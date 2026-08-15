from pathlib import Path

p = Path('src/pages/Horarios.jsx')
s = p.read_text(encoding='utf-8')

# Step 3: professors + areas only.
s = s.replace("  'Professores, Áreas e Disciplinas',", "  'Professores e Áreas',", 1)
s = s.replace("  if (currentStep === 3 && !currentConfig.disciplinas.length) return notify.error('Cadastre pelo menos uma disciplina antes de avançar.');\n", "", 1)

# Remove the curriculum/disciplines section from Step 3.
step3_start = s.find("        {currentStep === 3 && (")
step4_start = s.find("        {currentStep === 4 && (", step3_start)
if step3_start == -1 or step4_start == -1:
    raise SystemExit('Step markers not found')
step3 = s[step3_start:step4_start]
marker = '            <div className="mb-4 rounded-2xl border border-green-200'
marker_pos = step3.find(marker)
if marker_pos != -1:
    # Keep only the professor UI and close the step.
    step3 = step3[:marker_pos] + '          </div>\n        )}\n\n'
    s = s[:step3_start] + step3 + s[step4_start:]

# Replace assignment state.
old_state = """  const [linkDraft, setLinkDraft] = useState({
    professor_id: '',
    items: [{ id: newId('assignment-item'), turma_id: '', disciplina_id: '', aulas_semana: 2, max_aulas_consecutivas: 2 }],
  });"""
new_state = """  const [linkDraft, setLinkDraft] = useState({
    professor_id: '',
    items: [{ id: newId('assignment-item'), course_series: '', turma_ids: [], disciplina_catalog_id: '', aulas_semana: 2, max_aulas_consecutivas: 2 }],
  });"""
s = s.replace(old_state, new_state, 1)

# Curriculum helpers.
anchor = "  const professorAssignmentGroups = useMemo(() => {"
helpers = r'''  const getTurmaCurriculum = (turmaId) => {
    const turma = byId(turmas, turmaId);
    const curso = catalogCourseFromTurma(turma?.nome);
    const match = String(turma?.nome || '').match(/(\d+)\s*º|\b(\d+)\b/);
    const serie = match ? Number(match[1] || match[2]) : null;
    return { curso, serie };
  };

  const curriculumCourseSeriesOptions = useMemo(() => {
    const map = new Map();
    currentConfig.turmas.forEach((turmaId) => {
      const curriculum = getTurmaCurriculum(turmaId);
      if (!curriculum.curso || !curriculum.serie) return;
      const value = `${curriculum.curso}|${curriculum.serie}`;
      if (!map.has(value)) map.set(value, { value, label: `${curriculum.curso} · ${curriculum.serie}ª série` });
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [currentConfig.turmas, turmas]);

  const catalogOptionsForGroup = (courseSeries) => {
    if (!courseSeries) return [];
    const [curso, serie] = String(courseSeries).split('|');
    return disciplinaCatalogo
      .filter((row) => row.curso === curso && Number(row.serie) === Number(serie) && Number(row.semestre) === Number(currentConfig.semestre))
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome))
      .map((row) => ({ value: String(row.id), label: row.nome }));
  };

  const turmaOptionsForGroup = (courseSeries) => {
    if (!courseSeries) return [];
    const [curso, serie] = String(courseSeries).split('|');
    return currentConfig.turmas.map((turmaId) => byId(turmas, turmaId)).filter((turma) => {
      const curriculum = getTurmaCurriculum(turma?.id);
      return curriculum.curso === curso && Number(curriculum.serie) === Number(serie);
    }).map((turma) => ({ value: String(turma.id), label: turma.nome }));
  };

'''
if 'const curriculumCourseSeriesOptions' not in s:
    if anchor not in s:
        raise SystemExit('assignment group anchor not found')
    s = s.replace(anchor, helpers + anchor, 1)

# Replace assignment helpers.
start = s.find("  const newAssignmentItem = () => ({")
end = s.find("  const removeAssignment = (professorId) =>", start)
if start == -1 or end == -1:
    raise SystemExit('assignment helper markers not found')
replacement = r'''  const newAssignmentItem = () => ({
    id: newId('assignment-item'),
    course_series: '',
    turma_ids: [],
    disciplina_catalog_id: '',
    aulas_semana: 2,
    max_aulas_consecutivas: 2,
  });

  const openLinkModal = (assignment = null) => {
    setEditingLinkProfessorId(assignment?.professor_id || null);
    const groupedItems = [];
    const groupedMap = new Map();
    (assignment?.items || []).forEach((item) => {
      const curriculum = getTurmaCurriculum(item.turma_id);
      const courseSeries = curriculum.curso && curriculum.serie ? `${curriculum.curso}|${curriculum.serie}` : '';
      const discipline = byId(currentConfig.disciplinas, item.disciplina_id);
      const catalogRow = disciplinaCatalogo.find((row) => row.curso === curriculum.curso && Number(row.serie) === Number(curriculum.serie) && Number(row.semestre) === Number(currentConfig.semestre) && row.nome.trim().toLowerCase() === String(discipline?.nome || '').trim().toLowerCase());
      const key = `${courseSeries}|${catalogRow?.id || discipline?.nome || ''}|${Number(item.aulas_semana || 2)}|${Number(item.max_aulas_consecutivas || 2)}`;
      if (!groupedMap.has(key)) {
        const grouped = { id: item.id || newId('assignment-item'), course_series: courseSeries, turma_ids: [], disciplina_catalog_id: catalogRow?.id ? String(catalogRow.id) : '', aulas_semana: Number(item.aulas_semana || 2), max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2) };
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
    setLinkDraft((prev) => ({ ...prev, items: prev.items.map((item) => {
      if (String(item.id) !== String(itemId)) return item;
      if (field === 'course_series') return { ...item, course_series: value, turma_ids: [], disciplina_catalog_id: '' };
      return { ...item, [field]: value };
    }) }));
  };

  const addAssignmentItem = () => setLinkDraft((prev) => ({ ...prev, items: [...prev.items, newAssignmentItem()] }));
  const removeAssignmentItem = (itemId) => setLinkDraft((prev) => ({ ...prev, items: prev.items.length > 1 ? prev.items.filter((item) => String(item.id) !== String(itemId)) : prev.items }));

  const saveLinkFromModal = () => {
    if (!linkDraft.professor_id || !byId(currentConfig.professores, linkDraft.professor_id)) return notify.error('Selecione um professor válido.');
    const seenTurmas = new Set();
    const items = linkDraft.items.map((item) => ({ ...item, turma_ids: Array.from(new Set((Array.isArray(item.turma_ids) ? item.turma_ids : []).map(String))), disciplina_catalog_id: String(item.disciplina_catalog_id || ''), aulas_semana: Number(item.aulas_semana), max_aulas_consecutivas: Number(item.max_aulas_consecutivas) }));
    for (const item of items) {
      if (!item.course_series) return notify.error('Selecione o curso e a série em cada grupo.');
      if (!item.disciplina_catalog_id || !byId(disciplinaCatalogo, item.disciplina_catalog_id)) return notify.error('Selecione uma matéria válida em cada grupo.');
      if (!item.turma_ids.length) return notify.error('Selecione pelo menos uma turma em cada grupo.');
      if (!Number.isFinite(item.aulas_semana) || item.aulas_semana <= 0 || !Number.isFinite(item.max_aulas_consecutivas) || item.max_aulas_consecutivas <= 0) return notify.error('Informe aulas por semana e máximo de consecutivas válidos.');
      const allowed = new Set(turmaOptionsForGroup(item.course_series).map((option) => String(option.value)));
      for (const turmaId of item.turma_ids) {
        if (!allowed.has(String(turmaId))) return notify.error('Existe uma turma fora do curso/série escolhido.');
        if (seenTurmas.has(String(turmaId))) return notify.error('A mesma turma não pode aparecer em dois grupos desta atribuição.');
        seenTurmas.add(String(turmaId));
      }
    }
    const professorId = String(linkDraft.professor_id);
    const nextDisciplines = [...currentConfig.disciplinas];
    const disciplineByCatalog = new Map();
    items.forEach((item) => {
      const row = byId(disciplinaCatalogo, item.disciplina_catalog_id);
      if (!row) return;
      const existing = nextDisciplines.find((discipline) => discipline.nome.trim().toLowerCase() === row.nome.trim().toLowerCase());
      const discipline = existing || { id: newId('disc'), nome: row.nome, area_id: String(currentConfig.areas.find((area) => area.nome.trim().toLowerCase() === row.area_nome.trim().toLowerCase())?.id || currentConfig.areas[0]?.id || '') };
      if (!existing) nextDisciplines.push(discipline);
      disciplineByCatalog.set(String(row.id), String(discipline.id));
    });
    const links = items.flatMap((item) => item.turma_ids.map((turmaId) => ({ id: newId('link'), professor_id: professorId, turma_id: turmaId, disciplina_id: disciplineByCatalog.get(String(item.disciplina_catalog_id)), aulas_semana: item.aulas_semana, max_aulas_consecutivas: item.max_aulas_consecutivas })));
    setCurrentConfig((prev) => ({ ...prev, disciplinas: nextDisciplines, professorTurmas: [...prev.professorTurmas.filter((item) => String(item.professor_id) !== professorId), ...links] }));
    closeLinkModal();
  };

'''
s = s[:start] + replacement + s[end:]

# Replace assignment modal structurally.
modal_start = s.find('      <Modal isOpen={vinculoModalOpen}')
if modal_start == -1:
    raise SystemExit('assignment modal start not found')
modal_end = s.find('      </Modal>', modal_start)
if modal_end == -1:
    raise SystemExit('assignment modal end not found')
modal_end += len('      </Modal>')
new_modal = r'''      <Modal isOpen={vinculoModalOpen} onClose={closeLinkModal} title={editingLinkProfessorId ? 'Editar atribuição' : 'Nova atribuição'}>
        <div className="space-y-5">
          <CustomSelect label="Professor" value={linkDraft.professor_id} onChange={(value) => setLinkDraft((prev) => ({ ...prev, professor_id: value }))} options={editingLinkProfessorId ? professorOptions : professorOptions.filter((option) => !professorAssignmentGroups.some((assignment) => String(assignment.professor_id) === String(option.value)))} placeholder="Selecione o professor" showSearch emptyLabel="Nenhum professor disponível" disabled={Boolean(editingLinkProfessorId)} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="font-semibold text-slate-900 dark:text-white">Matérias por turma</h4><p className="text-xs text-slate-500 dark:text-slate-400">A matéria é filtrada pelo curso, série e semestre da Etapa 1.</p></div><Button type="button" variant="secondary" onClick={addAssignmentItem}><FaPlus className="mr-2" /> Outra matéria</Button></div>
            <div className="mt-4 space-y-3">
              {linkDraft.items.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"><div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Matéria {index + 1}</span>{linkDraft.items.length > 1 && <button type="button" onClick={() => removeAssignmentItem(item.id)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"><FaTrash /></button>}</div><div className="grid gap-4 sm:grid-cols-2"><CustomSelect label="Curso e série" value={item.course_series} onChange={(value) => updateAssignmentItem(item.id, 'course_series', value)} options={curriculumCourseSeriesOptions} placeholder="Selecione o curso e a série" emptyLabel="Nenhum curso/série disponível" /><CustomSelect label="Matéria" value={item.disciplina_catalog_id} onChange={(value) => updateAssignmentItem(item.id, 'disciplina_catalog_id', value)} options={catalogOptionsForGroup(item.course_series)} placeholder="Selecione a matéria" emptyLabel="Nenhuma matéria para este semestre" showSearch /><CustomSelect label="Turmas" value={item.turma_ids} multiple onChange={(value) => updateAssignmentItem(item.id, 'turma_ids', value)} options={turmaOptionsForGroup(item.course_series)} placeholder="Selecione uma ou mais turmas" emptyLabel="Nenhuma turma para este curso/série" showSearch showSelectedValues={false} /><div className="grid grid-cols-2 gap-3"><FormInput label="Aulas/semana" type="number" min="1" value={item.aulas_semana} onChange={(event) => updateAssignmentItem(item.id, 'aulas_semana', Number(event.target.value) || 0)} /><FormInput label="Máx. consecutivas" type="number" min="1" value={item.max_aulas_consecutivas} onChange={(event) => updateAssignmentItem(item.id, 'max_aulas_consecutivas', Number(event.target.value) || 0)} /></div></div></div>)}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><Button type="button" variant="secondary" onClick={closeLinkModal}>Cancelar</Button><Button type="button" onClick={saveLinkFromModal}>{editingLinkProfessorId ? 'Salvar atribuição' : 'Criar atribuição'}</Button></div>
        </div>
      </Modal>'''
s = s[:modal_start] + new_modal + s[modal_end:]

# Remove the two no-longer-used discipline/catalog modals from the end of the component.
for marker in ['      <Modal isOpen={catalogModalOpen}', '      <Modal isOpen={disciplinaModalOpen}']:
    while True:
        start = s.find(marker)
        if start == -1:
            break
        end = s.find('      </Modal>', start)
        if end == -1:
            raise SystemExit('discipline modal end not found')
        s = s[:start] + s[end + len('      </Modal>'):]

# Remove obsolete discipline/catalog state and handlers. They are not part of the new UX.
for snippet in [
    "  const [disciplinaModalOpen, setDisciplinaModalOpen] = useState(false);\n",
    "  const [editingDisciplinaId, setEditingDisciplinaId] = useState(null);\n",
    "  const [disciplinaForm, setDisciplinaForm] = useState({ nome: '', area_id: '' });\n",
    "  const [catalogModalOpen, setCatalogModalOpen] = useState(false);\n",
    "  const [catalogCourse, setCatalogCourse] = useState('');\n",
    "  const [catalogSerie, setCatalogSerie] = useState('1');\n",
    "  const [catalogSelected, setCatalogSelected] = useState([]);\n",
]:
    s = s.replace(snippet, '')

# Remove stale discipline/catalog functions between professor removal and assignment helpers.
stale_start = s.find('  const openDisciplinaCatalogModal = () => {')
stale_end = s.find('  const newAssignmentItem = () => ({', stale_start)
if stale_start != -1 and stale_end != -1:
    s = s[:stale_start] + s[stale_end:]

s = s.replace('    closeDisciplinaModal();\n', '', 1)
s = s.replace('    closeDisciplinaCatalogModal();\n', '', 1)

p.write_text(s, encoding='utf-8')
print('patched')
