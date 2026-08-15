from pathlib import Path
p=Path('src/pages/Horarios.jsx')
s=p.read_text(encoding='utf-8')
s=s.replace("      const curriculum = curriculumForTurmas(turmaIds);\n", "")
s=s.replace("      if (!curriculum) return notify.error('As turmas de um mesmo bloco precisam pertencer ao mesmo curso e série.');\n", "")
p.write_text(s, encoding='utf-8')
