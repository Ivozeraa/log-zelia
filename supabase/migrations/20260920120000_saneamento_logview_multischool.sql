-- Saneamento da arquitetura multi-escola antes da próxima camada do LogView.
-- Inicializa escolas existentes sem configuração, preserva as já configuradas,
-- registra automaticamente o ator da auditoria e otimiza as políticas RLS.

insert into public.logview_escola_config (escola_id, cor_primaria, cor_secundaria, versao_id, plano_id)
select e.id, '#16a34a', '#0f172a', v.id, p.id
from public.escolas e
cross join lateral (
  select id from public.logview_versoes
  where ativa = true order by created_at asc limit 1
) v
cross join lateral (
  select id from public.logview_planos
  where chave = 'basico' and ativo = true limit 1
) p
where not exists (
  select 1 from public.logview_escola_config c where c.escola_id = e.id
);

insert into public.logview_escola_recursos (escola_id, recurso_id, habilitado)
select c.escola_id, pr.recurso_id, pr.habilitado
from public.logview_escola_config c
join public.logview_plano_recursos pr on pr.plano_id = c.plano_id
where c.plano_id is not null
  and not exists (
    select 1 from public.logview_escola_recursos er
    where er.escola_id = c.escola_id and er.recurso_id = pr.recurso_id
  );

alter table public.logview_auditoria alter column usuario_id set default auth.uid();

drop policy if exists "super_admin_insert_auditoria" on public.logview_auditoria;
create policy "super_admin_insert_auditoria" on public.logview_auditoria for insert to authenticated
with check (exists (
  select 1 from public.usuarios u
  where u.id = (select auth.uid()) and u.role_id = 1 and u.escola_id is null
));

drop policy if exists "super_admin_select_auditoria" on public.logview_auditoria;
create policy "super_admin_select_auditoria" on public.logview_auditoria for select to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.id = (select auth.uid()) and u.role_id = 1 and u.escola_id is null
));

drop policy if exists "super_admin_all_logview_escola_config" on public.logview_escola_config;
create policy "super_admin_all_logview_escola_config" on public.logview_escola_config for all to authenticated
using (exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.role_id = 1))
with check (exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.role_id = 1));

drop policy if exists "super_admin_all_logview_escola_recursos" on public.logview_escola_recursos;
create policy "super_admin_all_logview_escola_recursos" on public.logview_escola_recursos for all to authenticated
using (exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.role_id = 1))
with check (exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.role_id = 1));

drop policy if exists "super_admin_all_logview_recursos" on public.logview_recursos;
create policy "super_admin_all_logview_recursos" on public.logview_recursos for all to authenticated
using (exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.role_id = 1))
with check (exists (select 1 from public.usuarios u where u.id = (select auth.uid()) and u.role_id = 1));

drop policy if exists "logview_planos_select_authenticated" on public.logview_planos;
create policy "logview_planos_select_authenticated" on public.logview_planos for select to authenticated
using (
  ativo or exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.role_id = 1
  )
);

drop policy if exists "logview_plano_recursos_select_authenticated" on public.logview_plano_recursos;
create policy "logview_plano_recursos_select_authenticated" on public.logview_plano_recursos for select to authenticated
using (
  exists (
    select 1 from public.logview_planos p
    where p.id = logview_plano_recursos.plano_id and p.ativo
  )
  or exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.role_id = 1
  )
);

drop policy if exists "school users can view own config" on public.logview_escola_config;
create policy "school users can view own config" on public.logview_escola_config for select to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.escola_id = logview_escola_config.escola_id
  )
  or exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.role_id = 1
  )
);

drop policy if exists "school users can view own resources" on public.logview_escola_recursos;
create policy "school users can view own resources" on public.logview_escola_recursos for select to authenticated
using (
  exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.escola_id = logview_escola_recursos.escola_id
  )
  or exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.role_id = 1
  )
);

drop policy if exists "authenticated users can view resource catalog" on public.logview_recursos;
create policy "authenticated users can view resource catalog" on public.logview_recursos for select to authenticated
using (ativo = true);
