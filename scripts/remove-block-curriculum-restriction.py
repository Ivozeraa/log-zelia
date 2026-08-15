from pathlib import Path

path = Path('src/pages/Horarios.jsx')
s = path.read_text(encoding='utf-8')
old = """      const curriculum = curriculumForTurmas(turmaIds);\n      if (!turmaIds.length) return notify.error('Selecione pelo menos uma turma em cada bloco.');\n      if (!curriculum) return notify.error('As turmas de um mesmo bloco precisam pertencer ao mesmo curso e série.');\n      if (!disciplineIds.length) return notify.error('Selecione pelo menos uma matéria em cada bloco.');\n"""
new = """      if (!turmaIds.length) return notify.error('Selecione pelo menos uma turma em cada bloco.');\n      if (!disciplineIds.length) return notify.error('Selecione pelo menos uma matéria em cada bloco.');\n"""
if old not in s:
    raise SystemExit('target validation block not found')
path.write_text(s.replace(old, new, 1), encoding='utf-8')
