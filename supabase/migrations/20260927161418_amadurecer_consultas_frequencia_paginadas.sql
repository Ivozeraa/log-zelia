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

create or replace function public.get_frequencia_registros(
  p_data_inicio date,
  p_data_fim date,
  p_turma_id uuid default null,
  p_aluno_id uuid default null,
  p_search text default null,
  p_status text default null,
  p_tipo text default null,
  p_metodo text default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table(
  id uuid,
  data date,
  aluno_id uuid,
  aluno_nome text,
  matricula text,
  turma_id uuid,
  turma_nome text,
  ponto_id uuid,
  ponto_nome text,
  tipo text,
  metodo text,
  status text,
  registrado_em timestamptz,
  confidence_score numeric,
  total_count bigint
)
language sql
stable
security invoker
set search_path to ''
as $function$
  with base as (
    select
      r.id,
      r.data,
      r.aluno_id,
      a.nome as aluno_nome,
      a.matricula,
      a.turma_id,
      t.nome as turma_nome,
      r.ponto_id,
      pv.nome as ponto_nome,
      r.tipo,
      r.metodo,
      r.status,
      r.registrado_em,
      r.confidence_score
    from public.registros_acesso r
    join public.alunos a on a.id = r.aluno_id
    join public.turmas t on t.id = a.turma_id
    left join public.pontos_verificacao pv on pv.id = r.ponto_id
    where r.escola_id = (select private.current_user_school_id())
      and r.data between p_data_inicio and p_data_fim
      and (p_turma_id is null or a.turma_id = p_turma_id)
      and (p_aluno_id is null or a.id = p_aluno_id)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or a.nome ilike '%' || trim(p_search) || '%'
        or coalesce(a.matricula, '') ilike '%' || trim(p_search) || '%'
      )
      and (nullif(trim(coalesce(p_status, '')), '') is null or r.status = p_status)
      and (nullif(trim(coalesce(p_tipo, '')), '') is null or r.tipo = p_tipo)
      and (nullif(trim(coalesce(p_metodo, '')), '') is null or r.metodo = p_metodo)
  )
  select base.*, count(*) over() as total_count
  from base
  order by data desc, registrado_em desc
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

create or replace function public.get_frequencia_resumo_alunos(
  p_data_inicio date,
  p_data_fim date,
  p_turma_id uuid default null,
  p_search text default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table(
  aluno_id uuid,
  aluno_nome text,
  matricula text,
  turma_id uuid,
  turma_nome text,
  dias_com_entrada bigint,
  entradas bigint,
  saidas bigint,
  ultimo_registro timestamptz,
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
  base as (
    select
      a.id as aluno_id,
      a.nome as aluno_nome,
      a.matricula,
      a.turma_id,
      t.nome as turma_nome,
      count(distinct r.data) filter (where r.tipo = 'entrada') as dias_com_entrada,
      count(r.id) filter (where r.tipo = 'entrada') as entradas,
      count(r.id) filter (where r.tipo = 'saida') as saidas,
      max(r.registrado_em) as ultimo_registro
    from public.alunos a
    join public.turmas t on t.id = a.turma_id
    left join minhas_turmas mt on mt.turma_id = a.turma_id
    left join public.registros_acesso r
      on r.aluno_id = a.id
      and r.escola_id = (select private.current_user_school_id())
      and r.data between p_data_inicio and p_data_fim
      and r.status = 'registrado'
    where a.escola_id = (select private.current_user_school_id())
      and ((select private.current_user_role_id()) in (1,2,3) or mt.turma_id is not null)
      and (p_turma_id is null or a.turma_id = p_turma_id)
      and (
        nullif(trim(coalesce(p_search, '')), '') is null
        or a.nome ilike '%' || trim(p_search) || '%'
        or coalesce(a.matricula, '') ilike '%' || trim(p_search) || '%'
      )
    group by a.id, a.nome, a.matricula, a.turma_id, t.nome
  )
  select base.*, count(*) over() as total_count
  from base
  order by turma_nome, aluno_nome
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

create or replace function public.get_frequencia_resumo_turmas(
  p_data_inicio date,
  p_data_fim date,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table(
  turma_id uuid,
  turma_nome text,
  total_alunos bigint,
  alunos_com_entrada bigint,
  entradas bigint,
  saidas bigint,
  ultimo_registro timestamptz,
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
  base as (
    select
      t.id as turma_id,
      t.nome as turma_nome,
      count(distinct a.id) as total_alunos,
      count(distinct a.id) filter (where r.id is not null and r.tipo = 'entrada') as alunos_com_entrada,
      count(r.id) filter (where r.tipo = 'entrada') as entradas,
      count(r.id) filter (where r.tipo = 'saida') as saidas,
      max(r.registrado_em) as ultimo_registro
    from public.turmas t
    left join minhas_turmas mt on mt.turma_id = t.id
    left join public.alunos a on a.turma_id = t.id and a.escola_id = (select private.current_user_school_id())
    left join public.registros_acesso r
      on r.aluno_id = a.id
      and r.escola_id = (select private.current_user_school_id())
      and r.data between p_data_inicio and p_data_fim
      and r.status = 'registrado'
    where t.escola_id = (select private.current_user_school_id())
      and ((select private.current_user_role_id()) in (1,2,3) or mt.turma_id is not null)
    group by t.id, t.nome
  )
  select base.*, count(*) over() as total_count
  from base
  order by turma_nome
  limit least(greatest(coalesce(p_limit, 10), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$function$;

revoke execute on function public.get_frequencia_professor_paginada(date, uuid, text, integer, integer) from public, anon;
grant execute on function public.get_frequencia_professor_paginada(date, uuid, text, integer, integer) to authenticated;

revoke execute on function public.get_frequencia_professor_resumo(date, uuid) from public, anon;
grant execute on function public.get_frequencia_professor_resumo(date, uuid) to authenticated;

revoke execute on function public.get_frequencia_registros(date, date, uuid, uuid, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.get_frequencia_registros(date, date, uuid, uuid, text, text, text, text, integer, integer) to authenticated;

revoke execute on function public.get_frequencia_resumo_alunos(date, date, uuid, text, integer, integer) from public, anon;
grant execute on function public.get_frequencia_resumo_alunos(date, date, uuid, text, integer, integer) to authenticated;

revoke execute on function public.get_frequencia_resumo_turmas(date, date, integer, integer) from public, anon;
grant execute on function public.get_frequencia_resumo_turmas(date, date, integer, integer) to authenticated;
