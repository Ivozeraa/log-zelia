begin;
create extension if not exists pg_cron with schema pg_catalog;
select cron.unschedule(jobid)
from cron.job
where jobname = 'logzelia-frequencia-saidas-automaticas';

select cron.schedule(
  'logzelia-frequencia-saidas-automaticas',
  '*/5 * * * *',
  $$select public.processar_saidas_automaticas_frequencia();$$
);
commit;