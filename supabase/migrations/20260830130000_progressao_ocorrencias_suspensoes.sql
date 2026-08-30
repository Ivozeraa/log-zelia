-- Progressão disciplinar:
-- 3 ocorrências simples = 1 suspensão acumulada.
-- 2 suspensões acumuladas = expulsão.
-- A regra considera suspensões diretas + floor(ocorrências simples / 3).

CREATE OR REPLACE FUNCTION public.atualizar_status_aluno()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  total_ocorrencias int;
  total_suspensoes_diretas int;
  total_suspensoes int;
  novo_status status_aluno_enum;
begin
  select count(*) into total_ocorrencias
  from ocorrencias
  where aluno_id = coalesce(NEW.aluno_id, OLD.aluno_id)
    and categoria = 'ocorrencia';

  select count(*) into total_suspensoes_diretas
  from ocorrencias
  where aluno_id = coalesce(NEW.aluno_id, OLD.aluno_id)
    and categoria = 'suspensao';

  total_suspensoes := total_suspensoes_diretas + floor(total_ocorrencias / 3)::int;

  if total_suspensoes >= 2 then
    novo_status := 'expulso';
  elsif total_suspensoes >= 1 then
    novo_status := 'suspenso';
  else
    novo_status := 'normal';
  end if;

  update alunos
  set status = novo_status
  where id = coalesce(NEW.aluno_id, OLD.aluno_id);

  return NEW;
end;
$function$;

CREATE OR REPLACE FUNCTION public.criar_notificacao_pdt_ocorrencia()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_pdt_usuario_id uuid;
  v_aluno_nome text;
  v_turma_nome text;
  v_total_ocorrencias int;
  v_total_suspensoes_diretas int;
  v_total_suspensoes int;
  v_mensagem text;
BEGIN
  SELECT hp_prof.usuario_id
    INTO v_pdt_usuario_id
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

  SELECT nome INTO v_aluno_nome FROM public.alunos WHERE id = NEW.aluno_id;
  SELECT nome INTO v_turma_nome FROM public.turmas WHERE id = NEW.turma_id;

  SELECT count(*) INTO v_total_ocorrencias
  FROM public.ocorrencias
  WHERE aluno_id = NEW.aluno_id AND categoria = 'ocorrencia';

  SELECT count(*) INTO v_total_suspensoes_diretas
  FROM public.ocorrencias
  WHERE aluno_id = NEW.aluno_id AND categoria = 'suspensao';

  v_total_suspensoes := v_total_suspensoes_diretas + floor(v_total_ocorrencias / 3)::int;

  IF v_total_suspensoes >= 2 THEN
    v_mensagem := format('🚨 %s atingiu 2 suspensões e será expulso.', COALESCE(v_aluno_nome, 'O aluno'));
  ELSIF NEW.categoria = 'ocorrencia' AND v_total_ocorrencias % 3 = 0 THEN
    v_mensagem := format('⚠️ %s atingiu %s ocorrências e será suspenso.', COALESCE(v_aluno_nome, 'O aluno'), v_total_ocorrencias);
  ELSE
    v_mensagem := format('Nova %s registrada para %s da turma %s.',
      CASE WHEN NEW.categoria = 'suspensao' THEN 'suspensão' ELSE 'ocorrência' END,
      COALESCE(v_aluno_nome, 'aluno'),
      COALESCE(v_turma_nome, 'não informada')
    );
  END IF;

  IF v_pdt_usuario_id IS NOT NULL THEN
    INSERT INTO public.notificacoes (
      escola_id, aluno_id, aluno_nome, mensagem, lida, usuario_id
    ) VALUES (
      NEW.escola_id, NEW.aluno_id, COALESCE(v_aluno_nome, 'Aluno'), v_mensagem, false, v_pdt_usuario_id
    );
  END IF;

  IF v_total_suspensoes >= 2
     AND NEW.professor_id IS NOT NULL
     AND NEW.professor_id <> v_pdt_usuario_id THEN
    INSERT INTO public.notificacoes (
      escola_id, aluno_id, aluno_nome, mensagem, lida, usuario_id
    ) VALUES (
      NEW.escola_id, NEW.aluno_id, COALESCE(v_aluno_nome, 'Aluno'), v_mensagem, false, NEW.professor_id
    );
  END IF;

  RETURN NEW;
END;
$function$;
