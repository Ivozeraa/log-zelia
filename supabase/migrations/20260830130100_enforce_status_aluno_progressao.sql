-- Mantém o status do aluno derivado do histórico de ocorrências.
-- Isso impede que o formulário de registro sobrescreva uma expulsão calculada pelo banco.

CREATE OR REPLACE FUNCTION public.enforce_status_aluno_progressao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  total_ocorrencias int;
  total_suspensoes_diretas int;
  total_suspensoes int;
begin
  select count(*) into total_ocorrencias
  from public.ocorrencias
  where aluno_id = NEW.id and categoria = 'ocorrencia';

  select count(*) into total_suspensoes_diretas
  from public.ocorrencias
  where aluno_id = NEW.id and categoria = 'suspensao';

  total_suspensoes := total_suspensoes_diretas + floor(total_ocorrencias / 3)::int;

  if total_suspensoes >= 2 then
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
