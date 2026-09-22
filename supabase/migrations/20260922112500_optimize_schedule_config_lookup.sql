create index if not exists idx_horario_configuracoes_escola_ordem
on public.horario_configuracoes (
  escola_id,
  ano_letivo desc,
  semestre desc,
  created_at desc
);

analyze public.horario_configuracoes;
