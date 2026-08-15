create or replace function public.current_user_role_id()
returns smallint
language sql
security definer
stable
set search_path = public
as $$
  select role_id from public.usuarios where id = auth.uid()
$$;

revoke all on function public.current_user_role_id() from public;
grant execute on function public.current_user_role_id() to authenticated;

drop policy if exists usuarios_update on public.usuarios;

create policy usuarios_update
on public.usuarios
for update
to authenticated
using (
  auth.uid() = id
  or public.current_user_role_id() in (1, 2, 3)
)
with check (
  auth.uid() = id
  or public.current_user_role_id() in (1, 2, 3)
);
