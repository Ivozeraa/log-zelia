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
import { FC_RULES, FIXED_AREAS, SLOT_DEFINITIONS, WEEK_DAYS, generateHorario, mergeProfessores } from '../services/horarioService';

const newId = (prefix) => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${prefix}-${Date.now()}-${Math.random()}`);
const emptyGrade = { grid: {}, schedule: [], validation: [], unscheduled: [] };
const makeAreas = (source = []) => FIXED_AREAS.map((fixed) => { const existing = source.find((item) => String(item?.nome || '').trim().toLowerCase() === fixed.nome.toLowerCase()); return existing ? { ...existing, nome: fixed.nome, base: fixed.base } : { id: newId('area'), ...fixed }; });
const makeConfig = (escola_id = '') => ({ nome: '', escola_id, ano_letivo: new Date().getFullYear(), semestre: 1, turmas: [], configTurmaMap: {}, professores: [], professorTurmas: [], pdt: {}, folgas: [], indisponibilidades: [], formacaoArea: [], areas: makeAreas(), disciplinas: [] });
const byId = (items, id) => items.find((item) => String(item.id) === String(id));
const ruleFor = (turma, semestre) => { const match = String(turma?.nome || '').match(/(\d+)\s*º|\b(\d+)\b/); const serie = match ? `${match[1] || match[2]}º` : null; return FC_RULES[Number(semestre) || 1]?.[serie]; };

const steps = ['Configuração', 'Turmas', 'Professores e Áreas', 'Disciplinas e Atribuições', 'Disponibilidades', 'PDT', 'Revisão e Geração'];

export const Horarios = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState([]);
  const [selectedConfigId, setSelectedConfigId] = useState('');
  const [currentStep, setCurrentStep] = useState(1);
  const [schools, setSchools] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [currentConfig, setCurrentConfig] = useState(() => makeConfig(user?.escola_id || ''));
  const [manualProfessor, setManualProfessor] = useState({ nome: '', area_id: '', max_aulas_consecutivas_default: 2, observacao: '' });
  const [disciplinaForm, setDisciplinaForm] = useState({ nome: '', area_id: '' });
  const [generatedSchedule, setGeneratedSchedule] = useState(emptyGrade);

  const areaOptions = useMemo(() => currentConfig.areas.map((area) => ({ value: String(area.id), label: `${area.nome}${area.base === 'tecnica' ? ' · Técnica' : ''}` })), [currentConfig.areas]);
  const professorOptions = useMemo(() => currentConfig.professores.map((professor) => ({ value: String(professor.id), label: `${professor.nome}${byId(currentConfig.areas, professor.area_id) ? ` · ${byId(currentConfig.areas, professor.area_id).nome}` : ''}` })), [currentConfig.professores, currentConfig.areas]);
  const turmaOptions = useMemo(() => currentConfig.turmas.map((id) => ({ value: String(id), label: byId(turmas, id)?.nome || 'Turma' })), [currentConfig.turmas, turmas]);
  const disciplinaOptions = useMemo(() => currentConfig.disciplinas.map((disciplina) => ({ value: String(disciplina.id), label: `${disciplina.nome} · ${byId(currentConfig.areas, disciplina.area_id)?.nome || 'Área inválida'}` })), [currentConfig.disciplinas, currentConfig.areas]);

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try {
        setLoading(true);
        const results = await Promise.all([
          supabase.from('escolas').select('*').order('nome', { ascending: true }),
          supabase.from('turmas').select('*').order('nome', { ascending: true }),
          supabase.from('horario_configuracoes').select('*').order('created_at', { ascending: false }),
          supabase.from('horario_areas').select('*').order('nome', { ascending: true }),
          supabase.from('usuarios').select('id, nome, area_id, escola_id, role_id').order('nome', { ascending: true }),
        ]);
        const error = results.find((result) => result.error)?.error;
        if (error) throw error;
        if (!active) return;
        setSchools(results[0].data || []);
        setTurmas(results[1].data || []);
        setConfigs(results[2].data || []);
        setUsuarios((results[4].data || []).map((item) => ({ ...item, area_nome: results[3].data?.find((area) => String(area.id) === String(item.area_id))?.nome || '' })));
        if (!selectedConfigId && results[2].data?.length) setSelectedConfigId(String(results[2].data[0].id));
        else if (!currentConfig.escola_id) setCurrentConfig((prev) => ({ ...prev, escola_id: user?.escola_id || results[0].data?.[0]?.id || '' }));
      } catch (error) {
        console.error(error);
        if (active) notify.error(`Não foi possível carregar os dados: ${error.message || 'erro desconhecido'}.`);
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInitial();
    return () => { active = false; };
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
      const results = await Promise.all([
        supabase.from('horario_configuracoes').select('*').eq('id', configId).maybeSingle(),
        supabase.from('horario_config_turmas').select('*').eq('configuracao_id', configId),
        supabase.from('horario_areas').select('*').eq('configuracao_id', configId).order('nome', { ascending: true }),
        supabase.from('horario_disciplinas').select('*').eq('configuracao_id', configId).order('nome', { ascending: true }),
        supabase.from('horario_professores').select('*').eq('configuracao_id', configId).order('nome', { ascending: true }),
        supabase.from('horario_professor_turma').select('*').eq('configuracao_id', configId),
        supabase.from('horario_pdt').select('*').eq('configuracao_id', configId),
        supabase.from('horario_professor_folgas').select('*').eq('configuracao_id', configId),
        supabase.from('horario_professor_indisponibilidades').select('*').eq('configuracao_id', configId),
        supabase.from('horario_formacao_area').select('*').eq('configuracao_id', configId),
        supabase.from('horario_grade_gerada').select('*').eq('configuracao_id', configId),
      ]);
      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      if (!results[0].data) throw new Error('Configuração não encontrada.');

      const configTurmaMap = Object.fromEntries((results[1].data || []).map((row) => [String(row.turma_id), String(row.id)]));
      const loadedAreas = makeAreas(results[2].data || []);
      const loadedDisciplines = (results[3].data || []).map((row) => ({ ...row, area_id: row.area_id ? String(row.area_id) : '' }));
      const loadedProfessors = (results[4].data || []).map((row) => ({ id: String(row.id), usuario_id: row.usuario_id ? String(row.usuario_id) : null, nome: row.nome, area_id: row.area_id ? String(row.area_id) : '', max_aulas_consecutivas_default: Number(row.max_aulas_consecutivas_default || 2), observacao: row.observacao || '', origem: row.origem || (row.usuario_id ? 'banco' : 'manual'), manual: row.origem === 'manual' }));
      const pdt = {};
      (results[6].data || []).forEach((row) => { const turmaId = results[1].data?.find((item) => String(item.id) === String(row.config_turma_id))?.turma_id; if (turmaId) pdt[String(turmaId)] = String(row.professor_id); });
      const links = (results[5].data || []).map((row) => ({ id: String(row.id), professor_id: String(row.professor_id), turma_id: String(results[1].data?.find((item) => String(item.id) === String(row.config_turma_id))?.turma_id || ''), disciplina_id: row.disciplina_id ? String(row.disciplina_id) : '', aulas_semana: Number(row.aulas_semanais || 0), max_aulas_consecutivas: Number(row.max_aulas_consecutivas || 2) }));
      const config = { nome: results[0].data.nome || '', escola_id: results[0].data.escola_id || '', ano_letivo: Number(results[0].data.ano_letivo || new Date().getFullYear()), semestre: Number(results[0].data.semestre || 1), turmas: (results[1].data || []).map((row) => String(row.turma_id)), configTurmaMap, professores: mergeProfessores({ professores: loadedProfessors }), professorTurmas: links, pdt, folgas: results[7].data || [], indisponibilidades: results[8].data || [], formacaoArea: results[9].data || [], areas: loadedAreas, disciplinas: loadedDisciplines };
      setCurrentConfig(config);
      setCurrentStep(1);
      rebuildGrade(results[10].data || [], config);
    } catch (error) {
      console.error(error);
      notify.error(`Não foi possível carregar a configuração: ${error.message || 'erro desconhecido'}.`);
    } finally {
      setLoading(false);
    }
  };

  const rebuildGrade = (rows, config) => {
    if (!rows.length) return setGeneratedSchedule(emptyGrade);
    const grid = {};
    const schedule = [];
    const validation = [];
    rows.sort((a, b) => Number(a.dia_semana) - Number(b.dia_semana) || Number(a.aula_numero) - Number(b.aula_numero)).forEach((row) => {
      const turmaId = Object.entries(config.configTurmaMap).find(([, id]) => String(id) === String(row.config_turma_id))?.[0];
      const professor = byId(config.professores, row.professor_id);
      const disciplina = row.disciplina_id ? byId(config.disciplinas, row.disciplina_id) : null;
      const record = { turma_id: turmaId, turma_nome: byId(turmas, turmaId)?.nome || 'Turma', professor_id: row.professor_id, professor_nome: professor?.nome || 'Professor', disciplina_id: row.disciplina_id || null, disciplina: row.tipo === 'fc' ? 'Formação para a Cidadania' : disciplina?.nome || 'Disciplina não encontrada', dia: WEEK_DAYS[Number(row.dia_semana) - 1] || '', slot: Number(row.aula_numero), tipo: row.tipo === 'fc' ? 'FC' : 'Regular' };
      if (!turmaId || !professor || (row.tipo !== 'fc' && !disciplina)) validation.push({ bloqueante: true, mensagem: 'A grade persistida possui referência inválida.' });
      (grid[String(turmaId)] ||= []).push(record);
      schedule.push(record);
    });
    setGeneratedSchedule({ grid, schedule, validation, unscheduled: [] });
  };

  const validateConfig = (complete = false) => {
    const problems = [];
    const areaIds = new Set(currentConfig.areas.map((area) => String(area.id)));
    const professorIds = new Set(currentConfig.professores.map((professor) => String(professor.id)));
    const turmaIds = new Set(currentConfig.turmas.map(String));
    const disciplineIds = new Set(currentConfig.disciplinas.map((discipline) => String(discipline.id)));
    if (!currentConfig.nome.trim()) problems.push({ bloqueante: true, mensagem: 'Informe o nome da configuração.' });
    if (!currentConfig.escola_id) problems.push({ bloqueante: true, mensagem: 'Selecione a escola.' });
    if (!Number(currentConfig.ano_letivo)) problems.push({ bloqueante: true, mensagem: 'Informe o ano letivo.' });
    if (![1, 2].includes(Number(currentConfig.semestre))) problems.push({ bloqueante: true, mensagem: 'Selecione um semestre válido.' });
    if (complete && !turmaIds.size) problems.push({ bloqueante: true, mensagem: 'Selecione pelo menos uma turma.' });
    if (complete && !currentConfig.professores.length) problems.push({ bloqueante: true, mensagem: 'Adicione pelo menos um professor.' });
    currentConfig.professores.forEach((professor) => { if (!areaIds.has(String(professor.area_id))) problems.push({ bloqueante: true, professor: professor.nome, mensagem: 'Professor precisa estar vinculado a uma área existente na configuração.' }); });
    currentConfig.disciplinas.forEach((discipline) => { if (!discipline.nome?.trim() || !areaIds.has(String(discipline.area_id))) problems.push({ bloqueante: true, disciplina: discipline.nome, mensagem: `Disciplina "${discipline.nome || 'sem nome'}" precisa de área válida.` }); });
    currentConfig.professorTurmas.forEach((link) => { const professor = byId(currentConfig.professores, link.professor_id); const turma = turmaOptions.find((option) => String(option.value) === String(link.turma_id)); const discipline = byId(currentConfig.disciplinas, link.disciplina_id); const aulas = Number(link.aulas_semana); if (!professor || !turma || !discipline || !disciplineIds.has(String(link.disciplina_id)) || !areaIds.has(String(discipline.area_id)) || !Number.isFinite(aulas) || aulas <= 0) problems.push({ bloqueante: true, professor: professor?.nome, turma: turma?.label, disciplina: discipline?.nome, mensagem: 'Existe um vínculo incompleto ou inválido.' }); });
    if (complete) currentConfig.turmas.forEach((turmaId) => { const turma = byId(turmas, turmaId); const rule = ruleFor(turma, currentConfig.semestre); if (rule && !professorIds.has(String(currentConfig.pdt?.[turmaId]))) problems.push({ bloqueante: true, turma: turma?.nome, mensagem: 'A turma precisa de um PDT pertencente à configuração.' }); });
    Object.entries(currentConfig.pdt || {}).forEach(([turmaId, professorId]) => { if (turmaIds.has(String(turmaId)) && !professorIds.has(String(professorId))) problems.push({ bloqueante: true, turma: byId(turmas, turmaId)?.nome, mensagem: 'O PDT selecionado não pertence à configuração.' }); });
    currentConfig.formacaoArea.forEach((item) => { if (!areaIds.has(String(item.area_id)) || Number(item.dia_semana) < 1 || Number(item.dia_semana) > 5 || Number(item.aula_numero) < 1 || Number(item.aula_numero) > 9) problems.push({ bloqueante: true, mensagem: 'Existe uma formação de área inválida.' }); });
    return problems;
  };

  const validationProblems = validateConfig(false);
  const blockingProblems = validateConfig(true);
  const setField = (field, value) => setCurrentConfig((prev) => ({ ...prev, [field]: value }));

  const mapUsuarioArea = (usuario) => {
    const byIdArea = currentConfig.areas.find((area) => String(area.id) === String(usuario.area_id));
    if (byIdArea) return String(byIdArea.id);
    const byName = currentConfig.areas.find((area) => String(area.nome).toLowerCase() === String(usuario.area_nome || '').toLowerCase());
    return byName ? String(byName.id) : '';
  };

  const toggleUsuario = (usuarioId) => {
    const usuario = usuarios.find((item) => String(item.id) === String(usuarioId));
    if (!usuario) return;
    setCurrentConfig((prev) => {
      const exists = prev.professores.some((professor) => String(professor.usuario_id || professor.id) === String(usuarioId));
      if (exists) return { ...prev, professores: prev.professores.filter((professor) => String(professor.usuario_id || professor.id) !== String(usuarioId)) };
      return { ...prev, professores: mergeProfessores({ professores: [...prev.professores, { id: String(usuario.id), usuario_id: String(usuario.id), nome: usuario.nome, area_id: mapUsuarioArea(usuario), max_aulas_consecutivas_default: 2, observacao: '', origem: 'banco', manual: false }] }) };
    });
  };

  const addManualProfessor = () => {
    if (!manualProfessor.nome.trim() || !manualProfessor.area_id) return notify.error('Professor manual exige nome e área.');
    const professor = { id: newId('prof'), usuario_id: null, nome: manualProfessor.nome.trim(), area_id: String(manualProfessor.area_id), max_aulas_consecutivas_default: Number(manualProfessor.max_aulas_consecutivas_default || 2), observacao: manualProfessor.observacao.trim(), origem: 'manual', manual: true };
    setCurrentConfig((prev) => ({ ...prev, professores: mergeProfessores({ professores: [...prev.professores, professor] }) }));
    setManualProfessor({ nome: '', area_id: '', max_aulas_consecutivas_default: 2, observacao: '' });
  };

  const updateProfessor = (id, field, value) => setCurrentConfig((prev) => ({ ...prev, professores: prev.professores.map((item) => String(item.id) === String(id) ? { ...item, [field]: value } : item) }));
  const addDisciplina = () => { const nome = disciplinaForm.nome.trim(); if (!nome || !byId(currentConfig.areas, disciplinaForm.area_id)) return notify.error('Disciplina exige nome e área válida.'); if (currentConfig.disciplinas.some((item) => item.nome.toLowerCase() === nome.toLowerCase())) return notify.error('Essa disciplina já existe na configuração.'); setCurrentConfig((prev) => ({ ...prev, disciplinas: [...prev.disciplinas, { id: newId('disc'), nome, area_id: String(disciplinaForm.area_id) }] })); setDisciplinaForm({ nome: '', area_id: '' }); };
  const addLink = () => setCurrentConfig((prev) => ({ ...prev, professorTurmas: [...prev.professorTurmas, { id: newId('link'), professor_id: '', turma_id: '', disciplina_id: '', aulas_semana: 2, max_aulas_consecutivas: 2 }] }));
  const updateLink = (id, field, value) => setCurrentConfig((prev) => ({ ...prev, professorTurmas: prev.professorTurmas.map((item) => item.id === id ? { ...item, [field]: value } : item) }));
  const removeLink = (id) => setCurrentConfig((prev) => ({ ...prev, professorTurmas: prev.professorTurmas.filter((item) => item.id !== id) }));
  const toggleFolga = (professorId, day) => setCurrentConfig((prev) => ({ ...prev, folgas: prev.folgas.some((item) => String(item.professor_id) === String(professorId) && Number(item.dia_semana) === day) ? prev.folgas.filter((item) => !(String(item.professor_id) === String(professorId) && Number(item.dia_semana) === day)) : [...prev.folgas, { id: newId('folga'), professor_id: professorId, dia_semana: day }] }));
  const toggleBlock = (field, values) => setCurrentConfig((prev) => ({ ...prev, [field]: prev[field].some((item) => values.every(([key, value]) => String(item[key]) === String(value))) ? prev[field].filter((item) => !values.every(([key, value]) => String(item[key]) === String(value))) : [...prev[field], { id: newId(field === 'formacaoArea' ? 'formacao' : 'ind'), ...Object.fromEntries(values) }] }));

  const saveConfiguration = async (complete = false) => {
    const problems = validateConfig(complete);
    if (problems.length) { notify.error(problems[0].mensagem); return false; }
    setSaving(true);
    const configId = selectedConfigId || newId('cfg');
    const turmaRows = currentConfig.turmas.map((turmaId) => ({ id: currentConfig.configTurmaMap[String(turmaId)] || newId('ct'), configuracao_id: configId, escola_id: currentConfig.escola_id, turma_id: turmaId }));
    const turmaMap = Object.fromEntries(turmaRows.map((row) => [String(row.turma_id), String(row.id)]));
    const areaRows = currentConfig.areas.map((area) => ({ id: area.id || newId('area'), configuracao_id: configId, nome: area.nome, base: area.base }));
    const disciplineRows = currentConfig.disciplinas.map((discipline) => ({ id: discipline.id || newId('disc'), configuracao_id: configId, nome: discipline.nome.trim(), area_id: discipline.area_id }));
    const professorRows = currentConfig.professores.map((professor) => ({ id: professor.id || newId('prof'), configuracao_id: configId, usuario_id: professor.usuario_id || null, nome: professor.nome.trim(), origem: professor.manual ? 'manual' : 'banco', area_id: professor.area_id, max_aulas_consecutivas_default: Number(professor.max_aulas_consecutivas_default || 2), observacao: professor.observacao || null }));
    const linkRows = currentConfig.professorTurmas.map((item) => ({ id: item.id || newId('link'), configuracao_id: configId, professor_id: item.professor_id, disciplina_id: item.disciplina_id, config_turma_id: turmaMap[String(item.turma_id)], aulas_semanais: Number(item.aulas_semana), max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2) }));
    const professorIds = new Set(professorRows.map((row) => String(row.id)));
    const pdtRows = Object.entries(currentConfig.pdt || {}).filter(([turmaId, professorId]) => turmaMap[String(turmaId)] && professorIds.has(String(professorId))).map(([turmaId, professorId]) => ({ id: newId('pdt'), configuracao_id: configId, config_turma_id: turmaMap[String(turmaId)], professor_id: professorId }));
    const payload = { id: configId, nome: currentConfig.nome.trim(), escola_id: currentConfig.escola_id, ano_letivo: Number(currentConfig.ano_letivo), semestre: Number(currentConfig.semestre), status: 'rascunho', created_by: user?.id || null, updated_at: new Date().toISOString() };

    try {
      const configResult = await supabase.from('horario_configuracoes').upsert(payload, { onConflict: 'id' });
      if (configResult.error) throw configResult.error;
      for (const table of ['horario_grade_gerada', 'horario_pdt', 'horario_professor_turma', 'horario_professor_folgas', 'horario_professor_indisponibilidades', 'horario_formacao_area', 'horario_professores', 'horario_disciplinas', 'horario_config_turmas', 'horario_areas']) {
        const result = await supabase.from(table).delete().eq('configuracao_id', configId);
        if (result.error) throw new Error(`Falha ao limpar ${table}: ${result.error.message}`);
      }
      const inserts = [[areaRows, 'horario_areas'], [turmaRows, 'horario_config_turmas'], [disciplineRows, 'horario_disciplinas'], [professorRows, 'horario_professores'], [linkRows, 'horario_professor_turma'], [pdtRows, 'horario_pdt'], [currentConfig.folgas.map((item) => ({ id: item.id || newId('folga'), configuracao_id: configId, professor_id: item.professor_id, dia_semana: Number(item.dia_semana) })), 'horario_professor_folgas'], [currentConfig.indisponibilidades.map((item) => ({ id: item.id || newId('ind'), configuracao_id: configId, professor_id: item.professor_id, dia_semana: Number(item.dia_semana), aula_numero: Number(item.aula_numero) })), 'horario_professor_indisponibilidades'], [currentConfig.formacaoArea.map((item) => ({ id: item.id || newId('formacao'), configuracao_id: configId, area_id: item.area_id, dia_semana: Number(item.dia_semana), aula_numero: Number(item.aula_numero) })), 'horario_formacao_area']];
      for (const [rows, table] of inserts) { if (!rows.length) continue; const result = await supabase.from(table).insert(rows); if (result.error) throw result.error; }
      setCurrentConfig((prev) => ({ ...prev, configTurmaMap: turmaMap, areas: areaRows, disciplinas: disciplineRows, professores: professorRows }));
      setConfigs((prev) => [{ ...payload, created_at: prev.find((item) => String(item.id) === String(configId))?.created_at || new Date().toISOString() }, ...prev.filter((item) => String(item.id) !== String(configId))]);
      setSelectedConfigId(configId);
      notify.success('Configuração salva com sucesso.');
      return true;
    } catch (error) {
      console.error(error);
      notify.error(`Não foi possível salvar: ${error.message || 'erro desconhecido'}.`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1 && !(await saveConfiguration(false))) return;
    if (currentStep === 2 && !currentConfig.turmas.length) return notify.error('Selecione ao menos uma turma.');
    if (currentStep === 3 && currentConfig.professores.some((professor) => !byId(currentConfig.areas, professor.area_id))) return notify.error('Todos os professores precisam de área.');
    if (currentStep === 4 && validateConfig(false).length) return notify.error(validateConfig(false)[0].mensagem);
    if (currentStep === 6 && validateConfig(true).length) return notify.error(validateConfig(true)[0].mensagem);
    if (currentStep < 7) setCurrentStep((step) => step + 1);
  };

  const generate = async () => {
    const problems = validateConfig(true);
    if (problems.length) { setGeneratedSchedule({ ...emptyGrade, validation: problems }); return notify.error(problems[0].mensagem); }
    if (!selectedConfigId) return notify.error('Salve a configuração antes de gerar.');
    const result = generateHorario({ configuracao: currentConfig, turmas, professores: currentConfig.professores, vinculos: currentConfig.professorTurmas, pdtMap: currentConfig.pdt, areas: currentConfig.areas, disciplinas: currentConfig.disciplinas, folgas: currentConfig.folgas, indisponibilidades: currentConfig.indisponibilidades, formacoesArea: currentConfig.formacaoArea, fcRules: FC_RULES[currentConfig.semestre] });
    setGeneratedSchedule(result);
    setCurrentStep(7);
    if (result.validation.length || result.unscheduled.length) return notify.error('Existem aulas não distribuídas ou restrições não satisfeitas. A grade não foi persistida.');
    try {
      const configTurmas = await supabase.from('horario_config_turmas').select('id, turma_id').eq('configuracao_id', selectedConfigId);
      if (configTurmas.error) throw configTurmas.error;
      const turmaMap = Object.fromEntries((configTurmas.data || []).map((row) => [String(row.turma_id), String(row.id)]));
      const rows = result.schedule.map((aula) => ({ id: newId('grade'), configuracao_id: selectedConfigId, config_turma_id: turmaMap[String(aula.turma_id)], dia_semana: WEEK_DAYS.indexOf(aula.dia) + 1, aula_numero: Number(aula.slot), professor_id: aula.professor_id, disciplina_id: aula.tipo === 'FC' ? null : aula.disciplina_id, tipo: aula.tipo === 'FC' ? 'fc' : 'aula' }));
      if (rows.some((row) => !row.config_turma_id || row.dia_semana < 1 || row.dia_semana > 5 || row.aula_numero < 1 || row.aula_numero > 9)) throw new Error('A grade contém referência inválida antes da persistência.');
      const remove = await supabase.from('horario_grade_gerada').delete().eq('configuracao_id', selectedConfigId); if (remove.error) throw remove.error;
      const insert = await supabase.from('horario_grade_gerada').insert(rows); if (insert.error) throw insert.error;
      notify.success(`Horário salvo com ${rows.length} aulas.`);
    } catch (error) { console.error(error); notify.error(`Não foi possível persistir a grade: ${error.message || 'erro desconhecido'}.`); }
  };

  const exportPdf = () => {
    if (!generatedSchedule.schedule.length) return notify.error('Gere o horário antes de exportar.');
    const doc = new jsPDF({ orientation: 'landscape' });
    const school = byId(schools, currentConfig.escola_id)?.nome || 'Escola';
    doc.setFontSize(13); doc.text(school, 14, 14); doc.setFontSize(10); doc.text(`${currentConfig.nome} · ${currentConfig.ano_letivo} · ${currentConfig.semestre}º semestre`, 14, 20);
    let y = 28;
    currentConfig.turmas.forEach((turmaId) => { if (y > 185) { doc.addPage(); y = 14; } doc.setFontSize(11); doc.text(byId(turmas, turmaId)?.nome || 'Turma', 14, y); y += 5; doc.setFontSize(7.5); SLOT_DEFINITIONS.forEach((slot) => { doc.text(`${slot.label} ${slot.time}`, 14, y); WEEK_DAYS.forEach((day, index) => { const aula = generatedSchedule.grid[String(turmaId)]?.find((item) => item.dia === day && Number(item.slot) === slot.slot); const text = aula ? `${aula.tipo === 'FC' ? 'FC · ' : ''}${aula.disciplina} · ${aula.professor_nome}` : '—'; doc.text(`${day.slice(0,3)}: ${text}`.slice(0, 46), 55 + index * 45, y); }); y += 4; }); y += 7; });
    doc.save(`horario_${currentConfig.nome || 'gerado'}.pdf`);
  };

  const exportExcel = () => {
    if (!generatedSchedule.schedule.length) return notify.error('Gere o horário antes de exportar.');
    const rows = [];
    currentConfig.turmas.forEach((turmaId) => SLOT_DEFINITIONS.forEach((slot) => WEEK_DAYS.forEach((day) => { const aula = generatedSchedule.grid[String(turmaId)]?.find((item) => item.dia === day && Number(item.slot) === slot.slot); rows.push({ Escola: byId(schools, currentConfig.escola_id)?.nome || 'Escola', Configuração: currentConfig.nome, Turma: byId(turmas, turmaId)?.nome || 'Turma', Dia: day, Horário: slot.time, Aula: slot.label, Disciplina: aula?.disciplina || '', Professor: aula?.professor_nome || '', Tipo: aula?.tipo === 'FC' ? 'FC' : aula ? 'Aula' : '' }); }))));
    const book = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows); XLSX.utils.book_append_sheet(book, sheet, 'Horários'); XLSX.writeFile(book, `horario_${currentConfig.nome || 'gerado'}.xlsx`);
  };

  const toggleAvailability = (field, professorId, day, slot) => setCurrentConfig((prev) => { const exists = prev[field].some((item) => String(item.professor_id) === String(professorId) && Number(item.dia_semana) === Number(day) && Number(item.aula_numero || 0) === Number(slot)); return { ...prev, [field]: exists ? prev[field].filter((item) => !(String(item.professor_id) === String(professorId) && Number(item.dia_semana) === Number(day) && Number(item.aula_numero || 0) === Number(slot))) : [...prev[field], { id: newId(field), professor_id: professorId, dia_semana: Number(day), ...(field === 'indisponibilidades' ? { aula_numero: Number(slot) } : {}) }] }; });

  const renderStep = () => {
    if (currentStep === 1) return <div className="grid gap-4 md:grid-cols-2"><FormInput label="Nome da configuração" value={currentConfig.nome} onChange={(event) => setField('nome', event.target.value)} /><label className="text-sm font-medium">Escola<select className="mt-1 w-full rounded-xl border px-3 py-2" value={currentConfig.escola_id} onChange={(event) => setField('escola_id', event.target.value)}><option value="">Selecione</option>{schools.map((school) => <option key={school.id} value={school.id}>{school.nome}</option>)}</select></label><FormInput label="Ano letivo" type="number" value={currentConfig.ano_letivo} onChange={(event) => setField('ano_letivo', Number(event.target.value))} /><label className="text-sm font-medium">Semestre<select className="mt-1 w-full rounded-xl border px-3 py-2" value={currentConfig.semestre} onChange={(event) => setField('semestre', Number(event.target.value))}><option value="1">1º semestre</option><option value="2">2º semestre</option></select></label></div>;
    if (currentStep === 2) return <div className="space-y-4"><div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">{turmas.map((turma) => <label key={turma.id} className="flex items-center gap-2 rounded-xl border p-3"><input type="checkbox" checked={currentConfig.turmas.includes(String(turma.id))} onChange={() => setField('turmas', currentConfig.turmas.includes(String(turma.id)) ? currentConfig.turmas.filter((id) => String(id) !== String(turma.id)) : [...currentConfig.turmas, String(turma.id)])} />{turma.nome}</label>)}</div><div className="rounded-xl bg-slate-50 p-4 text-sm">Selecionadas: {currentConfig.turmas.map((id) => byId(turmas, id)?.nome).join(' · ') || 'nenhuma'}</div></div>;
    if (currentStep === 3) return <div className="space-y-5"><div className="flex flex-wrap gap-2">{FIXED_AREAS.map((area) => <span key={area.nome} className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold">{area.nome}</span>)}</div><div className="grid gap-2 md:grid-cols-2">{usuarios.filter((usuario) => !currentConfig.professores.some((professor) => String(professor.usuario_id || professor.id) === String(usuario.id))).map((usuario) => <button type="button" key={usuario.id} onClick={() => toggleUsuario(usuario.id)} className="rounded-xl border p-3 text-left"><strong>{usuario.nome}</strong><div className="text-xs text-slate-500">{usuario.area_nome || 'Área não informada'}</div></button>)}</div><div className="rounded-xl border p-4 space-y-3"><div className="grid gap-3 md:grid-cols-4"><FormInput label="Professor manual" value={manualProfessor.nome} onChange={(event) => setManualProfessor((prev) => ({ ...prev, nome: event.target.value }))} /><label className="text-sm font-medium">Área<select className="mt-1 w-full rounded-xl border px-3 py-2" value={manualProfessor.area_id} onChange={(event) => setManualProfessor((prev) => ({ ...prev, area_id: event.target.value }))}><option value="">Selecione</option>{areaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><FormInput label="Máx. consecutivas" type="number" value={manualProfessor.max_aulas_consecutivas_default} onChange={(event) => setManualProfessor((prev) => ({ ...prev, max_aulas_consecutivas_default: Number(event.target.value) || 2 }))} /><FormInput label="Observação" value={manualProfessor.observacao} onChange={(event) => setManualProfessor((prev) => ({ ...prev, observacao: event.target.value }))} /></div><Button type="button" variant="secondary" onClick={addManualProfessor}><FaPlus className="mr-2" />Adicionar professor manual</Button></div><div className="space-y-2">{currentConfig.professores.map((professor) => <div key={professor.id} className="grid gap-2 rounded-xl border p-3 md:grid-cols-[1.3fr_1fr_160px_1.5fr]"><div><strong>{professor.nome}</strong><div className="text-xs text-slate-500">{professor.manual ? 'Manual' : 'Base'}</div></div><select className="rounded-xl border px-3 py-2" value={professor.area_id || ''} onChange={(event) => updateProfessor(professor.id, 'area_id', event.target.value)}><option value="">Área</option>{areaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input className="rounded-xl border px-3 py-2" type="number" min="1" value={professor.max_aulas_consecutivas_default || 2} onChange={(event) => updateProfessor(professor.id, 'max_aulas_consecutivas_default', Number(event.target.value) || 2)} /><input className="rounded-xl border px-3 py-2" value={professor.observacao || ''} onChange={(event) => updateProfessor(professor.id, 'observacao', event.target.value)} /></div>)}</div></div>;
    if (currentStep === 4) return <div className="space-y-5"><div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><FormInput label="Disciplina" value={disciplinaForm.nome} onChange={(event) => setDisciplinaForm((prev) => ({ ...prev, nome: event.target.value }))} /><label className="text-sm font-medium">Área<select className="mt-1 w-full rounded-xl border px-3 py-2" value={disciplinaForm.area_id} onChange={(event) => setDisciplinaForm((prev) => ({ ...prev, area_id: event.target.value }))}><option value="">Selecione</option>{areaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label><div className="flex items-end"><Button type="button" variant="secondary" onClick={addDisciplina}><FaPlus className="mr-2" />Adicionar</Button></div></div><div className="flex flex-wrap gap-2">{currentConfig.disciplinas.map((discipline) => <span key={discipline.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs">{discipline.nome} · {byId(currentConfig.areas, discipline.area_id)?.nome || 'Área inválida'}</span>)}</div><div className="space-y-3"><div className="flex justify-between"><h3 className="font-semibold">Atribuições</h3><Button type="button" variant="secondary" onClick={addLink}>Adicionar vínculo</Button></div>{currentConfig.professorTurmas.map((link) => <div key={link.id} className="grid gap-2 rounded-xl border p-3 md:grid-cols-6"><select className="rounded-xl border px-2 py-2" value={link.professor_id} onChange={(event) => updateLink(link.id, 'professor_id', event.target.value)}><option value="">Professor</option>{professorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select className="rounded-xl border px-2 py-2" value={link.turma_id} onChange={(event) => updateLink(link.id, 'turma_id', event.target.value)}><option value="">Turma</option>{turmaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><select className="rounded-xl border px-2 py-2" value={link.disciplina_id} onChange={(event) => updateLink(link.id, 'disciplina_id', event.target.value)}><option value="">Disciplina</option>{disciplinaOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><input className="rounded-xl border px-2 py-2" type="number" min="1" value={link.aulas_semana} onChange={(event) => updateLink(link.id, 'aulas_semana', Number(event.target.value) || 0)} /><input className="rounded-xl border px-2 py-2" type="number" min="1" value={link.max_aulas_consecutivas} onChange={(event) => updateLink(link.id, 'max_aulas_consecutivas', Number(event.target.value) || 1)} /><button type="button" className="rounded-xl border border-red-200 text-red-700" onClick={() => removeLink(link.id)}>Remover</button></div>)}</div></div>;
    if (currentStep === 5) return <div className="space-y-5"><div className="rounded-xl border p-4"><h3 className="mb-3 font-semibold">Folgas</h3>{currentConfig.professores.map((professor) => <div key={professor.id} className="mb-2 flex flex-wrap gap-2"><strong className="w-40 text-sm">{professor.nome}</strong>{[1,2,3,4,5].map((day) => <button type="button" key={day} onClick={() => toggleFolga(professor.id, day)} className={`rounded-full px-3 py-1 text-xs ${currentConfig.folgas.some((item) => String(item.professor_id) === String(professor.id) && Number(item.dia_semana) === day) ? 'bg-red-600 text-white' : 'bg-slate-100'}`}>{['Seg','Ter','Qua','Qui','Sex'][day - 1]}</button>)}</div>)}</div><div className="rounded-xl border p-4 overflow-x-auto"><h3 className="mb-3 font-semibold">Indisponibilidades</h3>{currentConfig.professores.map((professor) => <div key={professor.id} className="mb-4 min-w-[760px]"><strong>{professor.nome}</strong><div className="mt-2 grid grid-cols-5 gap-2">{[1,2,3,4,5].map((day) => <div key={day} className="rounded-lg bg-slate-50 p-2"><div className="mb-1 text-xs">{['Seg','Ter','Qua','Qui','Sex'][day-1]}</div><div className="grid grid-cols-5 gap-1">{SLOT_DEFINITIONS.map((slot) => <button type="button" key={slot.slot} onClick={() => toggleAvailability('indisponibilidades', professor.id, day, slot.slot)} className={`h-7 rounded text-[10px] ${currentConfig.indisponibilidades.some((item) => String(item.professor_id) === String(professor.id) && Number(item.dia_semana) === day && Number(item.aula_numero) === slot.slot) ? 'bg-orange-500 text-white' : 'bg-slate-200'}`}>{slot.slot}</button>)}</div></div>)}</div></div>)}</div><div className="rounded-xl border p-4 overflow-x-auto"><h3 className="mb-3 font-semibold">Formação por área</h3>{currentConfig.areas.map((area) => <div key={area.id} className="mb-4 min-w-[760px]"><strong>{area.nome}</strong><div className="mt-2 grid grid-cols-5 gap-2">{[1,2,3,4,5].map((day) => <div key={day} className="rounded-lg bg-slate-50 p-2"><div className="mb-1 text-xs">{['Seg','Ter','Qua','Qui','Sex'][day-1]}</div><div className="grid grid-cols-5 gap-1">{SLOT_DEFINITIONS.map((slot) => { const active = currentConfig.formacaoArea.some((item) => String(item.area_id) === String(area.id) && Number(item.dia_semana) === day && Number(item.aula_numero) === slot.slot); return <button type="button" key={slot.slot} onClick={() => toggleBlock('formacaoArea', [['area_id', area.id], ['dia_semana', day], ['aula_numero', slot.slot]])} className={`h-7 rounded text-[10px] ${active ? 'bg-amber-500 text-white' : 'bg-slate-200'}`}>{slot.slot}</button>; })}</div></div>)}</div></div>)}</div></div>;
    if (currentStep === 6) return <div className="space-y-3">{currentConfig.turmas.map((turmaId) => { const turma = byId(turmas, turmaId); const rule = ruleFor(turma, currentConfig.semestre); return <div key={turmaId} className="rounded-xl border p-4"><div className="mb-2 font-semibold">{turma?.nome || 'Turma'}{rule ? ` · FC ${rule.dia} · ${rule.slot}ª` : ' · sem regra de FC'}</div><select className="w-full rounded-xl border px-3 py-2" value={currentConfig.pdt?.[turmaId] || ''} onChange={(event) => setCurrentConfig((prev) => ({ ...prev, pdt: { ...prev.pdt, [turmaId]: event.target.value } }))}><option value="">Selecione o PDT</option>{professorOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>; })}</div>;

    return <div className="space-y-5"><div className="grid gap-4 md:grid-cols-2"><Card title="Configuração" content={`${currentConfig.nome} · ${currentConfig.ano_letivo} · ${currentConfig.semestre}º semestre`} /><Card title="Total de aulas" content={generatedSchedule.schedule.length} /></div><section className="rounded-xl border p-4"><h3 className="font-semibold">Turmas</h3><p className="text-sm">{currentConfig.turmas.map((id) => byId(turmas, id)?.nome).join(' · ') || 'nenhuma'}</p></section><section className="rounded-xl border p-4"><h3 className="font-semibold">Professores</h3>{currentConfig.professores.map((professor) => <div key={professor.id} className="text-sm">{professor.nome} · {byId(currentConfig.areas, professor.area_id)?.nome || 'Área inválida'}</div>)}</section><section className="rounded-xl border p-4"><h3 className="font-semibold">Disciplinas</h3>{currentConfig.disciplinas.map((discipline) => <div key={discipline.id} className="text-sm">{discipline.nome} · {byId(currentConfig.areas, discipline.area_id)?.nome || 'Área inválida'}</div>)}</section><section className="rounded-xl border p-4"><h3 className="font-semibold">Atribuições</h3>{currentConfig.professorTurmas.map((link) => <div key={link.id} className="text-sm">{byId(currentConfig.professores, link.professor_id)?.nome || 'Professor'} · {byId(turmas, link.turma_id)?.nome || 'Turma'} · {byId(currentConfig.disciplinas, link.disciplina_id)?.nome || 'Disciplina'} · {link.aulas_semana} aulas/semana</div>)}</section><section className="rounded-xl border p-4"><h3 className="font-semibold">PDT</h3>{currentConfig.turmas.map((id) => <div key={id} className="text-sm">{byId(turmas, id)?.nome} → {byId(currentConfig.professores, currentConfig.pdt?.[id])?.nome || 'não definido'}</div>)}</section><section className="rounded-xl border p-4"><h3 className="font-semibold">Restrições</h3><p className="text-sm">{currentConfig.folgas.length} folgas · {currentConfig.indisponibilidades.length} indisponibilidades · {currentConfig.formacaoArea.length} formações</p></section><section className="rounded-xl border p-4"><h3 className="font-semibold">Problemas encontrados</h3>{blockingProblems.length ? <ul className="list-disc pl-5 text-sm text-red-700">{blockingProblems.map((problem, index) => <li key={`${index}-${problem.mensagem}`}>{problem.mensagem}</li>)}</ul> : validationProblems.length ? <ul className="list-disc pl-5 text-sm text-amber-700">{validationProblems.map((problem, index) => <li key={`${index}-${problem.mensagem}`}>{problem.mensagem}</li>)}</ul> : <p className="text-sm text-green-700">Nenhum problema encontrado.</p>}</section>{generatedSchedule.schedule.length > 0 && <><div className="flex flex-wrap gap-2"><Button type="button" onClick={generate}><FaCalendarAlt className="mr-2" />Gerar novamente</Button><Button type="button" variant="secondary" onClick={exportPdf}><FaFilePdf className="mr-2" />PDF</Button><Button type="button" variant="secondary" onClick={exportExcel}><FaFileExcel className="mr-2" />Excel</Button></div>{currentConfig.turmas.map((turmaId) => <section key={turmaId} className="rounded-xl border p-4 overflow-x-auto"><h3 className="mb-3 font-semibold">{byId(turmas, turmaId)?.nome}</h3><table className="min-w-full border-collapse text-xs"><thead><tr><th className="border p-2">Aula / horário</th>{WEEK_DAYS.map((day) => <th className="border p-2" key={day}>{day}</th>)}</tr></thead><tbody>{SLOT_DEFINITIONS.map((slot) => <tr key={slot.slot}><td className="border p-2 font-semibold">{slot.label} · {slot.time}</td>{WEEK_DAYS.map((day) => { const aula = generatedSchedule.grid[String(turmaId)]?.find((item) => item.dia === day && Number(item.slot) === slot.slot); return <td className="border p-2" key={`${day}-${slot.slot}`}>{aula ? <><div className="font-semibold">{aula.tipo === 'FC' ? 'FC · ' : ''}{aula.disciplina}</div><div>{aula.professor_nome}</div></> : '—'}</td>; })}</tr>)}</tbody></table></section>)}</>}{generatedSchedule.validation.length > 0 && <section className="rounded-xl border border-red-200 bg-red-50 p-4"><h3 className="font-semibold text-red-800">Conflitos / não distribuídas</h3><ul className="list-disc pl-5 text-sm text-red-800">{generatedSchedule.validation.map((problem, index) => <li key={index}>{problem.turma ? `${problem.turma} · ` : ''}{problem.professor ? `${problem.professor} · ` : ''}{problem.disciplina ? `${problem.disciplina} · ` : ''}{problem.solicitadas ? `${problem.distribuídas}/${problem.solicitadas} distribuídas · ` : ''}{problem.mensagem}</li>)}</ul></section>}</div>;
  };

  if (loading) return <div className="flex min-h-[40vh] items-center justify-center gap-3 text-slate-600"><FaSpinner className="animate-spin" />Carregando módulo de horários...</div>;

  return <div className="space-y-6"><PageTitle title="Módulo de Horários Escolares" subtitle="Configuração, validação, geração automática e exportação." /><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{configs.map((config) => <button key={config.id} type="button" onClick={() => setSelectedConfigId(String(config.id))} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${String(selectedConfigId) === String(config.id) ? 'bg-green-700 text-white' : 'bg-slate-100'}`}>{config.nome}</button>)}</div><Button type="button" variant="secondary" onClick={() => { setSelectedConfigId(''); setCurrentConfig(makeConfig(user?.escola_id || schools[0]?.id || '')); setGeneratedSchedule(emptyGrade); setCurrentStep(1); }}>Nova configuração</Button></div><div className="grid gap-2 md:grid-cols-7">{steps.map((step, index) => { const number = index + 1; return <button key={step} type="button" onClick={() => number <= currentStep && setCurrentStep(number)} className={`rounded-xl px-2 py-2 text-xs font-semibold ${number === currentStep ? 'bg-green-700 text-white' : number < currentStep ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-500'}`}>{number}. {step}</button>; })}</div><div className="rounded-2xl border bg-white p-5 shadow-sm">{renderStep()}<div className="mt-6 flex flex-wrap justify-between gap-3 border-t pt-4"><div className="flex gap-2"><Button type="button" variant="secondary" disabled={currentStep === 1 || saving} onClick={() => setCurrentStep((step) => Math.max(1, step - 1))}>Voltar</Button>{currentStep < 7 && <Button type="button" disabled={saving} onClick={nextStep}>{saving ? 'Salvando...' : currentStep === 1 ? 'Salvar e continuar' : 'Continuar'}</Button>}</div><div className="flex gap-2"><Button type="button" variant="secondary" disabled={saving} onClick={() => saveConfiguration(false)}>{saving ? 'Salvando...' : 'Salvar'}</Button>{currentStep === 7 && <Button type="button" disabled={saving || blockingProblems.length > 0 || !selectedConfigId} onClick={generate}><FaCalendarAlt className="mr-2" />Gerar horário</Button>}</div></div></div></div>;
};
