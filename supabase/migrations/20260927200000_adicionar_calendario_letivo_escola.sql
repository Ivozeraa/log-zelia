create table if not exists public.calendario_letivo (
  id uuid primary key default gen_random_uuid(),
  escola_id uuid not null references public.escolas(id) on delete cascade,
  data date not null,
  tipo text not null default 'nao_letivo'
    check (tipo in ('feriado','recesso','nao_letivo','evento_letivo')),
  nome text not null,
  descricao text,
  eh_letivo boolean not null default false,
  created_by uuid references public.usuarios(id) on delete set null,
  updated_by uuid references public.usuarios(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint calendario_letivo_escola_data_key unique (escola_id, data)
);

create index if not exists idx_calendario_letivo_escola_data on public.calendario_letivo (escola_id, data);
create index if not exists idx_calendario_letivo_created_by on public.calendario_letivo (created_by);
create index if not exists idx_calendario_letivo_updated_by on public.calendario_letivo (updated_by);

alter table public.calendario_letivo enable row level security;

drop policy if exists calendario_letivo_select on public.calendario_letivo;
drop policy if exists calendario_letivo_insert on public.calendario_letivo;
drop policy if exists calendario_letivo_update on public.calendario_letivo;
drop policy if exists calendario_letivo_delete on public.calendario_letivo;

create policy calendario_letivo_select on public.calendario_letivo for select to authenticated
using ((select private.current_user_is_global_admin()) or escola_id = (select private.current_user_school_id()));

create policy calendario_letivo_insert on public.calendario_letivo for insert to authenticated
with check ((select private.current_user_is_global_admin())
  or (escola_id = (select private.current_user_school_id()) and (select private.current_user_role_id()) in (2,3)));

create policy calendario_letivo_update on public.calendario_letivo for update to authenticated
using ((select private.current_user_is_global_admin())
  or (escola_id = (select private.current_user_school_id()) and (select private.current_user_role_id()) in (2,3)))
with check ((select private.current_user_is_global_admin())
  or (escola_id = (select private.current_user_school_id()) and (select private.current_user_role_id()) in (2,3)));

create policy calendario_letivo_delete on public.calendario_letivo for delete to authenticated
using ((select private.current_user_is_global_admin())
  or (escola_id = (select private.current_user_school_id()) and (select private.current_user_role_id()) in (2,3)));

drop function if exists public.get_frequencia_calendario_aluno(uuid,date,date);

create function public.get_frequencia_calendario_aluno(
  p_aluno_id uuid, p_data_inicio date, p_data_fim date
)
returns table(
  data date, entrada timestamptz, saida timestamptz, status text,
  eh_dia_util boolean, eh_dia_letivo boolean,
  calendario_tipo text, calendario_nome text
)
language sql stable security invoker set search_path = ''
as $function$
  with aluno_permitido as (
    select a.id, a.turma_id
    from public.alunos a
    where a.id = p_aluno_id
      and a.escola_id = (select private.current_user_school_id())
      and (
        (select private.current_user_role_id()) in (1,2,3)
        or exists (
          select 1
          from public.horario_professores hp
          join public.horario_professor_turma hpt on hpt.professor_id = hp.id
          join public.horario_config_turmas hct on hct.id = hpt.config_turma_id
          where hp.usuario_id = (select auth.uid())
            and hct.escola_id = (select private.current_user_school_id())
            and hct.turma_id = a.turma_id
        )
      )
  ),
  dias as (
    select gs::date as data
    from generate_series(
      greatest(p_data_inicio, p_data_fim - 92),
      least(p_data_fim, p_data_inicio + 92),
      interval '1 day'
    ) gs
  ),
  eventos as (
    select r.data,
      min(r.registrado_em) filter (where r.tipo='entrada' and r.status='registrado') as entrada,
      max(r.registrado_em) filter (where r.tipo='saida' and r.status='registrado') as saida
    from public.registros_acesso r
    join aluno_permitido ap on ap.id = r.aluno_id
    where r.escola_id = (select private.current_user_school_id())
      and r.data between greatest(p_data_inicio,p_data_fim-92)
                     and least(p_data_fim,p_data_inicio+92)
    group by r.data
  )
  select d.data, e.entrada, e.saida,
    case
      when d.data > (now() at time zone 'America/Fortaleza')::date then 'futuro'
      when coalesce(c.eh_letivo, extract(isodow from d.data) between 1 and 5)=false then 'nao_letivo'
      when e.entrada is not null then 'presente'
      else 'falta'
    end,
    extract(isodow from d.data) between 1 and 5,
    coalesce(c.eh_letivo, extract(isodow from d.data) between 1 and 5),
    c.tipo, c.nome
  from dias d
  cross join aluno_permitido ap
  left join eventos e on e.data=d.data
  left join public.calendario_letivo c
    on c.escola_id=(select private.current_user_school_id()) and c.data=d.data
  order by d.data;
$function$;

revoke execute on function public.get_frequencia_calendario_aluno(uuid,date,date) from public, anon;
grant execute on function public.get_frequencia_calendario_aluno(uuid,date,date) to authenticated;