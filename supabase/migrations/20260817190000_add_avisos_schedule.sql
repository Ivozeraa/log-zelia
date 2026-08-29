alter table public.avisos
  add column if not exists inicio_em timestamptz,
  add column if not exists fim_em timestamptz;

create index if not exists avisos_janela_publicacao_idx
  on public.avisos (publicado, inicio_em, fim_em, criado_em desc);

alter table public.avisos
  drop constraint if exists avisos_periodo_valido;

alter table public.avisos
  add constraint avisos_periodo_valido
  check (fim_em is null or inicio_em is null or fim_em > inicio_em);

comment on column public.avisos.inicio_em is 'Momento a partir do qual o aviso pode ser exibido.';
comment on column public.avisos.fim_em is 'Momento a partir do qual o aviso deixa de ser exibido.';

 drop policy if exists "usuarios veem avisos publicados" on public.avisos;
create policy "usuarios veem avisos publicados"
on public.avisos
for select
to authenticated
using (
  publicado = true
  and (inicio_em is null or inicio_em <= now())
  and (fim_em is null or fim_em > now())
);
