-- Global platform branding
create table if not exists public.logview_config (
  id integer primary key default 1 check (id = 1),
  nome_aplicacao text not null default 'LogView',
  updated_at timestamptz not null default now()
);

alter table public.logview_config enable row level security;

drop policy if exists "authenticated_select_logview_config" on public.logview_config;
drop policy if exists "super_admin_insert_logview_config" on public.logview_config;
drop policy if exists "super_admin_update_logview_config" on public.logview_config;

create policy "authenticated_select_logview_config"
on public.logview_config
for select
to authenticated
using (true);

create policy "super_admin_insert_logview_config"
on public.logview_config
for insert
to authenticated
with check ((select private.current_user_role_id()) = 1);

create policy "super_admin_update_logview_config"
on public.logview_config
for update
to authenticated
using ((select private.current_user_role_id()) = 1)
with check ((select private.current_user_role_id()) = 1);

insert into public.logview_config (id, nome_aplicacao)
values (1, 'LogView')
on conflict (id) do nothing;
