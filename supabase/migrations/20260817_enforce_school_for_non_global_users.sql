alter table public.usuarios
  add constraint usuarios_non_global_requires_school
  check (role_id = 1 or escola_id is not null) not valid;

alter table public.usuarios
  validate constraint usuarios_non_global_requires_school;
