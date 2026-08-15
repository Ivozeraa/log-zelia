from pathlib import Path
import re

p = Path('src/pages/Horarios.jsx')
s = p.read_text(encoding='utf-8')

# Step 1: use the shared select design for school and semester.
s = s.replace(
'''            <SelectField label="Escola" value={currentConfig.escola_id} onChange={(event) => updateField('escola_id', event.target.value)}>
              <option value="">Selecione a escola</option>
              {schools.map((school) => <option key={school.id} value={school.id}>{school.nome}</option>)}
            </SelectField>''',
'''            <CustomSelect label="Escola" value={currentConfig.escola_id} onChange={(value) => updateField('escola_id', value)} options={schools.map((school) => ({ value: String(school.id), label: school.nome }))} placeholder="Selecione a escola" emptyLabel="Nenhuma escola disponível" />''',
1,
)
s = s.replace(
'''            <SelectField label="Semestre" value={currentConfig.semestre} onChange={(event) => updateField('semestre', Number(event.target.value))}>
              <option value="1">1º semestre</option>
              <option value="2">2º semestre</option>
            </SelectField>''',
'''            <CustomSelect label="Semestre" value={String(currentConfig.semestre)} onChange={(value) => updateField('semestre', Number(value))} options={[{ value: '1', label: '1º semestre' }, { value: '2', label: '2º semestre' }]} placeholder="Selecione o semestre" />''',
1,
)

# Replace curriculum helpers and assignment state/helpers.
start = s.find("  const getTurmaCurriculum = (turmaId) => {")
end = s.find("  const selectedModalUser =", start)
if start == -1 or end == -1:
    raise SystemExit('curriculum helper boundaries not found')
helpers = r'''  const getTurmaCurriculum = (turmaId) => {
    const turma = byId(turmas, turmaId);
    const curso = catalogCourseFromTurma(turma?.nome);
    const match = String(turma?.nome || '').match(/(\d+)\s*º|\b(\d+)\b/);
    const serie = match ? Number(match[1] || match[2]) : null;
    return { curso, serie };
  };

  const curriculumForTurmas = (turmaIds = []) => {
    const curriculums = turmaIds.map((turmaId) => getTurmaCurriculum(turmaId));
    if (!curriculums.length || curriculums.some((item) => !item.curso || !item.serie)) return null;
    const first = curriculums[0];
    const same = curriculums.every((item) => item.curso === first.curso && Number(item.serie) === Number(first.serie));
    return same ? first : null;
  };

  const catalogOptionsForTurmas = (turmaIds = []) => {
    const curriculum = curriculumForTurmas(turmaIds);
    if (!curriculum) return [];
    return disciplinaCatalogo
      .filter((row) => row.curso === curriculum.curso && Number(row.serie) === Number(curriculum.serie) && Number(row.semestre) === Number(currentConfig.semestre))
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome))
      .map((row) => ({ value: String(row.id), label: row.nome }));
  };

  const getMateriaSettings = (item) => item.materia_settings || {};

  const professorAssignmentGroups = useMemo(() => {
    const groups = new Map();
    currentConfig.professorTurmas.forEach((link) => {
      const key = String(link.professor_id);
      if (!groups.has(key)) groups.set(key, { professor_id: key, items: [] });
      groups.get(key).items.push(link);
    });
    return Array.from(groups.values());
  }, [currentConfig.professorTurmas]);

'''
s = s[:start] + helpers + s[end:]

# Replace assignment item state initializer.
s = s.replace(
"items: [{ id: newId('assignment-item'), course_series: '', turma_ids: [], disciplina_catalog_id: '', aulas_semana: 2, max_aulas_consecutivas: 2 }],",
"items: [{ id: newId('assignment-item'), turma_ids: [], disciplina_catalog_ids: [], materia_settings: {} }],",
1,
)

# Replace the assignment helper block.
start = s.find("  const newAssignmentItem = () => ({")
end = s.find("  const toggleFolga =", start)
if start == -1 or end == -1:
    raise SystemExit('assignment helper boundaries not found')
replacement = r'''  const newAssignmentItem = () => ({
    id: newId('assignment-item'),
    turma_ids: [],
    disciplina_catalog_ids: [],
    materia_settings: {},
  });

  const openLinkModal = (assignment = null) => {
    setEditingLinkProfessorId(assignment?.professor_id || null);
    const grouped = new Map();

    (assignment?.items || []).forEach((item) => {
      const curriculum = getTurmaCurriculum(item.turma_id);
      const groupKey = `${curriculum.curso}|${curriculum.serie}|${item.turma_id}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          id: newId('assignment-item'),
          turma_ids: [String(item.turma_id)],
          disciplina_catalog_ids: [],
          materia_settings: {},
        });
      }
      const group = grouped.get(groupKey);
      const discipline = byId(currentConfig.disciplinas, item.disciplina_id);
      const catalogRow = disciplinaCatalogo.find(
        (row) => row.curso === curriculum.curso
          && Number(row.serie) === Number(curriculum.serie)
          && Number(row.semestre) === Number(currentConfig.semestre)
          && String(row.nome).trim().toLowerCase() === String(discipline?.nome || '').trim().toLowerCase(),
      );
      if (catalogRow) {
        const catalogId = String(catalogRow.id);
        if (!group.disciplina_catalog_ids.includes(catalogId)) group.disciplina_catalog_ids.push(catalogId);
        group.materia_settings[catalogId] = {
          aulas_semana: Number(item.aulas_semana || 2),
          max_aulas_consecutivas: Number(item.max_aulas_consecutivas || 2),
        };
      }
    });

    setLinkDraft({
      professor_id: assignment?.professor_id || '',
      items: grouped.size ? Array.from(grouped.values()) : [newAssignmentItem()],
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
      items: prev.items.map((item) => {
        if (String(item.id) !== String(itemId)) return item;
        if (field === 'turma_ids') {
          const turmaIds = Array.from(new Set((Array.isArray(value) ? value : []).map(String)));
          const available = new Set(catalogOptionsForTurmas(turmaIds).map((option) => String(option.value)));
          const nextIds = item.disciplina_catalog_ids.filter((id) => available.has(String(id)));
          const nextSettings = Object.fromEntries(nextIds.map((id) => [String(id), item.materia_settings?.[id] || { aulas_semana: 2, max_aulas_consecutivas: 2 }]));
          return { ...item, turma_ids: turmaIds, disciplina_catalog_ids: nextIds, materia_settings: nextSettings };
        }
        if (field === 'disciplina_catalog_ids') {
          const ids = Array.from(new Set((Array.isArray(value) ? value : []).map(String)));
          const nextSettings = Object.fromEntries(ids.map((id) => [String(id), item.materia_settings?.[id] || { aulas_semana: 2, max_aulas_consecutivas: 2 }]));
          return { ...item, disciplina_catalog_ids: ids, materia_settings: nextSettings };
        }
        return { ...item, [field]: value };
      }),
    }));
  };

  const updateMateriaSetting = (itemId, disciplinaId, field, value) => {
    setLinkDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => String(item.id) !== String(itemId)
        ? item
        : {
            ...item,
            materia_settings: {
              ...item.materia_settings,
              [String(disciplinaId)]: {
                ...(item.materia_settings?.[String(disciplinaId)] || {}),
                [field]: Number(value) || 0,
              },
            },
          }),
    }));
  };

  const addAssignmentItem = () => setLinkDraft((prev) => ({ ...prev, items: [...prev.items, newAssignmentItem()] }));
  const removeAssignmentItem = (itemId) => setLinkDraft((prev) => ({
    ...prev,
    items: prev.items.length > 1 ? prev.items.filter((item) => String(item.id) !== String(itemId)) : prev.items,
  }));

  const saveLinkFromModal = () => {
    if (!linkDraft.professor_id || !byId(currentConfig.professores, linkDraft.professor_id)) return notify.error('Selecione um professor válido.');
    const links = [];
    const seenPairs = new Set();
    const nextDisciplines = [...currentConfig.disciplinas];

    for (const item of linkDraft.items) {
      const turmaIds = Array.from(new Set((item.turma_ids || []).map(String)));
      const disciplineIds = Array.from(new Set((item.disciplina_catalog_ids || []).map(String)));
      const curriculum = curriculumForTurmas(turmaIds);
      if (!turmaIds.length) return notify.error('Selecione pelo menos uma turma em cada bloco.');
      if (!curriculum) return notify.error('As turmas de um mesmo bloco precisam pertencer ao mesmo curso e série.');
      if (!disciplineIds.length) return notify.error('Selecione pelo menos uma matéria em cada bloco.');

      const allowed = new Set(catalogOptionsForTurmas(turmaIds).map((option) => String(option.value)));
      const settings = getMateriaSettings(item);
      disciplineIds.forEach((catalogId) => {
        if (!allowed.has(catalogId)) throw new Error('Existe uma matéria incompatível com as turmas selecionadas.');
        const setting = settings[catalogId] || {};
        const aulas = Number(setting.aulas_semana);
        const maxConsecutivas = Number(setting.max_aulas_consecutivas);
        if (!Number.isFinite(aulas) || aulas <= 0 || !Number.isFinite(maxConsecutivas) || maxConsecutivas <= 0) throw new Error('Informe aulas por semana e máximo de consecutivas para todas as matérias.');
        const row = byId(disciplinaCatalogo, catalogId);
        if (!row) throw new Error('Matéria do catálogo não encontrada.');
        let discipline = nextDisciplines.find((entry) => entry.nome.trim().toLowerCase() === row.nome.trim().toLowerCase());
        if (!discipline) {
          const areaId = currentConfig.areas.find((area) => String(area.nome).trim().toLowerCase() === String(row.area_nome || '').trim().toLowerCase())?.id || currentConfig.areas[0]?.id;
          discipline = { id: newId('disc'), nome: row.nome, area_id: String(areaId || '') };
          nextDisciplines.push(discipline);
        }
        turmaIds.forEach((turmaId) => {
          const pair = `${turmaId}|${discipline.id}`;
          if (seenPairs.has(pair)) throw new Error('A mesma matéria já foi atribuída à mesma turma neste formulário.');
          seenPairs.add(pair);
          links.push({ id: newId('link'), professor_id: String(linkDraft.professor_id), turma_id: String(turmaId), disciplina_id: String(discipline.id), aulas_semana: aulas, max_aulas_consecutivas: maxConsecutivas });
        });
      });
    }

    setCurrentConfig((prev) => ({
      ...prev,
      disciplinas: nextDisciplines,
      professorTurmas: [
        ...prev.professorTurmas.filter((item) => String(item.professor_id) !== String(linkDraft.professor_id)),
        ...links,
      ],
    }));
    closeLinkModal();
  };

  const removeAssignment = (professorId) => setCurrentConfig((prev) => ({
    ...prev,
    professorTurmas: prev.professorTurmas.filter((item) => String(item.professor_id) !== String(professorId)),
  }));

'''
s = s[:start] + replacement + s[end:]

# Replace assignment modal.
modal_start = s.find('      <Modal isOpen={vinculoModalOpen}')
modal_end = s.find('      </Modal>', modal_start)
if modal_start == -1 or modal_end == -1:
    raise SystemExit('assignment modal not found')
modal_end += len('      </Modal>')
modal = r'''      <Modal isOpen={vinculoModalOpen} onClose={closeLinkModal} title={editingLinkProfessorId ? 'Editar atribuição' : 'Nova atribuição'}>
        <div className="space-y-5">
          <CustomSelect label="Professor" value={linkDraft.professor_id} onChange={(value) => setLinkDraft((prev) => ({ ...prev, professor_id: value }))} options={editingLinkProfessorId ? professorOptions : professorOptions.filter((option) => !professorAssignmentGroups.some((assignment) => String(assignment.professor_id) === String(option.value)))} placeholder="Selecione o professor" showSearch emptyLabel="Nenhum professor disponível" disabled={Boolean(editingLinkProfessorId)} />
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h4 className="font-semibold text-slate-900 dark:text-white">Turmas e matérias</h4><p className="text-xs text-slate-500 dark:text-slate-400">Escolha as turmas. As matérias disponíveis são filtradas automaticamente pelo curso, série e semestre.</p></div>
              <Button type="button" variant="secondary" onClick={addAssignmentItem}><FaPlus className="mr-2" /> Outro grupo</Button>
            </div>
            <div className="mt-4 space-y-4">
              {linkDraft.items.map((item, index) => {
                const materiaOptions = catalogOptionsForTurmas(item.turma_ids);
                return <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
                  <div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Grupo {index + 1}</span>{linkDraft.items.length > 1 && <button type="button" onClick={() => removeAssignmentItem(item.id)} className="rounded-lg p-2 text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950"><FaTrash /></button>}</div>
                  <div className="grid gap-4">
                    <CustomSelect label="Turmas" value={item.turma_ids} multiple onChange={(value) => updateAssignmentItem(item.id, 'turma_ids', value)} options={turmaOptions} placeholder="Selecione uma ou mais turmas" emptyLabel="Nenhuma turma disponível" showSearch showSelectedValues={false} />
                    <CustomSelect label="Matérias" value={item.disciplina_catalog_ids} multiple onChange={(value) => updateAssignmentItem(item.id, 'disciplina_catalog_ids', value)} options={materiaOptions} placeholder={item.turma_ids.length ? 'Selecione uma ou mais matérias' : 'Selecione as turmas primeiro'} emptyLabel="Nenhuma matéria compatível" showSearch showSelectedValues={false} disabled={!item.turma_ids.length} />
                    {item.disciplina_catalog_ids.length > 0 && <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900">
                      {item.disciplina_catalog_ids.map((disciplineId) => {
                        const discipline = disciplinaCatalogo.find((row) => String(row.id) === String(disciplineId));
                        const setting = item.materia_settings?.[disciplineId] || { aulas_semana: 2, max_aulas_consecutivas: 2 };
                        return <div key={disciplineId} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_8rem_10rem] dark:border-slate-700 dark:bg-slate-950">
                          <div className="flex items-center"><span className="font-semibold text-slate-800 dark:text-slate-200">{discipline?.nome || 'Matéria'}</span></div>
                          <FormInput label="Aulas/semana" type="number" min="1" value={setting.aulas_semana} onChange={(event) => updateMateriaSetting(item.id, disciplineId, 'aulas_semana', event.target.value)} />
                          <FormInput label="Máx. consecutivas" type="number" min="1" value={setting.max_aulas_consecutivas} onChange={(event) => updateMateriaSetting(item.id, disciplineId, 'max_aulas_consecutivas', event.target.value)} />
                        </div>;
                      })}
                    </div>}
                  </div>
                </div>;
              })}
            </div>
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700"><Button type="button" variant="secondary" onClick={closeLinkModal}>Cancelar</Button><Button type="button" onClick={saveLinkFromModal}>{editingLinkProfessorId ? 'Salvar atribuição' : 'Criar atribuição'}</Button></div>
        </div>
      </Modal>'''
s = s[:modal_start] + modal + s[modal_end:]

p.write_text(s, encoding='utf-8')
