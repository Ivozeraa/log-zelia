-- Add lifecycle status to schools so the platform admin can activate or deactivate a tenant.
alter table public.escolas
  add column if not exists ativo boolean not null default true;

update public.escolas
set ativo = true
where ativo is null;
