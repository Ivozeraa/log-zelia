DROP POLICY IF EXISTS notificacoes_select_same_school ON public.notificacoes;
CREATE POLICY notificacoes_select_same_school
ON public.notificacoes
FOR SELECT
TO authenticated
USING (
  private.can_access_school(escola_id)
  AND (
    private.current_user_is_global_admin()
    OR usuario_id IS NULL
    OR usuario_id = (select auth.uid())
  )
);

DROP POLICY IF EXISTS notificacoes_update_same_school ON public.notificacoes;
CREATE POLICY notificacoes_update_same_school
ON public.notificacoes
FOR UPDATE
TO authenticated
USING (
  private.can_access_school(escola_id)
  AND (
    private.current_user_is_global_admin()
    OR usuario_id IS NULL
    OR usuario_id = (select auth.uid())
  )
)
WITH CHECK (
  private.can_access_school(escola_id)
  AND (
    private.current_user_is_global_admin()
    OR usuario_id IS NULL
    OR usuario_id = (select auth.uid())
  )
);
