begin;

create or replace function public.get_frequencia_professor(p_data date)
returns table (
  aluno_id uuid,
  aluno_nome text,
  turma_id uuid,
  turma_nome text,
  entrada timestamptz,
  saida timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
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
  )
  select
    a.id,
    a.nome,
    a.turma_id,
    t.nome,
    e.entrada,
    e.saida
  from public.alunos a
  join public.turmas t on t.id = a.turma_id
  left join minhas_turmas mt on mt.turma_id = a.turma_id
  left join eventos e on e.aluno_id = a.id
  where a.escola_id = (select private.current_user_school_id())
    and (
      (select private.current_user_role_id()) in (1, 2, 3)
      or mt.turma_id is not null
    )
  order by t.nome, a.nome;
$$;

revoke execute on function public.get_frequencia_professor(date) from public, anon;
grant execute on function public.get_frequencia_professor(date) to authenticated;

commit;
