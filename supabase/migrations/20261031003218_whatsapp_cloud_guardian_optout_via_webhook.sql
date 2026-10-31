
-- Support opt-out requests received through a verified Meta webhook.
create or replace function public.whatsapp_cloud_optout_internal(p_phone text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare v_digits text; v_local text; v_count int;
begin
  v_digits:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if left(v_digits,2) <> '55' or length(v_digits) not in (12,13) then return 0; end if;
  v_local:=substr(v_digits,3);
  update public.alunos set responsavel_whatsapp_opt_in_em=null, responsavel_whatsapp_opt_in_por=null
    where responsavel_whatsapp_opt_in_em is not null
      and regexp_replace(coalesce(responsavel_whatsapp,''),'[^0-9]','','g') in (v_digits,v_local);
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.whatsapp_cloud_optout_internal(text) from public, anon, authenticated;
grant execute on function public.whatsapp_cloud_optout_internal(text) to service_role;
