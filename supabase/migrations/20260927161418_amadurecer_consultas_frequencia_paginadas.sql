create or replace function public.get_frequencia_professor_paginada(
  p_data date,
  p_turma_id uuid default null,
  p_search text default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table(
  aluno_id uuid,
  aluno_nome text,
  turma_id uuid,
  turma_nome text,
  entrada timestamptz,
  saida timestamptz,
  total_count bigint
)
language sql
stable
security invoker
set search_path to ''
as $function$
  with minhas_turmas as (
    select distinct hct.turma_id
    from public.horario_professores hp
    join public.horario_professor_turma hpt on hpt.professor_id = hp.id
    join public.horario_config_turmas hct on hct.id = hpt.config_turma_id
    where hp.usuario_id = (select auth.uid())
      and hct.escola_id = (select private.current_user_school_id())
  ),
  eventos as (
    select
      r.aluno_id,
      min(r.registrado_em) filter (where r.tipo = 'entrada') as entrada,
      max(r.registrado_em) filter (where r.tipo = 'saida') as saida
    from public.registros_acesso r
    where r.data = p_data
      and r.status = 'registrado'
      and r.escola_id = (select private.current_user_school_id())
    group by r.aluno_id
  ),
  base as (
    select a.id as aluno_id, a.nome as aluno_nome, a.turma_id, t.nome as turma_nome, e.entrada, e.saida
    from public.alunos a
    join public.turmas t on t.id = a.turma_id
    left join minhas_turmas mt on mt.turma_id = a.turma_id
    left join eventos e on e.aluno_id = a.id
    where a.escola_id = (select private.current_user_school_id())
      and ((select private.current_user_role_id()) in (1,2,3) or mt.turma_id is not null)
      and (p_turma_id is null or a.turma_id = p_turma_id)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or a.nome ilike '%' || trim(p_search) || '%'
        or coalesce(a.matricula, '') ilike '%' || trim(p_search) || '%'
      )
  )
  select base.*, count(*) over() as total_count
  from base
  order by turma_nome, aluno_nome
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

create or replace function public.get_frequencia_professor_resumo(
  p_data date,
  p_turma_id uuid default null
)
returns table(
  total bigint,
  presentes bigint,
  com_saida bigint,
  nao_registrados bigint
)
language sql
stable
security invoker
set search_path to ''
as $function$
  with minhas_turmas as (
    select distinct hct.turma_id
    from public.horario_professores hp
    join public.horario_professor_turma hpt on hpt.professor_id = hp.id
    join public.horario_config_turmas hct on hct.id = hpt.config_turma_id
    where hp.usuario_id = (select auth.uid())
      and hct.escola_id = (select private.current_user_school_id())
  ),
  eventos as (
    select
      r.aluno_id,
      min(r.registrado_em) filter (where r.tipo = 'entrada') as entrada,
      max(r.registrado_em) filter (where r.tipo = 'saida') as saida
    from public.registros_acesso r
    where r.data = p_data
      and r.status = 'registrado'
      and r.escola_id = (select private.current_user_school_id())
    group by r.aluno_id
  ),
  base as (
    select e.entrada, e.saida
    from public.alunos a
    left join minhas_turmas mt on mt.turma_id = a.turma_id
    left join eventos e on e.aluno_id = a.id
    where a.escola_id = (select private.current_user_school_id())
      and ((select private.current_user_role_id()) in (1,2,3) or mt.turma_id is not null)
      and (p_turma_id is null or a.turma_id = p_turma_id)
  )
  select
    count(*) as total,
    count(*) filter (where entrada is not null and (saida is null or entrada > saida)) as presentes,
    count(*) filter (where saida is not null and (entrada is null or saida >= entrada)) as com_saida,
    count(*) filter (where entrada is null and saida is null) as nao_registrados
  from base;
$function$;

revoke execute on function public.get_frequencia_professor_paginada(date, uuid, text, integer, integer) from public, anon;
grant execute on function public.get_frequencia_professor_paginada(date, uuid, text, integer, integer) to authenticated;

revoke execute on function public.get_frequencia_professor_resumo(date, uuid) from public, anon;
grant execute on function public.get_frequencia_professor_resumo(date, uuid) to authenticated;
