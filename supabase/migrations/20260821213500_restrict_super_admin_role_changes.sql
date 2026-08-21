CREATE OR REPLACE FUNCTION private.prevent_non_admin_role_promotion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NEW.role_id IS DISTINCT FROM OLD.role_id
     AND (NEW.role_id = 1 OR OLD.role_id = 1)
     AND NOT private.current_user_is_global_admin()
  THEN
    RAISE EXCEPTION 'Somente o administrador global pode alterar usuários para ou a partir de Super Admin.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_non_admin_role_promotion ON public.usuarios;
CREATE TRIGGER trg_prevent_non_admin_role_promotion
BEFORE UPDATE OF role_id ON public.usuarios
FOR EACH ROW
EXECUTE FUNCTION private.prevent_non_admin_role_promotion();

REVOKE ALL ON FUNCTION private.prevent_non_admin_role_promotion() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.prevent_non_admin_role_promotion() TO authenticated;
