create or replace function public.get_frequencia_registros_resumo(
  p_data_inicio date,
  p_data_fim date,
  p_turma_id uuid default null,
  p_search text default null,
  p_status text default null,
  p_tipo text default null,
  p_metodo text default null
)
returns table(
  total_registros bigint,
  entradas bigint,
  saidas bigint,
  faciais bigint,
  manuais bigint,
  ultimo_registro timestamptz,
  primeiro_registro timestamptz
)
language sql
stable
security invoker
set search_path to ''
as $function$
  select
    count(*) as total_registros,
    count(*) filter (where r.tipo = 'entrada') as entradas,
    count(*) filter (where r.tipo = 'saida') as saidas,
    count(*) filter (where r.metodo = 'facial') as faciais,
    count(*) filter (where r.metodo = 'manual') as manuais,
    max(r.registrado_em) as ultimo_registro,
    min(r.registrado_em) as primeiro_registro
  from public.registros_acesso r
  join public.alunos a on a.id = r.aluno_id
  where r.escola_id = (select private.current_user_school_id())
    and r.data between p_data_inicio and p_data_fim
    and (p_turma_id is null or a.turma_id = p_turma_id)
    and (
      nullif(trim(coalesce(p_search, '')), '') is null
      or a.nome ilike '%' || trim(p_search) || '%'
      or coalesce(a.matricula, '') ilike '%' || trim(p_search) || '%'
    )
    and (nullif(trim(coalesce(p_status, '')), '') is null or r.status = p_status)
    and (nullif(trim(coalesce(p_tipo, '')), '') is null or r.tipo = p_tipo)
    and (nullif(trim(coalesce(p_metodo, '')), '') is null or r.metodo = p_metodo);
$function$;

revoke execute on function public.get_frequencia_registros_resumo(date, date, uuid, text, text, text, text) from public, anon;
grant execute on function public.get_frequencia_registros_resumo(date, date, uuid, text, text, text, text) to authenticated;
