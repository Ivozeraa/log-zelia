alter table public.turmas
  add constraint turmas_school_required
  check (escola_id is not null) not valid;

alter table public.turmas
  validate constraint turmas_school_required;

alter table public.alunos
  add constraint alunos_school_required
  check (escola_id is not null) not valid;

alter table public.alunos
  validate constraint alunos_school_required;

alter table public.ocorrencias
  add constraint ocorrencias_school_required
  check (escola_id is not null) not valid;

alter table public.ocorrencias
  validate constraint ocorrencias_school_required;
