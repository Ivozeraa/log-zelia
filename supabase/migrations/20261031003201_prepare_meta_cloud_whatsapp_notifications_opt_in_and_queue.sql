
-- WhatsApp Cloud API: explicit opt-in and per-school kill switch (OFF by default).
alter table public.alunos add column if not exists responsavel_whatsapp_opt_in_em timestamptz;
alter table public.alunos add column if not exists responsavel_whatsapp_opt_in_por uuid;
alter table public.escolas add column if not exists whatsapp_notificacoes_ativas boolean not null default false;

-- Consent does not transfer to an edited phone number.
create or replace function public.invalidate_guardian_whatsapp_consent()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if regexp_replace(coalesce(new.responsavel_whatsapp,''), '[^0-9]', '', 'g')
    is distinct from regexp_replace(coalesce(old.responsavel_whatsapp,''), '[^0-9]', '', 'g')
  then
    new.responsavel_whatsapp_opt_in_em := null;
    new.responsavel_whatsapp_opt_in_por := null;
  end if;
  return new;
end $$;
drop trigger if exists tr_invalidate_guardian_whatsapp_consent on public.alunos;
create trigger tr_invalidate_guardian_whatsapp_consent
before update of responsavel_whatsapp on public.alunos
for each row execute function public.invalidate_guardian_whatsapp_consent();

alter table public.whatsapp_queue add column if not exists tentativas int not null default 0;
alter table public.whatsapp_queue add column if not exists processando_em timestamptz;
alter table public.whatsapp_queue add column if not exists confirmado_em timestamptz;
alter table public.whatsapp_queue add column if not exists meta_message_id text;
alter table public.whatsapp_queue add column if not exists ultima_tentativa_em timestamptz;

-- Legacy Z-API queue is not to be replayed under a paid API.
update public.whatsapp_queue set status = 'cancelado_legado', erro = 'Fila antiga não migrada automaticamente para a Meta Cloud API.'
where status = 'pendente';

create unique index if not exists uq_whatsapp_queue_ocorrencia on public.whatsapp_queue(ocorrencia_id);
create unique index if not exists uq_whatsapp_queue_meta_id on public.whatsapp_queue(meta_message_id)
where meta_message_id is not null;
create index if not exists ix_whatsapp_queue_pending on public.whatsapp_queue(created_at)
where status = 'pendente';
alter table public.whatsapp_queue enable row level security;

-- Only queue future records when configured for school and consent was recorded.
create or replace function public.add_queue_ocorrencia()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.ocorrencia_origem_id is not null then return new; end if;
  if exists (
    select 1 from public.alunos a
    join public.escolas e on e.id = a.escola_id
    where a.id = new.aluno_id and a.escola_id = new.escola_id
      and e.whatsapp_notificacoes_ativas = true
      and a.responsavel_whatsapp_opt_in_em is not null
      and length(regexp_replace(coalesce(a.responsavel_whatsapp, ''),'[^0-9]','','g')) between 10 and 13
  ) then
    insert into public.whatsapp_queue(ocorrencia_id,status)
    values(new.id,'pendente') on conflict (ocorrencia_id) do nothing;
  end if;
  return new;
end $$;

-- Atomic worker claim, not exposed to the anon or authenticated roles.
create or replace function public.whatsapp_cloud_claim_internal(p_batch int default 10)
returns table(queue_id uuid, phone text)
language plpgsql security definer set search_path = ''
as $$
begin
  return query
  with ready as (
    select q.id, regexp_replace(coalesce(a.responsavel_whatsapp,''),'[^0-9]','','g') as digits
    from public.whatsapp_queue q
    join public.ocorrencias o on o.id=q.ocorrencia_id
    join public.alunos a on a.id=o.aluno_id and a.escola_id=o.escola_id
    join public.escolas e on e.id=o.escola_id
    where q.status='pendente' and q.tentativas=0 and e.whatsapp_notificacoes_ativas=true
      and a.responsavel_whatsapp_opt_in_em is not null
      and q.created_at > now()-interval '48 hours'
    order by q.created_at
    for update of q skip locked
    limit least(greatest(coalesce(p_batch,1),1),10)
  ), claimed as (
    update public.whatsapp_queue q
    set status='processando', tentativas=q.tentativas+1, processando_em=now(), ultima_tentativa_em=now()
    from ready r where q.id=r.id
    returning q.id, r.digits
  )
  select c.id,
    case
      when length(c.digits)=10 or length(c.digits)=11 then '55'||c.digits
      when length(c.digits)=12 or length(c.digits)=13 then c.digits
      else ''
    end from claimed c;
end $$;
-- A captured phone is re-checked in the worker; malformed numbers are never sent.

create or replace function public.whatsapp_cloud_mark_internal(
  p_id uuid, p_status text, p_message_id text default null, p_error text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('aceito','erro','revisar','ignorado') then return false; end if;
  update public.whatsapp_queue q set status=p_status,
    meta_message_id=case when p_status='aceito' then left(p_message_id,256) else q.meta_message_id end,
    erro=case when p_error is null then null else left(p_error,300) end,
    confirmado_em=case when p_status='aceito' then now() else null end
    where q.id=p_id and q.status='processando';
  return found;
end $$;

create or replace function public.whatsapp_cloud_status_internal(p_message_id text, p_status text)
returns boolean language plpgsql security definer set search_path = ''
as $$
begin
  if p_status not in ('sent','delivered','read','failed') or length(coalesce(p_message_id,''))>256 then return false; end if;
  update public.whatsapp_queue q
  set status=case p_status
    when 'sent' then 'enviado'
    when 'delivered' then 'entregue'
    when 'read' then 'lido'
    when 'failed' then 'erro'
  end
  where q.meta_message_id=p_message_id
    and q.status in ('aceito','enviado','entregue','lido')
    and (p_status='failed' or
      case q.status when 'aceito' then 0 when 'enviado' then 1 when 'entregue' then 2 when 'lido' then 3 else -1 end
      < case p_status when 'sent' then 1 when 'delivered' then 2 when 'read' then 3 end);
  return found;
end $$;

-- In-flight requests with unknown outcome should never be blindly replayed.
create or replace function public.whatsapp_cloud_reconcile_stuck_internal()
returns integer language plpgsql security definer set search_path = ''
as $$
declare affected int;
begin
  update public.whatsapp_queue set status='revisar', erro='Resultado desconhecido; conferir no painel Meta antes de reenviar.'
  where status='processando' and processando_em<now()-interval '15 minutes';
  get diagnostics affected = row_count;
  return affected;
end $$;
revoke all on function public.whatsapp_cloud_claim_internal(int) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_mark_internal(uuid,text,text,text) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_status_internal(text,text) from public, anon, authenticated;
revoke all on function public.whatsapp_cloud_reconcile_stuck_internal() from public, anon, authenticated;
grant execute on function public.whatsapp_cloud_claim_internal(int) to service_role;
grant execute on function public.whatsapp_cloud_mark_internal(uuid,text,text,text) to service_role;
grant execute on function public.whatsapp_cloud_status_internal(text,text) to service_role;
grant execute on function public.whatsapp_cloud_reconcile_stuck_internal() to service_role;
