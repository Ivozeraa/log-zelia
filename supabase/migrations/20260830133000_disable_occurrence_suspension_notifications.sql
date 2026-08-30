-- A decisão disciplinar agora é tomada no modal imediatamente após o registro.
-- O antigo gatilho de notificações não deve criar avisos para esse fluxo.
DROP TRIGGER IF EXISTS trg_criar_notificacao_pdt_ocorrencia ON public.ocorrencias;

-- Remove avisos de decisão antigos que ficaram pendentes na central de notificações.
DELETE FROM public.notificacoes
WHERE acao = 'definir_suspensao' AND lida = false;
