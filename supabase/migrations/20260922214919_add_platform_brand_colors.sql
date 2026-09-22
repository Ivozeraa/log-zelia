alter table public.logview_config
  add column if not exists cor_primaria text not null default '#4CA65A',
  add column if not exists cor_secundaria text not null default '#F2762E';

update public.logview_config
set cor_primaria = coalesce(nullif(cor_primaria, ''), '#4CA65A'),
    cor_secundaria = coalesce(nullif(cor_secundaria, ''), '#F2762E')
where id = 1;
