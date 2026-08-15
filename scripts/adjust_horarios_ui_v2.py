from pathlib import Path
import re


def sub_once(path, pattern, replacement):
    text = path.read_text(encoding='utf-8')
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'Pattern not found exactly once in {path}: {pattern[:180]}')
    path.write_text(new_text, encoding='utf-8')

h = Path('src/pages/Horarios.jsx')
c = Path('src/components/ui/CustomSelect.jsx')
m = Path('src/components/ui/Modal.jsx')

sub_once(h, r'\n  const professorAssignmentGroups = useMemo\(\(\) => \{', '''
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

  const professorAssignmentGroups = useMemo(() => {''')

sub_once(h, r'<CustomSelect label="Professor da base".*?disabled=\{Boolean\(editingProfessorId\)\} />', '''<CustomSelect label="Professor da base" value={professorDraft.usuario_id} onChange={(value) => setProfessorDraft((prev) => ({ ...prev, usuario_id: value, pdt_turma_id: '' }))} options={editingProfessorId && selectedModalProfessor?.usuario_id ? [{ value: String(selectedModalProfessor.usuario_id), label: `${selectedModalProfessor.nome}${selectedModalUser?.pdt ? ' · PDT' : ''}` }, ...professorUsers] : professorUsers} placeholder="Selecione o professor" showSearch emptyLabel="Nenhum professor disponível" disabled={Boolean(editingProfessorId)} />''')

sub_once(h, r'<CustomSelect label="Turma correspondente ao PDT".*?emptyLabel="Selecione turmas na Etapa 2" />', '''<CustomSelect label="Turma correspondente ao PDT" value={professorDraft.pdt_turma_id} onChange={(value) => setProfessorDraft((prev) => ({ ...prev, pdt_turma_id: value }))} options={availablePdtTurmaOptions} placeholder="Selecione a turma" emptyLabel="Todas as turmas selecionadas já possuem PDT" />''')

sub_once(h, r'  const newAssignmentItem = \(\) => \(\{.*?\n  const saveLinkFromModal = \(\) => \{', '''  const newAssignmentItem = () => ({
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
        const grouped = {
          id: item.id || newId('assignment-item'),
          turma_ids: [],
          disciplina_id: String(item.disciplina_id || ''),
          aulas_semana: Number(item.aulas_semana || 2),
          max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2),
        };
        groupedMap.set(key, grouped);
        groupedItems.push(grouped);
      }
      const target = groupedMap.get(key);
      if (item.turma_id && !target.turma_ids.includes(String(item.turma_id))) target.turma_ids.push(String(item.turma_id));
    });

    setLinkDraft({
      professor_id: assignment?.professor_id || '',
      items: groupedItems.length ? groupedItems : [newAssignmentItem()],
    });
    setVinculoModalOpen(true);
  };

  const closeLinkModal = () => {
    setVinculoModalOpen(false);
    setEditingLinkProfessorId(null);
    setLinkDraft({ professor_id: '', items: [newAssignmentItem()] });
  };

  const updateAssignmentItem = (itemId, field, value) => {
    setLinkDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => String(item.id) === String(itemId) ? { ...item, [field]: value } : item),
    }));
  };

  const addAssignmentItem = () => {
    setLinkDraft((prev) => ({ ...prev, items: [...prev.items, newAssignmentItem()] }));
  };

  const removeAssignmentItem = (itemId) => {
    setLinkDraft((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((item) => String(item.id) !== String(itemId)) : prev.items,
    }));
  };

  const saveLinkFromModal = () => {''')

sub_once(h, r'    const seenTurmas = new Set\(\);.*?\n    const professorId = String\(linkDraft\.professor_id\);.*?\n    \}\);', '''    const seenTurmas = new Set();
    const items = linkDraft.items.map((item) => ({
      ...item,
      turma_ids: Array.from(new Set((Array.isArray(item.turma_ids) ? item.turma_ids : []).map(String))),
      disciplina_id: String(item.disciplina_id || ''),
      aulas_semana: Number(item.aulas_semana),
      max_aulas_consecutivas: Number(item.max_aulas_consecutivas),
    }));

    for (const item of items) {
      if (!item.turma_ids.length || !byId(currentConfig.disciplinas, item.disciplina_id) || !Number.isFinite(item.aulas_semana) || item.aulas_semana <= 0 || !Number.isFinite(item.max_aulas_consecutivas) || item.max_aulas_consecutivas <= 0) {
        return notify.error('Cada grupo precisa de uma ou mais turmas, matéria, aulas por semana e máximo de consecutivas válidos.');
      }
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
        ...items.flatMap((item) => item.turma_ids.map((turmaId) => ({
          id: newId('link'),
          professor_id: professorId,
          turma_id: turmaId,
          disciplina_id: item.disciplina_id,
          aulas_semana: item.aulas_semana,
          max_aulas_consecutivas: item.max_aulas_consecutivas,
        }))),
      ],
    }));''')

sub_once(h, r'<div className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900 dark:text-white">Turmas e matérias</h4>.*?</div>\)\)}\n          </div>', '''<div className="space-y-3"><div className="flex items-center justify-between gap-3"><div><h4 className="font-semibold text-slate-900 dark:text-white">Turmas, matéria e carga</h4><p className="text-xs text-slate-500 dark:text-slate-400">Selecione várias turmas no mesmo grupo quando a matéria e a carga semanal forem iguais.</p></div><Button type="button" variant="secondary" onClick={addAssignmentItem}><FaPlus className="mr-2" /> Adicionar grupo</Button></div>
            {linkDraft.items.map((item, index) => <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900"><div className="mb-3 flex items-center justify-between gap-3"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Grupo {index + 1}</span>{linkDraft.items.length > 1 && <button type="button" onClick={() => removeAssignmentItem(item.id)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"><FaTrash /></button>}</div><div className="grid gap-4 sm:grid-cols-2"><CustomSelect label="Turmas" value={item.turma_ids} multiple onChange={(value) => updateAssignmentItem(item.id, 'turma_ids', value)} options={turmaOptions.filter((option) => currentConfig.turmas.includes(String(option.value)))} placeholder="Selecione uma ou mais turmas" emptyLabel="Selecione turmas na Etapa 2" showSearch /><CustomSelect label="Matéria" value={item.disciplina_id} onChange={(value) => updateAssignmentItem(item.id, 'disciplina_id', value)} options={disciplinaOptions} placeholder="Selecione a matéria" emptyLabel="Cadastre disciplinas na Etapa 3" /><FormInput label="Aulas por semana" type="number" min="1" value={item.aulas_semana} onChange={(event) => updateAssignmentItem(item.id, 'aulas_semana', Number(event.target.value) || 0)} /><FormInput label="Máx. de aulas consecutivas" type="number" min="1" value={item.max_aulas_consecutivas} onChange={(event) => updateAssignmentItem(item.id, 'max_aulas_consecutivas', Number(event.target.value) || 0)} /></div></div>)}
          </div>''')

sub_once(m, r'rounded-2xl shadow-xl max-w-2xl w-full max-h-\[92vh\]', 'rounded-2xl shadow-xl w-fit min-w-[min(92vw,32rem)] max-w-[calc(100vw-2rem)] max-h-[92vh]')

sub_once(c, r'  const \[searchTerm, setSearchTerm\] = useState\(""\);\n  const rootRef = useRef\(null\);', '''  const [searchTerm, setSearchTerm] = useState("");
  const [menuMinWidth, setMenuMinWidth] = useState(240);
  const rootRef = useRef(null);

  useEffect(() => {
    const labels = [placeholder, ...options.map((option) => option.label)];
    const maxLength = Math.max(0, ...labels.map((label) => String(label || '').length));
    setMenuMinWidth(Math.min(Math.max(240, Math.round(maxLength * 7.2 + 72)), 720));
  }, [options, placeholder]);''')
sub_once(c, r'return `\$\{selectedValues\.length\} alunos selecionados`;', 'return `${selectedValues.length} itens selecionados`;')
sub_once(c, r'<div className=\{`relative flex flex-col gap-2 \$\{className\}`\} ref=\{rootRef\}>', '<div className={`relative flex flex-col gap-2 ${className}`} ref={rootRef} style={{ minWidth: `min(${menuMinWidth}px, calc(100vw - 48px))` }}>')
sub_once(c, r'<div className="absolute left-0 right-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">', '<div className="absolute left-0 top-full z-40 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900" style={{ minWidth: `min(${menuMinWidth}px, calc(100vw - 48px))` }}>')

print('Patch applied')
