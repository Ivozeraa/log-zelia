BEGIN;

-- Mantém Física disponível como disciplina geral da área de Natureza
-- para todos os currículos/séries/semestres já cadastrados.
INSERT INTO public.horario_disciplinas_catalogo (
  curso,
  curriculo,
  serie,
  semestre,
  nome,
  categoria,
  area_nome,
  ordem,
  ativo
)
SELECT
  base.curso,
  base.curriculo,
  base.serie,
  base.semestre,
  'Física',
  'geral',
  'Natureza',
  COALESCE(bio.ordem + 1, GREATEST(qui.ordem - 1, 1), 99),
  true
FROM (
  SELECT DISTINCT curso, curriculo, serie, semestre
  FROM public.horario_disciplinas_catalogo
) AS base
LEFT JOIN public.horario_disciplinas_catalogo AS bio
  ON bio.curso = base.curso
 AND bio.curriculo = base.curriculo
 AND bio.serie = base.serie
 AND bio.semestre = base.semestre
 AND LOWER(bio.nome) = 'biologia'
LEFT JOIN public.horario_disciplinas_catalogo AS qui
  ON qui.curso = base.curso
 AND qui.curriculo = base.curriculo
 AND qui.serie = base.serie
 AND qui.semestre = base.semestre
 AND LOWER(qui.nome) = 'química'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.horario_disciplinas_catalogo AS fisica
  WHERE fisica.curso = base.curso
    AND fisica.curriculo = base.curriculo
    AND fisica.serie = base.serie
    AND fisica.semestre = base.semestre
    AND LOWER(fisica.nome) = 'física'
);

COMMIT;
