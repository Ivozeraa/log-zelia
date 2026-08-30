CREATE OR REPLACE FUNCTION public.enforce_status_aluno_progressao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  total_suspensoes int;
begin
  select count(*) into total_suspensoes
  from public.ocorrencias
  where aluno_id = NEW.id
    and categoria = 'suspensao';

  if total_suspensoes >= 3 then
    NEW.status := 'expulso';
  elsif total_suspensoes >= 1 then
    NEW.status := 'suspenso';
  else
    NEW.status := 'normal';
  end if;

  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_status_aluno_progressao ON public.alunos;
CREATE TRIGGER trg_enforce_status_aluno_progressao
BEFORE UPDATE OF status ON public.alunos
FOR EACH ROW
EXECUTE FUNCTION public.enforce_status_aluno_progressao();

UPDATE public.alunos a
SET status = CASE
  WHEN s.total_suspensoes >= 3 THEN 'expulso'::status_aluno_enum
  WHEN s.total_suspensoes >= 1 THEN 'suspenso'::status_aluno_enum
  ELSE 'normal'::status_aluno_enum
END
FROM (
  SELECT a2.id,
         count(o.id) FILTER (WHERE o.categoria = 'suspensao') AS total_suspensoes
  FROM public.alunos a2
  LEFT JOIN public.ocorrencias o ON o.aluno_id = a2.id
  GROUP BY a2.id
) s
WHERE a.id = s.id;
