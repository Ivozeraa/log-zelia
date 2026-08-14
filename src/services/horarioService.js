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

// Áreas fixas: automaticamente disponíveis em toda configuração
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
  const value = match[1] || match[2];
  return `${value}º`;
};

export const normalizeAgenda = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return item;
    if (item && item.id) return item.id;
    return item;
  });
};

const getProfessorById = (professores = [], professorId) =>
  professores.find((prof) => String(prof.id) === String(professorId));

const buildSlotKey = (dia, slot) => `${dia}::${slot}`;

const getMaxConsecutives = (professor, turmaId, vinculo) => {
  if (vinculo && vinculo.max_aulas_consecutivas)
    return Number(vinculo.max_aulas_consecutivas);

  if (professor && professor.max_aulas_consecutivas_default)
    return Number(professor.max_aulas_consecutivas_default);

  return 2;
};

export const generateHorario = ({
  configuracao = {},
  turmas = [],
  professores = [],
  vinculos = [],
  pdtMap = {},
  areas = [],
  disciplinas = [],
  folgas = [],
  indisponibilidades = [],
  formacoesArea = [],
  fcRules = [],
}) => {
  const professorMap = Object.fromEntries(
    professores.map((professor) => [String(professor.id), professor]),
  );

  const disciplinaMap = Object.fromEntries(
    disciplinas.map((disciplina) => [String(disciplina.id), disciplina]),
  );

  const areaMap = Object.fromEntries(
    areas.map((area) => [String(area.id), area]),
  );

  const turmaMap = Object.fromEntries(
    turmas.map((turma) => [String(turma.id), turma]),
  );

  const professorFolgaMap = {};
  folgas.forEach(({ professor_id, dia_semana }) => {
    if (!professor_id) return;
    const key = String(professor_id);
    professorFolgaMap[key] = professorFolgaMap[key] || [];
    professorFolgaMap[key].push(dia_semana);
  });

  const professorIndisponibilidadeMap = {};
  indisponibilidades.forEach(({ professor_id, dia_semana, aula_numero }) => {
    if (!professor_id) return;
    const key = String(professor_id);
    professorIndisponibilidadeMap[key] = professorIndisponibilidadeMap[key] || [];
    professorIndisponibilidadeMap[key].push(`${dia_semana}:${aula_numero}`);
  });

  const formacaoAreaMap = {};
  formacoesArea.forEach(({ area_id, dia_semana, aula_numero }) => {
    if (!area_id) return;
    const key = String(area_id);
    formacaoAreaMap[key] = formacaoAreaMap[key] || [];
    formacaoAreaMap[key].push(`${dia_semana}:${aula_numero}`);
  });

  const fcMap = {};
  const rules = fcRules.length ? fcRules : FC_RULES[Number(configuracao.semestre) || 1];

  turmas.forEach((turma) => {
    const serie = getTurmaSerie(turma.nome || turma.turma_nome || turma.label);
    const disciplina = rules && typeof rules === 'object' ? rules[serie] : null;

    if (!disciplina || !turma.id) return;

    const professorId = pdtMap[String(turma.id)] || pdtMap[turma.id];
    if (!professorId) return;

    fcMap[buildSlotKey(disciplina.dia, disciplina.slot)] = {
      turmaId: turma.id,
      turmaNome: turma.nome || turma.turma_nome || 'Turma',
      professorId,
      disciplina: 'Formação para a Cidadania',
      tipo: 'FC',
      dia: disciplina.dia,
      slot: disciplina.slot,
    };
  });

  const turmaSchedule = {};
  const professorSchedule = {};
  const generated = [];
  const validation = [];

  Object.values(fcMap).forEach((item) => {
    const key = `${item.dia}:${item.slot}`;
    turmaSchedule[String(item.turmaId)] = turmaSchedule[String(item.turmaId)] || {};
    turmaSchedule[String(item.turmaId)][key] = item;
    professorSchedule[String(item.professorId)] = professorSchedule[String(item.professorId)] || {};
    professorSchedule[String(item.professorId)][key] = item;
    generated.push({
      turma_id: item.turmaId,
      turma_nome: item.turmaNome,
      professor_id: item.professorId,
      professor_nome: getProfessorById(professores, item.professorId)?.nome || 'PDT',
      disciplina: item.disciplina,
      dia: item.dia,
      slot: item.slot,
      tipo: 'FC',
    });
  });

  const tasks = vinculos
    .map((vinculo) => {
      const professor = professorMap[String(vinculo.professor_id)];
      const turma = turmaMap[String(vinculo.turma_id)];
      const disciplina = disciplinaMap[String(vinculo.disciplina_id)];
      const aulas = Number(vinculo.aulas_semana || 0);

      if (!professor || !turma || !disciplina || aulas <= 0) return null;

      return {
        id: vinculo.id,
        professorId: vinculo.professor_id,
        turmaId: vinculo.turma_id,
        disciplinaId: vinculo.disciplina_id,
        professor,
        turma,
        disciplina,
        aulas,
        maxConsecutivo: getMaxConsecutives(professor, vinculo.turma_id, vinculo),
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.aulas - a.aulas);

  tasks.forEach((task, taskIndex) => {
    let remaining = task.aulas;
    const professorId = String(task.professorId);
    const turmaId = String(task.turmaId);

    while (remaining > 0) {
      let candidate = null;

      for (const day of WEEK_DAYS) {
        for (const slot of SLOT_DEFINITIONS) {
          const key = `${day}:${slot.slot}`;
          const professorDayBlock = professorFolgaMap[professorId] || [];
          const professorAreaId = task.professor?.area_id;
          const areaBlocks = professorAreaId ? formacaoAreaMap[String(professorAreaId)] || [] : [];
          const isBlockedByArea = areaBlocks.includes(key);
          const isBlockedByIndisponibilidade = (professorIndisponibilidadeMap[professorId] || []).includes(key);
          const isBlockedByFC = Boolean(fcMap[buildSlotKey(day, slot.slot)]);
          const professorBusy = Boolean(professorSchedule[professorId]?.[key]);
          const turmaBusy = Boolean(turmaSchedule[turmaId]?.[key]);
          const hasConsecutiveIssue = (() => {
            const currentSeries = [
              ...(professorSchedule[professorId] || {}),
            ]
              .filter(([, value]) => value && value.dia === day)
              .map(([, value]) => value.slot)
              .sort((a, b) => a - b);

            if (currentSeries.length === 0) return false;
            const maxSeries = currentSeries.includes(slot.slot)
              ? currentSeries.length + 1
              : currentSeries.length;
            return maxSeries > task.maxConsecutivo;
          })();

          if (
            professorDayBlock.includes(day) ||
            isBlockedByArea ||
            isBlockedByIndisponibilidade ||
            isBlockedByFC ||
            professorBusy ||
            turmaBusy ||
            hasConsecutiveIssue
          ) {
            continue;
          }

          const score =
            (day === 'Segunda-feira' ? 1 : 0) +
            (slot.slot >= 6 ? 1 : 0) +
            (task.aulas > 2 ? 1 : 0) +
            (remaining === 1 ? 2 : 0);

          candidate = candidate || { day, slot: slot.slot, score };
          if ((!candidate || score > candidate.score) && !candidate) {
            candidate = { day, slot: slot.slot, score };
          }
          if (candidate && score > candidate.score) {
            candidate = { day, slot: slot.slot, score };
          }
        }
      }

      if (!candidate) {
        validation.push({
          professor: task.professor?.nome || 'Professor',
          turma: task.turma?.nome || 'Turma',
          disciplina: task.disciplina?.nome || 'Disciplina',
          mensagem: 'Sem slot disponível dentro das restrições de folga, indisponibilidade, FC e formação.',
        });
        break;
      }

      const slotKey = `${candidate.day}:${candidate.slot}`;
      const record = {
        turma_id: turmaId,
        turma_nome: task.turma?.nome || 'Turma',
        professor_id: professorId,
        professor_nome: task.professor?.nome || 'Professor',
        disciplina: task.disciplina?.nome || 'Disciplina',
        dia: candidate.day,
        slot: candidate.slot,
        tipo: 'Regular',
        ordem: taskIndex,
      };

      turmaSchedule[turmaId] = turmaSchedule[turmaId] || {};
      professorSchedule[professorId] = professorSchedule[professorId] || {};
      turmaSchedule[turmaId][slotKey] = record;
      professorSchedule[professorId][slotKey] = record;
      generated.push(record);
      remaining -= 1;
    }
  });

  const grouped = generated.reduce((acc, item) => {
    const turmaKey = String(item.turma_id);
    if (!acc[turmaKey]) acc[turmaKey] = [];
    acc[turmaKey].push(item);
    return acc;
  }, {});

  return {
    grid: grouped,
    schedule: generated,
    validation,
    fcMap,
  };
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
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    doc.setFontSize(11);
    doc.text(`Turma ${turmaId}`, 14, y);
    y += 8;

    aulas.forEach((aula) => {
      doc.text(`${aula.dia} - ${aula.slot}ª - ${aula.disciplina} (${aula.professor_nome})`, 18, y);
      y += 7;
    });

    y += 5;
  });

  doc.save('grade_horario.pdf');
};
