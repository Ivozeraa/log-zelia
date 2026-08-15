from pathlib import Path
path = Path('src/components/ui/CustomSelect.jsx')
s = path.read_text(encoding='utf-8')
old = '''      const openAbove = spaceBelow < estimatedContentHeight && spaceAbove > spaceBelow;\n      const maxHeight = Math.max(\n        120,\n        Math.min(380, openAbove ? spaceAbove : Math.max(spaceBelow, 120)),\n      );\n      const top = openAbove\n        ? Math.max(viewportPadding, rect.top - maxHeight - gap)\n        : rect.bottom + gap;'''
new = '''      // Preferimos sempre abrir abaixo. Só abrimos acima quando praticamente não\n      // existe espaço utilizável abaixo do campo. Isso evita o menu “saltando”\n      // para cima em modais/páginas com espaço suficiente para uma lista rolável.\n      const minimumBelowSpace = Math.min(180, estimatedContentHeight);\n      const openAbove = spaceBelow < minimumBelowSpace && spaceAbove > spaceBelow;\n      const availableSpace = openAbove ? spaceAbove : spaceBelow;\n      const maxHeight = Math.max(120, Math.min(380, availableSpace));\n      const top = openAbove\n        ? Math.max(viewportPadding, rect.top - maxHeight - gap)\n        : rect.bottom + gap;'''
if old not in s:
    raise SystemExit('target block not found')
s = s.replace(old, new, 1)
path.write_text(s, encoding='utf-8')
