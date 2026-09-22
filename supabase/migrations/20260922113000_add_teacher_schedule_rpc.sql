create or replace function public.logview_get_teacher_schedule(p_user_id uuid, p_escola_id uuid)
returns table (
  id uuid,
  day integer,
  slot integer,
  turma text,
  disciplina text,
  tipo text
)
language sql
stable
security invoker
set search_path = public
as $$
  with current_config as (
    select hc.id
    from public.horario_configuracoes hc
    where hc.escola_id = p_escola_id
    order by hc.ano_letivo desc, hc.semestre desc, hc.created_at desc
    limit 1
  ),
  professor as (
    select hp.id
    from public.horario_professores hp
    join current_config cc on cc.id = hp.configuracao_id
    where hp.usuario_id = p_user_id
    limit 1
  )
  select
    hg.id,
    hg.dia_semana::integer as day,
    hg.aula_numero::integer as slot,
    coalesce(t.nome, 'Turma') as turma,
    case
      when hg.tipo = 'fc' then 'Formação para a Cidadania'
      else coalesce(hd.nome, 'Disciplina')
    end as disciplina,
    hg.tipo
  from public.horario_grade_gerada hg
  join current_config cc on cc.id = hg.configuracao_id
  join professor hp on hp.id = hg.professor_id
  left join public.horario_config_turmas hct
    on hct.id = hg.config_turma_id
   and hct.configuracao_id = hg.configuracao_id
  left join public.turmas t
    on t.id = hct.turma_id
  left join public.horario_disciplinas hd
    on hd.id = hg.disciplina_id
   and hd.configuracao_id = hg.configuracao_id
  order by hg.dia_semana, hg.aula_numero;
$$;
