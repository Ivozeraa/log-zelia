begin;

drop index if exists public.idx_pontos_verificacao_escola_id;

drop policy if exists "registros_acesso_management_select" on public.registros_acesso;
drop policy if exists "registros_acesso_teacher_select" on public.registros_acesso;

create policy "registros_acesso_select"
on public.registros_acesso for select to authenticated
using (
  (select private.current_user_is_global_admin())
  or (
    escola_id = (select private.current_user_school_id())
    and (
      (select private.current_user_role_id()) in (2, 3)
      or (
        (select private.current_user_role_id()) = 4
        and (select private.teacher_can_view_student(aluno_id))
      )
    )
  )
);

commit;