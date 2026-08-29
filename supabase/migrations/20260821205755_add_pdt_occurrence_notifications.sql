ALTER TABLE public.notificacoes
ADD COLUMN IF NOT EXISTS usuario_id uuid REFERENCES public.usuarios(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS notificacoes_usuario_id_criado_em_idx
ON public.notificacoes (usuario_id, criado_em DESC);

CREATE INDEX IF NOT EXISTS horario_config_turmas_turma_config_idx
ON public.horario_config_turmas (turma_id, configuracao_id);

CREATE INDEX IF NOT EXISTS horario_pdt_config_turma_idx
ON public.horario_pdt (config_turma_id, configuracao_id);

CREATE OR REPLACE FUNCTION public.criar_notificacao_pdt_ocorrencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_aluno_nome text;
  v_turma_nome text;
BEGIN
  SELECT hp_prof.usuario_id
    INTO v_usuario_id
  FROM public.horario_config_turmas hct
  JOIN public.horario_pdt hpdt
    ON hpdt.config_turma_id = hct.id
   AND hpdt.configuracao_id = hct.configuracao_id
  JOIN public.horario_professores hp_prof
    ON hp_prof.id = hpdt.professor_id
   AND hp_prof.configuracao_id = hpdt.configuracao_id
  JOIN public.horario_configuracoes hc
    ON hc.id = hct.configuracao_id
  WHERE hct.turma_id = NEW.turma_id
    AND hct.escola_id = NEW.escola_id
    AND hp_prof.usuario_id IS NOT NULL
  ORDER BY
    CASE hc.status WHEN 'validado' THEN 3 WHEN 'gerado' THEN 2 WHEN 'rascunho' THEN 1 ELSE 0 END DESC,
    hc.updated_at DESC NULLS LAST,
    hc.created_at DESC
  LIMIT 1;

  IF v_usuario_id IS NULL OR v_usuario_id = NEW.professor_id THEN
    RETURN NEW;
  END IF;

  SELECT nome INTO v_aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;
  SELECT nome INTO v_turma_nome FROM public.turmas WHERE id = NEW.turma_id;

  INSERT INTO public.notificacoes (
    escola_id,
    aluno_id,
    aluno_nome,
    mensagem,
    lida,
    usuario_id
  ) VALUES (
    NEW.escola_id,
    NEW.aluno_id,
    COALESCE(v_aluno_nome, 'Aluno'),
    format('Nova %s registrada para %s da turma %s.',
      CASE WHEN NEW.categoria = 'suspensao' THEN 'suspensão' ELSE 'ocorrência' END,
      COALESCE(v_aluno_nome, 'aluno'),
      COALESCE(v_turma_nome, 'não informada')
    ),
    false,
    v_usuario_id
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_criar_notificacao_pdt_ocorrencia ON public.ocorrencias;
CREATE TRIGGER trg_criar_notificacao_pdt_ocorrencia
AFTER INSERT ON public.ocorrencias
FOR EACH ROW
EXECUTE FUNCTION public.criar_notificacao_pdt_ocorrencia();
