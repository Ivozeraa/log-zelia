drop policy if exists "school logos insert super admin" on storage.objects;
drop policy if exists "school logos update super admin" on storage.objects;
drop policy if exists "school logos delete super admin" on storage.objects;

create policy "school logos insert super admin"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'school-logos'
  and (select private.current_user_role_id()) = 1
);

create policy "school logos update super admin"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'school-logos'
  and (select private.current_user_role_id()) = 1
)
with check (
  bucket_id = 'school-logos'
  and (select private.current_user_role_id()) = 1
);

create policy "school logos delete super admin"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'school-logos'
  and (select private.current_user_role_id()) = 1
);
