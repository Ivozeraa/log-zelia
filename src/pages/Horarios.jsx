import { useEffect, useMemo, useState } from 'react';
import {
  FaCalendarAlt,
  FaCheck,
  FaFileExcel,
  FaFilePdf,
  FaPlus,
  FaSpinner,
  FaTrash,
  FaUserPlus,
} from 'react-icons/fa';
import { addPdfFooter } from '../utils/pdfFooterPatch';
import logoImg from '../assets/images/logoEEEP.png';

import { supabase } from '../utils/supabase';
import { notify } from '../utils/notify';
import { useAuth } from '../hooks/useAuth';
import { PageTitle } from '../components/ui/PageTitle';
import { Button } from '../components/ui/Button';
import { FormInput } from '../components/ui/FormInput';
import { Card } from '../components/ui/Card';
import { CustomSelect } from '../components/ui/CustomSelect';
import { Modal } from '../components/ui/Modal';
import {
  FC_RULES,
  FIXED_AREAS,
  SLOT_DEFINITIONS,
  WEEK_DAYS,
  generateHorario,
} from '../services/horarioService';

const pdfLibrariesPromise = Promise.all([
  import('jspdf'),
  import('jspdf-autotable'),
]).then(([jspdfModule, autoTableModule]) => ({
  jsPDF: jspdfModule.jsPDF,
  autoTable: autoTableModule.default,
}));

const excelLibrariesPromise = import('exceljs').then((module) => module.default);

const emptyGrade = { grid: {}, schedule: [], validation: [], unscheduled: [] };
const PROFESSOR_ROLE_ID = 4;

const COURSE_STYLES = [
  { key: 'adm', label: 'Adm', match: /adm/i, hex: '60A5FA', rgb: [96, 165, 250] },
  { key: 'enfermagem', label: 'Enfermagem', match: /enferm/i, hex: '22C55E', rgb: [34, 197, 94] },
  { key: 'eletro', label: 'Eletro', match: /eletro/i, hex: 'F97316', rgb: [249, 115, 22] },
  { key: 'informatica', label: 'Informática', match: /inform[aá]tica/i, hex: 'DC2626', rgb: [220, 38, 38] },
];
const DEFAULT_COURSE_STYLE = { key: 'outros', label: 'Outros', hex: '475569', rgb: [71, 85, 105] };
const getCourseStyle = (turmaNome = '') => COURSE_STYLES.find((course) => course.match.test(turmaNome)) || DEFAULT_COURSE_STYLE;
const SCHEDULE_EXPORT_ROWS = [
  { type: 'slot', slot: 1 }, { type: 'slot', slot: 2 },
  { type: 'break', label: 'LANCHE DA MANHÃ' },
  { type: 'slot', slot: 3 }, { type: 'slot', slot: 4 }, { type: 'slot', slot: 5 },
  { type: 'break', label: 'ALMOÇO' },
  { type: 'slot', slot: 6 }, { type: 'slot', slot: 7 },
  { type: 'break', label: 'LANCHE DA TARDE' },
  { type: 'slot', slot: 8 }, { type: 'slot', slot: 9 },
];
const SCHEDULE_LEGEND_LEFT = ['7h20 - 1º TEMPO','8h10 - 2º TEMPO','9h00 - LANCHE','9h30 - 3º TEMPO','10h20 - 4º TEMPO','11h10 - 5º TEMPO','12h - ALMOÇO'];
const SCHEDULE_LEGEND_RIGHT = ['13h00 - 6º TEMPO','13h50 - 7º TEMPO','14h40 - LANCHE','15h - 8º TEMPO','15h50 - 9º TEMPO','16h40 - ENCERRAMENTO'];
const PDF_EXPORT_MODES = [
  { value: 'separated', title: 'Todos separados', description: 'Uma página por turma.' },
  { value: 'course', title: 'Somente por curso', description: 'Escolha um curso e gere somente as turmas dele.' },
  { value: 'unified', title: 'Todos em uma única página', description: 'Junta as turmas respeitando o espaço disponível.' },
];
const PDF_FOOTER_HEIGHT = 7;
const PDF_TOP_MARGIN = 22;
const firstName = (nome = '') => String(nome).trim().split(/\s+/)[0] || '';
const cellLabel = (aula) => !aula ? '—' : aula.tipo === 'FC' ? 'FC' : [aula.disciplina, aula.professor_nome].filter(Boolean).join(' - ').toUpperCase();
const cellLabelPdf = (aula) => !aula ? '—' : aula.tipo === 'FC' ? 'FC' : [aula.disciplina, firstName(aula.professor_nome)].filter(Boolean).join(' - ').toUpperCase();


const steps = [
  'Configuração',
  'Turmas',
  'Professores, Áreas e Disciplinas',
  'Atribuições',
  'Disponibilidades',
  'PDT',
  'Revisão e Geração',
];

const newId = (prefix) =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalize = (value) => (Array.isArray(value) ? value : []);
const byId = (items, id) =>
  normalize(items).find((item) => String(item.id) === String(id));
const selectedTurmas = (items, ids) =>
  normalize(items).filter((item) => normalize(ids).map(String).includes(String(item.id)));

const ruleFor = (turma, semestre) => {
  const match = String(turma?.nome || '').match(/(\d+)\s*º|\b(\d+)\b/);
  const serie = match ? `${match[1] || match[2]}º` : null;
  return FC_RULES[Number(semestre) || 1]?.[serie];
};

const makeAreas = (source = []) =>
  FIXED_AREAS.map((fixed) => {
    const existing = normalize(source).find(
      (area) => String(area?.nome || '').trim().toLowerCase() === fixed.nome.toLowerCase(),
    );
    return existing
      ? { ...existing, nome: fixed.nome, base: fixed.base }
      : { id: newId('area'), ...fixed };
  });

const emptyConfig = (escolaId = '') => ({
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

const selectClass =
  'h-12 w-full appearance-none rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 shadow-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white';

const SelectField = ({ label, value, onChange, children, className = '', ...props }) => (
  <label className="block space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
    <span>{label}</span>
    <select {...props} value={value} onChange={onChange} className={`${selectClass} ${className}`}>
      {children}
    </select>
  </label>
);

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
  const [currentConfig, setCurrentConfig] = useState(() => emptyConfig(user?.escola_id || ''));
  const [professorModalOpen, setProfessorModalOpen] = useState(false);
  const [editingProfessorId, setEditingProfessorId] = useState(null);
  const [professorDraft, setProfessorDraft] = useState({
    usuario_id: '',
    area_id: '',
    max_aulas_consecutivas_default: 2,
    pdt_turma_id: '',
  });
  const [disciplinaModalOpen, setDisciplinaModalOpen] = useState(false);
  const [editingDisciplinaId, setEditingDisciplinaId] = useState(null);
  const [disciplinaForm, setDisciplinaForm] = useState({ nome: '', area_id: '' });
  const [vinculoModalOpen, setVinculoModalOpen] = useState(false);
  const [editingLinkProfessorId, setEditingLinkProfessorId] = useState(null);
  const [linkDraft, setLinkDraft] = useState({
    professor_id: '',
    items: [{ id: newId('assignment-item'), turma_id: '', disciplina_id: '', aulas_semana: 2, max_aulas_consecutivas: 2 }],
  });
  const [generatedSchedule, setGeneratedSchedule] = useState(emptyGrade);
  const [statusMessage, setStatusMessage] = useState('');
  const [pdfModalOpen, setPdfModalOpen] = useState(false);
  const [pdfMode, setPdfMode] = useState('separated');
  const [pdfCourseKey, setPdfCourseKey] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [deleteConfigModalOpen, setDeleteConfigModalOpen] = useState(false);
  const [deletingConfig, setDeletingConfig] = useState(false);

  const schoolTurmas = useMemo(
    () =>
      currentConfig.escola_id
        ? turmas.filter((turma) => String(turma.escola_id) === String(currentConfig.escola_id))
        : turmas,
    [turmas, currentConfig.escola_id],
  );

  const allTurmasSelected =
    schoolTurmas.length > 0 &&
    schoolTurmas.every((turma) => currentConfig.turmas.map(String).includes(String(turma.id)));

  const areaOptions = useMemo(
    () => currentConfig.areas.map((area) => ({
      value: String(area.id),
      label: `${area.nome}${area.base === 'tecnica' ? ' · Técnica' : ''}`,
    })),
    [currentConfig.areas],
  );

  const turmaOptions = useMemo(
    () => schoolTurmas.map((turma) => ({ value: String(turma.id), label: turma.nome })),
    [schoolTurmas],
  );

  const availablePdfCourses = useMemo(() => {
    const map = new Map();
    currentConfig.turmas.forEach((turmaId) => {
      const course = getCourseStyle(byId(turmas, turmaId)?.nome);
      if (!map.has(course.key)) map.set(course.key, course);
    });
    return Array.from(map.values());
  }, [currentConfig.turmas, turmas]);

  const professorOptions = useMemo(
    () => currentConfig.professores.map((professor) => ({
      value: String(professor.id),
      label: `${professor.nome}${byId(currentConfig.areas, professor.area_id) ? ` · ${byId(currentConfig.areas, professor.area_id).nome}` : ' · área pendente'}`,
    })),
    [currentConfig.professores, currentConfig.areas],
  );

  const disciplinaOptions = useMemo(
    () => currentConfig.disciplinas.map((discipline) => ({
      value: String(discipline.id),
      label: `${discipline.nome} · ${byId(currentConfig.areas, discipline.area_id)?.nome || 'Área inválida'}`,
    })),
    [currentConfig.disciplinas, currentConfig.areas],
  );

  const professorUsers = useMemo(
    () => usuarios
      .filter((usuario) => Number(usuario.role_id) === PROFESSOR_ROLE_ID)
      .filter((usuario) => !currentConfig.professores.some((professor) => String(professor.usuario_id) === String(usuario.id)))
      .map((usuario) => ({ value: String(usuario.id), label: `${usuario.nome}${usuario.pdt ? ' · PDT' : ''}` })),
    [usuarios, currentConfig.professores],
  );

  const availablePdtTurmaOptions = useMemo(() => {
    const assigned = new Set(
      Object.entries(currentConfig.pdt || {})
        .filter(([, professorId]) => String(professorId) !== String(editingProfessorId || ''))
        .map(([turmaId]) => String(turmaId)),
    );
    return turmaOptions.filter(
      (option) => currentConfig.turmas.includes(String(option.value)) &&
        (!assigned.has(String(option.value)) || String(option.value) === String(professorDraft.pdt_turma_id)),
    );
  }, [currentConfig.pdt, currentConfig.turmas, editingProfessorId, professorDraft.pdt_turma_id, turmaOptions]);

  const professorAssignmentGroups = useMemo(() => {
    const groups = new Map();
    currentConfig.professorTurmas.forEach((link) => {
      const key = String(link.professor_id);
      if (!groups.has(key)) groups.set(key, { professor_id: key, items: [] });
      groups.get(key).items.push(link);
    });
    return Array.from(groups.values());
  }, [currentConfig.professorTurmas]);

  const selectedModalUser = byId(usuarios, professorDraft.usuario_id);
  const selectedModalProfessor = byId(currentConfig.professores, editingProfessorId);

  useEffect(() => {
    let active = true;
    const loadInitial = async () => {
      try {
        setLoading(true);
        const results = await Promise.all([
          supabase.from('escolas').select('*').order('nome', { ascending: true }),
          supabase.from('turmas').select('*').order('nome', { ascending: true }),
          supabase.from('horario_configuracoes').select('*').order('created_at', { ascending: false }),
          supabase.from('usuarios').select('id, nome, escola_id, role_id, pdt').order('nome', { ascending: true }),
        ]);
        const error = results.find((result) => result.error)?.error;
        if (error) throw error;
        if (!active) return;
        setSchools(results[0].data || []);
        setTurmas(results[1].data || []);
        setConfigs(results[2].data || []);
        setUsuarios(results[3].data || []);
        if (!selectedConfigId && results[2].data?.length) {
          setSelectedConfigId(String(results[2].data[0].id));
        } else if (!currentConfig.escola_id) {
          setCurrentConfig((prev) => ({ ...prev, escola_id: user?.escola_id || results[0].data?.[0]?.id || '' }));
        }
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
      const loadedProfessors = (results[4].data || []).map((row) => ({
        id: String(row.id),
        usuario_id: row.usuario_id ? String(row.usuario_id) : null,
        nome: row.nome || 'Professor',
        area_id: row.area_id ? String(row.area_id) : '',
        max_aulas_consecutivas_default: Number(row.max_aulas_consecutivas_default || 2),
        observacao: row.observacao || '',
        origem: row.origem || 'banco',
      }));
      const pdt = {};
      (results[6].data || []).forEach((row) => {
        const turmaId = results[1].data?.find((item) => String(item.id) === String(row.config_turma_id))?.turma_id;
        if (turmaId) pdt[String(turmaId)] = String(row.professor_id);
      });
      const links = (results[5].data || []).map((row) => ({
        id: String(row.id),
        professor_id: String(row.professor_id),
        turma_id: String(results[1].data?.find((item) => String(item.id) === String(row.config_turma_id))?.turma_id || ''),
        disciplina_id: row.disciplina_id ? String(row.disciplina_id) : '',
        aulas_semana: Number(row.aulas_semanais || 0),
        max_aulas_consecutivas: Number(row.max_aulas_consecutivas || 2),
      }));
      const config = {
        nome: results[0].data.nome || '',
        escola_id: results[0].data.escola_id || '',
        ano_letivo: Number(results[0].data.ano_letivo || new Date().getFullYear()),
        semestre: Number(results[0].data.semestre || 1),
        turmas: (results[1].data || []).map((row) => String(row.turma_id)),
        configTurmaMap,
        professores: loadedProfessors,
        professorTurmas: links,
        pdt,
        folgas: results[7].data || [],
        indisponibilidades: results[8].data || [],
        formacaoArea: results[9].data || [],
        areas: loadedAreas,
        disciplinas: loadedDisciplines,
      };
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
    if (!rows.length) {
      setGeneratedSchedule(emptyGrade);
      return;
    }
    const grid = {};
    const schedule = [];
    const validation = [];
    [...rows].sort((a, b) => Number(a.dia_semana) - Number(b.dia_semana) || Number(a.aula_numero) - Number(b.aula_numero)).forEach((row) => {
      const turmaId = Object.entries(config.configTurmaMap).find(([, id]) => String(id) === String(row.config_turma_id))?.[0];
      const professor = byId(config.professores, row.professor_id);
      const discipline = row.disciplina_id ? byId(config.disciplinas, row.disciplina_id) : null;
      const record = {
        turma_id: turmaId,
        turma_nome: byId(turmas, turmaId)?.nome || 'Turma',
        professor_id: row.professor_id,
        professor_nome: professor?.nome || 'Professor',
        disciplina_id: row.disciplina_id || null,
        disciplina: row.tipo === 'fc' ? 'Formação para a Cidadania' : discipline?.nome || 'Disciplina não encontrada',
        dia: WEEK_DAYS[Number(row.dia_semana) - 1] || '',
        slot: Number(row.aula_numero),
        tipo: row.tipo === 'fc' ? 'FC' : 'Regular',
      };
      if (!turmaId || !professor || (row.tipo !== 'fc' && !discipline)) validation.push({ bloqueante: true, mensagem: 'A grade persistida possui referência inválida.' });
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
    currentConfig.professores.forEach((professor) => {
      if (!professor.nome?.trim() || !areaIds.has(String(professor.area_id))) problems.push({ bloqueante: true, professor: professor.nome, mensagem: 'Todo professor precisa de nome e área válida na configuração.' });
    });
    currentConfig.disciplinas.forEach((discipline) => {
      if (!discipline.nome?.trim() || !areaIds.has(String(discipline.area_id))) problems.push({ bloqueante: true, disciplina: discipline.nome, mensagem: `Disciplina "${discipline.nome || 'sem nome'}" precisa de área válida.` });
    });
    currentConfig.professorTurmas.forEach((link) => {
      const professor = byId(currentConfig.professores, link.professor_id);
      const turma = byId(turmas, link.turma_id);
      const discipline = byId(currentConfig.disciplinas, link.disciplina_id);
      const aulas = Number(link.aulas_semana);
      const maxConsecutivas = Number(link.max_aulas_consecutivas);
      if (!professor || !turma || !discipline || !disciplineIds.has(String(link.disciplina_id)) || !areaIds.has(String(discipline.area_id)) || !Number.isFinite(aulas) || aulas <= 0 || !Number.isFinite(maxConsecutivas) || maxConsecutivas <= 0) {
        problems.push({ bloqueante: true, professor: professor?.nome, turma: turma?.nome, disciplina: discipline?.nome, mensagem: 'Existe um vínculo incompleto ou inválido.' });
      }
    });
    if (complete) {
      currentConfig.turmas.forEach((turmaId) => {
        const turma = byId(turmas, turmaId);
        const rule = ruleFor(turma, currentConfig.semestre);
        if (rule && !professorIds.has(String(currentConfig.pdt?.[turmaId]))) {
          problems.push({ bloqueante: true, turma: turma?.nome, mensagem: 'A turma precisa de um PDT pertencente à configuração.' });
        }
      });
    }
    Object.entries(currentConfig.pdt || {}).forEach(([turmaId, professorId]) => {
      if (turmaIds.has(String(turmaId)) && !professorIds.has(String(professorId))) problems.push({ bloqueante: true, turma: byId(turmas, turmaId)?.nome, mensagem: 'O PDT selecionado não pertence à configuração.' });
    });
    currentConfig.formacaoArea.forEach((item) => {
      if (!areaIds.has(String(item.area_id)) || Number(item.dia_semana) < 1 || Number(item.dia_semana) > 5 || Number(item.aula_numero) < 1 || Number(item.aula_numero) > 9) problems.push({ bloqueante: true, mensagem: 'Existe uma formação de área inválida.' });
    });
    currentConfig.folgas.forEach((item) => {
      if (!professorIds.has(String(item.professor_id)) || Number(item.dia_semana) < 1 || Number(item.dia_semana) > 5) problems.push({ bloqueante: true, mensagem: 'Existe uma folga de professor inválida.' });
    });
    currentConfig.indisponibilidades.forEach((item) => {
      if (!professorIds.has(String(item.professor_id)) || Number(item.dia_semana) < 1 || Number(item.dia_semana) > 5 || Number(item.aula_numero) < 1 || Number(item.aula_numero) > 9) problems.push({ bloqueante: true, mensagem: 'Existe uma indisponibilidade inválida.' });
    });
    return problems;
  };

  const updateField = (field, value) => setCurrentConfig((prev) => ({ ...prev, [field]: value }));

  const openProfessorModal = (professor = null) => {
    setEditingProfessorId(professor?.id || null);
    setProfessorDraft({
      usuario_id: professor?.usuario_id || '',
      area_id: professor?.area_id || '',
      max_aulas_consecutivas_default: professor?.max_aulas_consecutivas_default || 2,
      pdt_turma_id: professor ? Object.entries(currentConfig.pdt || {}).find(([, professorId]) => String(professorId) === String(professor.id))?.[0] || '' : '',
    });
    setProfessorModalOpen(true);
  };

  const closeProfessorModal = () => {
    setProfessorModalOpen(false);
    setEditingProfessorId(null);
    setProfessorDraft({ usuario_id: '', area_id: '', max_aulas_consecutivas_default: 2, pdt_turma_id: '' });
  };

  const saveProfessorFromModal = () => {
    if (!professorDraft.usuario_id || !professorDraft.area_id) {
      notify.error('Selecione o professor e uma área válida.');
      return;
    }
    const usuario = byId(usuarios, professorDraft.usuario_id);
    if (!usuario) return notify.error('Professor selecionado não foi encontrado.');
    if (Number(usuario.role_id) !== PROFESSOR_ROLE_ID) return notify.error('Somente usuários com cargo de professor podem ser adicionados.');
    const existing = currentConfig.professores.find((professor) => String(professor.usuario_id) === String(professorDraft.usuario_id));
    const targetId = editingProfessorId || newId('prof');
    if (existing && String(existing.id) !== String(editingProfessorId)) {
      notify.error('Esse professor já está adicionado à configuração.');
      return;
    }
    setCurrentConfig((prev) => {
      const professorData = {
        id: targetId,
        usuario_id: String(usuario.id),
        nome: usuario.nome,
        area_id: String(professorDraft.area_id),
        max_aulas_consecutivas_default: Number(professorDraft.max_aulas_consecutivas_default || 2),
        observacao: '',
        origem: 'banco',
      };
      const professores = editingProfessorId
        ? prev.professores.map((item) => String(item.id) === String(editingProfessorId) ? { ...item, ...professorData } : item)
        : [...prev.professores, professorData];
      const nextPdt = Object.fromEntries(Object.entries(prev.pdt || {}).filter(([, professorId]) => String(professorId) !== String(targetId)));
      if (professorDraft.pdt_turma_id && usuario.pdt) nextPdt[String(professorDraft.pdt_turma_id)] = targetId;
      return { ...prev, professores, pdt: nextPdt };
    });
    closeProfessorModal();
  };

  const removeProfessor = (id) => {
    setCurrentConfig((prev) => ({
      ...prev,
      professores: prev.professores.filter((item) => String(item.id) !== String(id)),
      professorTurmas: prev.professorTurmas.filter((item) => String(item.professor_id) !== String(id)),
      pdt: Object.fromEntries(Object.entries(prev.pdt || {}).filter(([, professorId]) => String(professorId) !== String(id))),
      folgas: prev.folgas.filter((item) => String(item.professor_id) !== String(id)),
      indisponibilidades: prev.indisponibilidades.filter((item) => String(item.professor_id) !== String(id)),
    }));
  };

  const openDisciplinaModal = (discipline = null) => {
    setEditingDisciplinaId(discipline?.id || null);
    setDisciplinaForm({
      nome: discipline?.nome || '',
      area_id: discipline?.area_id || '',
    });
    setDisciplinaModalOpen(true);
  };

  const closeDisciplinaModal = () => {
    setDisciplinaModalOpen(false);
    setEditingDisciplinaId(null);
    setDisciplinaForm({ nome: '', area_id: '' });
  };

  const saveDisciplinaFromModal = () => {
    const nome = disciplinaForm.nome.trim();
    if (!nome || !byId(currentConfig.areas, disciplinaForm.area_id)) {
      return notify.error('Disciplina exige nome e área válida.');
    }

    const duplicate = currentConfig.disciplinas.find(
      (item) =>
        item.nome.toLowerCase() === nome.toLowerCase() &&
        String(item.id) !== String(editingDisciplinaId),
    );
    if (duplicate) return notify.error('Essa disciplina já existe na configuração.');

    setCurrentConfig((prev) => ({
      ...prev,
      disciplinas: editingDisciplinaId
        ? prev.disciplinas.map((item) =>
            String(item.id) === String(editingDisciplinaId)
              ? { ...item, nome, area_id: String(disciplinaForm.area_id) }
              : item,
          )
        : [...prev.disciplinas, { id: newId('disc'), nome, area_id: String(disciplinaForm.area_id) }],
    }));
    closeDisciplinaModal();
  };

  const removeDisciplina = (id) => setCurrentConfig((prev) => ({
    ...prev,
    disciplinas: prev.disciplinas.filter((item) => String(item.id) !== String(id)),
    professorTurmas: prev.professorTurmas.filter((item) => String(item.disciplina_id) !== String(id)),
  }));

  const newAssignmentItem = () => ({
    id: newId('assignment-item'),
    turma_ids: [],
    disciplina_id: '',
    aulas_semana: 2,
    max_aulas_consecutivas: 2,
  });

  const openLinkModal = (assignment = null) => {
    setEditingLinkProfessorId(assignment?.professor_id || null);
    const groupedItems = [];
    const groupedMap = new Map();
    (assignment?.items || []).forEach((item) => {
      const key = `${String(item.disciplina_id || '')}|${Number(item.aulas_semana || 2)}|${Number(item.max_aulas_consecutivas || 2)}`;
      if (!groupedMap.has(key)) {
        const grouped = { id: item.id || newId('assignment-item'), turma_ids: [], disciplina_id: String(item.disciplina_id || ''), aulas_semana: Number(item.aulas_semana || 2), max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2) };
        groupedMap.set(key, grouped);
        groupedItems.push(grouped);
      }
      const target = groupedMap.get(key);
      if (item.turma_id && !target.turma_ids.includes(String(item.turma_id))) target.turma_ids.push(String(item.turma_id));
    });
    setLinkDraft({ professor_id: assignment?.professor_id || '', items: groupedItems.length ? groupedItems : [newAssignmentItem()] });
    setVinculoModalOpen(true);
  };

  const closeLinkModal = () => {
    setVinculoModalOpen(false);
    setEditingLinkProfessorId(null);
    setLinkDraft({ professor_id: '', items: [newAssignmentItem()] });
  };

  const updateAssignmentItem = (itemId, field, value) => {
    setLinkDraft((prev) => ({ ...prev, items: prev.items.map((item) => String(item.id) === String(itemId) ? { ...item, [field]: value } : item) }));
  };

  const addAssignmentItem = () => {
    setLinkDraft((prev) => ({ ...prev, items: [...prev.items, newAssignmentItem()] }));
  };

  const removeAssignmentItem = (itemId) => {
    setLinkDraft((prev) => ({ ...prev, items: prev.items.length > 1 ? prev.items.filter((item) => String(item.id) !== String(itemId)) : prev.items }));
  };

  const saveLinkFromModal = () => {
    if (!linkDraft.professor_id || !byId(currentConfig.professores, linkDraft.professor_id)) {
      return notify.error('Selecione um professor válido.');
    }

    const seenTurmas = new Set();
    const items = linkDraft.items.map((item) => ({
      ...item,
      turma_ids: Array.from(new Set((Array.isArray(item.turma_ids) ? item.turma_ids : []).map(String))),
      disciplina_id: String(item.disciplina_id || ''),
      aulas_semana: Number(item.aulas_semana),
      max_aulas_consecutivas: Number(item.max_aulas_consecutivas),
    }));
    for (const item of items) {
      if (!item.turma_ids.length || !byId(currentConfig.disciplinas, item.disciplina_id) || !Number.isFinite(item.aulas_semana) || item.aulas_semana <= 0 || !Number.isFinite(item.max_aulas_consecutivas) || item.max_aulas_consecutivas <= 0) return notify.error('Cada grupo precisa de uma ou mais turmas, matéria, aulas por semana e máximo de consecutivas válidos.');
      for (const turmaId of item.turma_ids) {
        if (!currentConfig.turmas.map(String).includes(turmaId)) return notify.error('Existe uma turma selecionada que não pertence à configuração.');
        if (seenTurmas.has(turmaId)) return notify.error('A mesma turma não pode aparecer em dois grupos da mesma atribuição.');
        seenTurmas.add(turmaId);
      }
    }
    const professorId = String(linkDraft.professor_id);
    setCurrentConfig((prev) => ({
      ...prev,
      professorTurmas: [
        ...prev.professorTurmas.filter((item) => String(item.professor_id) !== professorId),
        ...items.flatMap((item) => item.turma_ids.map((turmaId) => ({ id: newId('link'), professor_id: professorId, turma_id: turmaId, disciplina_id: item.disciplina_id, aulas_semana: item.aulas_semana, max_aulas_consecutivas: item.max_aulas_consecutivas }))),
      ],
    }));
    closeLinkModal();
  };

  const removeAssignment = (professorId) => setCurrentConfig((prev) => ({
    ...prev,
    professorTurmas: prev.professorTurmas.filter((item) => String(item.professor_id) !== String(professorId)),
  }));

  const toggleFolga = (professorId, day) => setCurrentConfig((prev) => ({
    ...prev,
    folgas: prev.folgas.some((item) => String(item.professor_id) === String(professorId) && Number(item.dia_semana) === day)
      ? prev.folgas.filter((item) => !(String(item.professor_id) === String(professorId) && Number(item.dia_semana) === day))
      : [...prev.folgas, { id: newId('folga'), professor_id: professorId, dia_semana: day }],
  }));

  const toggleCell = (field, values, prefix) => setCurrentConfig((prev) => ({
    ...prev,
    [field]: prev[field].some((item) => values.every(([key, value]) => String(item[key]) === String(value)))
      ? prev[field].filter((item) => !values.every(([key, value]) => String(item[key]) === String(value)))
      : [...prev[field], { id: newId(prefix), ...Object.fromEntries(values) }],
  }));

  const toggleTurma = (turmaId) => setCurrentConfig((prev) => ({
    ...prev,
    turmas: prev.turmas.map(String).includes(String(turmaId))
      ? prev.turmas.filter((id) => String(id) !== String(turmaId))
      : [...prev.turmas, String(turmaId)],
  }));

  const toggleAllTurmas = () => setCurrentConfig((prev) => ({
    ...prev,
    turmas: allTurmasSelected
      ? prev.turmas.filter((id) => !schoolTurmas.some((turma) => String(turma.id) === String(id)))
      : Array.from(new Set([...prev.turmas, ...schoolTurmas.map((turma) => String(turma.id))])),
  }));

  const saveConfiguration = async (complete = false) => {
    const validation = validateConfig(complete);
    if (validation.length) {
      notify.error(validation[0].mensagem);
      return false;
    }
    setSaving(true);
    const configId = selectedConfigId || newId('cfg');
    const turmaRows = currentConfig.turmas.map((turmaId) => ({ id: currentConfig.configTurmaMap[String(turmaId)] || newId('ct'), configuracao_id: configId, escola_id: currentConfig.escola_id, turma_id: turmaId }));
    const turmaMap = Object.fromEntries(turmaRows.map((row) => [String(row.turma_id), String(row.id)]));
    const areaRows = currentConfig.areas.map((area) => ({ id: area.id || newId('area'), configuracao_id: configId, nome: area.nome, base: area.base }));
    const disciplineRows = currentConfig.disciplinas.map((discipline) => ({ id: discipline.id || newId('disc'), configuracao_id: configId, nome: discipline.nome.trim(), area_id: discipline.area_id }));
    const professorRows = currentConfig.professores.map((professor) => ({ id: professor.id || newId('prof'), configuracao_id: configId, usuario_id: professor.usuario_id || null, nome: professor.nome.trim(), origem: 'banco', area_id: professor.area_id, max_aulas_consecutivas_default: Number(professor.max_aulas_consecutivas_default || 2), observacao: professor.observacao || null }));
    const professorIds = new Set(professorRows.map((row) => String(row.id)));
    const linkRows = currentConfig.professorTurmas.map((item) => ({ id: item.id || newId('link'), configuracao_id: configId, professor_id: item.professor_id, disciplina_id: item.disciplina_id, config_turma_id: turmaMap[String(item.turma_id)], aulas_semanais: Number(item.aulas_semana), max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2) }));
    const pdtRows = Object.entries(currentConfig.pdt || {}).filter(([turmaId, professorId]) => turmaMap[String(turmaId)] && professorIds.has(String(professorId))).map(([turmaId, professorId]) => ({ id: newId('pdt'), configuracao_id: configId, config_turma_id: turmaMap[String(turmaId)], professor_id: professorId }));
    const payload = { id: configId, nome: currentConfig.nome.trim(), escola_id: currentConfig.escola_id, ano_letivo: Number(currentConfig.ano_letivo), semestre: Number(currentConfig.semestre), status: 'rascunho', created_by: user?.id || null, updated_at: new Date().toISOString() };
    try {
      const configResult = await supabase.from('horario_configuracoes').upsert(payload, { onConflict: 'id' });
      if (configResult.error) throw configResult.error;
      for (const table of ['horario_grade_gerada', 'horario_pdt', 'horario_professor_turma', 'horario_professor_folgas', 'horario_professor_indisponibilidades', 'horario_formacao_area', 'horario_professores', 'horario_disciplinas', 'horario_config_turmas', 'horario_areas']) {
        const result = await supabase.from(table).delete().eq('configuracao_id', configId);
        if (result.error) throw new Error(`Falha ao limpar ${table}: ${result.error.message}`);
      }
      const inserts = [
        [areaRows, 'horario_areas'],
        [turmaRows, 'horario_config_turmas'],
        [disciplineRows, 'horario_disciplinas'],
        [professorRows, 'horario_professores'],
        [linkRows, 'horario_professor_turma'],
        [pdtRows, 'horario_pdt'],
        [currentConfig.folgas.map((item) => ({ id: item.id || newId('folga'), configuracao_id: configId, professor_id: item.professor_id, dia_semana: Number(item.dia_semana) })), 'horario_professor_folgas'],
        [currentConfig.indisponibilidades.map((item) => ({ id: item.id || newId('ind'), configuracao_id: configId, professor_id: item.professor_id, dia_semana: Number(item.dia_semana), aula_numero: Number(item.aula_numero) })), 'horario_professor_indisponibilidades'],
        [currentConfig.formacaoArea.map((item) => ({ id: item.id || newId('formacao'), configuracao_id: configId, area_id: item.area_id, dia_semana: Number(item.dia_semana), aula_numero: Number(item.aula_numero) })), 'horario_formacao_area'],
      ];
      for (const [rows, table] of inserts) {
        if (!rows.length) continue;
        const result = await supabase.from(table).insert(rows);
        if (result.error) throw result.error;
      }
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

  const deleteConfiguration = async () => {
    if (!selectedConfigId) return;
    setDeletingConfig(true);
    try {
      const relatedTables = [
        'horario_grade_gerada',
        'horario_pdt',
        'horario_professor_turma',
        'horario_professor_folgas',
        'horario_professor_indisponibilidades',
        'horario_formacao_area',
        'horario_professores',
        'horario_disciplinas',
        'horario_config_turmas',
        'horario_areas',
      ];

      for (const table of relatedTables) {
        const result = await supabase.from(table).delete().eq('configuracao_id', selectedConfigId);
        if (result.error) throw new Error(`Falha ao excluir ${table}: ${result.error.message}`);
      }

      const configResult = await supabase
        .from('horario_configuracoes')
        .delete()
        .eq('id', selectedConfigId);
      if (configResult.error) throw configResult.error;

      const nextConfigs = configs.filter((config) => String(config.id) !== String(selectedConfigId));
      const nextConfigId = nextConfigs[0]?.id ? String(nextConfigs[0].id) : '';

      setConfigs(nextConfigs);
      setDeleteConfigModalOpen(false);
      setGeneratedSchedule(emptyGrade);
      setStatusMessage('');

      if (nextConfigId) {
        setSelectedConfigId(nextConfigId);
      } else {
        setSelectedConfigId('');
        setCurrentConfig(emptyConfig(user?.escola_id || schools[0]?.id || ''));
        setCurrentStep(1);
      }

      notify.success('Configuração excluída com sucesso.');
    } catch (error) {
      console.error(error);
      notify.error(`Não foi possível excluir a configuração: ${error.message || 'erro desconhecido'}.`);
    } finally {
      setDeletingConfig(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1 && !(await saveConfiguration(false))) return;
    if (currentStep === 2 && !currentConfig.turmas.length) return notify.error('Selecione ao menos uma turma.');
    if (currentStep === 3 && currentConfig.professores.some((professor) => !byId(currentConfig.areas, professor.area_id))) return notify.error('Todos os professores precisam de uma área válida.');
    if (currentStep === 3 && !currentConfig.disciplinas.length) return notify.error('Cadastre pelo menos uma disciplina antes de avançar.');
    if (currentStep === 4) {
      const invalid = validateConfig(false);
      if (invalid.length) return notify.error(invalid[0].mensagem);
    }
    if (currentStep === 6) {
      const invalid = validateConfig(true);
      if (invalid.length) return notify.error(invalid[0].mensagem);
    }
    setCurrentStep((step) => Math.min(7, step + 1));
  };

  const previousStep = () => setCurrentStep((step) => Math.max(1, step - 1));
  const newConfiguration = () => {
    setSelectedConfigId('');
    setCurrentStep(1);
    setCurrentConfig(emptyConfig(user?.escola_id || schools[0]?.id || ''));
    setGeneratedSchedule(emptyGrade);
    setStatusMessage('');
    closeProfessorModal();
    closeDisciplinaModal();
    closeLinkModal();
  };

  const generate = async () => {
    const validation = validateConfig(true);
    if (validation.length) {
      setCurrentStep(7);
      setStatusMessage('Corrija os problemas bloqueantes antes de gerar.');
      return;
    }
    const result = generateHorario({ configuracao: currentConfig, turmas: selectedTurmas(turmas, currentConfig.turmas), professores: currentConfig.professores, vinculos: currentConfig.professorTurmas, pdtMap: currentConfig.pdt, areas: currentConfig.areas, disciplinas: currentConfig.disciplinas, folgas: currentConfig.folgas, indisponibilidades: currentConfig.indisponibilidades, formacoesArea: currentConfig.formacaoArea, fcRules: FC_RULES[currentConfig.semestre] || FC_RULES[1] });
    const hasBlocking = normalize(result.validation).some((item) => item.bloqueante !== false) || normalize(result.unscheduled).length > 0;
    setGeneratedSchedule(result);
    setCurrentStep(7);
    if (hasBlocking) {
      setStatusMessage('A grade não foi persistida porque existem conflitos ou aulas não distribuídas.');
      return;
    }
    const saved = await saveGeneratedGrade(result);
    if (saved) setStatusMessage(`Grade gerada e salva com sucesso: ${result.schedule.length} aulas.`);
  };

  const saveGeneratedGrade = async (result) => {
    if (!selectedConfigId) {
      notify.error('Salve a configuração antes de gerar o horário.');
      return false;
    }
    try {
      const configTurmasResult = await supabase.from('horario_config_turmas').select('id, turma_id').eq('configuracao_id', selectedConfigId);
      if (configTurmasResult.error) throw configTurmasResult.error;
      const turmaParaConfigTurma = Object.fromEntries((configTurmasResult.data || []).map((row) => [String(row.turma_id), String(row.id)]));
      const deleteResult = await supabase.from('horario_grade_gerada').delete().eq('configuracao_id', selectedConfigId);
      if (deleteResult.error) throw deleteResult.error;
      const rows = normalize(result.schedule).map((aula) => {
        const configTurmaId = turmaParaConfigTurma[String(aula.turma_id)];
        if (!configTurmaId) throw new Error(`Turma ${aula.turma_nome || aula.turma_id} não possui config_turma_id.`);
        return { id: newId('grade'), configuracao_id: selectedConfigId, config_turma_id: configTurmaId, dia_semana: WEEK_DAYS.indexOf(aula.dia) + 1, aula_numero: Number(aula.slot), professor_id: aula.professor_id, disciplina_id: aula.tipo === 'FC' ? null : aula.disciplina_id || null, tipo: aula.tipo === 'FC' ? 'fc' : 'aula' };
      });
      if (rows.length) {
        const insertResult = await supabase.from('horario_grade_gerada').insert(rows);
        if (insertResult.error) throw insertResult.error;
      }
      notify.success('Grade salva no banco de dados.');
      return true;
    } catch (error) {
      console.error(error);
      notify.error(`Não foi possível salvar a grade: ${error.message || 'erro desconhecido'}.`);
      return false;
    }
  };

  const drawPdfHeader = (doc, { schoolName, semesterLabel }) => {
    const pageWidth = doc.internal.pageSize.getWidth();

    // Adiciona a logo importada (logoImg)
    // Parâmetros: (imagem, formato, x, y, largura, altura)
    doc.addImage(logoImg, 'PNG', 12, 4, 12, 12);

    // Nome da escola (deslocado para x = 28 para dar espaço à logo)
    doc.setFontSize(11);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(60);
    doc.text(schoolName, 28, 11);

    // Rótulo do semestre (alinhado à direita)
    doc.setFont(undefined, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(semesterLabel, pageWidth - 12, 11, { align: 'right' });
  };

  const drawPdfFooter = (doc) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setDrawColor(203, 213, 225);

  doc.setFontSize(10);
  doc.setTextColor(100);

  doc.text(`LogZélia · ${currentConfig.nome || 'Horário'}`, 12, pageHeight - 10);
};

  const renderTurmaTable = (doc, turmaId, startY, { compact = false, autoTable } = {}) => {
    const turma = byId(turmas, turmaId);
    const turmaNome = turma?.nome || 'Turma';
    const course = getCourseStyle(turmaNome);
    const aulas = generatedSchedule.grid[String(turmaId)] || [];
    const body = SCHEDULE_EXPORT_ROWS.map((row) => {
      if (row.type === 'break') return [{ content: row.label, colSpan: 6, styles: { halign: 'center', fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] } }];
      const cells = WEEK_DAYS.map((day) => cellLabelPdf(aulas.find((aula) => aula.dia === day && Number(aula.slot) === row.slot)));
      return [{ content: `${row.slot}°`, styles: { fontStyle: 'bold', halign: 'center' } }, ...cells];
    });
    doc.setFontSize(compact ? 11 : 15);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(25);
    doc.text(turmaNome.toUpperCase(), doc.internal.pageSize.getWidth() / 2, startY, { align: 'center' });
    doc.setFont(undefined, 'normal');
    if (!autoTable) throw new Error('Biblioteca PDF não carregada.');

    autoTable(doc, {
      startY: startY + 5,
      head: [['', ...WEEK_DAYS.map((day) => day.replace('-feira', '').toUpperCase())]],
      body,
      theme: 'grid',
      styles: { fontSize: compact ? 6.2 : 7.4, cellPadding: compact ? 1.25 : 1.8, lineColor: [203, 213, 225], lineWidth: 0.15, valign: 'middle', textColor: [20, 20, 20], fontStyle: 'bold' },
      headStyles: { fillColor: course.rgb, textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: compact ? 6.6 : 8 },
      columnStyles: { 0: { cellWidth: compact ? 8 : 10, fillColor: [248, 250, 252] } },
      margin: { left: 10, right: 10, bottom: PDF_FOOTER_HEIGHT + 2 },
    });
    return doc.lastAutoTable.finalY;
  };

  const renderSchedulesLegend = (doc, startY, course) => {
    doc.setFontSize(8);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(course.rgb[0], course.rgb[1], course.rgb[2]);
    doc.text('HORÁRIOS', 14, startY);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(55);
    const lineHeight = 4.2;
    SCHEDULE_LEGEND_LEFT.forEach((line, i) => doc.text(line, 14, startY + lineHeight * (i + 1)));
    SCHEDULE_LEGEND_RIGHT.forEach((line, i) => doc.text(line, 85, startY + lineHeight * (i + 1)));
  };

  const exportPdf = async ({ mode = 'separated', courseKey = '' } = {}) => {
    const { jsPDF, autoTable } = await pdfLibrariesPromise;
    if (!generatedSchedule.schedule.length) return notify.error('Não há grade para exportar.');
    let turmaIds = currentConfig.turmas;
    if (mode === 'course') {
      if (!courseKey) return notify.error('Selecione um curso para gerar o PDF.');
      turmaIds = turmaIds.filter((turmaId) => getCourseStyle(byId(turmas, turmaId)?.nome).key === courseKey);
      if (!turmaIds.length) return notify.error('Nenhuma turma desse curso foi encontrada.');
    }
    setExportingPdf(true);
    try {
      const schoolName = schools.find((item) => String(item.id) === String(currentConfig.escola_id))?.nome || 'Escola';
      const semesterLabel = `${currentConfig.ano_letivo} · ${currentConfig.semestre}º semestre`;
      const doc = new jsPDF('l', 'mm', 'a4');
      const pageHeight = doc.internal.pageSize.getHeight();
      if (mode === 'unified') {
        let cursorY = PDF_TOP_MARGIN;
        drawPdfHeader(doc, { schoolName, semesterLabel });
        turmaIds.forEach((turmaId, index) => {
          if (index > 0 && cursorY + 88 > pageHeight - PDF_FOOTER_HEIGHT) {
            doc.addPage();
            drawPdfHeader(doc, { schoolName, semesterLabel });
            cursorY = PDF_TOP_MARGIN;
          }
          cursorY = renderTurmaTable(doc, turmaId, cursorY, { compact: true, autoTable }) + 8;
        });
        renderSchedulesLegend(doc, Math.min(cursorY + 3, pageHeight - 38), DEFAULT_COURSE_STYLE);
      } else {
        turmaIds.forEach((turmaId, index) => {
          if (index > 0) doc.addPage();
          drawPdfHeader(doc, { schoolName, semesterLabel });
          const finalY = renderTurmaTable(doc, turmaId, PDF_TOP_MARGIN, { autoTable });
          renderSchedulesLegend(doc, finalY + 8, getCourseStyle(byId(turmas, turmaId)?.nome));
        });
      }
      for (let page = 1; page <= doc.getNumberOfPages(); page += 1) { doc.setPage(page); drawPdfFooter(doc); }
      await addPdfFooter(doc);
      doc.save(`${currentConfig.nome || 'gerado'}.pdf`);
    } catch (error) {
      console.error(error);
      notify.error(`Não foi possível gerar o PDF: ${error.message || 'erro desconhecido'}.`);
    } finally {
      setExportingPdf(false);
    }
  };

  const openPdfModal = () => {
    if (!generatedSchedule.schedule.length) return notify.error('Não há grade para exportar.');
    setPdfMode('separated');
    setPdfCourseKey(availablePdfCourses[0]?.key || '');
    setPdfModalOpen(true);
  };

  const confirmPdfExport = async () => {
    await exportPdf({ mode: pdfMode, courseKey: pdfCourseKey });
    setPdfModalOpen(false);
  };

  const exportExcel = async () => {
    const ExcelJS = await excelLibrariesPromise;
    if (!generatedSchedule.schedule.length) return notify.error('Não há grade para exportar.');
    try {
      const workbook = new ExcelJS.Workbook();
      const usedSheetNames = new Set();
      currentConfig.turmas.forEach((turmaId) => {
        const turmaNome = byId(turmas, turmaId)?.nome || 'Turma';
        const course = getCourseStyle(turmaNome);
        const aulas = generatedSchedule.grid[String(turmaId)] || [];
        let sheetName = turmaNome.replace(/[\/*?:[\]]/g, ' ').trim().slice(0, 31) || 'Turma';
        let suffix = 2;
        while (usedSheetNames.has(sheetName.toLowerCase())) { sheetName = `${turmaNome.slice(0, 28)} ${suffix}`; suffix += 1; }
        usedSheetNames.add(sheetName.toLowerCase());
        const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: false }] });
        sheet.columns = [{ width: 9 }, ...WEEK_DAYS.map(() => ({ width: 22 }))];
        const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${course.hex}` } };
        const thinBorder = { style: 'thin', color: { argb: 'FFCBD5E1' } };
        const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
        const titleRow = sheet.addRow([turmaNome.toUpperCase()]);
        sheet.mergeCells(titleRow.number, 1, titleRow.number, 6);
        titleRow.getCell(1).font = { bold: true, size: 16 };
        titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        titleRow.height = 24;
        const headerRow = sheet.addRow(['', ...WEEK_DAYS.map((day) => day.replace('-feira', '').toUpperCase())]);
        headerRow.eachCell((cell) => { cell.fill = headerFill; cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }; cell.alignment = { horizontal: 'center', vertical: 'middle' }; cell.border = borders; });
        SCHEDULE_EXPORT_ROWS.forEach((row) => {
          if (row.type === 'break') {
            const breakRow = sheet.addRow([row.label]);
            sheet.mergeCells(breakRow.number, 1, breakRow.number, 6);
            breakRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
            breakRow.getCell(1).font = { bold: true, color: { argb: 'FF334155' } };
            breakRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            breakRow.eachCell({ includeEmpty: true }, (cell) => { cell.border = borders; });
            return;
          }
          const cells = WEEK_DAYS.map((day) => cellLabel(aulas.find((aula) => aula.dia === day && Number(aula.slot) === row.slot)));
          const dataRow = sheet.addRow([`${row.slot}°`, ...cells]);
          dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => { cell.border = borders; cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left', wrapText: true }; if (colNumber === 1) cell.font = { bold: true }; });
        });
        sheet.addRow([]);
        const legendTitle = sheet.addRow(['HORÁRIOS']);
        legendTitle.getCell(1).font = { bold: true, color: { argb: `FF${course.hex}` } };
        const legendRows = Math.max(SCHEDULE_LEGEND_LEFT.length, SCHEDULE_LEGEND_RIGHT.length);
        for (let i = 0; i < legendRows; i += 1) {
          const legendRow = sheet.addRow(['', SCHEDULE_LEGEND_LEFT[i] || '', '', '', SCHEDULE_LEGEND_RIGHT[i] || '']);
          sheet.mergeCells(legendRow.number, 2, legendRow.number, 3);
          sheet.mergeCells(legendRow.number, 5, legendRow.number, 6);
        }
      });
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `HORÁRIO ${currentConfig.nome || 'gerado'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      notify.error(`Não foi possível exportar o Excel: ${error.message || 'erro desconhecido'}.`);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3">
        <FaSpinner className="animate-spin" /> Carregando módulo de horários...
      </div>
    );
  }

  const blockingProblems = validateConfig(true);
  const gradeProblems = normalize(generatedSchedule.validation).filter((item) => item.bloqueante !== false);
  const unscheduled = normalize(generatedSchedule.unscheduled);
  const schoolName = schools.find((school) => String(school.id) === String(currentConfig.escola_id))?.nome || 'Escola';

  return (
    <div className="space-y-6 text-slate-900 dark:text-white">
      <PageTitle title="Módulo de Horários Escolares" subtitle="Configuração, validação, geração automática e exportação." />

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Configurações" content={configs.length} />
        <Card title="Turmas" content={currentConfig.turmas.length} />
        <Card title="Professores" content={currentConfig.professores.length} />
        <Card title="Aulas geradas" content={generatedSchedule.schedule.length} />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {configs.map((config) => (
              <button key={String(config.id)} type="button" onClick={() => setSelectedConfigId(String(config.id))} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${String(selectedConfigId) === String(config.id) ? 'bg-green-700 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'}`}>
                {config.nome}
              </button>
            ))}
          </div>
          <Button type="button" variant="secondary" onClick={newConfiguration}><FaPlus className="mr-2" /> Nova configuração</Button>
        </div>

        <div className="mb-6 grid gap-2 md:grid-cols-7">
          {steps.map((step, index) => (
            <button key={step} type="button" onClick={() => setCurrentStep(index + 1)} className={`rounded-xl px-3 py-2 text-xs font-semibold transition ${currentStep === index + 1 ? 'bg-green-700 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
              {index + 1}. {step}
            </button>
          ))}
        </div>

        {currentStep === 1 && (
          <div className="grid gap-5 md:grid-cols-2">
            <FormInput label="Nome da configuração" value={currentConfig.nome} onChange={(event) => updateField('nome', event.target.value)} placeholder="Horário 2026.2" />
            <SelectField label="Escola" value={currentConfig.escola_id} onChange={(event) => updateField('escola_id', event.target.value)}>
              <option value="">Selecione a escola</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.nome}</option>)}
            </SelectField>
            <FormInput label="Ano letivo" type="number" value={currentConfig.ano_letivo} onChange={(event) => updateField('ano_letivo', Number(event.target.value))} />
            <SelectField label="Semestre" value={currentConfig.semestre} onChange={(event) => updateField('semestre', Number(event.target.value))}>
              <option value="1">1º semestre</option>
              <option value="2">2º semestre</option>
            </SelectField>
            <div className="flex flex-wrap gap-3 md:col-span-2">
              <Button type="button" onClick={() => saveConfiguration(false)} disabled={saving}>{saving ? 'Salvando...' : 'Salvar configuração'}</Button>
              {selectedConfigId && (
                <Button type="button" variant="destructive" onClick={() => setDeleteConfigModalOpen(true)} disabled={saving || deletingConfig}>
                  <FaTrash className="mr-2" /> Excluir configuração
                </Button>
              )}
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Turmas participantes</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Escolha individualmente ou adicione todas as turmas da escola.</p>
                </div>
                <button type="button" onClick={toggleAllTurmas} disabled={!schoolTurmas.length} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${allTurmasSelected ? 'bg-green-700 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100 dark:bg-slate-950 dark:text-slate-200 dark:ring-slate-700'}`}>
                  {allTurmasSelected ? <FaCheck /> : <FaPlus />}
                  {allTurmasSelected ? 'Desmarcar todas' : 'Selecionar todas'}
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {schoolTurmas.map((turma) => {
                const selected = currentConfig.turmas.map(String).includes(String(turma.id));
                return (
                  <button key={turma.id} type="button" onClick={() => toggleTurma(turma.id)} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${selected ? 'border-green-500 bg-green-50 shadow-sm dark:border-green-700 dark:bg-green-950/40' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:bg-slate-900'}`}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-green-600 bg-green-600 text-white' : 'border-slate-300 dark:border-slate-600'}`}>{selected && <FaCheck className="text-xs" />}</span>
                    <span className={`font-medium ${selected ? 'text-green-900 dark:text-green-200' : 'text-slate-800 dark:text-slate-200'}`}>{turma.nome}</span>
                  </button>
                );
              })}
            </div>

            {!schoolTurmas.length && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Nenhuma turma cadastrada para a escola selecionada.</div>}
            <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-950"><strong>{currentConfig.turmas.length}</strong> turma(s) selecionada(s) de <strong>{schoolTurmas.length}</strong>.</div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div><h3 className="font-semibold text-slate-900 dark:text-white">Professores e áreas</h3><p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">Adicione somente usuários com cargo de professor e defina a área de cada um.</p></div>
                <Button type="button" onClick={() => openProfessorModal()}><FaUserPlus className="mr-2" /> Adicionar professor</Button>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">{currentConfig.areas.map((area) => <span key={area.id} className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-950 dark:text-green-300">{area.nome}</span>)}</div>
            </div>

            <div className="space-y-3">
              {currentConfig.professores.map((professor) => {
                const usuario = byId(usuarios, professor.usuario_id);
                const pdtTurma = Object.entries(currentConfig.pdt || {}).find(([, professorId]) => String(professorId) === String(professor.id))?.[0];
                return <div key={professor.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 dark:text-white">{professor.nome}</p>{usuario?.pdt && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">PDT</span>}</div><div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400"><span>{byId(currentConfig.areas, professor.area_id)?.nome || 'Área pendente'}</span><span>Máx. {professor.max_aulas_consecutivas_default || 2} consecutivas</span>{pdtTurma && <span>PDT: {byId(turmas, pdtTurma)?.nome || 'Turma'}</span>}</div></div><div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => openProfessorModal(professor)}>Editar</Button><button type="button" onClick={() => removeProfessor(professor.id)} className="rounded-xl px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"><FaTrash /></button></div></div></div>;
              })}
              {!currentConfig.professores.length && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700"><p className="font-semibold text-slate-700 dark:text-slate-200">Nenhum professor adicionado</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Use o botão acima para adicionar professores com cargo de professor.</p></div>}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-900 dark:text-white">Disciplinas</h3><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Cadastre aqui as matérias que serão usadas nas atribuições da Etapa 4.</p></div><Button type="button" variant="secondary" onClick={() => openDisciplinaModal()}><FaPlus className="mr-2" /> Nova disciplina</Button></div></div>

            <div><div className="mb-3 flex items-center justify-between"><h3 className="font-semibold text-slate-900 dark:text-white">Disciplinas cadastradas</h3><span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{currentConfig.disciplinas.length} disciplina(s)</span></div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{currentConfig.disciplinas.map((discipline) => <div key={discipline.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900 dark:text-white">{discipline.nome}</p><span className="mt-2 inline-flex rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800 dark:bg-green-950 dark:text-green-300">{byId(currentConfig.areas, discipline.area_id)?.nome || 'Área inválida'}</span></div><div className="flex gap-1"><button type="button" onClick={() => openDisciplinaModal(discipline)} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white">Editar</button><button type="button" onClick={() => removeDisciplina(discipline.id)} className="rounded-lg px-2 py-1 text-xs font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950">Excluir</button></div></div></div>)}</div>{!currentConfig.disciplinas.length && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Nenhuma disciplina cadastrada.</div>}</div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="font-semibold text-slate-900 dark:text-white">Atribuições por professor</h3><p className="mt-1 max-w-3xl text-sm text-slate-500 dark:text-slate-400">Uma atribuição reúne várias turmas do mesmo professor. Em cada turma você escolhe a matéria e a quantidade de aulas separadamente.</p></div><Button type="button" onClick={() => openLinkModal()}><FaPlus className="mr-2" /> Nova atribuição</Button></div></div>

            <div className="space-y-4">{professorAssignmentGroups.map((assignment) => { const professor = byId(currentConfig.professores, assignment.professor_id); return <div key={assignment.professor_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-slate-900 dark:text-white">{professor?.nome || 'Professor'}</h3><span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-800 dark:bg-green-950 dark:text-green-300">{assignment.items.length} turma(s)</span></div><div className="mt-4 space-y-2">{assignment.items.map((item) => <div key={item.id} className="grid gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-center dark:border-slate-800 dark:bg-slate-900"><div><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Turma</span><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{byId(turmas, item.turma_id)?.nome || 'Turma'}</p></div><div><span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Matéria</span><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{byId(currentConfig.disciplinas, item.disciplina_id)?.nome || 'Disciplina'}</p></div><div className="rounded-lg bg-white px-3 py-2 text-center dark:bg-slate-950"><div className="text-sm font-bold text-slate-900 dark:text-white">{item.aulas_semana}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">aulas/sem.</div></div><div className="rounded-lg bg-white px-3 py-2 text-center dark:bg-slate-950"><div className="text-sm font-bold text-slate-900 dark:text-white">{item.max_aulas_consecutivas}</div><div className="text-[10px] uppercase tracking-wide text-slate-400">máx.</div></div></div>)}</div></div><div className="flex shrink-0 gap-2"><Button type="button" variant="secondary" onClick={() => openLinkModal(assignment)}>Editar</Button><button type="button" onClick={() => removeAssignment(assignment.professor_id)} className="rounded-xl p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"><FaTrash /></button></div></div></div>; })}</div>

            {!professorAssignmentGroups.length && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Nenhuma atribuição cadastrada. Crie uma para cada professor que tenha turmas e matérias vinculadas.</div>}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <div><h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Folgas</h3>{currentConfig.professores.map((professor) => <div key={professor.id} className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800"><span className="w-40 text-sm font-medium text-slate-700 dark:text-slate-300">{professor.nome}</span>{[1, 2, 3, 4, 5].map((day) => { const selected = currentConfig.folgas.some((item) => String(item.professor_id) === String(professor.id) && Number(item.dia_semana) === day); return <button key={day} type="button" onClick={() => toggleFolga(professor.id, day)} className={`rounded-full px-3 py-1 text-xs font-semibold transition ${selected ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'}`}>{WEEK_DAYS[day - 1].slice(0, 3)}</button>; })}</div>)}</div>
            <div><h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Indisponibilidades</h3>{currentConfig.professores.map((professor) => <div key={professor.id} className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"><p className="mb-3 font-semibold text-slate-900 dark:text-white">{professor.nome}</p><div className="grid gap-3 md:grid-cols-5">{[1, 2, 3, 4, 5].map((day) => <div key={day} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"><div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{WEEK_DAYS[day - 1].slice(0, 3)}</div><div className="flex flex-wrap gap-1.5">{Array.from({ length: 9 }, (_, i) => i + 1).map((slot) => { const selected = currentConfig.indisponibilidades.some((item) => String(item.professor_id) === String(professor.id) && Number(item.dia_semana) === day && Number(item.aula_numero) === slot); return <button key={slot} type="button" onClick={() => toggleCell('indisponibilidades', [['professor_id', professor.id], ['dia_semana', day], ['aula_numero', slot]], 'ind')} className={`h-8 w-8 rounded-lg text-[10px] font-bold transition ${selected ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200'}`}>{slot}</button>; })}</div></div>)}</div></div>)}</div>
            <div><h3 className="mb-3 font-semibold text-slate-900 dark:text-white">Formação por área</h3>{currentConfig.areas.map((area) => <div key={area.id} className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"><p className="mb-3 font-semibold text-slate-900 dark:text-white">{area.nome}</p><div className="grid gap-3 md:grid-cols-5">{[1, 2, 3, 4, 5].map((day) => <div key={day} className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900"><div className="mb-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{WEEK_DAYS[day - 1].slice(0, 3)}</div><div className="flex flex-wrap gap-1.5">{Array.from({ length: 9 }, (_, i) => i + 1).map((slot) => { const selected = currentConfig.formacaoArea.some((item) => String(item.area_id) === String(area.id) && Number(item.dia_semana) === day && Number(item.aula_numero) === slot); return <button key={slot} type="button" onClick={() => toggleCell('formacaoArea', [['area_id', area.id], ['dia_semana', day], ['aula_numero', slot]], 'formacao')} className={`h-8 w-8 rounded-lg text-[10px] font-bold transition ${selected ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200'}`}>{slot}</button>; })}</div></div>)}</div></div>)}</div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-4">
            {currentConfig.turmas.map((turmaId) => { const turma = byId(turmas, turmaId); return <div key={turmaId} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"><div className="mb-2 font-semibold text-slate-900 dark:text-white">{turma?.nome || 'Turma'}</div><CustomSelect label="Professor PDT" value={currentConfig.pdt?.[turmaId] || ''} onChange={(value) => setCurrentConfig((prev) => ({ ...prev, pdt: { ...prev.pdt, [turmaId]: value } }))} options={professorOptions} placeholder="Selecione o PDT" /></div>; })}
          </div>
        )}

        {currentStep === 7 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Configuração</span><p className="font-semibold text-slate-900 dark:text-white">{currentConfig.nome}</p><p className="text-sm text-slate-600 dark:text-slate-300">{schoolName}</p><p className="text-sm text-slate-600 dark:text-slate-300">{currentConfig.ano_letivo} · {currentConfig.semestre}º semestre</p></div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Turmas</span><p className="text-sm text-slate-700 dark:text-slate-300">{currentConfig.turmas.map((id) => byId(turmas, id)?.nome).filter(Boolean).join(', ') || 'Nenhuma'}</p></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Professores</span>{currentConfig.professores.map((professor) => <p key={professor.id} className="text-sm text-slate-700 dark:text-slate-300">{professor.nome} · {byId(currentConfig.areas, professor.area_id)?.nome || 'sem área'}</p>)}</div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Disciplinas</span>{currentConfig.disciplinas.map((discipline) => <p key={discipline.id} className="text-sm text-slate-700 dark:text-slate-300">{discipline.nome} · {byId(currentConfig.areas, discipline.area_id)?.nome || 'sem área'}</p>)}</div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Atribuições</span>{currentConfig.professorTurmas.map((link) => <p key={link.id} className="text-sm text-slate-700 dark:text-slate-300">{byId(currentConfig.professores, link.professor_id)?.nome || 'Professor'} · {byId(turmas, link.turma_id)?.nome || 'Turma'} · {byId(currentConfig.disciplinas, link.disciplina_id)?.nome || 'Disciplina'} · {link.aulas_semana} aulas/semana</p>)}</div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"><span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">Restrições</span><p className="text-sm text-slate-600 dark:text-slate-300">Folgas: {currentConfig.folgas.length} · Indisponibilidades: {currentConfig.indisponibilidades.length} · Formações: {currentConfig.formacaoArea.length}</p></div>
            {blockingProblems.length > 0 && <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"><h3 className="mb-2 font-semibold">Problemas encontrados</h3>{blockingProblems.map((problem, index) => <p key={index} className="text-sm">• {problem.mensagem}{problem.professor ? ` · ${problem.professor}` : ''}{problem.turma ? ` · ${problem.turma}` : ''}{problem.disciplina ? ` · ${problem.disciplina}` : ''}</p>)}</div>}
            <div className="flex flex-wrap gap-3"><Button type="button" onClick={generate} disabled={saving || blockingProblems.length > 0}><FaCalendarAlt className="mr-2" /> Gerar horário</Button><Button type="button" variant="secondary" onClick={() => saveConfiguration(true)} disabled={saving}>{saving ? 'Salvando...' : 'Salvar configuração'}</Button>{generatedSchedule.schedule.length > 0 && <><Button type="button" variant="secondary" onClick={openPdfModal}><FaFilePdf className="mr-2" /> PDF</Button><Button type="button" variant="secondary" onClick={exportExcel}><FaFileExcel className="mr-2" /> Excel</Button></>}</div>
            {statusMessage && <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">{statusMessage}</div>}
            {generatedSchedule.schedule.length > 0 && currentConfig.turmas.map((turmaId) => { const turma = byId(turmas, turmaId); const aulas = generatedSchedule.grid[String(turmaId)] || []; return <div key={turmaId} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900"><h3 className="font-bold text-slate-900 dark:text-white">{turma?.nome || 'Turma'}</h3></div><div className="overflow-x-auto"><table className="min-w-full border-collapse text-sm"><thead><tr><th className="border-b border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Aula / horário</th>{WEEK_DAYS.map((day) => <th key={day} className="border-b border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">{day}</th>)}</tr></thead><tbody>{SLOT_DEFINITIONS.map((slot) => <tr key={slot.slot}><td className="border-b border-slate-100 p-3 font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">{slot.label} · {slot.time}</td>{WEEK_DAYS.map((day) => { const aula = aulas.find((item) => item.dia === day && Number(item.slot) === slot.slot); return <td key={`${day}-${slot.slot}`} className="border-b border-slate-100 p-3 align-top dark:border-slate-800">{aula ? <div><div className="font-semibold text-slate-900 dark:text-white">{aula.disciplina}{aula.tipo === 'FC' && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">FC</span>}</div><div className="text-xs text-slate-500 dark:text-slate-400">{aula.professor_nome}</div></div> : <span className="text-slate-400">—</span>}</td>; })}</tr>)}</tbody></table></div></div>; })}
            {(gradeProblems.length > 0 || unscheduled.length > 0) && <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100"><h3 className="mb-2 font-semibold">Conflitos / aulas não distribuídas</h3>{gradeProblems.map((item, index) => <p key={`g-${index}`} className="text-sm">• {item.professor || ''} · {item.turma || ''} · {item.disciplina || ''} — {item.mensagem}</p>)}{unscheduled.map((item, index) => <p key={`u-${index}`} className="text-sm">• {item.professor || ''} · {item.turma || ''} · {item.disciplina || ''} — solicitadas: {item.solicitadas}, distribuídas: {item.distribuidas}, motivo: {item.motivo || item.mensagem}</p>)}</div>}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700"><Button type="button" variant="secondary" onClick={previousStep} disabled={currentStep === 1}>Voltar</Button><div className="text-xs text-slate-500">Etapa {currentStep} de {steps.length}</div><Button type="button" onClick={nextStep} disabled={currentStep === 7 || saving}>{currentStep === 7 ? 'Concluído' : 'Continuar'}</Button></div>
      </div>

      <Modal isOpen={deleteConfigModalOpen} onClose={() => setDeleteConfigModalOpen(false)} title="Excluir configuração">
        <div className="space-y-4">
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            Esta ação excluirá a configuração e todas as informações relacionadas, incluindo turmas, professores, disciplinas, atribuições, PDT, disponibilidades e a grade gerada.
          </div>
          <p className="text-sm text-slate-600 dark:text-slate-300">Tem certeza de que deseja excluir <strong>{currentConfig.nome || 'esta configuração'}</strong>? Essa ação não pode ser desfeita.</p>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setDeleteConfigModalOpen(false)} disabled={deletingConfig}>Cancelar</Button>
            <Button type="button" variant="destructive" onClick={deleteConfiguration} disabled={deletingConfig}>
              {deletingConfig ? 'Excluindo...' : 'Excluir definitivamente'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={pdfModalOpen} onClose={() => setPdfModalOpen(false)} title="Exportar PDF do Horário">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Modo de exportação</label>
            <div className="space-y-2">
              {PDF_EXPORT_MODES.map((mode) => (
                <label key={mode.value} className={`flex cursor-pointer flex-col rounded-xl border p-3 transition ${pdfMode === mode.value ? 'border-green-600 bg-green-50/50 dark:bg-green-950/20' : 'border-slate-200 dark:border-slate-800'}`}>
                  <div className="flex items-center gap-2">
                    <input type="radio" name="pdfMode" value={mode.value} checked={pdfMode === mode.value} onChange={(event) => setPdfMode(event.target.value)} />
                    <span className="font-semibold text-slate-900 dark:text-white">{mode.title}</span>
                  </div>
                  <span className="ml-6 text-xs text-slate-500 dark:text-slate-400">{mode.description}</span>
                </label>
              ))}
            </div>
          </div>
          {pdfMode === 'course' && <CustomSelect label="Curso" value={pdfCourseKey} onChange={(value) => setPdfCourseKey(value)} options={availablePdfCourses.map((course) => ({ value: course.key, label: course.label }))} placeholder="Selecione o curso" />}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={() => setPdfModalOpen(false)}>Cancelar</Button>
            <Button type="button" onClick={confirmPdfExport} disabled={exportingPdf}>{exportingPdf ? 'Gerando...' : 'Exportar PDF'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={professorModalOpen} onClose={closeProfessorModal} title={editingProfessorId ? 'Editar professor' : 'Adicionar professor'}>
        <div className="space-y-5">
          <CustomSelect label="Professor da base" value={professorDraft.usuario_id} onChange={(value) => setProfessorDraft((prev) => ({ ...prev, usuario_id: value, pdt_turma_id: '' }))} options={editingProfessorId && selectedModalProfessor?.usuario_id ? [{ value: String(selectedModalProfessor.usuario_id), label: `${selectedModalProfessor.nome}${selectedModalUser?.pdt ? ' · PDT' : ''}` }, ...professorUsers] : professorUsers} placeholder="Selecione o professor" showSearch emptyLabel="Nenhum professor disponível" disabled={Boolean(editingProfessorId)} />
          <CustomSelect label="Área" value={professorDraft.area_id} onChange={(value) => setProfessorDraft((prev) => ({ ...prev, area_id: value }))} options={areaOptions} placeholder="Selecione a área" />
          <FormInput label="Máximo de aulas consecutivas" type="number" min="1" value={professorDraft.max_aulas_consecutivas_default} onChange={(event) => setProfessorDraft((prev) => ({ ...prev, max_aulas_consecutivas_default: Number(event.target.value) || 1 }))} />

          {selectedModalUser?.pdt && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-200"><span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-900 dark:bg-amber-900 dark:text-amber-100">PDT</span> Professor marcado como PDT</div>
              <CustomSelect label="Turma correspondente ao PDT" value={professorDraft.pdt_turma_id} onChange={(value) => setProfessorDraft((prev) => ({ ...prev, pdt_turma_id: value }))} options={availablePdtTurmaOptions} placeholder="Selecione a turma" emptyLabel="Todas as turmas selecionadas já possuem PDT" />
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={closeProfessorModal}>Cancelar</Button>
            <Button type="button" onClick={saveProfessorFromModal}>{editingProfessorId ? 'Salvar alterações' : 'Adicionar professor'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={disciplinaModalOpen} onClose={closeDisciplinaModal} title={editingDisciplinaId ? 'Editar disciplina' : 'Nova disciplina'}>
        <div className="space-y-5">
          <FormInput label="Nome da disciplina" value={disciplinaForm.nome} onChange={(event) => setDisciplinaForm((prev) => ({ ...prev, nome: event.target.value }))} placeholder="Ex.: Matemática" />
          <CustomSelect label="Área" value={disciplinaForm.area_id} onChange={(value) => setDisciplinaForm((prev) => ({ ...prev, area_id: value }))} options={areaOptions} placeholder="Selecione a área" />
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <Button type="button" variant="secondary" onClick={closeDisciplinaModal}>Cancelar</Button>
            <Button type="button" onClick={saveDisciplinaFromModal}>{editingDisciplinaId ? 'Salvar alterações' : 'Adicionar disciplina'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={vinculoModalOpen} onClose={closeLinkModal} title={editingLinkProfessorId ? 'Editar atribuição' : 'Nova atribuição'}>
        <div className="space-y-5">
          <CustomSelect label="Professor" value={linkDraft.professor_id} onChange={(value) => setLinkDraft((prev) => ({ ...prev, professor_id: value }))} options={editingLinkProfessorId ? professorOptions : professorOptions.filter((option) => !professorAssignmentGroups.some((assignment) => String(assignment.professor_id) === String(option.value)))} placeholder="Selecione o professor" showSearch emptyLabel="Nenhum professor disponível" disabled={Boolean(editingLinkProfessorId)} />
          <div className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900 dark:text-white">Turmas, matéria e carga</h4><p className="text-xs text-slate-500 dark:text-slate-400">Selecione várias turmas no mesmo grupo quando a matéria e a carga semanal forem iguais.</p></div><Button type="button" variant="secondary" onClick={addAssignmentItem}><FaPlus className="mr-2" /> Adicionar grupo</Button></div>
            {linkDraft.items.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Grupo {index + 1}</span>{linkDraft.items.length > 1 && <button type="button" onClick={() => removeAssignmentItem(item.id)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"><FaTrash /></button>}</div><div className="grid gap-4 sm:grid-cols-2"><CustomSelect label="Turmas" value={item.turma_ids} multiple onChange={(value) => updateAssignmentItem(item.id, 'turma_ids', value)} options={turmaOptions.filter((option) => currentConfig.turmas.includes(String(option.value)))} placeholder="Selecione uma ou mais turmas" emptyLabel="Selecione turmas na Etapa 2" showSearch /><CustomSelect label="Matéria" value={item.disciplina_id} onChange={(value) => updateAssignmentItem(item.id, 'disciplina_id', value)} options={disciplinaOptions} placeholder="Selecione a matéria" emptyLabel="Cadastre disciplinas na Etapa 3" /><FormInput label="Aulas por semana" type="number" min="1" value={item.aulas_semana} onChange={(event) => updateAssignmentItem(item.id, 'aulas_semana', Number(event.target.value) || 0)} /><FormInput label="Máx. de aulas consecutivas" type="number" min="1" value={item.max_aulas_consecutivas} onChange={(event) => updateAssignmentItem(item.id, 'max_aulas_consecutivas', Number(event.target.value) || 0)} /></div></div>)}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><Button type="button" variant="secondary" onClick={closeLinkModal}>Cancelar</Button><Button type="button" onClick={saveLinkFromModal}>{editingLinkProfessorId ? 'Salvar atribuição' : 'Criar atribuição'}</Button></div>
        </div>
      </Modal>
    </div>
  );
};
