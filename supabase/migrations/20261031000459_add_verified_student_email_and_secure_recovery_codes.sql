
-- Public student email: only Edge Function service_role can access the challenge workflow.
alter table public.alunos
  add column if not exists email_verificado_em timestamptz;

create or replace function public.aluno_email_invalidar_verificacao()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if lower(btrim(coalesce(new.email, ''))) is distinct from lower(btrim(coalesce(old.email, ''))) then
    new.email_verificado_em := null;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_aluno_email_invalidar_verificacao on public.alunos;
create trigger trg_aluno_email_invalidar_verificacao
before update of email on public.alunos
for each row execute function public.aluno_email_invalidar_verificacao();

create table if not exists public.aluno_email_codigos (
  id uuid primary key default gen_random_uuid(),
  aluno_id uuid not null references public.alunos(id) on delete cascade,
  finalidade text not null check(finalidade in ('confirmar','recuperar')),
  email text not null,
  codigo_hash text not null,
  criado_em timestamptz not null default now(),
  expira_em timestamptz not null default (now() + interval '10 minutes'),
  tentativas integer not null default 0 check (tentativas between 0 and 5),
  consumido_em timestamptz,
  enviado boolean not null default false,
  chave_ip text not null
);
create index if not exists idx_aluno_email_codigos_aluno on public.aluno_email_codigos(aluno_id, finalidade, criado_em desc);
create index if not exists idx_aluno_email_codigos_ip on public.aluno_email_codigos(chave_ip, criado_em desc);
alter table public.aluno_email_codigos enable row level security;
revoke all on table public.aluno_email_codigos from public, anon, authenticated;

create table if not exists public.aluno_email_tentativas_ip (
  id bigint generated always as identity primary key,
  chave_ip text not null,
  criado_em timestamptz not null default now()
);
create index if not exists idx_aluno_email_tentativas_ip on public.aluno_email_tentativas_ip(chave_ip, criado_em desc);
alter table public.aluno_email_tentativas_ip enable row level security;
revoke all on table public.aluno_email_tentativas_ip from public, anon, authenticated;
revoke all on sequence public.aluno_email_tentativas_ip_id_seq from public, anon, authenticated;

-- Gate is atomic for a given hashed IP. Run for every exposed action (including invalid accounts).
create or replace function public.aluno_email_gate_internal(p_chave_ip text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_now timestamptz := clock_timestamp();
begin
  if length(coalesce(p_chave_ip,'')) <> 64 then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('aluno-email-ip:' || p_chave_ip,0));
  if (select count(*) from public.aluno_email_tentativas_ip
      where chave_ip=p_chave_ip and criado_em>v_now-interval '5 minutes') >= 20 then
    return false;
  end if;
  insert into public.aluno_email_tentativas_ip(chave_ip,criado_em) values(p_chave_ip,v_now);
  return true;
end; $$;

create or replace function public.aluno_email_emitir_internal(
  p_aluno_id uuid, p_finalidade text, p_email text, p_codigo_hash text, p_chave_ip text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_now timestamptz:=clock_timestamp(); v_id uuid;
begin
  if p_finalidade not in ('confirmar','recuperar')
     or length(coalesce(p_email,''))>254 or p_email is null
     or length(coalesce(p_codigo_hash,''))<>64
     or length(coalesce(p_chave_ip,''))<>64 then return null; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('aluno-email:'||p_aluno_id::text,0));
  if not exists(select 1 from public.alunos where id=p_aluno_id) then return null; end if;
  if p_finalidade='recuperar' and not exists(
      select 1 from public.alunos
      where id=p_aluno_id and email_verificado_em is not null and lower(btrim(email))=lower(btrim(p_email))
  ) then return null; end if;
  if exists(select 1 from public.aluno_email_codigos
      where aluno_id=p_aluno_id and finalidade=p_finalidade and criado_em > v_now-interval '2 minutes')
     or (select count(*) from public.aluno_email_codigos
      where aluno_id=p_aluno_id and criado_em > v_now-interval '1 hour') >= 3
     or (select count(*) from public.aluno_email_codigos
      where aluno_id=p_aluno_id and criado_em > v_now-interval '1 day') >= 6
     or (select count(*) from public.aluno_email_codigos
      where chave_ip=p_chave_ip and criado_em > v_now-interval '1 hour') >= 15
  then return null; end if;
  insert into public.aluno_email_codigos(aluno_id,finalidade,email,codigo_hash,chave_ip,criado_em,expira_em)
  values (p_aluno_id,p_finalidade,lower(btrim(p_email)),p_codigo_hash,p_chave_ip,v_now,v_now+interval '10 minutes')
  returning id into v_id;
  return v_id;
end; $$;

create or replace function public.aluno_email_marcar_envio_internal(p_id uuid, p_enviado boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.aluno_email_codigos
  set enviado = p_enviado, consumido_em = case when p_enviado then consumido_em else clock_timestamp() end
  where id=p_id and consumido_em is null;
end; $$;

create or replace function public.aluno_email_concluir_internal(
  p_aluno_id uuid, p_finalidade text, p_email text, p_codigo_hash text, p_nova_senha text default null)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_reg public.aluno_email_codigos%rowtype; v_now timestamptz:=clock_timestamp();
begin
  if p_finalidade not in ('confirmar','recuperar') or length(coalesce(p_codigo_hash,''))<>64 then return false; end if;
  if p_finalidade='recuperar' and (length(coalesce(p_nova_senha,''))<8 or length(p_nova_senha)>128) then return false; end if;
  select * into v_reg from public.aluno_email_codigos
  where aluno_id=p_aluno_id and finalidade=p_finalidade and email=lower(btrim(p_email))
  order by criado_em desc limit 1 for update;
  if not found or v_reg.consumido_em is not null or not v_reg.enviado
    or v_reg.expira_em <= v_now or v_reg.tentativas >= 5 then return false; end if;
  if v_reg.codigo_hash is distinct from p_codigo_hash then
    update public.aluno_email_codigos set tentativas=tentativas+1 where id=v_reg.id;
    return false;
  end if;
  if p_finalidade='confirmar' then
    update public.alunos set email=lower(btrim(p_email)), email_verificado_em=v_now where id=p_aluno_id;
    if not found then return false; end if;
  else
    update public.alunos set
      senha_hash=pg_catalog.encode(extensions.digest(p_nova_senha,'sha256'),'hex'),
      primeiro_acesso=false
    where id=p_aluno_id and email_verificado_em is not null and lower(btrim(email))=lower(btrim(p_email));
    if not found then return false; end if;
  end if;
  update public.aluno_email_codigos set consumido_em=v_now where id=v_reg.id;
  return true;
end; $$;

revoke all on function public.aluno_email_gate_internal(text) from public, anon, authenticated;
revoke all on function public.aluno_email_emitir_internal(uuid,text,text,text,text) from public, anon, authenticated;
revoke all on function public.aluno_email_marcar_envio_internal(uuid,boolean) from public, anon, authenticated;
revoke all on function public.aluno_email_concluir_internal(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.aluno_email_gate_internal(text) to service_role;
grant execute on function public.aluno_email_emitir_internal(uuid,text,text,text,text) to service_role;
grant execute on function public.aluno_email_marcar_envio_internal(uuid,boolean) to service_role;
grant execute on function public.aluno_email_concluir_internal(uuid,text,text,text,text) to service_role;
grant select, insert, update, delete on public.aluno_email_codigos to service_role;
grant select, insert, update, delete on public.aluno_email_tentativas_ip to service_role;
grant usage, select on sequence public.aluno_email_tentativas_ip_id_seq to service_role;
