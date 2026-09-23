-- Keep school-scoped SELECT policies cheap by resolving the current
-- user's school once per statement instead of calling a row-dependent
-- authorization function for every returned row.

drop policy if exists "ocorrencias_select_same_school" on public.ocorrencias;
create policy "ocorrencias_select_same_school"
on public.ocorrencias
for select
to authenticated
using (
  (select private.current_user_is_global_admin())
  or escola_id = (select private.current_user_school_id())
);

drop policy if exists "turmas_select_same_school" on public.turmas;
create policy "turmas_select_same_school"
on public.turmas
for select
to authenticated
using (
  (select private.current_user_is_global_admin())
  or escola_id = (select private.current_user_school_id())
);

drop policy if exists "alunos_select_same_school" on public.alunos;
create policy "alunos_select_same_school"
on public.alunos
for select
to authenticated
using (
  (select private.current_user_is_global_admin())
  or escola_id = (select private.current_user_school_id())
);
