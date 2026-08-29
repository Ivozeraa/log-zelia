from pathlib import Path

path = Path('src/pages/Horarios.jsx')
s = path.read_text(encoding='utf-8')
old = '<div className="grid gap-4">\n                    <CustomSelect label="Turmas" value={item.turma_ids}'
new = '<div className="grid gap-4 md:grid-cols-2 md:items-start">\n                    <CustomSelect label="Turmas" value={item.turma_ids}'
if old not in s:
    raise SystemExit('assignment select grid not found')
s = s.replace(old, new, 1)
path.write_text(s, encoding='utf-8')
