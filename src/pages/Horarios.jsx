import { useEffect, useMemo, useState } from 'react';
import { FaCalendarAlt, FaDownload, FaFileExcel, FaFilePdf, FaPlus, FaSpinner, FaUsers } from 'react-icons/fa';
import * as XLSX from 'xlsx';

import { supabase } from '../utils/supabase';
import { notify } from '../utils/notify';
import { useAuth } from '../hooks/useAuth';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { FormInput } from '../components/ui/FormInput';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Card } from '../components/ui/Card';
import {
  FC_RULES,
  FIXED_AREAS,
  SLOT_DEFINITIONS,
  WEEK_DAYS,
  generateHorario,
} from '../services/horarioService';

const STORAGE_KEY = 'log_zelia_horarios';

const createEntityId = (prefix = 'id') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildLocalState = (key, defaultValue) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch (error) {
    return defaultValue;
  }
};

const saveLocalState = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const normalizeArray = (value) => (Array.isArray(value) ? value : []);

const formatProfessorOptions = (items = []) =>
  items.map((item) => ({
    value: String(item.id),
    label: `${item.nome} ${item.area_nome ? `- ${item.area_nome}` : ''}`,
  }));

const getTurmaLabel = (turmas = [], id) =>
  turmas.find((turma) => String(turma.id) === String(id))?.nome || 'Turma';

const getProfessorName = (professores = [], id) =>
  professores.find((professor) => String(professor.id) === String(id))?.nome || 'Professor';

const getDisciplinaName = (disciplinas = [], id) =>
  disciplinas.find((disciplina) => String(disciplina.id) === String(id))?.nome || 'Disciplina';

export const Horarios = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [configs, setConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [activeTab, setActiveTab] = useState('configuracoes');
  const [currentConfig, setCurrentConfig] = useState({
    nome: '',
    escola_id: user?.escola_id || '',
    ano_letivo: new Date().getFullYear(),
    semestre: 1,
    turmas: [],
    professores: [],
    professorManual: [],
    professorTurmas: [],
    pdt: {},
    folgas: [],
    indisponibilidades: [],
    formacaoArea: [],
    areas: FIXED_AREAS.map((area) => ({ id: createEntityId('area'), ...area })),
    disciplinas: [],
  });
  const [schools, setSchools] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [areas, setAreas] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [profissionais, setProfissionais] = useState([]);
  const [manualProfessor, setManualProfessor] = useState({
    nome: '',
    area_id: '',
    max_aulas_consecutivas_default: 2,
    observacao: '',
  });
  const [generatedSchedule, setGeneratedSchedule] = useState({ grid: {}, schedule: [], validation: [] });
  const [statusMessage, setStatusMessage] = useState('');
  const [disciplinaForm, setDisciplinaForm] = useState({ nome: '', area_id: '' });

  useEffect(() => {
    loadModuleData();
  }, [user]);

  useEffect(() => {
    if (selectedConfigId) {
      loadGradeGerada(selectedConfigId);
    }
  }, [selectedConfigId]);


  const professorOptions = useMemo(
    () => formatProfessorOptions(profissionais),
    [profissionais],
  );

  const turmaOptions = useMemo(
    () =>
      turmas.map((turma) => ({
        value: String(turma.id),
        label: turma.nome,
      })),
    [turmas],
  );

  const areaOptions = useMemo(
    () =>
      areas.map((area) => ({
        value: String(area.id),
        label: `${area.nome} (${area.base || 'comum'})`,
      })),
    [areas],
  );

  const disciplinaOptions = useMemo(
    () =>
      disciplinas.map((disciplina) => ({
        value: String(disciplina.id),
        label: `${disciplina.nome} ${disciplina.area_nome ? `- ${disciplina.area_nome}` : ''}`,
      })),
    [disciplinas],
  );

  async function loadModuleData() {
    try {
      setLoading(true);

      const localConfigs = buildLocalState(STORAGE_KEY, []);

      const schoolsResult = await supabase.from('escolas').select('*').order('nome', { ascending: true });
      const turmasResult = await supabase.from('turmas').select('*').order('nome', { ascending: true });
      const configResult = await supabase.from('horario_configuracoes').select('*').order('created_at', { ascending: false });
      const areasResult = await supabase.from('horario_areas').select('*').order('nome', { ascending: true });
      const disciplinasResult = await supabase.from('horario_disciplinas').select('*').order('nome', { ascending: true });
      const professoresResult = await supabase.from('usuarios').select('id, nome, escola_id, role_id').order('nome', { ascending: true });

      const escolas = schoolsResult?.data || [];
      const turmasData = turmasResult?.data || [];
      const areasData = areasResult?.data || [];
      const disciplinasData = disciplinasResult?.data || [];
      const professorData = (professoresResult?.data || []).map((prof) => ({
        ...prof,
        area_nome: areasData.find((area) => String(area.id) === String(prof.area_id))?.nome || '',
      }));

      setSchools(escolas);
      setTurmas(turmasData);
      setAreas(areasData);
      setDisciplinas(disciplinasData);
      setProfissionais(professorData);

      const configList = configResult?.data || localConfigs || [];
      setConfigs(configList);

      if (configList.length > 0 && !selectedConfigId) {
        setSelectedConfigId(String(configList[0].id || configList[0].configuracao_id || ''));
      }

      if (!currentConfig.nome) {
        setCurrentConfig((prev) => ({
          ...prev,
          escola_id: user?.escola_id || prev.escola_id || escolas[0]?.id || '',
        }));
      }
    } catch (error) {
      console.error(error);
      setConfigs(buildLocalState(STORAGE_KEY, []));
      notify.error('Não foi possível carregar os dados do módulo de horários.');
    } finally {
      setLoading(false);
    }
  }

  const loadConfigDetails = async (configId) => {
    if (!configId) return;

    try {
      const turmasResult = await supabase.from('horario_config_turmas').select('*').eq('configuracao_id', configId);
      const areasResult = await supabase.from('horario_areas').select('*').eq('configuracao_id', configId).order('nome', { ascending: true });
      const disciplinasResult = await supabase.from('horario_disciplinas').select('*').eq('configuracao_id', configId).order('nome', { ascending: true });
      const professoresResult = await supabase.from('horario_professores').select('*').eq('configuracao_id', configId);
      const pdtResult = await supabase.from('horario_pdt').select('*').eq('configuracao_id', configId);
      const professorTurmaResult = await supabase.from('horario_professor_turma').select('*').eq('configuracao_id', configId);
      const folgasResult = await supabase.from('horario_professor_folgas').select('*').eq('configuracao_id', configId);
      const indisponibilidadesResult = await supabase.from('horario_professor_indisponibilidades').select('*').eq('configuracao_id', configId);
      const formacaoAreaResult = await supabase.from('horario_formacao_area').select('*').eq('configuracao_id', configId);

      const config = configs.find((item) => String(item.id) === String(configId)) || {};
      const turmaIds = (turmasResult?.data || []).map((item) => String(item.turma_id));
      const turmaIdByConfigTurma = {};
      (turmasResult?.data || []).forEach((item) => {
        turmaIdByConfigTurma[String(item.id)] = String(item.turma_id);
      });
      const pdtMap = {};
      (pdtResult?.data || []).forEach((item) => {
        const turmaKey = item.config_turma_id;
        pdtMap[turmaKey] = String(item.professor_id);
      });
      const professorTurmas = (professorTurmaResult?.data || []).map((item) => ({
        id: item.id,
        professor_id: String(item.professor_id),
        turma_id: turmaIdByConfigTurma[String(item.config_turma_id)] || String(item.config_turma_id),
        disciplina_id: String(item.disciplina_id),
        aulas_semana: Number(item.aulas_semanais || 0),
        max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2),
      }));

      setCurrentConfig((prev) => ({
        ...prev,
        nome: config.nome || prev.nome,
        escola_id: config.escola_id || prev.escola_id,
        ano_letivo: config.ano_letivo || prev.ano_letivo,
        semestre: config.semestre || prev.semestre,
        turmas: turmaIds,
        areas: areasResult?.data || [],
        disciplinas: disciplinasResult?.data || [],
        professores: (professoresResult?.data || []).map((item) => ({
          id: item.id,
          nome: item.nome,
          area_id: item.area_id,
          max_aulas_consecutivas_default: item.max_aulas_consecutivas_default,
          origem: item.origem,
          usuario_id: item.usuario_id,
        })),
        professorTurmas,
        pdt: pdtMap,
        folgas: folgasResult?.data || [],
        indisponibilidades: indisponibilidadesResult?.data || [],
        formacaoArea: formacaoAreaResult?.data || [],
      }));
    } catch (error) {
      console.error(error);
      notify.error('Não foi possível carregar a configuração selecionada.');
    }
  };

  const loadGradeGerada = async (configId) => {
    if (!configId) return;

    try {
      const { data: gradeData } = await supabase
        .from('horario_grade_gerada')
        .select('*')
        .eq('configuracao_id', configId);

      if (!gradeData || gradeData.length === 0) return;

      const { data: configTurmas } = await supabase
        .from('horario_config_turmas')
        .select('id, turma_id')
        .eq('configuracao_id', configId);

      const configTurmaParaTurma = {};
      (configTurmas || []).forEach((item) => {
        configTurmaParaTurma[String(item.id)] = item.turma_id;
      });

      const grid = {};
      const schedule = [];

      gradeData.forEach((aula) => {
        const turmaId = configTurmaParaTurma[String(aula.config_turma_id)];
        const turma = turmas.find((t) => String(t.id) === String(turmaId));
        const professor = [
          ...normalizeArray(currentConfig.professores),
          ...normalizeArray(currentConfig.professorManual),
        ].find((p) => String(p.id) === String(aula.professor_id));
        const disciplina = (currentConfig.disciplinas || []).find(
          (d) => String(d.id) === String(aula.disciplina_id),
        );

        const dia = WEEK_DAYS[aula.dia_semana - 1] || '';
        const record = {
          turma_id: turmaId,
          turma_nome: turma?.nome || 'Turma',
          professor_id: aula.professor_id,
          professor_nome: professor?.nome || 'Professor',
          disciplina: disciplina?.nome || 'Disciplina',
          dia,
          slot: aula.aula_numero,
          tipo: aula.tipo === 'fc' ? 'FC' : 'Regular',
        };

        if (!grid[String(turmaId)]) grid[String(turmaId)] = [];
        grid[String(turmaId)].push(record);
        schedule.push(record);
      });

      setGeneratedSchedule({ grid, schedule, validation: [] });
    } catch (error) {
      console.error(error);
    }
  };

  const saveConfigToStorage = (value) => {
    saveLocalState(STORAGE_KEY, value);
  };

  const handleOpenConfig = async (configId) => {
    setSelectedConfigId(String(configId));
    await loadConfigDetails(configId);
    setActiveTab('configuracoes');
  };

  const handleCreateConfig = async () => {
    if (!currentConfig.nome || !currentConfig.escola_id) {
      notify.error('Informe o nome da configuração e a escola antes de salvar.');
      return;
    }

    const configId = selectedConfigId || createEntityId('cfg');
    const payload = {
      id: configId,
      nome: currentConfig.nome,
      escola_id: currentConfig.escola_id,
      ano_letivo: Number(currentConfig.ano_letivo || new Date().getFullYear()),
      semestre: Number(currentConfig.semestre || 1),
      status: 'rascunho',
      created_by: user?.id || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    try {
      const { error: configError } = await supabase.from('horario_configuracoes').upsert(payload, { onConflict: 'id' });
      if (configError) throw configError;

      const configTurmaRows = currentConfig.turmas.map((turmaId) => ({
        id: createEntityId('ct'),
        configuracao_id: configId,
        escola_id: currentConfig.escola_id,
        turma_id: turmaId,
      }));

      await supabase.from('horario_config_turmas').delete().eq('configuracao_id', configId);
      const { data: insertedConfigTurmas, error: turmaError } = await supabase.from('horario_config_turmas').insert(configTurmaRows).select();
      if (turmaError) throw turmaError;

      const configTurmaMap = {};
      (insertedConfigTurmas || []).forEach((item) => {
        configTurmaMap[String(item.turma_id)] = item.id;
      });

      const areaRows = (currentConfig.areas || []).map((area) => ({
        id: area.id || createEntityId('area'),
        configuracao_id: configId,
        nome: area.nome,
        base: area.base,
      }));

      const disciplinaRows = (currentConfig.disciplinas || []).map((disciplina) => ({
        id: disciplina.id || createEntityId('disciplina'),
        configuracao_id: configId,
        nome: disciplina.nome,
        area_id: disciplina.area_id,
      }));

      const professorRows = [...normalizeArray(currentConfig.professores), ...normalizeArray(currentConfig.professorManual)].map((professor) => ({
        id: professor.id || createEntityId('prof'),
        configuracao_id: configId,
        usuario_id: professor.usuario_id || null,
        nome: professor.nome,
        origem: professor.manual ? 'manual' : 'banco',
        area_id: professor.area_id || areaRows[0]?.id || null,
        max_aulas_consecutivas_default: Number(professor.max_aulas_consecutivas_default || 2),
      }));

      const professorTurmaRows = (currentConfig.professorTurmas || []).map((item) => ({
        id: item.id || createEntityId('link'),
        configuracao_id: configId,
        professor_id: item.professor_id,
        disciplina_id: item.disciplina_id,
        config_turma_id: item.config_turma_id || configTurmaMap[String(item.turma_id)] || item.turma_id,
        aulas_semanais: Number(item.aulas_semana || 0),
        max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2),
      }));

      const pdtRows = Object.entries(currentConfig.pdt || {}).map(([turmaId, professorId]) => ({
        id: createEntityId('pdt'),
        configuracao_id: configId,
        config_turma_id: configTurmaMap[String(turmaId)] || turmaId,
        professor_id: professorId,
      }));

      const folgaRows = (currentConfig.folgas || []).map((folga) => ({
        id: folga.id || createEntityId('folga'),
        configuracao_id: configId,
        professor_id: folga.professor_id,
        dia_semana: Number(folga.dia_semana),
      }));

      const indisponibilidadeRows = (currentConfig.indisponibilidades || []).map((item) => ({
        id: item.id || createEntityId('indisponibilidade'),
        configuracao_id: configId,
        professor_id: item.professor_id,
        dia_semana: Number(item.dia_semana),
        aula_numero: Number(item.aula_numero),
      }));

      const formacaoAreaRows = (currentConfig.formacaoArea || []).map((item) => ({
        id: item.id || createEntityId('formacao'),
        configuracao_id: configId,
        area_id: item.area_id,
        dia_semana: Number(item.dia_semana),
        aula_numero: Number(item.aula_numero),
      }));

      await supabase.from('horario_areas').delete().eq('configuracao_id', configId);
      if (areaRows.length > 0) {
        const { error: areaError } = await supabase.from('horario_areas').insert(areaRows);
        if (areaError) throw areaError;
      }

      await supabase.from('horario_disciplinas').delete().eq('configuracao_id', configId);
      if (disciplinaRows.length > 0) {
        const { error: disciplinaError } = await supabase.from('horario_disciplinas').insert(disciplinaRows);
        if (disciplinaError) throw disciplinaError;
      }

      await supabase.from('horario_professores').delete().eq('configuracao_id', configId);
      if (professorRows.length > 0) {
        const { error: professorError } = await supabase.from('horario_professores').insert(professorRows);
        if (professorError) throw professorError;
      }

      await supabase.from('horario_professor_turma').delete().eq('configuracao_id', configId);
      if (professorTurmaRows.length > 0) {
        const { error: professorTurmaError } = await supabase.from('horario_professor_turma').insert(professorTurmaRows);
        if (professorTurmaError) throw professorTurmaError;
      }

      await supabase.from('horario_pdt').delete().eq('configuracao_id', configId);
      if (pdtRows.length > 0) {
        const { error: pdtError } = await supabase.from('horario_pdt').insert(pdtRows);
        if (pdtError) throw pdtError;
      }

      await supabase.from('horario_professor_folgas').delete().eq('configuracao_id', configId);
      if (folgaRows.length > 0) {
        const { error: folgaError } = await supabase.from('horario_professor_folgas').insert(folgaRows);
        if (folgaError) throw folgaError;
      }

      await supabase.from('horario_professor_indisponibilidades').delete().eq('configuracao_id', configId);
      if (indisponibilidadeRows.length > 0) {
        const { error: indisponibilidadeError } = await supabase.from('horario_professor_indisponibilidades').insert(indisponibilidadeRows);
        if (indisponibilidadeError) throw indisponibilidadeError;
      }

      await supabase.from('horario_formacao_area').delete().eq('configuracao_id', configId);
      if (formacaoAreaRows.length > 0) {
        const { error: formacaoAreaError } = await supabase.from('horario_formacao_area').insert(formacaoAreaRows);
        if (formacaoAreaError) throw formacaoAreaError;
      }

      const nextConfigs = [
        { ...payload, turmas: currentConfig.turmas },
        ...configs.filter((item) => String(item.id) !== String(configId)),
      ];

      setConfigs(nextConfigs);
      saveConfigToStorage(nextConfigs);
      setSelectedConfigId(configId);
      notify.success('Configuração salva com sucesso no banco.');
    } catch (error) {
      console.error(error);
      notify.error('Não foi possível salvar a configuração no Supabase.');
    }
  };

  const handleGenerate = async () => {
    if (!currentConfig.turmas.length) {
      notify.error('Selecione as turmas antes de gerar o horário.');
      return;
    }

    const professorList = [
      ...normalizeArray(currentConfig.professores),
      ...normalizeArray(currentConfig.professorManual),
    ];

    if (!professorList.length) {
      notify.error('Adicione pelo menos um professor para gerar o horário.');
      return;
    }

    const scheduleData = {
      configuracao: currentConfig,
      turmas,
      professores: professorList,
      vinculos: normalizeArray(currentConfig.professorTurmas),
      pdtMap: currentConfig.pdt || {},
      areas,
      disciplinas,
      folgas: normalizeArray(currentConfig.folgas),
      indisponibilidades: normalizeArray(currentConfig.indisponibilidades),
      formacoesArea: normalizeArray(currentConfig.formacaoArea),
      fcRules: FC_RULES[currentConfig.semestre] || FC_RULES[1],
    };

    const result = generateHorario(scheduleData);
    setGeneratedSchedule(result);
    setActiveTab('resultado');
    setStatusMessage(
      result.validation.length
        ? `Gerado com ${result.schedule.length} aulas e ${result.validation.length} observações de conflito.`
        : `Gerado com sucesso. ${result.schedule.length} aulas atribuídas.`,
    );

    // Salvar grade gerada no banco
    await salvarGradeGerada(result);
  };

  const salvarGradeGerada = async (result) => {
    if (!selectedConfigId) {
      notify.error('Salve a configuração antes de gerar a grade.');
      return;
    }

    try {
      // Mapear turma_id para config_turma_id
      const turmaParaConfigTurma = {};
      const { data: configTurmas } = await supabase
        .from('horario_config_turmas')
        .select('id, turma_id')
        .eq('configuracao_id', selectedConfigId);

      (configTurmas || []).forEach((item) => {
        turmaParaConfigTurma[String(item.turma_id)] = item.id;
      });

      // Deletar grade anterior
      await supabase.from('horario_grade_gerada').delete().eq('configuracao_id', selectedConfigId);

      // Preparar dados para inserção
      const gradeRows = (result.schedule || []).map((aula) => {
        const configTurmaId = turmaParaConfigTurma[String(aula.turma_id)];
        return {
          id: createEntityId('grade'),
          configuracao_id: selectedConfigId,
          config_turma_id: configTurmaId,
          dia_semana: WEEK_DAYS.indexOf(aula.dia) + 1,
          aula_numero: aula.slot,
          professor_id: aula.professor_id,
          disciplina_id: (currentConfig.disciplinas || []).find(
            (d) => d.nome === aula.disciplina,
          )?.id || null,
          tipo: aula.tipo === 'FC' ? 'fc' : 'aula',
        };
      });

      if (gradeRows.length > 0) {
        const { error: gradeError } = await supabase.from('horario_grade_gerada').insert(gradeRows);
        if (gradeError) throw gradeError;
      }

      notify.success('Grade salva no banco de dados com sucesso.');
    } catch (error) {
      console.error(error);
      notify.error('Não foi possível salvar a grade no banco.');
    }
  };


  const handleExportPdf = () => {
    if (generatedSchedule.schedule.length === 0) {
      notify.error('Gere a grade antes de exportar para PDF.');
      return;
    }

    const jsPDFLib = window.jspdf && window.jspdf.jsPDF ? window.jspdf.jsPDF : null;
    const doc = jsPDFLib ? new jsPDFLib() : null;
    if (!doc) {
      notify.error('O navegador não conseguiu inicializar a geração de PDF.');
      return;
    }

    const linhas = [];
    Object.entries(generatedSchedule.grid || {}).forEach(([turmaId, aulas]) => {
      linhas.push(`Turma ${getTurmaLabel(turmas, turmaId)}`);
      aulas.forEach((aula) => {
        linhas.push(`- ${aula.dia} / ${aula.slot}ª aula / ${aula.disciplina} / ${aula.professor_nome}`);
      });
      linhas.push('');
    });

    doc.setFontSize(14);
    doc.text('EEEP Irmã Ana Zélia da Fonseca', 14, 16);
    doc.setFontSize(12);
    doc.text(`Horário - ${currentConfig.nome || 'Sem título'}`, 14, 24);
    doc.setFontSize(10);

    let y = 32;
    linhas.forEach((linha) => {
      if (y > 270) {
        doc.addPage();
        y = 14;
      }
      doc.text(linha, 14, y);
      y += 5;
    });

    doc.save(`horario_${currentConfig.nome || 'gerado'}.pdf`);
    notify.success('PDF exportado com sucesso.');
  };


  const handleExportExcel = () => {
    if (generatedSchedule.schedule.length === 0) {
      notify.error('Gere a grade antes de exportar para Excel.');
      return;
    }

    const workbook = XLSX.utils.book_new();
    const rows = [];

    Object.entries(generatedSchedule.grid || {}).forEach(([turmaId, aulas]) => {
      rows.push({ Turma: getTurmaLabel(turmas, turmaId), Dia: '', Aula: '', Disciplina: '', Professor: '' });
      aulas.forEach((aula) => {
        rows.push({
          Turma: '',
          Dia: aula.dia,
          Aula: `${aula.slot}ª`,
          Disciplina: aula.disciplina,
          Professor: aula.professor_nome,
        });
      });
      rows.push({ Turma: '', Dia: '', Aula: '', Disciplina: '', Professor: '' });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Horarios');
    XLSX.writeFile(workbook, `horario_${currentConfig.nome || 'gerado'}.xlsx`);
    notify.success('Arquivo Excel exportado com sucesso.');
  };

  const handleAddDisciplina = () => {
    if (!disciplinaForm.nome.trim()) {
      notify.error('Digite o nome da disciplina antes de salvar.');
      return;
    }

    const newDisciplina = {
      id: createEntityId('disciplina'),
      nome: disciplinaForm.nome.trim(),
      area_id: disciplinaForm.area_id,
    };

    setCurrentConfig((prev) => ({
      ...prev,
      disciplinas: [...normalizeArray(prev.disciplinas), newDisciplina],
    }));
    setDisciplinaForm({ nome: '', area_id: '' });
    notify.success('Disciplina adicionada na configuração.');
  };

  const handleAddManualProfessor = () => {
    if (!manualProfessor.nome || !manualProfessor.area_id) {
      notify.error('Informe nome e área do professor manual.');
      return;
    }

    const professor = {
      id: createEntityId('manual'),
      nome: manualProfessor.nome,
      area_id: manualProfessor.area_id,
      max_aulas_consecutivas_default: manualProfessor.max_aulas_consecutivas_default,
      observacao: manualProfessor.observacao,
      manual: true,
    };

    setCurrentConfig((prev) => ({
      ...prev,
      professorManual: [...normalizeArray(prev.professorManual), professor],
      professores: [...normalizeArray(prev.professores), professor],
    }));

    setManualProfessor({
      nome: '',
      area_id: '',
      max_aulas_consecutivas_default: 2,
      observacao: '',
    });
  };

  const handleProfessorAssignment = (turmaId, professorId) => {
    setCurrentConfig((prev) => {
      const nextPdt = { ...prev.pdt, [turmaId]: professorId };
      return { ...prev, pdt: nextPdt };
    });
  };

  const handleAddProfessorTurma = () => {
    setCurrentConfig((prev) => ({
      ...prev,
      professorTurmas: [
        ...normalizeArray(prev.professorTurmas),
        {
          id: createEntityId('link'),
          professor_id: '',
          turma_id: '',
          disciplina_id: '',
          aulas_semana: 2,
          max_aulas_consecutivas: 2,
        },
      ],
    }));
  };

  const updateProfessorTurma = (id, field, value) => {
    setCurrentConfig((prev) => ({
      ...prev,
      professorTurmas: normalizeArray(prev.professorTurmas).map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const toggleFolia = (professorId, diaSemana) => {
    setCurrentConfig((prev) => {
      const exists = (prev.folgas || []).some(
        (item) => String(item.professor_id) === String(professorId) && Number(item.dia_semana) === Number(diaSemana),
      );

      const next = exists
        ? (prev.folgas || []).filter(
            (item) => !(String(item.professor_id) === String(professorId) && Number(item.dia_semana) === Number(diaSemana)),
          )
        : [...(prev.folgas || []), { id: createEntityId('folga'), professor_id: professorId, dia_semana: Number(diaSemana) }];

      return { ...prev, folgas: next };
    });
  };

  const toggleIndisponibilidade = (professorId, diaSemana, aulaNumero) => {
    setCurrentConfig((prev) => {
      const exists = (prev.indisponibilidades || []).some(
        (item) =>
          String(item.professor_id) === String(professorId) &&
          Number(item.dia_semana) === Number(diaSemana) &&
          Number(item.aula_numero) === Number(aulaNumero),
      );

      const next = exists
        ? (prev.indisponibilidades || []).filter(
            (item) =>
              !(String(item.professor_id) === String(professorId) &&
                Number(item.dia_semana) === Number(diaSemana) &&
                Number(item.aula_numero) === Number(aulaNumero)),
          )
        : [
            ...(prev.indisponibilidades || []),
            {
              id: createEntityId('indisponibilidade'),
              professor_id: professorId,
              dia_semana: Number(diaSemana),
              aula_numero: Number(aulaNumero),
            },
          ];

      return { ...prev, indisponibilidades: next };
    });
  };

  const toggleFormacaoArea = (areaId, diaSemana, aulaNumero) => {
    setCurrentConfig((prev) => {
      const exists = (prev.formacaoArea || []).some(
        (item) =>
          String(item.area_id) === String(areaId) &&
          Number(item.dia_semana) === Number(diaSemana) &&
          Number(item.aula_numero) === Number(aulaNumero),
      );

      const next = exists
        ? (prev.formacaoArea || []).filter(
            (item) =>
              !(String(item.area_id) === String(areaId) &&
                Number(item.dia_semana) === Number(diaSemana) &&
                Number(item.aula_numero) === Number(aulaNumero)),
          )
        : [
            ...(prev.formacaoArea || []),
            {
              id: createEntityId('formacao'),
              area_id: areaId,
              dia_semana: Number(diaSemana),
              aula_numero: Number(aulaNumero),
            },
          ];

      return { ...prev, formacaoArea: next };
    });
  };

  const updateConfigField = (field, value) => {
    setCurrentConfig((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-600">
        <FaSpinner className="animate-spin" />
        Carregando módulo de horários...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageTitle
        title="Módulo de Horários Escolares"
        subtitle="Criação, validação, geração automática e exportação de horários para a EEEP Irmã Ana Zélia da Fonseca."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Configurações" content={configs.length} />
        <Card title="Turmas" content={turmas.length} />
        <Card title="Professores" content={profissionais.length + (currentConfig.professorManual || []).length} />
        <Card title="Grade gerada" content={generatedSchedule.schedule.length || 0} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {configs.length > 0 ? (
              configs.map((config) => (
                <button
                  key={String(config.id)}
                  type="button"
                  onClick={() => handleOpenConfig(config.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                    String(selectedConfigId) === String(config.id)
                      ? 'bg-green-700 text-white'
                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                  }`}
                >
                  {config.nome}
                </button>
              ))
            ) : (
              <span className="text-sm text-slate-500">Nenhuma configuração salva ainda.</span>
            )}
          </div>

          <Button type="button" onClick={() => setCurrentConfig((prev) => ({
            ...prev,
            nome: '',
            ano_letivo: new Date().getFullYear(),
            semestre: 1,
            turmas: [],
            professores: [],
            professorManual: [],
            professorTurmas: [],
            pdt: {},
            folgas: [],
            indisponibilidades: [],
            formacaoArea: [],
            areas: FIXED_AREAS.map((area) => ({ id: createEntityId('area'), ...area })),
            disciplinas: [],
          }))} variant="secondary">
            Nova configuração
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {[
            { key: 'configuracoes', label: 'Configurações' },
            { key: 'turmas', label: 'Turmas' },
            { key: 'professores', label: 'Professores' },
            { key: 'atribuicoes', label: 'Atribuições' },
            { key: 'disponibilidades', label: 'Disponibilidades' },
            { key: 'pdt', label: 'PDT' },
            { key: 'resultado', label: 'Resultado' },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold ${
                activeTab === tab.key
                  ? 'bg-green-700 text-white'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'configuracoes' && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              label="Nome da configuração"
              value={currentConfig.nome}
              onChange={(event) => updateConfigField('nome', event.target.value)}
              placeholder="Horário 2026.1"
            />

            <CustomSelect
              label="Escola"
              value={String(currentConfig.escola_id || '')}
              onChange={(value) => updateConfigField('escola_id', value)}
              options={schools.map((school) => ({ value: String(school.id), label: school.nome }))}
              placeholder="Selecione a escola"
            />

            <FormInput
              label="Ano letivo"
              type="number"
              value={currentConfig.ano_letivo}
              onChange={(event) => updateConfigField('ano_letivo', Number(event.target.value))}
            />

            <CustomSelect
              label="Semestre"
              value={String(currentConfig.semestre || 1)}
              onChange={(value) => updateConfigField('semestre', Number(value))}
              options={[
                { value: '1', label: '1º semestre' },
                { value: '2', label: '2º semestre' },
              ]}
            />

            <div className="md:col-span-2">
              <Button type="button" onClick={handleCreateConfig} className="w-full md:w-auto">
                <FaPlus className="mr-2" />
                Salvar configuração
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'turmas' && (
          <div className="space-y-4">
            <CustomSelect
              label="Turmas participantes"
              value={currentConfig.turmas}
              onChange={(value) => updateConfigField('turmas', value)}
              options={turmaOptions}
              placeholder="Selecione as turmas"
              multiple
            />

            <div className="rounded-xl border border-dashed border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-2 font-semibold text-slate-700 dark:text-slate-200">Resumo</p>
              <div className="flex flex-wrap gap-2">
                {currentConfig.turmas.length > 0 ? (
                  currentConfig.turmas.map((turmaId) => (
                    <span key={turmaId} className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                      {getTurmaLabel(turmas, turmaId)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-slate-500">Nenhuma turma selecionada.</span>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'professores' && (
          <div className="space-y-5">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Áreas disponíveis na configuração</p>
              <div className="flex flex-wrap gap-2">
                {normalizeArray(currentConfig.areas).map((area) => (
                  <span key={area.id} className="rounded-full bg-green-100 px-3 py-1.5 text-xs font-medium text-green-800">
                    {area.nome} <span className="ml-1 text-[10px] text-green-600">({area.base === 'tecnica' ? 'Técnica' : 'Comum'})</span>
                  </span>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">As áreas são automaticamente disponibilizadas. Crie disciplinas vinculando-as a uma dessas áreas.</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Disciplinas da configuração</p>
              <div className="grid gap-3 md:grid-cols-[1.2fr_1fr_auto]">
                <FormInput
                  label="Nome da disciplina"
                  value={disciplinaForm.nome}
                  onChange={(event) => setDisciplinaForm((prev) => ({ ...prev, nome: event.target.value }))}
                  placeholder="Ex.: Física"
                />
                <CustomSelect
                  label="Área"
                  value={disciplinaForm.area_id}
                  onChange={(value) => setDisciplinaForm((prev) => ({ ...prev, area_id: value }))}
                  options={areaOptions}
                  placeholder="Selecione a área"
                />
                <div className="flex items-end">
                  <Button type="button" onClick={handleAddDisciplina} variant="secondary">Adicionar disciplina</Button>
                </div>
              </div>

              {normalizeArray(currentConfig.disciplinas).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {currentConfig.disciplinas.map((disciplina) => (
                    <span key={disciplina.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {disciplina.nome}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <CustomSelect
              label="Professores da base"
              value={currentConfig.professores}
              onChange={(value) => updateConfigField('professores', value)}
              options={professorOptions}
              placeholder="Selecione os professores"
              multiple
            />

            <div className="grid gap-4 md:grid-cols-3">
              <FormInput
                label="Nome do professor manual"
                value={manualProfessor.nome}
                onChange={(event) => setManualProfessor((prev) => ({ ...prev, nome: event.target.value }))}
              />

              <CustomSelect
                label="Área"
                value={manualProfessor.area_id}
                onChange={(value) => setManualProfessor((prev) => ({ ...prev, area_id: value }))}
                options={areaOptions}
                placeholder="Selecione a área"
              />

              <FormInput
                label="Máx. aulas consecutivas"
                type="number"
                value={manualProfessor.max_aulas_consecutivas_default}
                onChange={(event) =>
                  setManualProfessor((prev) => ({
                    ...prev,
                    max_aulas_consecutivas_default: Number(event.target.value) || 2,
                  }))
                }
              />
            </div>

            <FormInput
              label="Observação"
              value={manualProfessor.observacao}
              onChange={(event) => setManualProfessor((prev) => ({ ...prev, observacao: event.target.value }))}
              placeholder="Ex.: professor de apoio em turno integral"
            />

            <Button type="button" onClick={handleAddManualProfessor} variant="secondary">
              Adicionar professor manual
            </Button>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <p className="mb-3 font-semibold text-slate-700 dark:text-slate-200">Professores cadastrados na configuração</p>

              {normalizeArray(currentConfig.professores).length === 0 &&
                normalizeArray(currentConfig.professorManual).length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum professor adicionado ainda.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {[...normalizeArray(currentConfig.professores), ...normalizeArray(currentConfig.professorManual)].map((professor) => (
                      <span key={String(professor.id)} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {professor.nome}
                      </span>
                    ))}
                  </div>
                )}
            </div>
          </div>
        )}

        {activeTab === 'atribuicoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Vínculos professor · turma · disciplina</h3>
              <Button type="button" onClick={handleAddProfessorTurma} variant="secondary">Adicionar vínculo</Button>
            </div>

            <div className="space-y-3">
              {normalizeArray(currentConfig.professorTurmas).length === 0 ? (
                <p className="text-sm text-slate-500">Nenhum vínculo cadastrado.</p>
              ) : (
                normalizeArray(currentConfig.professorTurmas).map((link) => (
                  <div key={link.id} className="grid gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-5 dark:border-slate-700">
                    <CustomSelect
                      label="Professor"
                      value={String(link.professor_id || '')}
                      onChange={(value) => updateProfessorTurma(link.id, 'professor_id', value)}
                      options={professorOptions}
                      placeholder="Professor"
                    />
                    <CustomSelect
                      label="Turma"
                      value={String(link.turma_id || '')}
                      onChange={(value) => updateProfessorTurma(link.id, 'turma_id', value)}
                      options={turmaOptions}
                      placeholder="Turma"
                    />
                    <CustomSelect
                      label="Disciplina"
                      value={String(link.disciplina_id || '')}
                      onChange={(value) => updateProfessorTurma(link.id, 'disciplina_id', value)}
                      options={disciplinaOptions}
                      placeholder="Disciplina"
                    />
                    <FormInput
                      label="Aulas"
                      type="number"
                      value={link.aulas_semana || 2}
                      onChange={(event) => updateProfessorTurma(link.id, 'aulas_semana', Number(event.target.value) || 0)}
                    />
                    <FormInput
                      label="Máx. consecutivas"
                      type="number"
                      value={link.max_aulas_consecutivas || 2}
                      onChange={(event) => updateProfessorTurma(link.id, 'max_aulas_consecutivas', Number(event.target.value) || 2)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {activeTab === 'disponibilidades' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-200">Folgas por professor</h3>
              <div className="space-y-4">
                {[...normalizeArray(currentConfig.professores), ...normalizeArray(currentConfig.professorManual)].map((professor) => (
                  <div key={String(professor.id)} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">{professor.nome}</p>
                    <div className="flex flex-wrap gap-2">
                      {['1', '2', '3', '4', '5'].map((dia) => {
                        const selected = (currentConfig.folgas || []).some(
                          (item) => String(item.professor_id) === String(professor.id) && Number(item.dia_semana) === Number(dia),
                        );
                        return (
                          <button
                            key={`${professor.id}-${dia}`}
                            type="button"
                            onClick={() => toggleFolia(professor.id, dia)}
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${selected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                          >
                            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][Number(dia) - 1]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-200">Indisponibilidades específicas</h3>
              <div className="space-y-4">
                {[...normalizeArray(currentConfig.professores), ...normalizeArray(currentConfig.professorManual)].map((professor) => (
                  <div key={String(professor.id)} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">{professor.nome}</p>
                    <div className="grid gap-2 sm:grid-cols-5">
                      {['1', '2', '3', '4', '5'].map((dia) => (
                        <div key={`${professor.id}-ind-${dia}`} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                          <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][Number(dia) - 1]}</p>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: 9 }, (_, index) => index + 1).map((aula) => {
                              const selected = (currentConfig.indisponibilidades || []).some(
                                (item) =>
                                  String(item.professor_id) === String(professor.id) &&
                                  Number(item.dia_semana) === Number(dia) &&
                                  Number(item.aula_numero) === Number(aula),
                              );

                              return (
                                <button
                                  key={`${professor.id}-${dia}-${aula}`}
                                  type="button"
                                  onClick={() => toggleIndisponibilidade(professor.id, dia, aula)}
                                  className={`h-7 w-7 rounded text-[10px] font-bold ${selected ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                                >
                                  {aula}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <h3 className="mb-3 text-lg font-semibold text-slate-800 dark:text-slate-200">Formação das áreas</h3>
              <div className="space-y-4">
                {normalizeArray(currentConfig.areas).map((area) => (
                  <div key={area.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                    <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">{area.nome}</p>
                    <div className="grid gap-2 sm:grid-cols-5">
                      {['1', '2', '3', '4', '5'].map((dia) => (
                        <div key={`${area.id}-${dia}`} className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900">
                          <p className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex'][Number(dia) - 1]}</p>
                          <div className="flex flex-wrap gap-1">
                            {Array.from({ length: 9 }, (_, index) => index + 1).map((aula) => {
                              const selected = (currentConfig.formacaoArea || []).some(
                                (item) =>
                                  String(item.area_id) === String(area.id) &&
                                  Number(item.dia_semana) === Number(dia) &&
                                  Number(item.aula_numero) === Number(aula),
                              );

                              return (
                                <button
                                  key={`${area.id}-${dia}-${aula}`}
                                  type="button"
                                  onClick={() => toggleFormacaoArea(area.id, dia, aula)}
                                  className={`h-7 w-7 rounded text-[10px] font-bold ${selected ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                                >
                                  {aula}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resultado' && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <Button type="button" onClick={handleGenerate} variant="default">
                <FaCalendarAlt className="mr-2" />
                Gerar grade automática
              </Button>
              <Button type="button" onClick={handleExportPdf} variant="secondary">
                <FaFilePdf className="mr-2" />
                Exportar PDF
              </Button>
              <Button type="button" onClick={handleExportExcel} variant="secondary">
                <FaFileExcel className="mr-2" />
                Exportar Excel
              </Button>
            </div>

            {statusMessage && (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
                {statusMessage}
              </div>
            )}

            {generatedSchedule.schedule.length > 0 ? (
              <div className="space-y-6">
                {currentConfig.turmas.map((turmaId) => {
                  const turma = turmas.find((item) => String(item.id) === String(turmaId));
                  const aulas = generatedSchedule.grid[String(turmaId)] || [];

                  return (
                    <div key={turmaId} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                      <h3 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">{turma?.nome || 'Turma'}</h3>

                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-left text-sm">
                          <thead>
                            <tr>
                              <th className="border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">Horário</th>
                              {WEEK_DAYS.map((day) => (
                                <th key={day} className="border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900">
                                  {day}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {SLOT_DEFINITIONS.map((slot) => (
                              <tr key={slot.slot}>
                                <td className="border border-slate-200 bg-slate-50 p-2 font-semibold dark:border-slate-700 dark:bg-slate-900">
                                  {slot.label} ({slot.time})
                                </td>
                                {WEEK_DAYS.map((day) => {
                                  const aula = aulas.find((item) => item.dia === day && item.slot === slot.slot);
                                  return (
                                    <td key={`${day}-${slot.slot}`} className="border border-slate-200 p-2 dark:border-slate-700">
                                      {aula ? (
                                        <div className="space-y-1">
                                          <strong className="block text-xs text-green-700">{aula.disciplina}</strong>
                                          <span className="text-xs text-slate-600 dark:text-slate-300">{aula.professor_nome}</span>
                                          {aula.tipo === 'FC' && (
                                            <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">FC</span>
                                          )}
                                        </div>
                                      ) : (
                                        <span className="text-xs text-slate-400">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-500 dark:border-slate-700 dark:text-slate-300">
                Ainda não há grade gerada. Clique em “Gerar grade automática” para criar a distribuição.
              </div>
            )}

            {generatedSchedule.validation.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                <h4 className="mb-2 font-bold text-amber-900 dark:text-amber-100">Validações e observações</h4>
                <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800 dark:text-amber-200">
                  {generatedSchedule.validation.map((item, index) => (
                    <li key={`${item.professor}-${index}`}>
                      {item.professor} • {item.turma} • {item.disciplina} — {item.mensagem}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {activeTab === 'pdt' && (
          <div className="space-y-5">
            {currentConfig.turmas.length === 0 ? (
              <p className="text-sm text-slate-500">Selecione as turmas para associar os PDTs.</p>
            ) : (
              <div className="space-y-4">
                {currentConfig.turmas.map((turmaId) => (
                  <div key={turmaId} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                    <p className="mb-3 font-semibold text-slate-700 dark:text-slate-200">{getTurmaLabel(turmas, turmaId)}</p>
                    <CustomSelect
                      label="Professor responsável"
                      value={String(currentConfig.pdt?.[turmaId] || '')}
                      onChange={(value) => handleProfessorAssignment(turmaId, value)}
                      options={professorOptions}
                      placeholder="Selecione o PDT"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
