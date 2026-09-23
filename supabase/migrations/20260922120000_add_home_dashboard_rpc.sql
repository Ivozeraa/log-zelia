create or replace function public.logview_get_home_dashboard(p_escola_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with all_occurrences as (
    select
      o.id,
      o.data_ocorrido,
      o.categoria,
      o.ocorrencia_origem_id,
      o.professor_id,
      o.professor_nome,
      o.turma_id
    from public.ocorrencias o
    where o.escola_id = p_escola_id
  ),
  origin_ids as (
    select distinct ocorrencia_origem_id as id
    from all_occurrences
    where categoria = 'suspensao'
      and ocorrencia_origem_id is not null
  ),
  consolidated as (
    select o.*
    from all_occurrences o
    left join origin_ids oi on oi.id = o.id
    where oi.id is null
  ),
  month_occurrences as (
    select *
    from consolidated
    where data_ocorrido >= date_trunc('month', current_date)::date
  ),
  professor_counts as (
    select
      professor_id as id,
      coalesce(max(professor_nome) filter (where professor_nome is not null), 'Professor') as nome,
      count(*)::integer as total
    from month_occurrences
    where professor_id is not null
    group by professor_id
  ),
  turma_counts as (
    select
      m.turma_id as id,
      coalesce(max(t.nome), 'Turma') as nome,
      count(*)::integer as total
    from month_occurrences m
    left join public.turmas t on t.id = m.turma_id
    where m.turma_id is not null
    group by m.turma_id
  )
  select jsonb_build_object(
    'ocorrencias',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', c.id,
            'data_ocorrido', c.data_ocorrido,
            'categoria', c.categoria,
            'ocorrencia_origem_id', c.ocorrencia_origem_id
          )
          order by c.data_ocorrido desc
        )
        from consolidated c
      ), '[]'::jsonb),
    'turmas',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', t.id, 'nome', t.nome)
          order by t.nome
        )
        from public.turmas t
        where t.escola_id = p_escola_id
      ), '[]'::jsonb),
    'ranking_professores',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', pc.id, 'nome', pc.nome, 'total', pc.total)
          order by pc.total desc, pc.nome asc
        )
        from professor_counts pc
      ), '[]'::jsonb),
    'ranking_turmas',
      coalesce((
        select jsonb_agg(
          jsonb_build_object('id', tc.id, 'nome', tc.nome, 'total', tc.total)
          order by tc.total desc, tc.nome asc
        )
        from turma_counts tc
      ), '[]'::jsonb)
  );
$$;
