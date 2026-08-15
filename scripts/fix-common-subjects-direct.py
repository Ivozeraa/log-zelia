from pathlib import Path
import re

path = Path('src/pages/Horarios.jsx')
s = path.read_text(encoding='utf-8')

replacement = '''  const catalogOptionsForTurmas = (turmaIds = []) => {
    const ids = Array.from(new Set((turmaIds || []).map(String)));
    if (!ids.length) return [];

    const normalize = (value = '') => String(value)
      .normalize('NFD')
      .replace(/[\\u0300-\\u036f]/g, '')
      .trim()
      .toLowerCase();

    const semester = Number(currentConfig.semestre);
    const curricula = ids.map((turmaId) => {
      const turma = byId(turmas, turmaId);
      const curso = normalize(catalogCourseFromTurma(turma?.nome));
      const match = String(turma?.nome || '').match(/(\\d+)\\s*º|\\b(\\d+)\\b/);
      const serie = match ? Number(match[1] || match[2]) : null;
      return { curso, serie };
    });

    if (curricula.some((item) => !item.curso || !item.serie)) return [];

    const rowsFor = (curriculum) => disciplinaCatalogo.filter((row) =>
      normalize(row.curso) === curriculum.curso
      && Number(row.serie) === Number(curriculum.serie)
      && Number(row.semestre) === semester,
    );

    const isGeneral = (row) => {
      const category = normalize(row?.categoria);
      const name = normalize(row?.nome);
      return category.includes('formacao geral')
        || category === 'geral'
        || GENERAL_DISCIPLINE_NAMES.has(name);
    };

    if (ids.length === 1) {
      return rowsFor(curricula[0])
        .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome).localeCompare(String(b.nome)))
        .map((row) => ({ value: String(row.id), label: row.nome }));
    }

    const commonMaps = curricula.map((curriculum) => {
      const map = new Map();
      rowsFor(curriculum).filter(isGeneral).forEach((row) => map.set(normalize(row.nome), row));
      return map;
    });

    const first = commonMaps[0];
    const commonNames = [...first.keys()].filter((name) => commonMaps.every((map) => map.has(name)));

    return commonNames
      .map((name) => first.get(name))
      .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0) || String(a.nome).localeCompare(String(b.nome)))
      .map((row) => ({ value: String(row.id), label: row.nome }));
  };'''

pattern = re.compile(r"  const catalogOptionsForTurmas = \(turmaIds = \[\]\) => \{.*?\n  \};", re.S)
if not pattern.search(s):
    raise SystemExit('catalogOptionsForTurmas not found')
s = pattern.sub(lambda _m: replacement, s, count=1)
path.write_text(s, encoding='utf-8')
