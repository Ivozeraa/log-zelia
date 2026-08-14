import { useEffect, useMemo, useState } from 'react';
import { FaCalendarAlt, FaFileExcel, FaFilePdf, FaPlus, FaSpinner } from 'react-icons/fa';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';

import { supabase } from '../utils/supabase';
import { notify } from '../utils/notify';
import { useAuth } from '../hooks/useAuth';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { FormInput } from '../components/ui/FormInput';
import { Card } from '../components/ui/Card';
import {
  FC_RULES,
  FIXED_AREAS,
  SLOT_DEFINITIONS,
  WEEK_DAYS,
  generateHorario,
  mergeProfessores,
} from '../services/horarioService';

const createEntityId = (prefix = 'id') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const emptyGrade = { grid: {}, schedule: [], validation: [], unscheduled: [] };

const makeAreas = (source = []) =>
  FIXED_AREAS.map((fixed) => {
    const existing = source.find(
      (area) => String(area?.nome || '').trim().toLowerCase() === fixed.nome.toLowerCase(),
    );
    return existing
      ? { ...existing, nome: fixed.nome, base: fixed.base }
      : { id: createEntityId('area'), ...fixed };
  });

const makeEmptyConfig = (escolaId = '') => ({
  nome: '',
  escola_id: escolaId,
  ano_letivo: new Date().getFullYear(),
  semestre: 1,
  turmas: [],
  configTurmaMap: {},
  professores: [],
  professorTurmas: [],
  pdt: {},
  folgas: [],
  indisponibilidades: [],
  formacaoArea: [],
  areas: makeAreas(),
  disciplinas: [],
});

const normalizeIds = (items = []) => (Array.isArray(items) ? items.map((item) => String(item)) : []);
const nameOf = (items = [], id) => items.find((item) => String(item.id) === String(id))?.nome || 'Não encontrado';
const areaOf = (areas = [], id) => areas.find((area) => String(area.id) === String(id));
const professorOf = (professores = [], id) => professores.find((item) => String(item.id) === String(id));
const disciplinaOf = (disciplinas = [], id) => disciplinas.find((item) => String(item.id) === String(id));
const serieRule = (turmaName, semestre) => {
  const match = String(turmaName || '').match(/(\d+)\s*º|\b(\d+)\b/);
  const serie = match ? `${match[1] || match[2]}º` : null;
  return FC_RULES[Number(semestre) || 1]?.[serie];
};

const steps = [
  'Configuração',
  'Turmas',
  'Professores e Áreas',
  'Disciplinas e Atribuições',
  'Disponibilidades',
  'PDT',
  'Revisão e Geração',
];

export const Horarios = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [schools, setSchools] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [globalAreas, setGlobalAreas] = useState([]);
  const [currentConfig, setCurrentConfig] = useState(() => makeEmptyConfig(user?.escola_id || ''));
  const [manualProfessor, setManualProfessor] = useState({
    nome: '',
    area_id: '',
    max_aulas_consecutivas_default: 2,
    observacao: '',
  });
  const [disciplinaForm, setDisciplinaForm] = useState({ nome: '', area_id: '' });
  const [generatedSchedule, setGeneratedSchedule] = useState(emptyGrade);

  useEffect(() => {
    let alive = true;

    const loadInitial = async () => {
      try {
        setLoading(true);
        const [schoolsResult, turmasResult, configResult, areasResult, usersResult] = await Promise.all([
          supabase.from('escolas').select('*').order('nome', { ascending: true }),
          supabase.from('turmas').select('*').order('nome', { ascending: true }),
          supabase.from('horario_configuracoes').select('*').order('created_at', { ascending: false }),
          supabase.from('horario_areas').select('*').order('nome', { ascending: true }),
          supabase.from('usuarios').select('id, nome, area_id, escola_id, role_id').order('nome', { ascending: true }),
        ]);

        const firstError = [schoolsResult, turmasResult, configResult, areasResult, usersResult].find((result) => result?.error)?.error;
        if (firstError) throw firstError;

        const escolas = schoolsResult.data || [];
        const turmasData = turmasResult.data || [];
        const areasData = areasResult.data || [];
        const usersData = usersResult.data || [];
        const normalizedUsers = usersData.map((professor) => ({
          ...professor,
          area_nome: areasData.find((area) => String(area.id) === String(professor.area_id))?.nome || '',
        }));

        if (!alive) return;
        setSchools(escolas);
        setTurmas(turmasData);
        setGlobalAreas(areasData);
        setProfissionais(normalizedUsers);
        setConfigs(configResult.data || []);

        if (!selectedConfigId && configResult.data?.length) setSelectedConfigId(String(configResult.data[0].id));
        else if (!currentConfig.escola_id) {
          setCurrentConfig((prev) => ({ ...prev, escola_id: user?.escola_id || escolas[0]?.id || '' }));
        }
      } catch (error) {
        console.error(error);
        if (alive) notify.error(`Não foi possível carregar o módulo de horários: ${error.message || 'erro desconhecido'}.`);
      } finally {
        if (alive) setLoading(false);
      }
    };

    void loadInitial();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (!selectedConfigId) return;
    void loadConfiguration(selectedConfigId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConfigId]);

  const loadConfiguration = async (configId) => {
    try {
      setLoading(true);
      setGeneratedSchedule(emptyGrade);
      const [configResult, configTurmasResult, areasResult, disciplinasResult, professoresResult, pdtResult, linksResult, folgasResult, indisponibilidadesResult, formacaoResult, gradeResult] = await Promise.all([
        supabase.from('horario_configuracoes').select('*').eq('id', configId).maybeSingle(),
        supabase.from('horario_config_turmas').select('*').eq('configuracao_id', configId),
        supabase.from('horario_areas').select('*').eq('configuracao_id', configId).order('nome', { ascending: true }),
        supabase.from('horario_disciplinas').select('*').eq('configuracao_id', configId).order('nome', { ascending: true }),
        supabase.from('horario_professores').select('*').eq('configuracao_id', configId).order('nome', { ascending: true }),
        supabase.from('horario_pdt').select('*').eq('configuracao_id', configId),
        supabase.from('horario_professor_turma').select('*').eq('configuracao_id', configId),
        supabase.from('horario_professor_folgas').select('*').eq('configuracao_id', configId),
        supabase.from('horario_professor_indisponibilidades').select('*').eq('configuracao_id', configId),
        supabase.from('horario_formacao_area').select('*').eq('configuracao_id', configId),
        supabase.from('horario_grade_gerada').select('*').eq('configuracao_id', configId),
      ]);
      const results = [configResult, configTurmasResult, areasResult, disciplinasResult, professoresResult, pdtResult, linksResult, folgasResult, indisponibilidadesResult, formacaoResult, gradeResult];
      const firstError = results.find((result) => result?.error)?.error;
      if (firstError) throw firstError;
      if (!configResult.data) throw new Error('Configuração não encontrada.');

      const configTurmaMap = {};
      (configTurmasResult.data || []).forEach((item) => {
        configTurmaMap[String(item.turma_id)] = String(item.id);
      });
      const loadedAreas = makeAreas(areasResult.data || []);
      const loadedDisciplinas = (disciplinasResult.data || []).map((item) => ({ ...item, area_id: item.area_id ? String(item.area_id) : '' }));
      const loadedProfessores = (professoresResult.data || []).map((item) => ({
        id: String(item.id),
        nome: item.nome,
        usuario_id: item.usuario_id ? String(item.usuario_id) : null,
        area_id: item.area_id ? String(item.area_id) : '',
        max_aulas_consecutivas_default: Number(item.max_aulas_consecutivas_default || 2),
        observacao: item.observacao || '',
        origem: item.origem || (item.usuario_id ? 'banco' : 'manual'),
        manual: item.origem === 'manual',
      }));

      const loadedPdt = {};
      (pdtResult.data || []).forEach((item) => {
        const turmaId = configTurmasResult.data?.find((ct) => String(ct.id) === String(item.config_turma_id))?.turma_id;
        if (turmaId) loadedPdt[String(turmaId)] = String(item.professor_id);
      });

      const loadedLinks = (linksResult.data || []).map((item) => {
        const turmaId = configTurmasResult.data?.find((ct) => String(ct.id) === String(item.config_turma_id))?.turma_id;
        return {
          id: String(item.id),
          professor_id: String(item.professor_id),
          turma_id: turmaId ? String(turmaId) : '',
          disciplina_id: item.disciplina_id ? String(item.disciplina_id) : '',
          aulas_semana: Number(item.aulas_semanais || 0),
          max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2),
        };
      });

      const nextConfig = {
        nome: configResult.data.nome || '',
        escola_id: configResult.data.escola_id || user?.escola_id || '',
        ano_letivo: Number(configResult.data.ano_letivo || new Date().getFullYear()),
        semestre: Number(configResult.data.semestre || 1),
        turmas: normalizeIds((configTurmasResult.data || []).map((item) => item.turma_id)),
        configTurmaMap,
        professores: mergeProfessores({ professores: loadedProfessores }),
        professorTurmas: loadedLinks,
        pdt: loadedPdt,
        folgas: folgasResult.data || [],
        indisponibilidades: indisponibilidadesResult.data || [],
        formacaoArea: formacaoResult.data || [],
        areas: loadedAreas,
        disciplinas: loadedDisciplinas,
      };

      setCurrentConfig(nextConfig);
      setCurrentStep(1);
      setGeneratedSchedule(emptyGrade);
      reconstructGrade(gradeResult.data || [], nextConfig, turmas);
    } catch (error) {
      console.error(error);
      notify.error(`Não foi possível carregar a configuração: ${error.message || 'erro desconhecido'}.`);
    } finally {
      setLoading(false);
    }
  };

  const reconstructGrade = (gradeRows, config, turmasData) => {
    if (!gradeRows.length) {
      setGeneratedSchedule(emptyGrade);
      return;
    }

    const grid = {};
    const schedule = [];
    const validation = [];
    [...gradeRows]
      .sort((a, b) => Number(a.dia_semana) - Number(b.dia_semana) || Number(a.aula_numero) - Number(b.aula_numero))
      .forEach((row) => {
        const turmaId = Object.entries(config.configTurmaMap).find(([, configTurmaId]) => String(configTurmaId) === String(row.config_turma_id))?.[0];
        const turma = turmasData.find((item) => String(item.id) === String(turmaId));
        const professor = professorOf(config.professores, row.professor_id);
        const disciplina = row.disciplina_id ? disciplinaOf(config.disciplinas, row.disciplina_id) : null;
        const record = {
          turma_id: turmaId,
          turma_nome: turma?.nome || 'Turma',
          professor_id: row.professor_id,
          professor_nome: professor?.nome || 'Professor',
          disciplina_id: row.disciplina_id || null,
          disciplina: row.tipo === 'fc' ? 'Formação para a Cidadania' : disciplina?.nome || 'Disciplina não encontrada',
          dia: WEEK_DAYS[Number(row.dia_semana) - 1] || '',
          slot: Number(row.aula_numero),
          tipo: row.tipo === 'fc' ? 'FC' : 'Regular',
        };
        if (!turmaId || !professor || (row.tipo !== 'fc' && !disciplina)) validation.push({ bloqueante: true, mensagem: 'A grade persistida possui referência inválida.' });
        if (turmaId) (grid[turmaId] ||= []).push(record);
        schedule.push(record);
      });
    setGeneratedSchedule({ grid, schedule, validation, unscheduled: [] });
  };

  const currentAreaOptions = useMemo(() => currentConfig.areas.map((area) => ({ value: String(area.id), label: `${area.nome}${area.base === 'tecnica' ? ' · Técnica' : ''}` })), [currentConfig.areas]);
  const selectedProfessors = useMemo(() => currentConfig.professores, [currentConfig.professores]);
  const selectedProfessorOptions = useMemo(() => selectedProfessors.map((professor) => ({ value: String(professor.id), label: `${professor.nome}${areaOf(currentConfig.areas, professor.area_id) ? ` · ${areaOf(currentConfig.areas, professor.area_id).nome}` : ''}` })), [selectedProfessors, currentConfig.areas]);
  const selectedTurmaOptions = useMemo(() => currentConfig.turmas.map((id) => ({ value: String(id), label: nameOf(turmas, id) })), [currentConfig.turmas, turmas]);
  const selectedDisciplinaOptions = useMemo(() => currentConfig.disciplinas.map((item) => ({ value: String(item.id), label: `${item.nome} · ${areaOf(currentConfig.areas, item.area_id)?.nome || 'Área inválida'}` })), [currentConfig.disciplinas, currentConfig.areas]);
  const turmaIdOptions = selectedTurmaOptions;

  const setField = (field, value) => setCurrentConfig((prev) => ({ ...prev, [field]: value }));
  const selectedUser = (id) => profissionais.find((item) => String(item.id) === String(id));
  const mapUserAreaToConfig = (userRecord) => {
    if (!userRecord) return '';
    const byId = currentConfig.areas.find((area) => String(area.id) === String(userRecord.area_id));
    if (byId) return String(byId.id);
    const byName = currentConfig.areas.find((area) => String(area.nome).toLowerCase() === String(userRecord.area_nome || '').toLowerCase());
    return byName ? String(byName.id) : '';
  };

  const toggleBaseProfessor = (userId) => {
    const userRecord = selectedUser(userId);
    if (!userRecord) return;
    setCurrentConfig((prev) => {
      const exists = prev.professores.some((professor) => String(professor.usuario_id || professor.id) === String(userId));
      if (exists) return { ...prev, professores: prev.professores.filter((professor) => String(professor.usuario_id || professor.id) !== String(userId)) };
      return {
        ...prev,
        professores: [...prev.professores, {
          id: String(userRecord.id), usuario_id: String(userRecord.id), nome: userRecord.nome,
          area_id: mapUserAreaToConfig(userRecord), area_origem_id: userRecord.area_id ? String(userRecord.area_id) : '',
          max_aulas_consecutivas_default: 2, observacao: '', origem: 'banco', manual: false,
        }],
      };
    });
  };

  const updateProfessor = (professorId, field, value) => setCurrentConfig((prev) => ({ ...prev, professores: prev.professores.map((professor) => String(professor.id) === String(professorId) ? { ...professor, [field]: value } : professor) }));

  const addManualProfessor = () => {
    const nome = manualProfessor.nome.trim();
    if (!nome || !manualProfessor.area_id) return notify.error('Professor manual exige nome e área.');
    const professor = { id: createEntityId('prof'), usuario_id: null, nome, area_id: String(manualProfessor.area_id), max_aulas_consecutivas_default: Number(manualProfessor.max_aulas_consecutivas_default || 2), observacao: manualProfessor.observacao.trim(), origem: 'manual', manual: true };
    setCurrentConfig((prev) => ({ ...prev, professores: mergeProfessores({ professores: [...prev.professores, professor] }) }));
    setManualProfessor({ nome: '', area_id: '', max_aulas_consecutivas_default: 2, observacao: '' });
  };

  const addDisciplina = () => {
    const nome = disciplinaForm.nome.trim();
    const area = areaOf(currentConfig.areas, disciplinaForm.area_id);
    if (!nome || !area) return notify.error('Disciplina exige nome e uma área existente na configuração.');
    if (currentConfig.disciplinas.some((item) => String(item.nome).trim().toLowerCase() === nome.toLowerCase())) return notify.error('Já existe uma disciplina com esse nome na configuração.');
    setCurrentConfig((prev) => ({ ...prev, disciplinas: [...prev.disciplinas, { id: createEntityId('disc'), nome, area_id: String(area.id) }] }));
    setDisciplinaForm({ nome: '', area_id: '' });
  };

  const addProfessorTurma = () => setCurrentConfig((prev) => ({ ...prev, professorTurmas: [...prev.professorTurmas, { id: createEntityId('link'), professor_id: '', turma_id: '', disciplina_id: '', aulas_semana: 2, max_aulas_consecutivas: 2 }] }));
  const updateProfessorTurma = (id, field, value) => setCurrentConfig((prev) => ({ ...prev, professorTurmas: prev.professorTurmas.map((item) => item.id === id ? { ...item, [field]: value } : item) }));
  const removeProfessorTurma = (id) => setCurrentConfig((prev) => ({ ...prev, professorTurmas: prev.professorTurmas.filter((item) => item.id !== id) }));

  const toggleFolga = (professorId, diaSemana) => setCurrentConfig((prev) => {
    const exists = prev.folgas.some((item) => String(item.professor_id) === String(professorId) && Number(item.dia_semana) === Number(diaSemana));
    return { ...prev, folgas: exists ? prev.folgas.filter((item) => !(String(item.professor_id) === String(professorId) && Number(item.dia_semana) === Number(diaSemana))) : [...prev.folgas, { id: createEntityId('folga'), professor_id: professorId, dia_semana: Number(diaSemana) }] };
  });

  const toggleIndisponibilidade = (professorId, diaSemana, aulaNumero) => setCurrentConfig((prev) => {
    const exists = prev.indisponibilidades.some((item) => String(item.professor_id) === String(professorId) && Number(item.dia_semana) === Number(diaSemana) && Number(item.aula_numero) === Number(aulaNumero));
    return { ...prev, indisponibilidades: exists ? prev.indisponibilidades.filter((item) => !(String(item.professor_id) === String(professorId) && Number(item.dia_semana) === Number(diaSemana) && Number(item.aula_numero) === Number(aulaNumero))) : [...prev.indisponibilidades, { id: createEntityId('ind'), professor_id: professorId, dia_semana: Number(diaSemana), aula_numero: Number(aulaNumero) }] };
  });

  const toggleFormacao = (areaId, diaSemana, aulaNumero) => setCurrentConfig((prev) => {
    const exists = prev.formacaoArea.some((item) => String(item.area_id) === String(areaId) && Number(item.dia_semana) === Number(diaSemana) && Number(item.aula_numero) === Number(aulaNumero));
    return { ...prev, formacaoArea: exists ? prev.formacaoArea.filter((item) => !(String(item.area_id) === String(areaId) && Number(item.dia_semana) === Number(diaSemana) && Number(item.aula_numero) === Number(aulaNumero))) : [...prev.formacaoArea, { id: createEntityId('formacao'), area_id: areaId, dia_semana: Number(diaSemana), aula_numero: Number(aulaNumero) }] };
  });

  const validateConfig = () => {
    const problems = [];
    const areaIds = new Set(currentConfig.areas.map((area) => String(area.id)));
    const professorIds = new Set(currentConfig.professores.map((professor) => String(professor.id)));
    const turmaIds = new Set(currentConfig.turmas.map(String));
    const disciplinaIds = new Set(currentConfig.disciplinas.map((item) => String(item.id)));
    if (!currentConfig.nome.trim()) problems.push({ bloqueante: true, mensagem: 'Informe o nome da configuração.' });
    if (!currentConfig.escola_id) problems.push({ bloqueante: true, mensagem: 'Selecione a escola.' });
    if (!Number(currentConfig.ano_letivo)) problems.push({ bloqueante: true, mensagem: 'Informe o ano letivo.' });
    if (![1, 2].includes(Number(currentConfig.semestre))) problems.push({ bloqueante: true, mensagem: 'Selecione um semestre válido.' });
    if (!turmaIds.size) problems.push({ bloqueante: true, mensagem: 'Selecione pelo menos uma turma.' });
    if (!currentConfig.professores.length) problems.push({ bloqueante: true, mensagem: 'Adicione pelo menos um professor.' });
    currentConfig.professores.forEach((professor) => {
      if (!areaIds.has(String(professor.area_id))) problems.push({ bloqueante: true, professor: professor.nome, mensagem: 'Professor precisa estar vinculado a uma área da configuração.' });
    });
    currentConfig.disciplinas.forEach((disciplina) => {
      if (!disciplina.nome?.trim() || !areaIds.has(String(disciplina.area_id))) problems.push({ bloqueante: true, disciplina: disciplina.nome, mensagem: `Disciplina "${disciplina.nome || 'sem nome'}" precisa de uma área válida.` });
    });
    currentConfig.professorTurmas.forEach((link) => {
      const professor = professorOf(currentConfig.professores, link.professor_id);
      const turma = turmaIdOptions.find((item) => String(item.value) === String(link.turma_id));
      const disciplina = disciplinaOf(currentConfig.disciplinas, link.disciplina_id);
      const aulas = Number(link.aulas_semana);
      if (!professor || !turma || !disciplina || !disciplinaIds.has(String(link.disciplina_id)) || !Number.isFinite(aulas) || aulas <= 0 || !areaIds.has(String(disciplina.area_id))) problems.push({ bloqueante: true, mensagem: 'Existe um vínculo incompleto ou com disciplina sem área válida.' });
    });
    currentConfig.turmas.forEach((turmaId) => {
      const turma = turmas.find((item) => String(item.id) === String(turmaId));
      const rule = serieRule(turma?.nome, currentConfig.semestre);
      if (rule && !professorIds.has(String(currentConfig.pdt?.[turmaId]))) problems.push({ bloqueante: true, turma: turma?.nome, mensagem: 'Cada turma com FC obrigatória precisa de um PDT pertencente à configuração.' });
    });
    Object.entries(currentConfig.pdt || {}).forEach(([turmaId, professorId]) => {
      if (!turmaIds.has(String(turmaId))) return;
      if (!professorIds.has(String(professorId))) problems.push({ bloqueante: true, turma: nameOf(turmas, turmaId), mensagem: 'O PDT selecionado não pertence ao conjunto de professores da configuração.' });
    });
    currentConfig.formacaoArea.forEach((item) => {
      if (!areaIds.has(String(item.area_id)) || Number(item.dia_semana) < 1 || Number(item.dia_semana) > 5 || Number(item.aula_numero) < 1 || Number(item.aula_numero) > 9) problems.push({ bloqueante: true, mensagem: 'Existe uma formação de área inválida.' });
    });
    return problems;
  };

  const validationProblems = validateConfig();
  const blockingProblems = validationProblems.filter((problem) => problem.bloqueante !== false);

  const saveConfiguration = async () => {
    const problems = validateConfig();
    if (problems.length) {
      notify.error(problems[0].mensagem);
      return false;
    }
    setSaving(true);
    const configId = selectedConfigId || createEntityId('cfg');
    const selectedTurmas = currentConfig.turmas.map(String);
    const configTurmaRows = selectedTurmas.map((turmaId) => ({ id: currentConfig.configTurmaMap[turmaId] || createEntityId('ct'), configuracao_id: configId, escola_id: currentConfig.escola_id, turma_id: turmaId }));
    const configTurmaMap = Object.fromEntries(configTurmaRows.map((row) => [String(row.turma_id), String(row.id)]));
    const normalizedAreas = currentConfig.areas.map((area) => ({ id: area.id || createEntityId('area'), configuracao_id: configId, nome: area.nome, base: area.base }));
    const normalizedDisciplines = currentConfig.disciplinas.map((discipline) => ({ id: discipline.id || createEntityId('disc'), configuracao_id: configId, nome: discipline.nome.trim(), area_id: discipline.area_id }));
    const normalizedProfessors = currentConfig.professores.map((professor) => ({ id: professor.id || createEntityId('prof'), configuracao_id: configId, usuario_id: professor.usuario_id || null, nome: professor.nome.trim(), origem: professor.manual ? 'manual' : 'banco', area_id: professor.area_id, max_aulas_consecutivas_default: Number(professor.max_aulas_consecutivas_default || 2), observacao: professor.observacao || null }));
    const linkRows = currentConfig.professorTurmas.map((item) => ({ id: item.id || createEntityId('link'), configuracao_id: configId, professor_id: item.professor_id, disciplina_id: item.disciplina_id, config_turma_id: configTurmaMap[String(item.turma_id)], aulas_semanais: Number(item.aulas_semana), max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2) }));
    const professorIdSet = new Set(normalizedProfessors.map((item) => String(item.id)));
    const pdtRows = Object.entries(currentConfig.pdt || {}).filter(([turmaId, professorId]) => selectedTurmas.includes(String(turmaId)) && professorIdSet.has(String(professorId))).map(([turmaId, professorId]) => ({ id: createEntityId('pdt'), configuracao_id: configId, config_turma_id: configTurmaMap[String(turmaId)], professor_id: professorId }));
    const configPayload = { id: configId, nome: currentConfig.nome.trim(), escola_id: currentConfig.escola_id, ano_letivo: Number(currentConfig.ano_letivo), semestre: Number(currentConfig.semestre), status: 'rascunho', created_by: user?.id || null, updated_at: new Date().toISOString() };

    try {
      const { error: configError } = await supabase.from('horario_configuracoes').upsert(configPayload, { onConflict: 'id' });
      if (configError) throw configError;

      const deleteSteps = [
        ['horario_grade_gerada', 'grade'],
        ['horario_pdt', 'PDT'],
        ['horario_professor_turma', 'vínculos'],
        ['horario_professor_folgas', 'folgas'],
        ['horario_professor_indisponibilidades', 'indisponibilidades'],
        ['horario_formacao_area', 'formações'],
        ['horario_professores', 'professores'],
        ['horario_disciplinas', 'disciplinas'],
        ['horario_config_turmas', 'turmas da configuração'],
        ['horario_areas', 'áreas'],
      ];

      for (const [table, label] of deleteSteps) {
        const { error } = await supabase.from(table).delete().eq('configuracao_id', configId);
        if (error) throw new Error(`Falha ao limpar ${label}: ${error.message}`);
      }

      const insertSteps = [
        [normalizedAreas, 'horario_areas'],
        [configTurmaRows, 'horario_config_turmas'],
        [normalizedDisciplines, 'horario_disciplinas'],
        [normalizedProfessors, 'horario_professores'],
        [linkRows, 'horario_professor_turma'],
        [pdtRows, 'horario_pdt'],
        [currentConfig.folgas.map((item) => ({ id: item.id || createEntityId('folga'), configuracao_id: configId, professor_id: item.professor_id, dia_semana: Number(item.dia_semana) })), 'horario_professor_folgas'],
        [currentConfig.indisponibilidades.map((item) => ({ id: item.id || createEntityId('ind'), configuracao_id: configId, professor_id: item.professor_id, dia_semana: Number(item.dia_semana), aula_numero: Number(item.aula_numero) })), 'horario_professor_indisponibilidades'],
        [currentConfig.formacaoArea.map((item) => ({ id: item.id || createEntityId('formacao'), configuracao_id: configId, area_id: item.area_id, dia_semana: Number(item.dia_semana), aula_numero: Number(item.aula_numero) })), 'horario_formacao_area'],
      ];

      for (const [rows, table] of insertSteps) {
        if (!rows.length) continue;
        const { error } = await supabase.from(table).insert(rows);
        if (error) throw error;
      }

      setCurrentConfig((prev) => ({ ...prev, configTurmaMap, areas: normalizedAreas, disciplinas: normalizedDisciplines, professores: normalizedProfessors }));
      setSelectedConfigId(configId);
      setConfigs((prev) => [{ ...configPayload, created_at: prev.find((item) => String(item.id) === String(configId))?.created_at || new Date().toISOString() }, ...prev.filter((item) => String(item.id) !== String(configId))]);
      notify.success('Configuração salva com sucesso.');
      return true;
    } catch (error) {
      console.error(error);
      notify.error(`Falha ao persistir a configuração: ${error.message || 'erro desconhecido'}.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleNext = async () => {
    if (currentStep === 1 && !(await saveConfiguration())) return;
    if (currentStep === 2 && currentConfig.turmas.length === 0) return notify.error('Selecione pelo menos uma turma.');
    if (currentStep === 3 && currentConfig.professores.some((professor) => !areaOf(currentConfig.areas, professor.area_id))) return notify.error('Vincule todos os professores a uma área da configuração.');
    if (currentStep === 4 && validateConfig().length) return notify.error(validateConfig()[0].mensagem);
    if (currentStep < 7) setCurrentStep((step) => step + 1);
  };

  const handleBack = () => setCurrentStep((step) => Math.max(1, step - 1));
  const newConfiguration = () => {
    setSelectedConfigId('');
    setCurrentConfig(makeEmptyConfig(user?.escola_id || schools[0]?.id || ''));
    setGeneratedSchedule(emptyGrade);
    setManualProfessor({ nome: '', area_id: '', max_aulas_consecutivas_default: 2, observacao: '' });
    setDisciplinaForm({ nome: '', area_id: '' });
    setCurrentStep(1);
  };

  const handleGenerate = async () => {
    const problems = validateConfig();
    if (problems.length) {
      setGeneratedSchedule({ ...emptyGrade, validation: problems });
      notify.error(problems[0].mensagem);
      return;
    }
    if (!selectedConfigId) return notify.error('Salve a configuração antes de gerar o horário.');
    const result = generateHorario({ configuracao: currentConfig, turmas, professores: currentConfig.professores, vinculos: currentConfig.professorTurmas, pdtMap: currentConfig.pdt, areas: currentConfig.areas, disciplinas: currentConfig.disciplinas, folgas: currentConfig.folgas, indisponibilidades: currentConfig.indisponibilidades, formacoesArea: currentConfig.formacaoArea, fcRules: FC_RULES[currentConfig.semestre] });
    setGeneratedSchedule(result);
    setCurrentStep(7);
    if (result.validation.length || result.unscheduled.length) {
      notify.error('O gerador encontrou restrições não satisfeitas. A grade parcial não foi persistida.');
      return;
    }
    const saved = await saveGeneratedGrade(result);
    if (saved) notify.success(`Horário gerado e salvo com ${result.schedule.length} aulas.`);
  };

  const saveGeneratedGrade = async (result) => {
    if (!selectedConfigId) return false;
    try {
      const { data: configTurmaRows, error: configTurmaError } = await supabase.from('horario_config_turmas').select('id, turma_id').eq('configuracao_id', selectedConfigId);
      if (configTurmaError) throw configTurmaError;
      const turmaToConfig = Object.fromEntries((configTurmaRows || []).map((item) => [String(item.turma_id), String(item.id)]));
      const gradeRows = (result.schedule || []).map((aula) => {
        const configTurmaId = turmaToConfig[String(aula.turma_id)];
        if (!configTurmaId || !aula.professor_id || Number(aula.slot) < 1 || Number(aula.slot) > 9) throw new Error(`Aula inválida para persistência: turma ${aula.turma_id}, aula ${aula.slot}.`);
        return { id: createEntityId('grade'), configuracao_id: selectedConfigId, config_turma_id: configTurmaId, dia_semana: WEEK_DAYS.indexOf(aula.dia) + 1, aula_numero: Number(aula.slot), professor_id: aula.professor_id, disciplina_id: aula.tipo === 'FC' ? null : aula.disciplina_id, tipo: aula.tipo === 'FC' ? 'fc' : 'aula' };
      });
      if (gradeRows.some((row) => row.dia_semana < 1 || row.dia_semana > 5)) throw new Error('Existe uma aula com dia da semana inválido.');
      const { error: deleteError } = await supabase.from('horario_grade_gerada').delete().eq('configuracao_id', selectedConfigId);
      if (deleteError) throw deleteError;
      if (gradeRows.length) {
        const { error: insertError } = await supabase.from('horario_grade_gerada').insert(gradeRows);
        if (insertError) throw insertError;
      }
      return true;
    } catch (error) {
      console.error(error);
      notify.error(`Não foi possível salvar a grade: ${error.message || 'erro desconhecido'}.`);
      return false;
    }
  };

  const exportPdf = () => {
    if (!generatedSchedule.schedule.length) return notify.error('Não existe grade gerada para exportar.');
    const doc = new jsPDF({ orientation: 'landscape' });
    const escola = schools.find((item) => String(item.id) === String(currentConfig.escola_id))?.nome || 'Escola';
    let y = 14;
    doc.setFontSize(14); doc.text(escola, 14, y); y += 7;
    doc.setFontSize(11); doc.text(`${currentConfig.nome} · ${currentConfig.ano_letivo} · ${currentConfig.semestre}º semestre`, 14, y); y += 8;
    currentConfig.turmas.forEach((turmaId) => {
      const turma = turmas.find((item) => String(item.id) === String(turmaId));
      if (y > 185) { doc.addPage(); y = 14; }
      doc.setFontSize(12); doc.text(turma?.nome || 'Turma', 14, y); y += 6; doc.setFontSize(8.5);
      SLOT_DEFINITIONS.forEach((slot) => {
        doc.text(`${slot.label} (${slot.time})`, 14, y);
        WEEK_DAYS.forEach((day, index) => {
          const aula = generatedSchedule.grid[String(turmaId)]?.find((item) => item.dia === day && Number(item.slot) === slot.slot);
          const label = aula ? `${aula.tipo === 'FC' ? 'FC · ' : ''}${aula.disciplina} · ${aula.professor_nome}` : '—';
          doc.text(`${day.slice(0, 3)}: ${label}`.slice(0, 44), 55 + index * 45, y);
        });
        y += 5;
      });
      y += 7;
    });
    doc.save(`horario_${currentConfig.nome || 'configuracao'}.pdf`);
  };

  const exportExcel = () => {
    if (!generatedSchedule.schedule.length) return notify.error('Não existe grade gerada para exportar.');
    const rows = [];
    const escola = schools.find((item) => String(item.id) === String(currentConfig.escola_id))?.nome || 'Escola';
    currentConfig.turmas.forEach((turmaId) => {
      const turma = turmas.find((item) => String(item.id) === String(turmaId));
      SLOT_DEFINITIONS.forEach((slot) => WEEK_DAYS.forEach((day) => {
        const aula = generatedSchedule.grid[String(turmaId)]?.find((item) => item.dia === day && Number(item.slot) === slot.slot);
        rows.push({ Escola: escola, Configuração: currentConfig.nome, Turma: turma?.nome || 'Turma', Dia: day, Horário: slot.time, Aula: slot.label, Disciplina: aula?.disciplina || '', Professor: aula?.professor_nome || '', Tipo: aula?.tipo === 'FC' ? 'FC' : aula ? 'Aula' : '' });
      }));
    });
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [18, 24, 18, 18, 18, 8, 30, 28, 10].map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Horários');
    XLSX.writeFile(workbook, `horario_${currentConfig.nome || 'configuracao'}.xlsx`);
  };

  const renderStep = () => {
    if (currentStep === 1) return <div className="grid gap-4 md:grid-cols-2"><FormInput label="Nome da configuração" value={currentConfig.nome} onChange={(event) => setField('nome', event.target.value)} placeholder="Horário 2026.2" /><label className="space-y-1 text-sm font-medium">Escola<select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" value={String(currentConfig.escola_id || '')} onChange={(event) => setField('escola_id', event.target.value)}><option value="">Selecione</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.nome}</option>)}</select></label><FormInput label="Ano letivo" type="number" value={currentConfig.ano_letivo} onChange={(event) => setField('ano_letivo', Number(event.target.value))} /><label className="space-y-1 text-sm font-medium">Semestre<select className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2" value={String(currentConfig.semestre)} onChange={(event) => setField('semestre', Number(event.target.value))}><option value="1">1º semestre</option><option value="2">2º semestre</option></select></label></div>;

    if (currentStep === 2) return <div className="space-y-4"><div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{turmas.map((turma) => <label key={turma.id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={currentConfig.turmas.includes(String(turma.id))} onChange={() => setField('turmas', currentConfig.turmas.includes(String(turma.id)) ? currentConfig.turmas.filter((id) => String(id) !== String(turma.id)) : [...currentConfig.turmas, String(turma.id)])} /><span>{turma.nome}</span></label>)}</div><div className="rounded-xl bg-slate-50 p-4 text-sm">{currentConfig.turmas.length ? currentConfig.turmas.map((id) => nameOf(turmas, id)).join(' · ') : 'Nenhuma turma selecionada.'}</div></div>;

    if (currentStep === 3) return <div className="space-y-6"><div className="flex flex-wrap gap-2">{FIXED_AREAS.map((area) => <span key={area.nome} className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">{area.nome}{area.base === 'tecnica' ? ' · Técnica' : ''}</span>)}</div><div className="grid gap-3 md:grid-cols-2">{profissionais.filter((professor) => !currentConfig.professores.some((selected) => String(selected.usuario_id || selected.id) === String(professor.id))).slice(0, 80).map((professor) => <button key={professor.id} type="button" onClick={() => toggleBaseProfessor(professor.id)} className="rounded-xl border border-slate-200 p-3 text-left hover:border-green-500"><strong>{professor.nome}</strong><div className="text-xs text-slate-500">{professor.area_nome || 'Área não informada'}</div></button>)}</div><div className="rounded-2xl border border-slate-200 p-4 space-y-4"><div className="grid gap-3 md:grid-cols-4"><FormInput label="Professor manual" value={manualProfessor.nome} onChange={(event) => setManualProfessor((prev) => ({ ...prev, nome: event.target.value }))} /><label className="space-y-1 text-sm font-medium">Área<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={manualProfessor.area_id} onChange={(event) => setManualProfessor((prev) => ({ ...prev, area_id: event.target.value }))}><option value="">Selecione</option>{currentAreaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><FormInput label="Máx. consecutivas" type="number" value={manualProfessor.max_aulas_consecutivas_default} onChange={(event) => setManualProfessor((prev) => ({ ...prev, max_aulas_consecutivas_default: Number(event.target.value) || 2 }))} /><FormInput label="Observação" value={manualProfessor.observacao} onChange={(event) => setManualProfessor((prev) => ({ ...prev, observacao: event.target.value }))} /></div><Button type="button" onClick={addManualProfessor} variant="secondary"><FaPlus className="mr-2" />Adicionar manual</Button></div><div className="space-y-3">{selectedProfessors.map((professor) => <div key={professor.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[1.4fr_1fr_160px_2fr]"><div><strong>{professor.nome}</strong><div className="text-xs text-slate-500">{professor.manual ? 'Manual' : 'Base'}</div></div><select className="rounded-xl border border-slate-300 px-3 py-2" value={professor.area_id || ''} onChange={(event) => updateProfessor(professor.id, 'area_id', event.target.value)}><option value="">Selecione área</option>{currentAreaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input className="rounded-xl border border-slate-300 px-3 py-2" type="number" min="1" value={professor.max_aulas_consecutivas_default || 2} onChange={(event) => updateProfessor(professor.id, 'max_aulas_consecutivas_default', Number(event.target.value) || 2)} /><input className="rounded-xl border border-slate-300 px-3 py-2" value={professor.observacao || ''} onChange={(event) => updateProfessor(professor.id, 'observacao', event.target.value)} placeholder="Observação" /></div>)}</div></div>;

    if (currentStep === 4) return <div className="space-y-6"><div className="rounded-2xl border border-slate-200 p-4"><div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]"><FormInput label="Disciplina" value={disciplinaForm.nome} onChange={(event) => setDisciplinaForm((prev) => ({ ...prev, nome: event.target.value }))} /><label className="space-y-1 text-sm font-medium">Área<select className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2" value={disciplinaForm.area_id} onChange={(event) => setDisciplinaForm((prev) => ({ ...prev, area_id: event.target.value }))}><option value="">Selecione</option>{currentAreaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="flex items-end"><Button type="button" onClick={addDisciplina} variant="secondary"><FaPlus className="mr-2" />Adicionar</Button></div></div></div><div className="flex flex-wrap gap-2">{currentConfig.disciplinas.map((discipline) => <span key={discipline.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{discipline.nome} · {areaOf(currentConfig.areas, discipline.area_id)?.nome || 'Área inválida'}</span>)}</div><div className="space-y-3"><div className="flex items-center justify-between"><h3 className="font-semibold">Vínculos</h3><Button type="button" onClick={addProfessorTurma} variant="secondary">Adicionar vínculo</Button></div>{currentConfig.professorTurmas.map((link) => <div key={link.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-6"><select className="rounded-xl border border-slate-300 px-3 py-2" value={link.professor_id} onChange={(event) => updateProfessorTurma(link.id, 'professor_id', event.target.value)}><option value="">Professor</option>{selectedProfessorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select className="rounded-xl border border-slate-300 px-3 py-2" value={link.turma_id} onChange={(event) => updateProfessorTurma(link.id, 'turma_id', event.target.value)}><option value="">Turma</option>{selectedTurmaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select className="rounded-xl border border-slate-300 px-3 py-2" value={link.disciplina_id} onChange={(event) => updateProfessorTurma(link.id, 'disciplina_id', event.target.value)}><option value="">Disciplina</option>{selectedDisciplinaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input className="rounded-xl border border-slate-300 px-3 py-2" type="number" min="1" value={link.aulas_semana} onChange={(event) => updateProfessorTurma(link.id, 'aulas_semana', Number(event.target.value) || 0)} /><input className="rounded-xl border border-slate-300 px-3 py-2" type="number" min="1" value={link.max_aulas_consecutivas} onChange={(event) => updateProfessorTurma(link.id, 'max_aulas_consecutivas', Number(event.target.value) || 1)} /><button type="button" className="rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700" onClick={() => removeProfessorTurma(link.id)}>Remover</button></div>)}</div></div>;

    if (currentStep === 5) return <div className="space-y-6"><div className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-3 font-semibold">Folgas</h3>{selectedProfessors.map((professor) => <div key={professor.id} className="mb-3 flex flex-wrap items-center gap-2"><strong className="mr-2 w-40 text-sm">{professor.nome}</strong>{[1,2,3,4,5].map((dia) => { const active = currentConfig.folgas.some((item) => String(item.professor_id) === String(professor.id) && Number(item.dia_semana) === dia); return <button key={dia} type="button" onClick={() => toggleFolga(professor.id, dia)} className={`rounded-full px-3 py-1 text-xs font-semibold ${active ? 'bg-red-600 text-white' : 'bg-slate-100'}`}>{['Seg','Ter','Qua','Qui','Sex'][dia - 1]}</button>; })}</div>)}</div><div className="rounded-2xl border border-slate-200 p-4 overflow-x-auto"><h3 className="mb-3 font-semibold">Indisponibilidades</h3>{selectedProfessors.map((professor) => <div key={professor.id} className="mb-5"><strong>{professor.nome}</strong><div className="mt-2 grid min-w-[760px] grid-cols-5 gap-2">{[1,2,3,4,5].map((dia) => <div key={dia} className="rounded-lg bg-slate-50 p-2"><div className="mb-2 text-xs font-semibold">{['Seg','Ter','Qua','Qui','Sex'][dia - 1]}</div><div className="grid grid-cols-5 gap-1">{SLOT_DEFINITIONS.map((slot) => { const active = currentConfig.indisponibilidades.some((item) => String(item.professor_id) === String(professor.id) && Number(item.dia_semana) === dia && Number(item.aula_numero) === slot.slot); return <button key={slot.slot} type="button" onClick={() => toggleIndisponibilidade(professor.id, dia, slot.slot)} className={`h-7 rounded text-[10px] ${active ? 'bg-orange-500 text-white' : 'bg-slate-200'}`}>{slot.slot}</button>; })}</div></div>)}</div></div>)}</div><div className="rounded-2xl border border-slate-200 p-4 overflow-x-auto"><h3 className="mb-3 font-semibold">Formação por área</h3>{currentConfig.areas.map((area) => <div key={area.id} className="mb-5"><strong>{area.nome}</strong><div className="mt-2 grid min-w-[760px] grid-cols-5 gap-2">{[1,2,3,4,5].map((dia) => <div key={dia} className="rounded-lg bg-slate-50 p-2"><div className="mb-2 text-xs font-semibold">{['Seg','Ter','Qua','Qui','Sex'][dia - 1]}</div><div className="grid grid-cols-5 gap-1">{SLOT_DEFINITIONS.map((slot) => { const active = currentConfig.formacaoArea.some((item) => String(item.area_id) === String(area.id) && Number(item.dia_semana) === dia && Number(item.aula_numero) === slot.slot); return <button key={slot.slot} type="button" onClick={() => toggleFormacao(area.id, dia, slot.slot)} className={`h-7 rounded text-[10px] ${active ? 'bg-amber-500 text-white' : 'bg-slate-200'}`}>{slot.slot}</button>; })}</div></div>)}</div></div>)}</div></div>;

    if (currentStep === 6) return <div className="space-y-3">{currentConfig.turmas.map((turmaId) => { const turma = turmas.find((item) => String(item.id) === String(turmaId)); const rule = serieRule(turma?.nome, currentConfig.semestre); return <div key={turmaId} className="rounded-xl border border-slate-200 p-4"><div className="mb-2 font-semibold">{turma?.nome || 'Turma'}{rule ? ` · FC ${rule.dia} · ${rule.slot}ª` : ' · sem regra de FC'}</div><select className="w-full rounded-xl border border-slate-300 px-3 py-2" value={currentConfig.pdt?.[turmaId] || ''} onChange={(event) => setCurrentConfig((prev) => ({ ...prev, pdt: { ...prev.pdt, [turmaId]: event.target.value } }))}><option value="">Selecione o PDT</option>{selectedProfessorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; })}</div>;

    return <div className="space-y-6"><div className="grid gap-4 md:grid-cols-2"><Card title="Configuração" content={`${currentConfig.nome || 'Sem nome'} · ${currentConfig.ano_letivo} · ${currentConfig.semestre}º semestre`} /><Card title="Aulas geradas" content={generatedSchedule.schedule.length} /></div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">Turmas</h3><div className="text-sm">{currentConfig.turmas.map((id) => nameOf(turmas, id)).join(' · ') || 'Nenhuma'}</div></div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">Professores</h3>{currentConfig.professores.map((professor) => <div key={professor.id} className="text-sm">{professor.nome} · {areaOf(currentConfig.areas, professor.area_id)?.nome || 'Área inválida'}</div>)}</div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">Disciplinas</h3>{currentConfig.disciplinas.map((discipline) => <div key={discipline.id} className="text-sm">{discipline.nome} · {areaOf(currentConfig.areas, discipline.area_id)?.nome || 'Área inválida'}</div>)}</div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">Atribuições</h3>{currentConfig.professorTurmas.map((link) => <div key={link.id} className="text-sm">{professorOf(currentConfig.professores, link.professor_id)?.nome || 'Professor'} · {nameOf(turmas, link.turma_id)} · {disciplinaOf(currentConfig.disciplinas, link.disciplina_id)?.nome || 'Disciplina'} · {link.aulas_semana} aulas/semana</div>)}</div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">PDT</h3>{currentConfig.turmas.map((turmaId) => <div key={turmaId} className="text-sm">{nameOf(turmas, turmaId)} → {professorOf(currentConfig.professores, currentConfig.pdt?.[turmaId])?.nome || 'não definido'}</div>)}</div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">Restrições</h3><div className="text-sm">{currentConfig.folgas.length} folgas · {currentConfig.indisponibilidades.length} indisponibilidades · {currentConfig.formacaoArea.length} formações</div></div><div className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">Problemas encontrados</h3>{blockingProblems.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-red-700">{blockingProblems.map((problem, index) => <li key={`${index}-${problem.mensagem}`}>{problem.turma ? `${problem.turma} · ` : ''}{problem.professor ? `${problem.professor} · ` : ''}{problem.mensagem}</li>)}</ul> : <p className="text-sm text-green-700">Nenhum erro bloqueante.</p>}</div>{generatedSchedule.schedule.length > 0 && <div className="space-y-5"><div className="flex flex-wrap gap-2"><Button type="button" onClick={handleGenerate}><FaCalendarAlt className="mr-2" />Gerar horário</Button><Button type="button" onClick={exportPdf} variant="secondary"><FaFilePdf className="mr-2" />PDF</Button><Button type="button" onClick={exportExcel} variant="secondary"><FaFileExcel className="mr-2" />Excel</Button></div>{currentConfig.turmas.map((turmaId) => <div key={turmaId} className="rounded-2xl border border-slate-200 p-4"><h3 className="mb-3 text-lg font-bold">{nameOf(turmas, turmaId)}</h3><div className="overflow-x-auto"><table className="min-w-full border-collapse text-xs"><thead><tr><th className="border p-2 text-left">Aula</th>{WEEK_DAYS.map((day) => <th key={day} className="border p-2 text-left">{day}</th>)}</tr></thead><tbody>{SLOT_DEFINITIONS.map((slot) => <tr key={slot.slot}><td className="border p-2 font-semibold">{slot.label} · {slot.time}</td>{WEEK_DAYS.map((day) => { const aula = generatedSchedule.grid[String(turmaId)]?.find((item) => item.dia === day && Number(item.slot) === slot.slot); return <td key={`${day}-${slot.slot}`} className="border p-2">{aula ? <div><div className="font-semibold">{aula.tipo === 'FC' ? 'FC · ' : ''}{aula.disciplina}</div><div>{aula.professor_nome}</div></div> : <span className="text-slate-400">—</span>}</td>; })}</tr>)}</tbody></table></div></div>)}</div>}{(generatedSchedule.validation || []).length > 0 && <div className="rounded-2xl border border-red-200 bg-red-50 p-4"><h3 className="font-semibold text-red-800">Conflitos e aulas não distribuídas</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-red-800">{generatedSchedule.validation.map((problem, index) => <li key={index}>{problem.professor ? `${problem.professor} · ` : ''}{problem.turma ? `${problem.turma} · ` : ''}{problem.disciplina ? `${problem.disciplina} · ` : ''}{problem.solicitadas ? `${problem.distribuídas}/${problem.solicitadas} distribuídas · ` : ''}{problem.mensagem}</li>)}</ul></div>}</div>;
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-600"><FaSpinner className="animate-spin" /> Carregando módulo de horários...</div>;

  return <div className="space-y-6"><PageTitle title="Módulo de Horários Escolares" subtitle="Configuração, validação, geração e exportação de horários." /><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{configs.map((config) => <button key={config.id} type="button" onClick={() => setSelectedConfigId(String(config.id))} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${String(selectedConfigId) === String(config.id) ? 'bg-green-700 text-white' : 'bg-slate-100'}`}>{config.nome}</button>)}</div><Button type="button" variant="secondary" onClick={newConfiguration}>Nova configuração</Button></div><div className="grid gap-2 md:grid-cols-7">{steps.map((step, index) => { const number = index + 1; return <button key={step} type="button" onClick={() => number <= currentStep && setCurrentStep(number)} className={`rounded-xl px-3 py-2 text-xs font-semibold ${number === currentStep ? 'bg-green-700 text-white' : number < currentStep ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>{number}. {step}</button>; })}</div><div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">{renderStep()}<div className="mt-6 flex flex-wrap justify-between gap-3 border-t border-slate-100 pt-4"><div className="flex gap-2"><Button type="button" variant="secondary" disabled={currentStep === 1 || saving} onClick={handleBack}>Voltar</Button>{currentStep < 7 && <Button type="button" onClick={handleNext} disabled={saving}>{saving ? 'Salvando...' : currentStep === 1 ? 'Salvar e continuar' : 'Continuar'}</Button>}</div><div className="flex gap-2"><Button type="button" variant="secondary" onClick={saveConfiguration} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>{currentStep === 7 && <Button type="button" onClick={handleGenerate} disabled={blockingProblems.length > 0 || !selectedConfigId || saving}><FaCalendarAlt className="mr-2" />Gerar horário</Button>}</div></div></div></div>;
};
