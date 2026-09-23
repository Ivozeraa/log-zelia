create index if not exists idx_ocorrencias_escola_data
on public.ocorrencias (escola_id, data_ocorrido desc);

analyze public.ocorrencias;
