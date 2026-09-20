-- Optimize professor schedule RLS by evaluating auth/user context once per query.
create or replace function private.current_user_role_id()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select u.role_id
  from public.usuarios u
  where u.id = (select auth.uid())
  limit 1;
$$;

drop policy if exists "horario_configuracoes_professor_select" on public.horario_configuracoes;
create policy "horario_configuracoes_professor_select"
on public.horario_configuracoes
for select
to authenticated
using (
  (select private.current_user_role_id()) = 4
  and escola_id = (select private.current_user_school_id())
);

drop policy if exists "horario_config_turmas_professor_select" on public.horario_config_turmas;
create policy "horario_config_turmas_professor_select"
on public.horario_config_turmas
for select
to authenticated
using (
  (select private.current_user_role_id()) = 4
  and exists (
    select 1
    from public.horario_configuracoes hc
    where hc.id = horario_config_turmas.configuracao_id
      and hc.escola_id = (select private.current_user_school_id())
  )
);

drop policy if exists "horario_disciplinas_professor_select" on public.horario_disciplinas;
create policy "horario_disciplinas_professor_select"
on public.horario_disciplinas
for select
to authenticated
using (
  (select private.current_user_role_id()) = 4
  and exists (
    select 1
    from public.horario_configuracoes hc
    where hc.id = horario_disciplinas.configuracao_id
      and hc.escola_id = (select private.current_user_school_id())
  )
);

drop policy if exists "horario_grade_gerada_professor_select" on public.horario_grade_gerada;
create policy "horario_grade_gerada_professor_select"
on public.horario_grade_gerada
for select
to authenticated
using (
  (select private.current_user_role_id()) = 4
  and exists (
    select 1
    from public.horario_professores hp
    where hp.id = horario_grade_gerada.professor_id
      and hp.usuario_id = (select auth.uid())
      and hp.configuracao_id = horario_grade_gerada.configuracao_id
  )
);

drop policy if exists "horario_professores_professor_select" on public.horario_professores;
create policy "horario_professores_professor_select"
on public.horario_professores
for select
to authenticated
using (usuario_id = (select auth.uid()));
