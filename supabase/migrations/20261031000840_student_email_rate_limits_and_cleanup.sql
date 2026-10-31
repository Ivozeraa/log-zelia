
-- A school's shared network may generate many legitimate sessions.
-- Per-student issuance still limits to 3 codes/hour and 6 codes/day.
create or replace function public.aluno_email_gate_internal(p_chave_ip text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_now timestamptz := clock_timestamp();
begin
  if length(coalesce(p_chave_ip,'')) <> 64 then return false; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('aluno-email-ip:' || p_chave_ip,0));
  if (select count(*) from public.aluno_email_tentativas_ip
      where chave_ip=p_chave_ip and criado_em>v_now-interval '5 minutes') >= 120 then
    return false;
  end if;
  if (select count(*) from public.aluno_email_tentativas_ip
      where chave_ip=p_chave_ip and criado_em>v_now-interval '1 hour') >= 500 then
    return false;
  end if;
  insert into public.aluno_email_tentativas_ip(chave_ip,criado_em) values(p_chave_ip,v_now);
  return true;
end;
$$;
revoke all on function public.aluno_email_gate_internal(text) from public, anon, authenticated;
grant execute on function public.aluno_email_gate_internal(text) to service_role;

-- Remove expired sensitive challenges and obsolete rate-limit rows daily.
select cron.schedule('logview-student-email-cleanup', '20 3 * * *',
  'delete from public.aluno_email_codigos where criado_em < now() - interval ''7 days''; delete from public.aluno_email_tentativas_ip where criado_em < now() - interval ''2 days'';');
