alter table public.logview_escola_config
  add column if not exists nome_aplicacao text not null default 'LogView';

update public.logview_escola_config
set nome_aplicacao = coalesce(nullif(nome_aplicacao, ''), 'LogView')
where nome_aplicacao is null or nome_aplicacao = '';
