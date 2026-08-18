BEGIN;

-- O trigger de integridade roda durante INSERT/UPDATE de ocorrencias.
-- Ele precisa executar como DEFINER para conseguir chamar a função privada
-- de validação sem conceder EXECUTE direto aos usuários autenticados.
CREATE OR REPLACE FUNCTION public.validate_ocorrencia_school_integrity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private'
AS $function$
begin
  perform private.assert_same_school(
    new.escola_id,
    new.aluno_id,
    new.turma_id,
    new.professor_id,
    null
  );
  return new;
end;
$function$;

ALTER FUNCTION public.validate_ocorrencia_school_integrity() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.validate_ocorrencia_school_integrity() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_ocorrencia_school_integrity() TO authenticated, service_role;

COMMIT;
