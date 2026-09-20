-- Prevent recursive RLS evaluation on public.usuarios.
-- The previous Super Admin policies queried usuarios directly from a
-- usuarios policy, causing PostgreSQL 42P17 infinite recursion.

drop policy if exists "super_admin_select_usuarios_global" on public.usuarios;
drop policy if exists "super_admin_update_usuarios_global" on public.usuarios;

create policy "super_admin_select_usuarios_global"
on public.usuarios
for select
to authenticated
using ((select private.current_user_is_global_admin()));

create policy "super_admin_update_usuarios_global"
on public.usuarios
for update
to authenticated
using ((select private.current_user_is_global_admin()))
with check ((select private.current_user_is_global_admin()));
