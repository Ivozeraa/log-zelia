CREATE OR REPLACE FUNCTION private.current_user_is_global_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.usuarios u
    WHERE u.id = (SELECT auth.uid())
      AND u.role_id = 1
  );
$function$;
