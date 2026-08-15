from pathlib import Path

p = Path('src/pages/Horarios.jsx')
s = p.read_text(encoding='utf-8')

old = '''  const catalogOptionsForTurmas = (turmaIds = []) => {\n    const curriculum = curriculumForTurmas(turmaIds);\n    if (!curriculum) return [];\n    return disciplinaCatalogo\n      .filter((row) => row.curso === curriculum.curso && Number(row.serie) === Number(curriculum.serie) && Number(row.semestre) === Number(currentConfig.semestre))\n      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome))\n      .map((row) => ({ value: String(row.id), label: row.nome }));\n  };'''

new = '''  const normalizeDisciplineText = (value = '') => String(value)\n    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')\n    .trim()\n    .toLowerCase();\n\n  const GENERAL_DISCIPLINE_NAMES = new Set([\n    'lingua portuguesa',\n    'portugues',\n    'redacao',\n    'arte',\n    'lingua estrangeira ingles',\n    'lingua estrangeira: ingles',\n    'lingua estrangeira',\n    'educacao fisica',\n    'historia',\n    'geografia',\n    'filosofia',\n    'sociologia',\n    'matematica',\n    'biologia',\n    'fisica',\n    'quimica',\n  ]);\n\n  const isGeneralDiscipline = (row) => {\n    const category = normalizeDisciplineText(row?.categoria);\n    const name = normalizeDisciplineText(row?.nome);\n    return category.includes('formacao geral')\n      || category === 'geral'\n      || GENERAL_DISCIPLINE_NAMES.has(name);\n  };\n\n  const catalogOptionsForTurmas = (turmaIds = []) => {\n    const curriculum = curriculumForTurmas(turmaIds);\n    if (!curriculum) return [];\n    const multipleTurmas = turmaIds.length > 1;\n\n    return disciplinaCatalogo\n      .filter((row) => row.curso === curriculum.curso\n        && Number(row.serie) === Number(curriculum.serie)\n        && Number(row.semestre) === Number(currentConfig.semestre))\n      .filter((row) => !multipleTurmas || isGeneralDiscipline(row))\n      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome))\n      .map((row) => ({\n        value: String(row.id),\n        label: `${row.nome}${multipleTurmas && isGeneralDiscipline(row) ? ' · comum' : ''}`,\n      }));\n  };'''

if old not in s:
    raise SystemExit('catalogOptionsForTurmas block not found')
s = s.replace(old, new, 1)

old_note = '<p className="text-xs text-slate-500 dark:text-slate-400">A matéria é filtrada pelo curso, série e semestre da Etapa 1.</p>'
new_note = '<p className="text-xs text-slate-500 dark:text-slate-400">Em várias turmas, matérias gerais são aplicadas a todas. Matérias técnicas ficam para atribuição individual.</p>'
if old_note in s:
    s = s.replace(old_note, new_note, 1)

p.write_text(s, encoding='utf-8')
