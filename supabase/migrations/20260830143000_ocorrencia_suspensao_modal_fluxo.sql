-- A suspensão só passa a existir depois que o professor confirma no modal.
ALTER TABLE public.ocorrencias
  ADD COLUMN IF NOT EXISTS ocorrencia_origem_id uuid REFERENCES public.ocorrencias(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ocorrencias_origem_suspensao
  ON public.ocorrencias(ocorrencia_origem_id);

-- Status disciplinar considera apenas suspensões efetivamente registradas.
-- 1ª e 2ª suspensão: suspenso. 3ª suspensão: expulso.
CREATE OR REPLACE FUNCTION public.atualizar_status_aluno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  total_suspensoes int;
  novo_status status_aluno_enum;
  v_aluno_id uuid;
begin
  v_aluno_id := coalesce(NEW.aluno_id, OLD.aluno_id);

  select count(*) into total_suspensoes
  from public.ocorrencias
  where aluno_id = v_aluno_id
    and categoria = 'suspensao';

  if total_suspensoes >= 3 then
    novo_status := 'expulso';
  elsif total_suspensoes >= 1 then
    novo_status := 'suspenso';
  else
    novo_status := 'normal';
  end if;

  update public.alunos
  set status = novo_status
  where id = v_aluno_id;

  return NEW;
end;
$function$;

-- O fluxo de decisão deixa de depender da central de notificações.
DROP TRIGGER IF EXISTS trg_criar_notificacao_pdt_ocorrencia ON public.ocorrencias;

-- O formulário antigo possui uma inserção legada de "foi suspenso".
-- Bloqueamos somente essa mensagem para que a decisão aconteça exclusivamente pelo modal.
CREATE OR REPLACE FUNCTION public.bloquear_notificacao_legacy_suspensao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if coalesce(NEW.acao, '') = ''
     and NEW.mensagem like '% foi suspenso.' then
    return null;
  end if;
  return NEW;
end;
$function$;

DROP TRIGGER IF EXISTS trg_bloquear_notificacao_legacy_suspensao ON public.notificacoes;
CREATE TRIGGER trg_bloquear_notificacao_legacy_suspensao
BEFORE INSERT ON public.notificacoes
FOR EACH ROW
EXECUTE FUNCTION public.bloquear_notificacao_legacy_suspensao();

DELETE FROM public.notificacoes
WHERE acao = 'definir_suspensao';
