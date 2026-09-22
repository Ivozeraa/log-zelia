drop policy if exists "super_admin_insert_auditoria" on public.logview_auditoria;

create policy "authenticated_insert_auditoria"
on public.logview_auditoria
for insert
to authenticated
with check (
  (select private.current_user_role_id()) = 1
  and (
    escola_id is null
    or exists (
      select 1
      from public.usuarios u
      where u.id = (select auth.uid())
        and (u.escola_id is null or u.escola_id = logview_auditoria.escola_id)
    )
  )
);
