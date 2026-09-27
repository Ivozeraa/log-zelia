create or replace function public.get_frequencia_turmas()
returns table(id uuid, nome text)
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
  )
  select t.id, t.nome
  from public.turmas t
  left join minhas_turmas mt on mt.turma_id = t.id
  where t.escola_id = (select private.current_user_school_id())
    and ((select private.current_user_role_id()) in (1,2,3) or mt.turma_id is not null)
  order by t.nome;
$function$;

revoke execute on function public.get_frequencia_turmas() from public, anon;
grant execute on function public.get_frequencia_turmas() to authenticated;
