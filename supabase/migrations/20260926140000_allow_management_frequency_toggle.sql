begin;

drop policy if exists "school management can update frequency resource" on public.logview_escola_recursos;
create policy "school management can update frequency resource"
on public.logview_escola_recursos for update to authenticated
using (
  escola_id = (select private.current_user_school_id())
  and (select private.current_user_role_id()) in (2, 3)
  and exists (
    select 1
    from public.logview_recursos r
    where r.id = logview_escola_recursos.recurso_id
      and r.chave = 'frequencia'
  )
)
with check (
  escola_id = (select private.current_user_school_id())
  and (select private.current_user_role_id()) in (2, 3)
  and exists (
    select 1
    from public.logview_recursos r
    where r.id = logview_escola_recursos.recurso_id
      and r.chave = 'frequencia'
  )
);

commit;