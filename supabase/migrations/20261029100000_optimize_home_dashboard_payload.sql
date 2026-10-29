-- Dashboard retorna métricas já agregadas. Não transmite o histórico inteiro ao cliente.
-- Mantém a mesma regra de consolidação: a ocorrência de origem não é contada
-- novamente quando existe suspensão vinculada a ela.
create or replace function public.logview_get_home_dashboard(p_escola_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with reference_date as (
    select timezone('America/Fortaleza', now())::date as hoje
  ),
  all_occurrences as (
    select o.id, o.data_ocorrido, o.categoria, o.ocorrencia_origem_id,
           o.professor_id, o.professor_nome, o.turma_id
    from public.ocorrencias o
    where o.escola_id = p_escola_id
  ),
  origin_ids as (
    select distinct ocorrencia_origem_id as id
    from all_occurrences
    where categoria = 'suspensao' and ocorrencia_origem_id is not null
  ),
  consolidated as (
    select o.*
    from all_occurrences o
    left join origin_ids oi on oi.id = o.id
    where oi.id is null
  ),
  bounds as (
    select hoje,
           date_trunc('month', hoje)::date as start_of_month,
           (hoje - extract(dow from hoje)::int) as start_of_week
    from reference_date
  ),
  totals as (
    select count(*)::integer as total,
           count(*) filter (where c.data_ocorrido >= b.start_of_month)::integer as mes,
           count(*) filter (where c.data_ocorrido >= b.start_of_week)::integer as semana
    from consolidated c
    cross join bounds b
  ),
  week_counts as (
    select extract(dow from c.data_ocorrido)::int as dia, count(*)::integer as total
    from consolidated c cross join bounds b
    where c.data_ocorrido >= b.start_of_week
    group by 1
  ),
  month_occurrences as (
    select c.* from consolidated c cross join bounds b
    where c.data_ocorrido >= b.start_of_month
  ),
  professor_counts as (
    select professor_id as id,
           coalesce(max(professor_nome) filter (where professor_nome is not null), 'Professor') as nome,
           count(*)::integer as total
    from month_occurrences
    where professor_id is not null
    group by professor_id
  ),
  turma_counts as (
    select m.turma_id as id,
           coalesce(max(t.nome), 'Turma') as nome,
           count(*)::integer as total
    from month_occurrences m
    left join public.turmas t on t.id = m.turma_id
    where m.turma_id is not null
    group by m.turma_id
  )
  select jsonb_build_object(
    'totais', (select to_jsonb(t) from totals t),
    'grafico', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', (array['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'])[days.dia + 1],
          'ocorrencias', coalesce(w.total, 0)
        ) order by days.dia
      )
      from generate_series(0, 6) as days(dia)
      left join week_counts w on w.dia = days.dia
    ), '[]'::jsonb),
    'turmas', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome) order by t.nome)
      from public.turmas t
      where t.escola_id = p_escola_id
    ), '[]'::jsonb),
    'ranking_professores', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', pc.id, 'nome', pc.nome, 'total', pc.total)
        order by pc.total desc, pc.nome asc
      )
      from professor_counts pc
    ), '[]'::jsonb),
    'ranking_turmas', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', tc.id, 'nome', tc.nome, 'total', tc.total)
        order by tc.total desc, tc.nome asc
      )
      from turma_counts tc
    ), '[]'::jsonb)
  );
$$;
