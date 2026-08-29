BEGIN;

-- =========================================================
-- Módulo de horários escolares
-- Estrutura baseada no schema já existente do projeto.
-- Mantém as tabelas principais do sistema e respeita o contexto
-- de configuração por configuracao_id.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.horario_configuracoes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  nome text NOT NULL,
  ano_letivo integer NOT NULL,
  semestre smallint NOT NULL CHECK (semestre IN (1, 2)),
  status text NOT NULL DEFAULT 'rascunho'::text CHECK (status IN ('rascunho', 'gerado', 'validado')),
  resultado_validacao jsonb,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT horario_configuracoes_pkey PRIMARY KEY (id),
  CONSTRAINT horario_configuracoes_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id),
  CONSTRAINT horario_configuracoes_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id)
);

CREATE TABLE IF NOT EXISTS public.horario_config_turmas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  escola_id uuid NOT NULL,
  turma_id uuid NOT NULL,
  CONSTRAINT horario_config_turmas_pkey PRIMARY KEY (id),
  CONSTRAINT horario_config_turmas_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_config_turmas_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id),
  CONSTRAINT horario_config_turmas_turma_id_fkey FOREIGN KEY (turma_id) REFERENCES public.turmas(id),
  CONSTRAINT horario_config_turmas_unique UNIQUE (configuracao_id, turma_id)
);

CREATE TABLE IF NOT EXISTS public.horario_areas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  nome text NOT NULL,
  base text NOT NULL CHECK (base IN ('tecnica', 'comum')),
  CONSTRAINT horario_areas_pkey PRIMARY KEY (id),
  CONSTRAINT horario_areas_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_areas_unique UNIQUE (configuracao_id, nome)
);

CREATE TABLE IF NOT EXISTS public.horario_disciplinas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  nome text NOT NULL,
  area_id uuid,
  CONSTRAINT horario_disciplinas_pkey PRIMARY KEY (id),
  CONSTRAINT horario_disciplinas_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_disciplinas_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.horario_areas(id),
  CONSTRAINT horario_disciplinas_unique UNIQUE (configuracao_id, nome)
);

CREATE TABLE IF NOT EXISTS public.horario_professores (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  usuario_id uuid,
  nome text NOT NULL,
  origem text NOT NULL DEFAULT 'manual'::text CHECK (origem IN ('banco', 'manual')),
  area_id uuid NOT NULL,
  max_aulas_consecutivas_default smallint NOT NULL DEFAULT 2 CHECK (max_aulas_consecutivas_default BETWEEN 1 AND 9),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT horario_professores_pkey PRIMARY KEY (id),
  CONSTRAINT horario_professores_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_professores_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES public.usuarios(id),
  CONSTRAINT horario_professores_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.horario_areas(id),
  CONSTRAINT horario_professores_unique UNIQUE (configuracao_id, usuario_id, nome)
);

CREATE TABLE IF NOT EXISTS public.horario_professor_turma (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  disciplina_id uuid NOT NULL,
  config_turma_id uuid NOT NULL,
  aulas_semanais smallint NOT NULL CHECK (aulas_semanais BETWEEN 1 AND 45),
  max_aulas_consecutivas smallint CHECK (max_aulas_consecutivas BETWEEN 1 AND 9),
  CONSTRAINT horario_professor_turma_pkey PRIMARY KEY (id),
  CONSTRAINT horario_professor_turma_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_professor_turma_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.horario_professores(id),
  CONSTRAINT horario_professor_turma_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.horario_disciplinas(id),
  CONSTRAINT horario_professor_turma_config_turma_id_fkey FOREIGN KEY (config_turma_id) REFERENCES public.horario_config_turmas(id),
  CONSTRAINT horario_professor_turma_unique UNIQUE (configuracao_id, professor_id, disciplina_id, config_turma_id)
);

CREATE TABLE IF NOT EXISTS public.horario_pdt (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  config_turma_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  CONSTRAINT horario_pdt_pkey PRIMARY KEY (id),
  CONSTRAINT horario_pdt_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_pdt_config_turma_id_fkey FOREIGN KEY (config_turma_id) REFERENCES public.horario_config_turmas(id),
  CONSTRAINT horario_pdt_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.horario_professores(id),
  CONSTRAINT horario_pdt_unique UNIQUE (configuracao_id, config_turma_id)
);

CREATE TABLE IF NOT EXISTS public.horario_professor_folgas (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  CONSTRAINT horario_professor_folgas_pkey PRIMARY KEY (id),
  CONSTRAINT horario_professor_folgas_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_professor_folgas_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.horario_professores(id),
  CONSTRAINT horario_professor_folgas_unique UNIQUE (configuracao_id, professor_id, dia_semana)
);

CREATE TABLE IF NOT EXISTS public.horario_professor_indisponibilidades (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  professor_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  aula_numero smallint NOT NULL CHECK (aula_numero BETWEEN 1 AND 9),
  CONSTRAINT horario_professor_indisponibilidades_pkey PRIMARY KEY (id),
  CONSTRAINT horario_professor_indisponibilidades_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_professor_indisponibilidades_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.horario_professores(id),
  CONSTRAINT horario_professor_indisponibilidades_unique UNIQUE (configuracao_id, professor_id, dia_semana, aula_numero)
);

CREATE TABLE IF NOT EXISTS public.horario_formacao_area (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  area_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  aula_numero smallint NOT NULL CHECK (aula_numero BETWEEN 1 AND 9),
  CONSTRAINT horario_formacao_area_pkey PRIMARY KEY (id),
  CONSTRAINT horario_formacao_area_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_formacao_area_area_id_fkey FOREIGN KEY (area_id) REFERENCES public.horario_areas(id),
  CONSTRAINT horario_formacao_area_unique UNIQUE (configuracao_id, area_id, dia_semana, aula_numero)
);

CREATE TABLE IF NOT EXISTS public.horario_fc_regras (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  ano_serie smallint NOT NULL CHECK (ano_serie IN (1, 2, 3)),
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  aula_numero smallint NOT NULL CHECK (aula_numero BETWEEN 1 AND 9),
  CONSTRAINT horario_fc_regras_pkey PRIMARY KEY (id),
  CONSTRAINT horario_fc_regras_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_fc_regras_unique UNIQUE (configuracao_id, ano_serie)
);

CREATE TABLE IF NOT EXISTS public.horario_slots (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  escola_id uuid NOT NULL,
  aula_numero smallint NOT NULL CHECK (aula_numero BETWEEN 1 AND 9),
  turno text NOT NULL CHECK (turno IN ('manha', 'tarde')),
  hora_inicio time without time zone NOT NULL,
  hora_fim time without time zone NOT NULL,
  CONSTRAINT horario_slots_pkey PRIMARY KEY (id),
  CONSTRAINT horario_slots_escola_id_fkey FOREIGN KEY (escola_id) REFERENCES public.escolas(id),
  CONSTRAINT horario_slots_unique UNIQUE (escola_id, aula_numero, turno)
);

CREATE TABLE IF NOT EXISTS public.horario_grade_gerada (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  configuracao_id uuid NOT NULL,
  config_turma_id uuid NOT NULL,
  dia_semana smallint NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
  aula_numero smallint NOT NULL CHECK (aula_numero BETWEEN 1 AND 9),
  professor_id uuid,
  disciplina_id uuid,
  tipo text NOT NULL DEFAULT 'aula'::text CHECK (tipo IN ('aula', 'fc')),
  CONSTRAINT horario_grade_gerada_pkey PRIMARY KEY (id),
  CONSTRAINT horario_grade_gerada_configuracao_id_fkey FOREIGN KEY (configuracao_id) REFERENCES public.horario_configuracoes(id),
  CONSTRAINT horario_grade_gerada_config_turma_id_fkey FOREIGN KEY (config_turma_id) REFERENCES public.horario_config_turmas(id),
  CONSTRAINT horario_grade_gerada_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.horario_professores(id),
  CONSTRAINT horario_grade_gerada_disciplina_id_fkey FOREIGN KEY (disciplina_id) REFERENCES public.horario_disciplinas(id),
  CONSTRAINT horario_grade_gerada_unique UNIQUE (configuracao_id, config_turma_id, dia_semana, aula_numero)
);

-- =========================================================
-- Views e índices
-- =========================================================

CREATE OR REPLACE VIEW public.horario_carga_professor AS
SELECT
  hp.configuracao_id,
  hp.id AS professor_id,
  hp.nome AS professor_nome,
  COUNT(hgg.id) AS aulas_total,
  COUNT(hgg.id) FILTER (WHERE hgg.tipo = 'aula') AS aulas_regulares,
  COUNT(hgg.id) FILTER (WHERE hgg.tipo = 'fc') AS aulas_fc
FROM public.horario_professores hp
LEFT JOIN public.horario_grade_gerada hgg
  ON hgg.configuracao_id = hp.configuracao_id
 AND hgg.professor_id = hp.id
GROUP BY hp.configuracao_id, hp.id, hp.nome;

CREATE INDEX IF NOT EXISTS idx_horario_configuracoes_escola_id
  ON public.horario_configuracoes (escola_id);

CREATE INDEX IF NOT EXISTS idx_horario_config_turmas_configuracao_id
  ON public.horario_config_turmas (configuracao_id);

CREATE INDEX IF NOT EXISTS idx_horario_areas_configuracao_id
  ON public.horario_areas (configuracao_id);

CREATE INDEX IF NOT EXISTS idx_horario_disciplinas_configuracao_id
  ON public.horario_disciplinas (configuracao_id);

CREATE INDEX IF NOT EXISTS idx_horario_professores_configuracao_id
  ON public.horario_professores (configuracao_id);

CREATE INDEX IF NOT EXISTS idx_horario_professor_turma_configuracao_id
  ON public.horario_professor_turma (configuracao_id);

CREATE INDEX IF NOT EXISTS idx_horario_grade_gerada_configuracao_id
  ON public.horario_grade_gerada (configuracao_id);

-- =========================================================
-- RLS: não desativa; apenas habilita conforme segurança do banco.
-- =========================================================

ALTER TABLE public.horario_configuracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_config_turmas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_disciplinas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_professores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_professor_turma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_pdt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_professor_folgas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_professor_indisponibilidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_formacao_area ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_fc_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.horario_grade_gerada ENABLE ROW LEVEL SECURITY;

COMMIT;
