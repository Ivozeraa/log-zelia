import { useEffect, useMemo, useState } from 'react';
import {
  FaCalendarAlt,
  FaFileExcel,
  FaFilePdf,
  FaPlus,
  FaSpinner,
  FaTrash,
} from 'react-icons/fa';
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
} from '../services/horarioService';

const emptyGrade = {
  grid: {},
  schedule: [],
  validation: [],
  unscheduled: [],
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

const newId = (prefix) =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;

const normalize = (value) => (Array.isArray(value) ? value : []);

const byId = (items, id) =>
  normalize(items).find((item) => String(item.id) === String(id));

const selectedTurmas = (items, ids) =>
  normalize(items).filter((item) =>
    normalize(ids).map(String).includes(String(item.id)),
  );

const ruleFor = (turma, semestre) => {
  const match = String(turma?.nome || '').match(/(\d+)\s*º|\b(\d+)\b/);
  const serie = match ? `${match[1] || match[2]}º` : null;
  return FC_RULES[Number(semestre) || 1]?.[serie];
};

const makeAreas = (source = []) =>
  FIXED_AREAS.map((fixed) => {
    const existing = normalize(source).find(
      (area) =>
        String(area?.nome || '').trim().toLowerCase() ===
        fixed.nome.toLowerCase(),
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
  const [currentConfig, setCurrentConfig] = useState(() =>
    emptyConfig(user?.escola_id || ''),
  );
  const [manualProfessor, setManualProfessor] = useState({
    nome: '',
    area_id: '',
    max_aulas_consecutivas_default: 2,
    observacao: '',
  });
  const [disciplinaForm, setDisciplinaForm] = useState({
    nome: '',
    area_id: '',
  });
  const [generatedSchedule, setGeneratedSchedule] = useState(emptyGrade);
  const [statusMessage, setStatusMessage] = useState('');

  const areaOptions = useMemo(
    () =>
      currentConfig.areas.map((area) => ({
        value: String(area.id),
        label: `${area.nome}${area.base === 'tecnica' ? ' · Técnica' : ''}`,
      })),
    [currentConfig.areas],
  );

  const professorOptions = useMemo(
    () =>
      currentConfig.professores.map((professor) => ({
        value: String(professor.id),
        label: `${professor.nome}${
          byId(currentConfig.areas, professor.area_id)
            ? ` · ${byId(currentConfig.areas, professor.area_id).nome}`
            : ' · área pendente'
        }`,
      })),
    [currentConfig.professores, currentConfig.areas],
  );

  const turmaOptions = useMemo(
    () =>
      turmas.map((turma) => ({
        value: String(turma.id),
        label: turma.nome,
      })),
    [turmas],
  );

  const disciplinaOptions = useMemo(
    () =>
      currentConfig.disciplinas.map((discipline) => ({
        value: String(discipline.id),
        label: `${discipline.nome} · ${
          byId(currentConfig.areas, discipline.area_id)?.nome || 'Área inválida'
        }`,
      })),
    [currentConfig.disciplinas, currentConfig.areas],
  );

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      try {
        setLoading(true);

        const results = await Promise.all([
          supabase.from('escolas').select('*').order('nome', { ascending: true }),
          supabase.from('turmas').select('*').order('nome', { ascending: true }),
          supabase
            .from('horario_configuracoes')
            .select('*')
            .order('created_at', { ascending: false }),
          // usuarios nao possui area_id; area e especifica de horario_professores por configuracao.
          supabase
            .from('usuarios')
            .select('id, nome, escola_id, role_id, pdt')
            .order('nome', { ascending: true }),
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
          setCurrentConfig((prev) => ({
            ...prev,
            escola_id:
              user?.escola_id || results[0].data?.[0]?.id || '',
          }));
        }
      } catch (error) {
        console.error(error);
        if (active) {
          notify.error(
            `Não foi possível carregar os dados: ${error.message || 'erro desconhecido'}.`,
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadInitial();

    return () => {
      active = false;
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

      const results = await Promise.all([
        supabase
          .from('horario_configuracoes')
          .select('*')
          .eq('id', configId)
          .maybeSingle(),
        supabase
          .from('horario_config_turmas')
          .select('*')
          .eq('configuracao_id', configId),
        supabase
          .from('horario_areas')
          .select('*')
          .eq('configuracao_id', configId)
          .order('nome', { ascending: true }),
        supabase
          .from('horario_disciplinas')
          .select('*')
          .eq('configuracao_id', configId)
          .order('nome', { ascending: true }),
        supabase
          .from('horario_professores')
          .select('*')
          .eq('configuracao_id', configId)
          .order('nome', { ascending: true }),
        supabase
          .from('horario_professor_turma')
          .select('*')
          .eq('configuracao_id', configId),
        supabase
          .from('horario_pdt')
          .select('*')
          .eq('configuracao_id', configId),
        supabase
          .from('horario_professor_folgas')
          .select('*')
          .eq('configuracao_id', configId),
        supabase
          .from('horario_professor_indisponibilidades')
          .select('*')
          .eq('configuracao_id', configId),
        supabase
          .from('horario_formacao_area')
          .select('*')
          .eq('configuracao_id', configId),
        supabase
          .from('horario_grade_gerada')
          .select('*')
          .eq('configuracao_id', configId),
      ]);

      const error = results.find((result) => result.error)?.error;
      if (error) throw error;
      if (!results[0].data) throw new Error('Configuração não encontrada.');

      const configTurmaMap = Object.fromEntries(
        (results[1].data || []).map((row) => [
          String(row.turma_id),
          String(row.id),
        ]),
      );

      const loadedAreas = makeAreas(results[2].data || []);
      const loadedDisciplines = (results[3].data || []).map((row) => ({
        ...row,
        area_id: row.area_id ? String(row.area_id) : '',
      }));
      const loadedProfessors = (results[4].data || []).map((row) => ({
        id: String(row.id),
        usuario_id: row.usuario_id ? String(row.usuario_id) : null,
        nome: row.nome || 'Professor',
        area_id: row.area_id ? String(row.area_id) : '',
        max_aulas_consecutivas_default: Number(
          row.max_aulas_consecutivas_default || 2,
        ),
        observacao: row.observacao || '',
        origem: row.origem || (row.usuario_id ? 'banco' : 'manual'),
        manual: row.origem === 'manual',
      }));

      const pdt = {};
      (results[6].data || []).forEach((row) => {
        const turmaId = results[1].data?.find(
          (item) => String(item.id) === String(row.config_turma_id),
        )?.turma_id;

        if (turmaId) {
          pdt[String(turmaId)] = String(row.professor_id);
        }
      });

      const links = (results[5].data || []).map((row) => ({
        id: String(row.id),
        professor_id: String(row.professor_id),
        turma_id: String(
          results[1].data?.find(
            (item) => String(item.id) === String(row.config_turma_id),
          )?.turma_id || '',
        ),
        disciplina_id: row.disciplina_id ? String(row.disciplina_id) : '',
        aulas_semana: Number(row.aulas_semanais || 0),
        max_aulas_consecutivas: Number(row.max_aulas_consecutivas || 2),
      }));

      const config = {
        nome: results[0].data.nome || '',
        escola_id: results[0].data.escola_id || '',
        ano_letivo: Number(
          results[0].data.ano_letivo || new Date().getFullYear(),
        ),
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
      notify.error(
        `Não foi possível carregar a configuração: ${error.message || 'erro desconhecido'}.`,
      );
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

    [...rows]
      .sort(
        (a, b) =>
          Number(a.dia_semana) - Number(b.dia_semana) ||
          Number(a.aula_numero) - Number(b.aula_numero),
      )
      .forEach((row) => {
        const turmaId = Object.entries(config.configTurmaMap).find(
          ([, id]) => String(id) === String(row.config_turma_id),
        )?.[0];
        const professor = byId(config.professores, row.professor_id);
        const discipline = row.disciplina_id
          ? byId(config.disciplinas, row.disciplina_id)
          : null;
        const record = {
          turma_id: turmaId,
          turma_nome: byId(turmas, turmaId)?.nome || 'Turma',
          professor_id: row.professor_id,
          professor_nome: professor?.nome || 'Professor',
          disciplina_id: row.disciplina_id || null,
          disciplina:
            row.tipo === 'fc'
              ? 'Formação para a Cidadania'
              : discipline?.nome || 'Disciplina não encontrada',
          dia: WEEK_DAYS[Number(row.dia_semana) - 1] || '',
          slot: Number(row.aula_numero),
          tipo: row.tipo === 'fc' ? 'FC' : 'Regular',
        };

        if (!turmaId || !professor || (row.tipo !== 'fc' && !discipline)) {
          validation.push({
            bloqueante: true,
            mensagem: 'A grade persistida possui referência inválida.',
          });
        }

        (grid[String(turmaId)] ||= []).push(record);
        schedule.push(record);
      });

    setGeneratedSchedule({
      grid,
      schedule,
      validation,
      unscheduled: [],
    });
  };

  const validateConfig = (complete = false) => {
    const problems = [];
    const areaIds = new Set(
      currentConfig.areas.map((area) => String(area.id)),
    );
    const professorIds = new Set(
      currentConfig.professores.map((professor) => String(professor.id)),
    );
    const turmaIds = new Set(currentConfig.turmas.map(String));
    const disciplineIds = new Set(
      currentConfig.disciplinas.map((discipline) => String(discipline.id)),
    );

    if (!currentConfig.nome.trim()) {
      problems.push({ bloqueante: true, mensagem: 'Informe o nome da configuração.' });
    }
    if (!currentConfig.escola_id) {
      problems.push({ bloqueante: true, mensagem: 'Selecione a escola.' });
    }
    if (!Number(currentConfig.ano_letivo)) {
      problems.push({ bloqueante: true, mensagem: 'Informe o ano letivo.' });
    }
    if (![1, 2].includes(Number(currentConfig.semestre))) {
      problems.push({ bloqueante: true, mensagem: 'Selecione um semestre válido.' });
    }
    if (complete && !turmaIds.size) {
      problems.push({
        bloqueante: true,
        mensagem: 'Selecione pelo menos uma turma.',
      });
    }
    if (complete && !currentConfig.professores.length) {
      problems.push({
        bloqueante: true,
        mensagem: 'Adicione pelo menos um professor.',
      });
    }

    currentConfig.professores.forEach((professor) => {
      if (
        !professor.nome?.trim() ||
        !areaIds.has(String(professor.area_id))
      ) {
        problems.push({
          bloqueante: true,
          professor: professor.nome,
          mensagem:
            'Todo professor precisa de nome e área válida na configuração.',
        });
      }
    });

    currentConfig.disciplinas.forEach((discipline) => {
      if (
        !discipline.nome?.trim() ||
        !areaIds.has(String(discipline.area_id))
      ) {
        problems.push({
          bloqueante: true,
          disciplina: discipline.nome,
          mensagem: `Disciplina "${discipline.nome || 'sem nome'}" precisa de área válida.`,
        });
      }
    });

    currentConfig.professorTurmas.forEach((link) => {
      const professor = byId(currentConfig.professores, link.professor_id);
      const turma = byId(turmas, link.turma_id);
      const discipline = byId(currentConfig.disciplinas, link.disciplina_id);
      const aulas = Number(link.aulas_semana);
      const maxConsecutivas = Number(link.max_aulas_consecutivas);

      if (
        !professor ||
        !turma ||
        !discipline ||
        !disciplineIds.has(String(link.disciplina_id)) ||
        !areaIds.has(String(discipline.area_id)) ||
        !Number.isFinite(aulas) ||
        aulas <= 0 ||
        !Number.isFinite(maxConsecutivas) ||
        maxConsecutivas <= 0
      ) {
        problems.push({
          bloqueante: true,
          professor: professor?.nome,
          turma: turma?.nome,
          disciplina: discipline?.nome,
          mensagem: 'Existe um vínculo incompleto ou inválido.',
        });
      }
    });

    if (complete) {
      currentConfig.turmas.forEach((turmaId) => {
        const turma = byId(turmas, turmaId);
        const rule = ruleFor(turma, currentConfig.semestre);

        if (
          rule &&
          !professorIds.has(String(currentConfig.pdt?.[turmaId]))
        ) {
          problems.push({
            bloqueante: true,
            turma: turma?.nome,
            mensagem: 'A turma precisa de um PDT pertencente à configuração.',
          });
        }
      });
    }

    Object.entries(currentConfig.pdt || {}).forEach(
      ([turmaId, professorId]) => {
        if (
          turmaIds.has(String(turmaId)) &&
          !professorIds.has(String(professorId))
        ) {
          problems.push({
            bloqueante: true,
            turma: byId(turmas, turmaId)?.nome,
            mensagem: 'O PDT selecionado não pertence à configuração.',
          });
        }
      },
    );

    currentConfig.formacaoArea.forEach((item) => {
      if (
        !areaIds.has(String(item.area_id)) ||
        Number(item.dia_semana) < 1 ||
        Number(item.dia_semana) > 5 ||
        Number(item.aula_numero) < 1 ||
        Number(item.aula_numero) > 9
      ) {
        problems.push({
          bloqueante: true,
          mensagem: 'Existe uma formação de área inválida.',
        });
      }
    });

    currentConfig.folgas.forEach((item) => {
      if (
        !professorIds.has(String(item.professor_id)) ||
        Number(item.dia_semana) < 1 ||
        Number(item.dia_semana) > 5
      ) {
        problems.push({
          bloqueante: true,
          mensagem: 'Existe uma folga de professor inválida.',
        });
      }
    });

    currentConfig.indisponibilidades.forEach((item) => {
      if (
        !professorIds.has(String(item.professor_id)) ||
        Number(item.dia_semana) < 1 ||
        Number(item.dia_semana) > 5 ||
        Number(item.aula_numero) < 1 ||
        Number(item.aula_numero) > 9
      ) {
        problems.push({
          bloqueante: true,
          mensagem: 'Existe uma indisponibilidade inválida.',
        });
      }
    });

    return problems;
  };

  const updateField = (field, value) =>
    setCurrentConfig((prev) => ({ ...prev, [field]: value }));

  const addBaseProfessor = (usuarioId) => {
    const usuario = byId(usuarios, usuarioId);
    if (!usuario) return;

    setCurrentConfig((prev) =>
      prev.professores.some(
        (professor) =>
          String(professor.usuario_id) === String(usuario.id),
      )
        ? prev
        : {
            ...prev,
            professores: [
              ...prev.professores,
              {
                id: newId('prof'),
                usuario_id: String(usuario.id),
                nome: usuario.nome,
                area_id: '',
                max_aulas_consecutivas_default: 2,
                observacao: '',
                origem: 'banco',
                manual: false,
              },
            ],
          },
    );
  };

  const updateProfessor = (id, field, value) =>
    setCurrentConfig((prev) => ({
      ...prev,
      professores: prev.professores.map((item) =>
        String(item.id) === String(id)
          ? { ...item, [field]: value }
          : item,
      ),
    }));

  const removeProfessor = (id) =>
    setCurrentConfig((prev) => ({
      ...prev,
      professores: prev.professores.filter(
        (item) => String(item.id) !== String(id),
      ),
      professorTurmas: prev.professorTurmas.filter(
        (item) => String(item.professor_id) !== String(id),
      ),
      pdt: Object.fromEntries(
        Object.entries(prev.pdt).filter(
          ([, professorId]) => String(professorId) !== String(id),
        ),
      ),
      folgas: prev.folgas.filter(
        (item) => String(item.professor_id) !== String(id),
      ),
      indisponibilidades: prev.indisponibilidades.filter(
        (item) => String(item.professor_id) !== String(id),
      ),
    }));

  const addManualProfessor = () => {
    if (!manualProfessor.nome.trim() || !manualProfessor.area_id) {
      return notify.error('Professor manual exige nome e área.');
    }

    setCurrentConfig((prev) => ({
      ...prev,
      professores: [
        ...prev.professores,
        {
          id: newId('prof'),
          usuario_id: null,
          nome: manualProfessor.nome.trim(),
          area_id: String(manualProfessor.area_id),
          max_aulas_consecutivas_default: Number(
            manualProfessor.max_aulas_consecutivas_default || 2,
          ),
          observacao: manualProfessor.observacao.trim(),
          origem: 'manual',
          manual: true,
        },
      ],
    }));

    setManualProfessor({
      nome: '',
      area_id: '',
      max_aulas_consecutivas_default: 2,
      observacao: '',
    });
  };

  const addDisciplina = () => {
    const nome = disciplinaForm.nome.trim();

    if (!nome || !byId(currentConfig.areas, disciplinaForm.area_id)) {
      return notify.error('Disciplina exige nome e área válida.');
    }

    if (
      currentConfig.disciplinas.some(
        (item) => item.nome.toLowerCase() === nome.toLowerCase(),
      )
    ) {
      return notify.error('Essa disciplina já existe na configuração.');
    }

    setCurrentConfig((prev) => ({
      ...prev,
      disciplinas: [
        ...prev.disciplinas,
        {
          id: newId('disc'),
          nome,
          area_id: String(disciplinaForm.area_id),
        },
      ],
    }));

    setDisciplinaForm({ nome: '', area_id: '' });
  };

  const removeDisciplina = (id) =>
    setCurrentConfig((prev) => ({
      ...prev,
      disciplinas: prev.disciplinas.filter(
        (item) => String(item.id) !== String(id),
      ),
      professorTurmas: prev.professorTurmas.filter(
        (item) => String(item.disciplina_id) !== String(id),
      ),
    }));

  const addLink = () =>
    setCurrentConfig((prev) => ({
      ...prev,
      professorTurmas: [
        ...prev.professorTurmas,
        {
          id: newId('link'),
          professor_id: '',
          turma_id: '',
          disciplina_id: '',
          aulas_semana: 2,
          max_aulas_consecutivas: 2,
        },
      ],
    }));

  const updateLink = (id, field, value) =>
    setCurrentConfig((prev) => ({
      ...prev,
      professorTurmas: prev.professorTurmas.map((item) =>
        String(item.id) === String(id)
          ? { ...item, [field]: value }
          : item,
      ),
    }));

  const removeLink = (id) =>
    setCurrentConfig((prev) => ({
      ...prev,
      professorTurmas: prev.professorTurmas.filter(
        (item) => String(item.id) !== String(id),
      ),
    }));

  const toggleFolga = (professorId, day) =>
    setCurrentConfig((prev) => ({
      ...prev,
      folgas: prev.folgas.some(
        (item) =>
          String(item.professor_id) === String(professorId) &&
          Number(item.dia_semana) === day,
      )
        ? prev.folgas.filter(
            (item) =>
              !(
                String(item.professor_id) === String(professorId) &&
                Number(item.dia_semana) === day
              ),
          )
        : [
            ...prev.folgas,
            {
              id: newId('folga'),
              professor_id: professorId,
              dia_semana: day,
            },
          ],
    }));

  const toggleCell = (field, values, prefix) =>
    setCurrentConfig((prev) => ({
      ...prev,
      [field]: prev[field].some((item) =>
        values.every(([key, value]) => String(item[key]) === String(value)),
      )
        ? prev[field].filter(
            (item) =>
              !values.every(
                ([key, value]) => String(item[key]) === String(value),
              ),
          )
        : [
            ...prev[field],
            {
              id: newId(prefix),
              ...Object.fromEntries(values),
            },
          ],
    }));

  const saveConfiguration = async (complete = false) => {
    const validation = validateConfig(complete);
    if (validation.length) {
      notify.error(validation[0].mensagem);
      return false;
    }

    setSaving(true);

    const configId = selectedConfigId || newId('cfg');
    const turmaRows = currentConfig.turmas.map((turmaId) => ({
      id: currentConfig.configTurmaMap[String(turmaId)] || newId('ct'),
      configuracao_id: configId,
      escola_id: currentConfig.escola_id,
      turma_id: turmaId,
    }));
    const turmaMap = Object.fromEntries(
      turmaRows.map((row) => [String(row.turma_id), String(row.id)]),
    );
    const areaRows = currentConfig.areas.map((area) => ({
      id: area.id || newId('area'),
      configuracao_id: configId,
      nome: area.nome,
      base: area.base,
    }));
    const disciplineRows = currentConfig.disciplinas.map((discipline) => ({
      id: discipline.id || newId('disc'),
      configuracao_id: configId,
      nome: discipline.nome.trim(),
      area_id: discipline.area_id,
    }));
    const professorRows = currentConfig.professores.map((professor) => ({
      id: professor.id || newId('prof'),
      configuracao_id: configId,
      usuario_id: professor.usuario_id || null,
      nome: professor.nome.trim(),
      origem: professor.manual ? 'manual' : 'banco',
      area_id: professor.area_id,
      max_aulas_consecutivas_default: Number(
        professor.max_aulas_consecutivas_default || 2,
      ),
      observacao: professor.observacao || null,
    }));
    const professorIds = new Set(
      professorRows.map((row) => String(row.id)),
    );
    const linkRows = currentConfig.professorTurmas.map((item) => ({
      id: item.id || newId('link'),
      configuracao_id: configId,
      professor_id: item.professor_id,
      disciplina_id: item.disciplina_id,
      config_turma_id: turmaMap[String(item.turma_id)],
      aulas_semanais: Number(item.aulas_semana),
      max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2),
    }));
    const pdtRows = Object.entries(currentConfig.pdt || {})
      .filter(
        ([turmaId, professorId]) =>
          turmaMap[String(turmaId)] && professorIds.has(String(professorId)),
      )
      .map(([turmaId, professorId]) => ({
        id: newId('pdt'),
        configuracao_id: configId,
        config_turma_id: turmaMap[String(turmaId)],
        professor_id: professorId,
      }));
    const payload = {
      id: configId,
      nome: currentConfig.nome.trim(),
      escola_id: currentConfig.escola_id,
      ano_letivo: Number(currentConfig.ano_letivo),
      semestre: Number(currentConfig.semestre),
      status: 'rascunho',
      created_by: user?.id || null,
      updated_at: new Date().toISOString(),
    };

    try {
      const configResult = await supabase
        .from('horario_configuracoes')
        .upsert(payload, { onConflict: 'id' });
      if (configResult.error) throw configResult.error;

      for (const table of [
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
      ]) {
        const result = await supabase
          .from(table)
          .delete()
          .eq('configuracao_id', configId);

        if (result.error) {
          throw new Error(
            `Falha ao limpar ${table}: ${result.error.message}`,
          );
        }
      }

      const inserts = [
        [areaRows, 'horario_areas'],
        [turmaRows, 'horario_config_turmas'],
        [disciplineRows, 'horario_disciplinas'],
        [professorRows, 'horario_professores'],
        [linkRows, 'horario_professor_turma'],
        [pdtRows, 'horario_pdt'],
        [
          currentConfig.folgas.map((item) => ({
            id: item.id || newId('folga'),
            configuracao_id: configId,
            professor_id: item.professor_id,
            dia_semana: Number(item.dia_semana),
          })),
          'horario_professor_folgas',
        ],
        [
          currentConfig.indisponibilidades.map((item) => ({
            id: item.id || newId('ind'),
            configuracao_id: configId,
            professor_id: item.professor_id,
            dia_semana: Number(item.dia_semana),
            aula_numero: Number(item.aula_numero),
          })),
          'horario_professor_indisponibilidades',
        ],
        [
          currentConfig.formacaoArea.map((item) => ({
            id: item.id || newId('formacao'),
            configuracao_id: configId,
            area_id: item.area_id,
            dia_semana: Number(item.dia_semana),
            aula_numero: Number(item.aula_numero),
          })),
          'horario_formacao_area',
        ],
      ];

      for (const [rows, table] of inserts) {
        if (!rows.length) continue;
        const result = await supabase.from(table).insert(rows);
        if (result.error) throw result.error;
      }

      setCurrentConfig((prev) => ({
        ...prev,
        configTurmaMap: turmaMap,
        areas: areaRows,
        disciplinas: disciplineRows,
        professores: professorRows,
      }));
      setConfigs((prev) => [
        {
          ...payload,
          created_at:
            prev.find((item) => String(item.id) === String(configId))
              ?.created_at || new Date().toISOString(),
        },
        ...prev.filter((item) => String(item.id) !== String(configId)),
      ]);
      setSelectedConfigId(configId);
      notify.success('Configuração salva com sucesso.');
      return true;
    } catch (error) {
      console.error(error);
      notify.error(
        `Não foi possível salvar: ${error.message || 'erro desconhecido'}.`,
      );
      return false;
    } finally {
      setSaving(false);
    }
  };

  const nextStep = async () => {
    if (currentStep === 1 && !(await saveConfiguration(false))) return;

    if (currentStep === 2 && !currentConfig.turmas.length) {
      return notify.error('Selecione ao menos uma turma.');
    }

    if (
      currentStep === 3 &&
      currentConfig.professores.some(
        (professor) => !byId(currentConfig.areas, professor.area_id),
      )
    ) {
      return notify.error('Todos os professores precisam de uma área válida.');
    }

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

  const previousStep = () =>
    setCurrentStep((step) => Math.max(1, step - 1));

  const newConfiguration = () => {
    setSelectedConfigId('');
    setCurrentStep(1);
    setCurrentConfig(
      emptyConfig(user?.escola_id || schools[0]?.id || ''),
    );
    setGeneratedSchedule(emptyGrade);
    setStatusMessage('');
  };

  const generate = async () => {
    const validation = validateConfig(true);

    if (validation.length) {
      setCurrentStep(7);
      setStatusMessage('Corrija os problemas bloqueantes antes de gerar.');
      return;
    }

    const result = generateHorario({
      configuracao: currentConfig,
      turmas: selectedTurmas(turmas, currentConfig.turmas),
      professores: currentConfig.professores,
      vinculos: currentConfig.professorTurmas,
      pdtMap: currentConfig.pdt,
      areas: currentConfig.areas,
      disciplinas: currentConfig.disciplinas,
      folgas: currentConfig.folgas,
      indisponibilidades: currentConfig.indisponibilidades,
      formacoesArea: currentConfig.formacaoArea,
      fcRules: FC_RULES[currentConfig.semestre] || FC_RULES[1],
    });
    const hasBlocking =
      normalize(result.validation).some(
        (item) => item.bloqueante !== false,
      ) || normalize(result.unscheduled).length > 0;

    setGeneratedSchedule(result);
    setCurrentStep(7);

    if (hasBlocking) {
      setStatusMessage(
        'A grade não foi persistida porque existem conflitos ou aulas não distribuídas.',
      );
      return;
    }

    const saved = await saveGeneratedGrade(result);
    if (saved) {
      setStatusMessage(
        `Grade gerada e salva com sucesso: ${result.schedule.length} aulas.`,
      );
    }
  };

  const saveGeneratedGrade = async (result) => {
    if (!selectedConfigId) {
      notify.error('Salve a configuração antes de gerar o horário.');
      return false;
    }

    try {
      const configTurmasResult = await supabase
        .from('horario_config_turmas')
        .select('id, turma_id')
        .eq('configuracao_id', selectedConfigId);

      if (configTurmasResult.error) throw configTurmasResult.error;

      const turmaParaConfigTurma = Object.fromEntries(
        (configTurmasResult.data || []).map((row) => [
          String(row.turma_id),
          String(row.id),
        ]),
      );

      const deleteResult = await supabase
        .from('horario_grade_gerada')
        .delete()
        .eq('configuracao_id', selectedConfigId);

      if (deleteResult.error) throw deleteResult.error;

      const rows = normalize(result.schedule).map((aula) => {
        const configTurmaId =
          turmaParaConfigTurma[String(aula.turma_id)];

        if (!configTurmaId) {
          throw new Error(
            `Turma ${aula.turma_nome || aula.turma_id} não possui config_turma_id.`,
          );
        }

        return {
          id: newId('grade'),
          configuracao_id: selectedConfigId,
          config_turma_id: configTurmaId,
          dia_semana: WEEK_DAYS.indexOf(aula.dia) + 1,
          aula_numero: Number(aula.slot),
          professor_id: aula.professor_id,
          disciplina_id:
            aula.tipo === 'FC' ? null : aula.disciplina_id || null,
          tipo: aula.tipo === 'FC' ? 'fc' : 'aula',
        };
      });

      if (rows.length) {
        const insertResult = await supabase
          .from('horario_grade_gerada')
          .insert(rows);
        if (insertResult.error) throw insertResult.error;
      }

      notify.success('Grade salva no banco de dados.');
      return true;
    } catch (error) {
      console.error(error);
      notify.error(
        `Não foi possível salvar a grade: ${error.message || 'erro desconhecido'}.`,
      );
      return false;
    }
  };

  const exportPdf = () => {
    if (!generatedSchedule.schedule.length) {
      return notify.error('Não há grade para exportar.');
    }

    const doc = new jsPDF('l', 'mm', 'a4');
    const schoolName =
      schools.find(
        (school) => String(school.id) === String(currentConfig.escola_id),
      )?.nome || 'Escola';

    doc.setFontSize(14);
    doc.text(schoolName, 12, 12);
    doc.setFontSize(11);
    doc.text(
      `Configuração: ${currentConfig.nome} · ${currentConfig.ano_letivo} · ${currentConfig.semestre}º semestre`,
      12,
      19,
    );

    let y = 28;

    currentConfig.turmas.forEach((turmaId) => {
      const turma = byId(turmas, turmaId);
      doc.setFontSize(12);
      doc.text(`Turma: ${turma?.nome || 'Turma'}`, 12, y);
      y += 7;
      doc.setFontSize(8);

      generatedSchedule.schedule
        .filter((aula) => String(aula.turma_id) === String(turmaId))
        .sort(
          (a, b) =>
            WEEK_DAYS.indexOf(a.dia) - WEEK_DAYS.indexOf(b.dia) ||
            a.slot - b.slot,
        )
        .forEach((aula) => {
          if (y > 190) {
            doc.addPage();
            y = 14;
          }

          doc.text(
            `${aula.dia} · ${aula.slot}ª · ${aula.disciplina}${aula.tipo === 'FC' ? ' [FC]' : ''} · ${aula.professor_nome}`,
            12,
            y,
          );
          y += 5;
        });

      y += 4;
    });

    doc.save(`horario_${currentConfig.nome || 'gerado'}.pdf`);
  };

  const exportExcel = () => {
    if (!generatedSchedule.schedule.length) {
      return notify.error('Não há grade para exportar.');
    }

    const rows = generatedSchedule.schedule.map((aula) => ({
      Turma: aula.turma_nome,
      Dia: aula.dia,
      Aula: `${aula.slot}ª`,
      Horário:
        SLOT_DEFINITIONS.find(
          (slot) => slot.slot === Number(aula.slot),
        )?.time || '',
      Disciplina: aula.disciplina,
      Professor: aula.professor_nome,
      Tipo: aula.tipo === 'FC' ? 'FC' : 'Aula',
    }));

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, 'Horários');
    XLSX.writeFile(
      workbook,
      `horario_${currentConfig.nome || 'gerado'}.xlsx`,
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-3">
        <FaSpinner className="animate-spin" />
        Carregando módulo de horários...
      </div>
    );
  }

  const blockingProblems = validateConfig(true);
  const gradeProblems = normalize(generatedSchedule.validation).filter(
    (item) => item.bloqueante !== false,
  );
  const unscheduled = normalize(generatedSchedule.unscheduled);
  const schoolName =
    schools.find(
      (school) => String(school.id) === String(currentConfig.escola_id),
    )?.nome || 'Escola';

  return (
    <div className="space-y-6">
      <PageTitle
        title="Módulo de Horários Escolares"
        subtitle="Configuração, validação, geração automática e exportação."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <Card title="Configurações" content={configs.length} />
        <Card title="Turmas" content={currentConfig.turmas.length} />
        <Card
          title="Professores"
          content={currentConfig.professores.length}
        />
        <Card
          title="Aulas geradas"
          content={generatedSchedule.schedule.length}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-950">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {configs.map((config) => (
              <button
                key={String(config.id)}
                type="button"
                onClick={() => setSelectedConfigId(String(config.id))}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                  String(selectedConfigId) === String(config.id)
                    ? 'bg-green-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800'
                }`}
              >
                {config.nome}
              </button>
            ))}
          </div>

          <Button type="button" variant="secondary" onClick={newConfiguration}>
            <FaPlus className="mr-2" />
            Nova configuração
          </Button>
        </div>

        <div className="mb-6 grid gap-2 md:grid-cols-7">
          {steps.map((step, index) => (
            <button
              key={step}
              type="button"
              onClick={() => setCurrentStep(index + 1)}
              className={`rounded-lg px-2 py-2 text-xs font-semibold ${
                currentStep === index + 1
                  ? 'bg-green-700 text-white'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              {index + 1}. {step}
            </button>
          ))}
        </div>

        {currentStep === 1 && (
          <div className="grid gap-4 md:grid-cols-2">
            <FormInput
              label="Nome da configuração"
              value={currentConfig.nome}
              onChange={(event) =>
                updateField('nome', event.target.value)
              }
              placeholder="Horário 2026.2"
            />

            <label className="space-y-1 text-sm font-semibold text-slate-700 dark:text-slate-400">
              Escola
              <select
                className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={currentConfig.escola_id}
                onChange={(event) =>
                  updateField('escola_id', event.target.value)
                }
              >
                <option value="">Selecione</option>
                {schools.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.nome}
                  </option>
                ))}
              </select>
            </label>

            <FormInput
              label="Ano letivo"
              type="number"
              value={currentConfig.ano_letivo}
              onChange={(event) =>
                updateField('ano_letivo', Number(event.target.value))
              }
            />

            <label className="space-y-1 text-sm font-semibold text-slate-700 dark:text-slate-400">
              Semestre
              <select
                className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={currentConfig.semestre}
                onChange={(event) =>
                  updateField('semestre', Number(event.target.value))
                }
              >
                <option value="1">1º semestre</option>
                <option value="2">2º semestre</option>
              </select>
            </label>

            <div className="md:col-span-2">
              <Button
                type="button"
                onClick={() => saveConfiguration(false)}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar configuração'}
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <label className="block space-y-2 text-sm font-semibold text-slate-700 dark:text-slate-400">
              Turmas participantes
              <select
                multiple
                className="min-h-48 w-full rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={currentConfig.turmas}
                onChange={(event) =>
                  updateField(
                    'turmas',
                    Array.from(
                      event.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
              >
                {turmaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
              <strong>{currentConfig.turmas.length}</strong> turma(s) selecionada(s).
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <h3 className="mb-3 font-semibold text-slate-800 dark:text-slate-100">
                Áreas da configuração
              </h3>
              <div className="flex flex-wrap gap-2">
                {currentConfig.areas.map((area) => (
                  <span
                    key={area.id}
                    className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-950 dark:text-green-300"
                  >
                    {area.nome}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <select
                className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value=""
                onChange={(event) =>
                  addBaseProfessor(event.target.value)
                }
              >
                <option value="">Adicionar professor da base...</option>
                {usuarios.map((usuario) => (
                  <option key={usuario.id} value={usuario.id}>
                    {usuario.nome}
                    {usuario.pdt ? ' · PDT' : ''}
                  </option>
                ))}
              </select>

              <div className="grid gap-3 md:grid-cols-4">
                <FormInput
                  label="Professor manual"
                  value={manualProfessor.nome}
                  onChange={(event) =>
                    setManualProfessor((prev) => ({
                      ...prev,
                      nome: event.target.value,
                    }))
                  }
                />
                <select
                  className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  value={manualProfessor.area_id}
                  onChange={(event) =>
                    setManualProfessor((prev) => ({
                      ...prev,
                      area_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Área manual</option>
                  {areaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <FormInput
                  label="Máx. consecutivas"
                  type="number"
                  value={manualProfessor.max_aulas_consecutivas_default}
                  onChange={(event) =>
                    setManualProfessor((prev) => ({
                      ...prev,
                      max_aulas_consecutivas_default:
                        Number(event.target.value) || 2,
                    }))
                  }
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addManualProfessor}
                >
                  Adicionar
                </Button>
              </div>
            </div>

            <div className="space-y-3">
              {currentConfig.professores.map((professor) => (
                <div
                  key={professor.id}
                  className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1.4fr_1fr_1fr_auto] dark:border-slate-700 dark:bg-slate-950"
                >
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {professor.nome}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {professor.manual ? 'Manual' : 'Base'}
                    </p>
                  </div>

                  <select
                    className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    value={professor.area_id || ''}
                    onChange={(event) =>
                      updateProfessor(
                        professor.id,
                        'area_id',
                        event.target.value,
                      )
                    }
                  >
                    <option value="">Área...</option>
                    {areaOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <FormInput
                    label="Máx. consecutivas"
                    type="number"
                    value={professor.max_aulas_consecutivas_default || 2}
                    onChange={(event) =>
                      updateProfessor(
                        professor.id,
                        'max_aulas_consecutivas_default',
                        Number(event.target.value) || 2,
                      )
                    }
                  />

                  <button
                    type="button"
                    className="self-end rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => removeProfessor(professor.id)}
                  >
                    <FaTrash />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
              <FormInput
                label="Nome da disciplina"
                value={disciplinaForm.nome}
                onChange={(event) =>
                  setDisciplinaForm((prev) => ({
                    ...prev,
                    nome: event.target.value,
                  }))
                }
              />

              <select
                className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                value={disciplinaForm.area_id}
                onChange={(event) =>
                  setDisciplinaForm((prev) => ({
                    ...prev,
                    area_id: event.target.value,
                  }))
                }
              >
                <option value="">Área</option>
                {areaOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <Button
                type="button"
                variant="secondary"
                onClick={addDisciplina}
              >
                Adicionar
              </Button>
            </div>

            <div className="flex flex-wrap gap-2">
              {currentConfig.disciplinas.map((discipline) => (
                <span
                  key={discipline.id}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  {discipline.nome} ·{' '}
                  {byId(currentConfig.areas, discipline.area_id)?.nome ||
                    'Área inválida'}
                  <button
                    type="button"
                    className="font-bold text-slate-400 hover:text-red-600"
                    onClick={() => removeDisciplina(discipline.id)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 dark:text-white">
                Atribuições
              </h3>
              <Button type="button" variant="secondary" onClick={addLink}>
                Adicionar vínculo
              </Button>
            </div>

            {currentConfig.professorTurmas.map((link) => (
              <div
                key={link.id}
                className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-6 dark:border-slate-700 dark:bg-slate-950"
              >
                <select
                  className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={link.professor_id}
                  onChange={(event) =>
                    updateLink(
                      link.id,
                      'professor_id',
                      event.target.value,
                    )
                  }
                >
                  <option value="">Professor</option>
                  {professorOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={link.turma_id}
                  onChange={(event) =>
                    updateLink(link.id, 'turma_id', event.target.value)
                  }
                >
                  <option value="">Turma</option>
                  {turmaOptions
                    .filter((option) =>
                      currentConfig.turmas.includes(String(option.value)),
                    )
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>

                <select
                  className="h-12 rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                  value={link.disciplina_id}
                  onChange={(event) =>
                    updateLink(
                      link.id,
                      'disciplina_id',
                      event.target.value,
                    )
                  }
                >
                  <option value="">Disciplina</option>
                  {disciplinaOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <FormInput
                  label="Aulas/semana"
                  type="number"
                  value={link.aulas_semana}
                  onChange={(event) =>
                    updateLink(
                      link.id,
                      'aulas_semana',
                      Number(event.target.value) || 0,
                    )
                  }
                />

                <FormInput
                  label="Máx. consecutivas"
                  type="number"
                  value={link.max_aulas_consecutivas}
                  onChange={(event) =>
                    updateLink(
                      link.id,
                      'max_aulas_consecutivas',
                      Number(event.target.value) || 0,
                    )
                  }
                />

                <button
                  type="button"
                  className="self-end rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => removeLink(link.id)}
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-6">
            <div>
              <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">
                Folgas
              </h3>
              {currentConfig.professores.map((professor) => (
                <div
                  key={professor.id}
                  className="mb-2 flex flex-wrap items-center gap-2 border-b border-slate-100 py-2 last:border-0 dark:border-slate-800"
                >
                  <span className="w-40 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {professor.nome}
                  </span>
                  {[1, 2, 3, 4, 5].map((day) => {
                    const selected = currentConfig.folgas.some(
                      (item) =>
                        String(item.professor_id) === String(professor.id) &&
                        Number(item.dia_semana) === day,
                    );
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleFolga(professor.id, day)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          selected
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {WEEK_DAYS[day - 1].slice(0, 3)}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">
                Indisponibilidades
              </h3>
              {currentConfig.professores.map((professor) => (
                <div
                  key={professor.id}
                  className="mb-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <p className="mb-2 font-semibold text-slate-900 dark:text-white">
                    {professor.nome}
                  </p>
                  <div className="grid gap-2 md:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((day) => (
                      <div
                        key={day}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {WEEK_DAYS[day - 1].slice(0, 3)}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Array.from({ length: 9 }, (_, i) => i + 1).map(
                            (slot) => {
                              const selected = currentConfig.indisponibilidades.some(
                                (item) =>
                                  String(item.professor_id) ===
                                    String(professor.id) &&
                                  Number(item.dia_semana) === day &&
                                  Number(item.aula_numero) === slot,
                              );
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() =>
                                    toggleCell(
                                      'indisponibilidades',
                                      [
                                        ['professor_id', professor.id],
                                        ['dia_semana', day],
                                        ['aula_numero', slot],
                                      ],
                                      'ind',
                                    )
                                  }
                                  className={`h-8 w-8 rounded-lg text-[10px] font-bold transition ${
                                    selected
                                      ? 'bg-orange-500 text-white'
                                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {slot}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="mb-3 font-semibold text-slate-900 dark:text-white">
                Formação por área
              </h3>
              {currentConfig.areas.map((area) => (
                <div
                  key={area.id}
                  className="mb-4 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
                >
                  <p className="mb-2 font-semibold text-slate-900 dark:text-white">
                    {area.nome}
                  </p>
                  <div className="grid gap-2 md:grid-cols-5">
                    {[1, 2, 3, 4, 5].map((day) => (
                      <div
                        key={day}
                        className="rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-900"
                      >
                        <div className="mb-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          {WEEK_DAYS[day - 1].slice(0, 3)}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {Array.from({ length: 9 }, (_, i) => i + 1).map(
                            (slot) => {
                              const selected = currentConfig.formacaoArea.some(
                                (item) =>
                                  String(item.area_id) === String(area.id) &&
                                  Number(item.dia_semana) === day &&
                                  Number(item.aula_numero) === slot,
                              );
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() =>
                                    toggleCell(
                                      'formacaoArea',
                                      [
                                        ['area_id', area.id],
                                        ['dia_semana', day],
                                        ['aula_numero', slot],
                                      ],
                                      'formacao',
                                    )
                                  }
                                  className={`h-8 w-8 rounded-lg text-[10px] font-bold transition ${
                                    selected
                                      ? 'bg-amber-500 text-white'
                                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200'
                                  }`}
                                >
                                  {slot}
                                </button>
                              );
                            },
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-4">
            {currentConfig.turmas.map((turmaId) => {
              const turma = byId(turmas, turmaId);

              return (
                <div
                  key={turmaId}
                  className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"
                >
                  <div className="mb-2 font-semibold text-slate-900 dark:text-white">
                    {turma?.nome || 'Turma'}
                  </div>
                  <select
                    className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                    value={currentConfig.pdt?.[turmaId] || ''}
                    onChange={(event) =>
                      setCurrentConfig((prev) => ({
                        ...prev,
                        pdt: {
                          ...prev.pdt,
                          [turmaId]: event.target.value,
                        },
                      }))
                    }
                  >
                    <option value="">Selecione o PDT</option>
                    {professorOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        )}

        {currentStep === 7 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Configuração
                </span>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {currentConfig.nome}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {schoolName}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {currentConfig.ano_letivo} · {currentConfig.semestre}º semestre
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Turmas
                </span>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {currentConfig.turmas
                    .map((id) => byId(turmas, id)?.nome)
                    .filter(Boolean)
                    .join(', ') || 'Nenhuma'}
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Professores
                </span>
                {currentConfig.professores.map((professor) => (
                  <p
                    key={professor.id}
                    className="text-sm text-slate-700 dark:text-slate-300"
                  >
                    {professor.nome} ·{' '}
                    {byId(currentConfig.areas, professor.area_id)?.nome ||
                      'sem área'}
                  </p>
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
                <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                  Disciplinas
                </span>
                {currentConfig.disciplinas.map((discipline) => (
                  <p
                    key={discipline.id}
                    className="text-sm text-slate-700 dark:text-slate-300"
                  >
                    {discipline.nome} ·{' '}
                    {byId(currentConfig.areas, discipline.area_id)?.nome ||
                      'sem área'}
                  </p>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Atribuições
              </span>
              {currentConfig.professorTurmas.map((link) => (
                <p
                  key={link.id}
                  className="text-sm text-slate-700 dark:text-slate-300"
                >
                  {byId(currentConfig.professores, link.professor_id)?.nome ||
                    'Professor'}{' '}
                  · {byId(turmas, link.turma_id)?.nome || 'Turma'} ·{' '}
                  {byId(currentConfig.disciplinas, link.disciplina_id)?.nome ||
                    'Disciplina'}{' '}
                  · {link.aulas_semana} aulas/semana
                </p>
              ))}
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
              <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-500">
                Restrições
              </span>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Folgas: {currentConfig.folgas.length} · Indisponibilidades:{' '}
                {currentConfig.indisponibilidades.length} · Formações:{' '}
                {currentConfig.formacaoArea.length}
              </p>
            </div>

            {blockingProblems.length > 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <h3 className="mb-2 font-semibold">Problemas encontrados</h3>
                {blockingProblems.map((problem, index) => (
                  <p key={index} className="text-sm">
                    • {problem.mensagem}
                    {problem.professor ? ` · ${problem.professor}` : ''}
                    {problem.turma ? ` · ${problem.turma}` : ''}
                    {problem.disciplina ? ` · ${problem.disciplina}` : ''}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                onClick={generate}
                disabled={saving || blockingProblems.length > 0}
              >
                <FaCalendarAlt className="mr-2" />
                Gerar horário
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={() => saveConfiguration(true)}
                disabled={saving}
              >
                {saving ? 'Salvando...' : 'Salvar configuração'}
              </Button>

              {generatedSchedule.schedule.length > 0 && (
                <>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportPdf}
                  >
                    <FaFilePdf className="mr-2" />
                    PDF
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={exportExcel}
                  >
                    <FaFileExcel className="mr-2" />
                    Excel
                  </Button>
                </>
              )}
            </div>

            {statusMessage && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                {statusMessage}
              </div>
            )}

            {generatedSchedule.schedule.length > 0 &&
              currentConfig.turmas.map((turmaId) => {
                const turma = byId(turmas, turmaId);
                const aulas = generatedSchedule.grid[String(turmaId)] || [];

                return (
                  <div
                    key={turmaId}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <h3 className="font-bold text-slate-900 dark:text-white">
                        {turma?.nome || 'Turma'}
                      </h3>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <thead>
                          <tr>
                            <th className="border-b border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                              Aula / horário
                            </th>
                            {WEEK_DAYS.map((day) => (
                              <th
                                key={day}
                                className="border-b border-slate-200 bg-slate-50 p-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
                              >
                                {day}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {SLOT_DEFINITIONS.map((slot) => (
                            <tr key={slot.slot}>
                              <td className="border-b border-slate-100 p-3 font-semibold text-slate-700 dark:border-slate-800 dark:text-slate-300">
                                {slot.label} · {slot.time}
                              </td>
                              {WEEK_DAYS.map((day) => {
                                const aula = aulas.find(
                                  (item) =>
                                    item.dia === day &&
                                    Number(item.slot) === slot.slot,
                                );

                                return (
                                  <td
                                    key={`${day}-${slot.slot}`}
                                    className="border-b border-slate-100 p-3 align-top dark:border-slate-800"
                                  >
                                    {aula ? (
                                      <div>
                                        <div className="font-semibold text-slate-900 dark:text-white">
                                          {aula.disciplina}
                                          {aula.tipo === 'FC' && (
                                            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                              FC
                                            </span>
                                          )}
                                        </div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400">
                                          {aula.professor_nome}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="text-slate-400">—</span>
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

            {(gradeProblems.length > 0 || unscheduled.length > 0) && (
              <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-100">
                <h3 className="mb-2 font-semibold">
                  Conflitos / aulas não distribuídas
                </h3>
                {gradeProblems.map((item, index) => (
                  <p key={`g-${index}`} className="text-sm">
                    • {item.professor || ''} · {item.turma || ''} ·{' '}
                    {item.disciplina || ''} — {item.mensagem}
                  </p>
                ))}
                {unscheduled.map((item, index) => (
                  <p key={`u-${index}`} className="text-sm">
                    • {item.professor || ''} · {item.turma || ''} ·{' '}
                    {item.disciplina || ''} — solicitadas: {item.solicitadas},
                    distribuídas: {item.distribuidas}, motivo:{' '}
                    {item.motivo || item.mensagem}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 dark:border-slate-700">
          <Button
            type="button"
            variant="secondary"
            onClick={previousStep}
            disabled={currentStep === 1}
          >
            Voltar
          </Button>
          <div className="text-xs text-slate-500">
            Etapa {currentStep} de {steps.length}
          </div>
          <Button
            type="button"
            onClick={nextStep}
            disabled={currentStep === 7 || saving}
          >
            {currentStep === 7 ? 'Concluído' : 'Continuar'}
          </Button>
        </div>
      </div>
    </div>
  );
};
