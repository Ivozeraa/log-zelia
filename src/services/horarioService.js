export const WEEK_DAYS = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
];

export const SLOT_DEFINITIONS = [
  { slot: 1, label: '1ª', time: '07:20 - 08:10' },
  { slot: 2, label: '2ª', time: '08:10 - 09:00' },
  { slot: 3, label: '3ª', time: '09:30 - 10:20' },
  { slot: 4, label: '4ª', time: '10:20 - 11:10' },
  { slot: 5, label: '5ª', time: '11:10 - 12:00' },
  { slot: 6, label: '6ª', time: '13:00 - 13:50' },
  { slot: 7, label: '7ª', time: '13:50 - 14:40' },
  { slot: 8, label: '8ª', time: '15:00 - 15:50' },
  { slot: 9, label: '9ª', time: '15:50 - 16:40' },
];

export const FIXED_AREAS = [
  { nome: 'Exatas', base: 'comum' },
  { nome: 'Natureza', base: 'comum' },
  { nome: 'Humanas', base: 'comum' },
  { nome: 'Linguagens', base: 'comum' },
  { nome: 'Técnica', base: 'tecnica' },
];

export const FC_RULES = {
  1: {
    '1º': { dia: 'Segunda-feira', slot: 6 },
    '2º': { dia: 'Segunda-feira', slot: 7 },
    '3º': { dia: 'Segunda-feira', slot: 8 },
  },
  2: {
    '1º': { dia: 'Segunda-feira', slot: 6 },
    '2º': { dia: 'Segunda-feira', slot: 7 },
    '3º': { dia: 'Quarta-feira', slot: 6 },
  },
};

export const getTurmaSerie = (turmaNome = '') => {
  const match = String(turmaNome).match(/(\d+)\s*º|\b(\d+)\b/);
  if (!match) return null;
  return `${match[1] || match[2]}º`;
};

export const normalizeAgenda = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => (typeof item === 'string' ? item : item?.id || item));
};

const buildSlotKey = (dia, slot) => `${dia}:${slot}`;
const getProfessorById = (professores, id) => professores.find((item) => String(item.id) === String(id));
const getMaxConsecutives = (professor, vinculo) => Number(vinculo?.max_aulas_consecutivas || professor?.max_aulas_consecutivas_default || 2);

const getConsecutiveLengthIfPlaced = (schedule = {}, day, slot) => {
  const slots = Object.entries(schedule)
    .filter(([, value]) => value?.dia === day)
    .map(([, value]) => Number(value.slot));
  slots.push(Number(slot));
  const unique = [...new Set(slots)].sort((a, b) => a - b);
  let longest = 0;
  let current = 0;
  let previous = null;
  unique.forEach((value) => {
    current = previous !== null && value === previous + 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
    previous = value;
  });
  return longest;
};

const getAdjacentCount = (schedule = {}, day, slot) => {
  const values = Object.values(schedule).filter((item) => item?.dia === day).map((item) => Number(item.slot));
  return values.filter((value) => value === slot - 1 || value === slot + 1).length;
};

export const generateHorario = ({
  configuracao = {}, turmas = [], professores = [], vinculos = [], pdtMap = {},
  areas = [], disciplinas = [], folgas = [], indisponibilidades = [],
  formacoesArea = [], fcRules = [],
}) => {
  const professorMap = Object.fromEntries(professores.map((item) => [String(item.id), item]));
  const disciplinaMap = Object.fromEntries(disciplinas.map((item) => [String(item.id), item]));
  const areaMap = Object.fromEntries(areas.map((item) => [String(item.id), item]));
  const turmaMap = Object.fromEntries(turmas.map((item) => [String(item.id), item]));

  const folgaMap = {};
  folgas.forEach(({ professor_id, dia_semana }) => {
    if (!professor_id) return;
    const key = String(professor_id);
    folgaMap[key] ||= [];
    folgaMap[key].push(dia_semana);
  });

  const indisponibilidadeMap = {};
  indisponibilidades.forEach(({ professor_id, dia_semana, aula_numero }) => {
    if (!professor_id) return;
    const key = String(professor_id);
    indisponibilidadeMap[key] ||= [];
    indisponibilidadeMap[key].push(buildSlotKey(dia_semana, aula_numero));
  });

  const formacaoMap = {};
  formacoesArea.forEach(({ area_id, dia_semana, aula_numero }) => {
    if (!area_id) return;
    const key = String(area_id);
    formacaoMap[key] ||= [];
    formacaoMap[key].push(buildSlotKey(dia_semana, aula_numero));
  });

  const turmaSchedule = {};
  const professorSchedule = {};
  const generated = [];
  const validation = [];

  const rules = fcRules.length ? fcRules : (fcRules && Object.keys(fcRules).length ? fcRules : FC_RULES[Number(configuracao.semestre) || 1]);

  // FC é inserida primeiro e bloqueia somente a turma e o PDT correspondentes.
  turmas.forEach((turma) => {
    const rule = rules?.[getTurmaSerie(turma.nome || turma.turma_nome || '')];
    const professorId = pdtMap[String(turma.id)] || pdtMap[turma.id];
    if (!rule || !professorId) {
      validation.push({ turma: turma.nome || 'Turma', mensagem: !professorId ? 'Turma sem PDT para a aula obrigatória de FC.' : 'Não foi possível identificar a regra de FC da turma.' });
      return;
    }
    const key = buildSlotKey(rule.dia, rule.slot);
    const item = { turma_id: String(turma.id), turma_nome: turma.nome || 'Turma', professor_id: String(professorId), professor_nome: getProfessorById(professores, professorId)?.nome || 'PDT', disciplina: 'Formação para a Cidadania', dia: rule.dia, slot: rule.slot, tipo: 'FC' };
    turmaSchedule[String(turma.id)] ||= {};
    professorSchedule[String(professorId)] ||= {};
    if (turmaSchedule[String(turma.id)][key] || professorSchedule[String(professorId)][key]) {
      validation.push({ turma: item.turma_nome, professor: item.professor_nome, mensagem: 'Conflito ao reservar a FC obrigatória.' });
      return;
    }
    turmaSchedule[String(turma.id)][key] = item;
    professorSchedule[String(professorId)][key] = item;
    generated.push(item);
  });

  const tasks = vinculos.map((vinculo) => {
    const professor = professorMap[String(vinculo.professor_id)];
    const turma = turmaMap[String(vinculo.turma_id)];
    const disciplina = disciplinaMap[String(vinculo.disciplina_id)];
    const aulas = Number(vinculo.aulas_semana || 0);
    if (!professor || !turma || !disciplina || aulas <= 0) return null;
    const area = areaMap[String(disciplina.area_id)] || areaMap[String(professor.area_id)] || null;
    return { ...vinculo, professor, turma, disciplina, area, aulas, maxConsecutivo: getMaxConsecutives(professor, vinculo) };
  }).filter(Boolean).sort((a, b) => {
    const baseA = String(a.area?.base || '').toLowerCase() === 'tecnica' ? 1 : 0;
    const baseB = String(b.area?.base || '').toLowerCase() === 'tecnica' ? 1 : 0;
    if (baseA !== baseB) return baseB - baseA;
    return b.aulas - a.aulas;
  });

  tasks.forEach((task, taskIndex) => {
    let remaining = task.aulas;
    const professorId = String(task.professor_id);
    const turmaId = String(task.turma_id);
    while (remaining > 0) {
      const candidates = [];
      for (const day of WEEK_DAYS) {
        for (const definition of SLOT_DEFINITIONS) {
          const slot = definition.slot;
          const key = buildSlotKey(day, slot);
          const areaId = String(task.disciplina.area_id || task.professor.area_id || '');
          if ((folgaMap[professorId] || []).includes(day)) continue;
          if ((indisponibilidadeMap[professorId] || []).includes(key)) continue;
          if ((formacaoMap[areaId] || []).includes(key)) continue;
          if (professorSchedule[professorId]?.[key] || turmaSchedule[turmaId]?.[key]) continue;
          const consecutiveLength = getConsecutiveLengthIfPlaced(professorSchedule[professorId] || {}, day, slot);
          if (consecutiveLength > task.maxConsecutivo) continue;
          const adjacent = getAdjacentCount(professorSchedule[professorId] || {}, day, slot);
          const turmaLoad = Object.values(turmaSchedule[turmaId] || {}).filter((item) => item.dia === day).length;
          const professorLoad = Object.values(professorSchedule[professorId] || {}).filter((item) => item.dia === day).length;
          const score = adjacent * 20 - turmaLoad * 2 - professorLoad + (remaining === 1 ? 1 : 0);
          candidates.push({ day, slot, score });
        }
      }
      candidates.sort((a, b) => b.score - a.score || a.slot - b.slot || WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day));
      const candidate = candidates[0];
      if (!candidate) {
        validation.push({ professor: task.professor.nome, turma: task.turma.nome, disciplina: task.disciplina.nome, mensagem: `Não foi possível distribuir todas as ${task.aulas} aulas dentro das restrições.` });
        break;
      }
      const key = buildSlotKey(candidate.day, candidate.slot);
      const record = { turma_id: turmaId, turma_nome: task.turma.nome || 'Turma', professor_id: professorId, professor_nome: task.professor.nome || 'Professor', disciplina: task.disciplina.nome || 'Disciplina', dia: candidate.day, slot: candidate.slot, tipo: 'Regular', ordem: taskIndex };
      turmaSchedule[turmaId] ||= {};
      professorSchedule[professorId] ||= {};
      turmaSchedule[turmaId][key] = record;
      professorSchedule[professorId][key] = record;
      generated.push(record);
      remaining -= 1;
    }
  });

  const grid = generated.reduce((acc, item) => {
    const key = String(item.turma_id);
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});

  return { grid, schedule: generated, validation, fcMap: {} };
};

export const exportarGradePdf = (grade, nomeEscola = 'EEEP Irmã Ana Zélia da Fonseca') => {
  const { jsPDF } = window.jspdf || {};
  if (!jsPDF) return;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(nomeEscola, 14, 16);
  doc.setFontSize(11);
  doc.text('Grade escolar gerada', 14, 24);
  let y = 34;
  Object.entries(grade || {}).forEach(([turmaId, aulas]) => {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(11);
    doc.text(`Turma ${turmaId}`, 14, y);
    y += 8;
    aulas.forEach((aula) => { doc.text(`${aula.dia} - ${aula.slot}ª - ${aula.disciplina} (${aula.professor_nome})`, 18, y); y += 7; });
    y += 5;
  });
  doc.save('grade_horario.pdf');
};
