from pathlib import Path
import re

horarios = Path('src/pages/Horarios.jsx')
s = horarios.read_text(encoding='utf-8')
pattern = re.compile(r"  const catalogOptionsForTurmas = \(turmaIds = \[\]\) => \{.*?\n  \};", re.S)
replacement = '''  const catalogOptionsForTurmas = (turmaIds = []) => {
    const curriculum = curriculumForTurmas(turmaIds);
    if (!curriculum) return [];
    const selectedCount = turmaIds.length;
    const isTechnical = (row) => {
      const category = String(row?.categoria || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
      const name = String(row?.nome || '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase();
      return category.includes('tecn') || category.includes('formacao tecnica') || category.includes('itinerario tecnico')
        || name.includes('estagio') || name.includes('pratica profissional') || name.includes('projeto integrador');
    };
    return disciplinaCatalogo
      .filter((row) =>
        row.curso === curriculum.curso
        && Number(row.serie) === Number(curriculum.serie)
        && Number(row.semestre) === Number(currentConfig.semestre)
        && (selectedCount <= 1 || !isTechnical(row)),
      )
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome))
      .map((row) => ({ value: String(row.id), label: row.nome }));
  };'''
if not pattern.search(s):
    raise SystemExit('catalogOptionsForTurmas block not found')
s = pattern.sub(replacement, s, count=1)

select = Path('src/components/ui/CustomSelect.jsx')
t = select.read_text(encoding='utf-8')
old = '''      const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
      const spaceAbove = rect.top - viewportPadding - gap;
      const openAbove = spaceBelow < 240 && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        180,
        Math.min(380, openAbove ? spaceAbove : spaceBelow),
      );
      const top = openAbove
        ? Math.max(viewportPadding, rect.top - maxHeight - gap)
        : rect.bottom + gap;

      setMenuPosition({ top, left, width, maxHeight });'''
new = '''      const spaceBelow = Math.max(0, window.innerHeight - rect.bottom - viewportPadding - gap);
      const spaceAbove = Math.max(0, rect.top - viewportPadding - gap);
      const optionCount = displayedOptions.length;
      const estimatedContentHeight = Math.min(
        380,
        Math.max(48, optionCount * 44 + (showSearch ? 60 : 0) + (multiple ? 58 : 0)),
      );
      const openAbove = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;
      const maxHeight = Math.max(
        120,
        Math.min(380, openAbove ? spaceAbove : Math.max(spaceBelow, 120)),
      );
      const top = openAbove
        ? Math.max(viewportPadding, rect.top - maxHeight - gap)
        : rect.bottom + gap;

      setMenuPosition({ top, left, width, maxHeight });'''
if old not in t:
    raise SystemExit('CustomSelect positioning block not found')
t = t.replace(old, new, 1)
t = t.replace('  }, [open, menuMinWidth]);', '  }, [open, menuMinWidth, displayedOptions.length, showSearch, multiple]);', 1)
select.write_text(t, encoding='utf-8')
horarios.write_text(s, encoding='utf-8')
