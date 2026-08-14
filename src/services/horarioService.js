export const WEEK_DAYS = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];

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

export const normalizeFixedAreas = (areas = []) => {
  const source = Array.isArray(areas) ? areas : [];
  return FIXED_AREAS.map((fixed) => {
    const existing = source.find((area) => String(area?.nome || '').trim().toLowerCase() === fixed.nome.toLowerCase());
    return existing ? { ...existing, nome: fixed.nome, base: fixed.base } : { ...fixed };
  });
};

export const FC_RULES = {
  1: { '1º': { dia: 'Segunda-feira', slot: 6 }, '2º': { dia: 'Segunda-feira', slot: 7 }, '3º': { dia: 'Segunda-feira', slot: 8 } },
  2: { '1º': { dia: 'Segunda-feira', slot: 6 }, '2º': { dia: 'Segunda-feira', slot: 7 }, '3º': { dia: 'Quarta-feira', slot: 6 } },
};

export const getTurmaSerie = (nome = '') => {
  const match = String(nome).match(/(\d+)\s*º|\b(\d+)\b/);
  return match ? `${match[1] || match[2]}º` : null;
};

export const normalizeAgenda = (value) => Array.isArray(value) ? value.map((item) => (typeof item === 'string' ? item : item?.id || item)) : [];

const normalizeDay = (day) => {
  if (typeof day === 'number' || /^\d+$/.test(String(day))) return WEEK_DAYS[Number(day) - 1] || String(day);
  return String(day || '');
};
const slotKey = (dia, slot) => `${normalizeDay(dia)}:${Number(slot)}`;
const professorById = (items, id) => items.find((item) => String(item.id) === String(id));
const maxConsecutives = (professor, vinculo) => Math.max(1, Number(vinculo?.max_aulas_consecutivas || professor?.max_aulas_consecutivas_default || 2));
const daySlots = (schedule, day) => Object.values(schedule || {}).filter((item) => normalizeDay(item?.dia) === normalizeDay(day)).map((item) => Number(item.slot));
const consecutiveIfPlaced = (schedule, day, slot) => {
  const values = [...new Set([...daySlots(schedule, day), Number(slot)])].sort((a, b) => a - b);
  let longest = 0; let run = 0; let previous = null;
  values.forEach((value) => { run = previous !== null && value === previous + 1 ? run + 1 : 1; longest = Math.max(longest, run); previous = value; });
  return longest;
};
const adjacentCount = (schedule, day, slot) => daySlots(schedule, day).filter((value) => value === Number(slot) - 1 || value === Number(slot) + 1).length;

export const mergeProfessores = (configuracao = {}, professores = []) => {
  const merged = [
    ...(Array.isArray(professores) ? professores : []),
    ...(Array.isArray(configuracao?.professores) ? configuracao.professores : []),
    ...(Array.isArray(configuracao?.professorManual) ? configuracao.professorManual : []),
  ].filter(Boolean);
  return Array.from(new Map(merged.map((item) => [String(item.id), item])).values());
};

const addProblem = (validation, problem) => validation.push({ ...problem, bloqueante: true });

export const generateHorario = ({ configuracao = {}, turmas = [], professores = [], vinculos = [], pdtMap = {}, areas = [], disciplinas = [], folgas = [], indisponibilidades = [], formacoesArea = [], fcRules = [] } = {}) => {
  const effectiveAreas = normalizeFixedAreas(configuracao?.areas?.length ? configuracao.areas : areas);
  const effectiveDisciplinas = Array.isArray(configuracao?.disciplinas) ? configuracao.disciplinas : disciplinas;
  const effectiveProfessores = mergeProfessores(configuracao, professores);
  const selectedIds = new Set((configuracao?.turmas || []).map(String));
  const effectiveTurmas = selectedIds.size ? turmas.filter((turma) => selectedIds.has(String(turma.id))) : turmas;
  const professorMap = Object.fromEntries(effectiveProfessores.map((item) => [String(item.id), item]));
  const disciplinaMap = Object.fromEntries(effectiveDisciplinas.map((item) => [String(item.id), item]));
  const areaMap = Object.fromEntries(effectiveAreas.map((item) => [String(item.id), item]));
  const turmaMap = Object.fromEntries(effectiveTurmas.map((item) => [String(item.id), item]));
  const validation = []; const generated = []; const unscheduled = []; const turmaSchedule = {}; const professorSchedule = {};

  const folgaMap = {};
  folgas.forEach(({ professor_id, dia_semana }) => { if (professor_id) (folgaMap[String(professor_id)] ||= []).push(normalizeDay(dia_semana)); });
  const indisponibilidadeMap = {};
  indisponibilidades.forEach(({ professor_id, dia_semana, aula_numero }) => { if (professor_id) (indisponibilidadeMap[String(professor_id)] ||= []).push(slotKey(dia_semana, aula_numero)); });
  const formacaoMap = {};
  formacoesArea.forEach(({ area_id, dia_semana, aula_numero }) => { if (area_id) (formacaoMap[String(area_id)] ||= []).push(slotKey(dia_semana, aula_numero)); });

  const rules = fcRules && !Array.isArray(fcRules) && Object.keys(fcRules).length ? fcRules : FC_RULES[Number(configuracao.semestre) || 1];

  effectiveTurmas.forEach((turma) => {
    const turmaId = String(turma.id); const rule = rules?.[getTurmaSerie(turma.nome || turma.turma_nome || '')]; const professorId = pdtMap[turmaId];
    if (!rule) return addProblem(validation, { turma: turma.nome || 'Turma', mensagem: `Não existe regra de FC para a série ${getTurmaSerie(turma.nome || '') || 'não identificada'} no semestre ${configuracao.semestre || 1}.` });
    if (!professorId) return addProblem(validation, { turma: turma.nome || 'Turma', mensagem: 'Turma sem PDT para a aula obrigatória de FC.' });
    const professor = professorById(effectiveProfessores, professorId);
    if (!professor) return addProblem(validation, { turma: turma.nome || 'Turma', professor: professorId, mensagem: 'O PDT informado não pertence à configuração atual.' });
    const key = slotKey(rule.dia, rule.slot);
    turmaSchedule[turmaId] ||= {}; professorSchedule[String(professorId)] ||= {};
    if ((folgaMap[String(professorId)] || []).includes(rule.dia)) return addProblem(validation, { turma: turma.nome, professor: professor.nome, mensagem: 'A FC obrigatória conflita com a folga do PDT.' });
    if ((indisponibilidadeMap[String(professorId)] || []).includes(key)) return addProblem(validation, { turma: turma.nome, professor: professor.nome, mensagem: 'A FC obrigatória conflita com a indisponibilidade do PDT.' });
    if ((formacaoMap[String(professor.area_id)] || []).includes(key)) return addProblem(validation, { turma: turma.nome, professor: professor.nome, mensagem: 'A FC obrigatória conflita com a formação da área do PDT.' });
    if (turmaSchedule[turmaId][key] || professorSchedule[String(professorId)][key]) return addProblem(validation, { turma: turma.nome, professor: professor.nome, mensagem: 'Conflito ao reservar a FC obrigatória.' });
    const max = maxConsecutives(professor, {});
    if (consecutiveIfPlaced(professorSchedule[String(professorId)], rule.dia, rule.slot) > max) return addProblem(validation, { turma: turma.nome, professor: professor.nome, mensagem: `A FC obrigatória excede o máximo de ${max} aulas consecutivas do PDT.` });
    const item = { turma_id: turmaId, turma_nome: turma.nome || 'Turma', professor_id: String(professorId), professor_nome: professor.nome || 'PDT', disciplina_id: null, disciplina: 'Formação para a Cidadania', dia: rule.dia, slot: rule.slot, tipo: 'FC' };
    turmaSchedule[turmaId][key] = item; professorSchedule[String(professorId)][key] = item; generated.push(item);
  });

  const tasks = vinculos.map((vinculo) => {
    const professor = professorMap[String(vinculo.professor_id)]; const turma = turmaMap[String(vinculo.turma_id)]; const disciplina = disciplinaMap[String(vinculo.disciplina_id)]; const aulas = Number(vinculo.aulas_semana ?? vinculo.aulas_semanais ?? 0);
    if (!professor) { addProblem(validation, { professor: vinculo.professor_id, turma: turma?.nome, disciplina: disciplina?.nome, mensagem: 'Professor do vínculo não pertence à configuração atual.' }); return null; }
    if (!turma) { addProblem(validation, { professor: professor.nome, turma: vinculo.turma_id, disciplina: disciplina?.nome, mensagem: 'Turma do vínculo não está selecionada na configuração atual.' }); return null; }
    if (!disciplina) { addProblem(validation, { professor: professor.nome, turma: turma.nome, disciplina: vinculo.disciplina_id, mensagem: 'Disciplina do vínculo não pertence à configuração atual.' }); return null; }
    if (!Number.isFinite(aulas) || aulas <= 0) { addProblem(validation, { professor: professor.nome, turma: turma.nome, disciplina: disciplina.nome, mensagem: 'A quantidade de aulas semanais deve ser maior que zero.' }); return null; }
    const area = areaMap[String(disciplina.area_id)];
    if (!area) { addProblem(validation, { professor: professor.nome, turma: turma.nome, disciplina: disciplina.nome, mensagem: `A disciplina "${disciplina.nome}" não possui uma área válida nesta configuração.` }); return null; }
    return { ...vinculo, professor, turma, disciplina, area, aulas, maxConsecutivo: maxConsecutives(professor, vinculo) };
  }).filter(Boolean).sort((a, b) => (b.area.base === 'tecnica' ? 1 : 0) - (a.area.base === 'tecnica' ? 1 : 0) || b.aulas - a.aulas);

  tasks.forEach((task, order) => {
    let remaining = task.aulas; let distributed = 0; const professorId = String(task.professor_id); const turmaId = String(task.turma_id);
    while (remaining > 0) {
      const candidates = [];
      WEEK_DAYS.forEach((day) => SLOT_DEFINITIONS.forEach(({ slot }) => {
        const key = slotKey(day, slot);
        if ((folgaMap[professorId] || []).includes(day) || (indisponibilidadeMap[professorId] || []).includes(key) || (formacaoMap[String(task.disciplina.area_id)] || []).includes(key) || professorSchedule[professorId]?.[key] || turmaSchedule[turmaId]?.[key]) return;
        if (consecutiveIfPlaced(professorSchedule[professorId] || {}, day, slot) > task.maxConsecutivo) return;
        const adjacent = adjacentCount(professorSchedule[professorId] || {}, day, slot); const turmaLoad = daySlots(turmaSchedule[turmaId], day).length; const professorLoad = daySlots(professorSchedule[professorId], day).length;
        candidates.push({ day, slot, score: adjacent * 20 - turmaLoad * 3 - professorLoad * 2 + (remaining === 1 ? 1 : 0) });
      }));
      candidates.sort((a, b) => b.score - a.score || a.slot - b.slot || WEEK_DAYS.indexOf(a.day) - WEEK_DAYS.indexOf(b.day));
      const candidate = candidates[0];
      if (!candidate) break;
      const key = slotKey(candidate.day, candidate.slot);
      const record = { turma_id: turmaId, turma_nome: task.turma.nome || 'Turma', professor_id: professorId, professor_nome: task.professor.nome || 'Professor', disciplina_id: task.disciplina.id, disciplina: task.disciplina.nome || 'Disciplina', dia: candidate.day, slot: candidate.slot, tipo: 'Regular', ordem: order };
      turmaSchedule[turmaId] ||= {}; professorSchedule[professorId] ||= {}; turmaSchedule[turmaId][key] = record; professorSchedule[professorId][key] = record; generated.push(record); distributed += 1; remaining -= 1;
    }
    if (remaining > 0) {
      const problem = { professor: task.professor.nome, professor_id: task.professor_id, turma: task.turma.nome, turma_id: task.turma_id, disciplina: task.disciplina.nome, disciplina_id: task.disciplina.id, solicitadas: task.aulas, distribuídas: distributed, restantes: remaining, mensagem: 'Não foi possível distribuir todas as aulas dentro das restrições de disponibilidade, formação, conflitos e consecutivas.' };
      addProblem(validation, problem); unscheduled.push(problem);
    }
  });

  const grid = generated.reduce((acc, item) => { (acc[String(item.turma_id)] ||= []).push(item); return acc; }, {});
  return { grid, schedule: generated, validation, unscheduled, fcMap: {}, areas: effectiveAreas, disciplinas: effectiveDisciplinas };
};
