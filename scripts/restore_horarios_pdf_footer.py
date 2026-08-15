from pathlib import Path

path = Path('src/pages/Horarios.jsx')
text = path.read_text(encoding='utf-8')

import_line = "import ExcelJS from 'exceljs';\n"
topo_line = "import topoMiniImg from '../assets/images/topo_mini.png';\n"
if topo_line not in text:
    if import_line not in text:
        raise SystemExit('ExcelJS import anchor not found')
    text = text.replace(import_line, import_line + topo_line, 1)

text = text.replace('const PDF_FOOTER_HEIGHT = 7;', 'const PDF_FOOTER_RESERVED_HEIGHT = 18;', 1)
text = text.replace('margin: { left: 10, right: 10, bottom: PDF_FOOTER_HEIGHT + 2 },', 'margin: { left: 10, right: 10, bottom: PDF_FOOTER_RESERVED_HEIGHT },', 1)

anchor = "const newId = (prefix) =>"
helper = """const loadImageAsDataUrl = (url) => new Promise((resolve) => {\n  if (!url) {\n    resolve(null);\n    return;\n  }\n  const img = new Image();\n  img.crossOrigin = 'anonymous';\n  img.onload = () => {\n    try {\n      const canvas = document.createElement('canvas');\n      canvas.width = img.naturalWidth;\n      canvas.height = img.naturalHeight;\n      const ctx = canvas.getContext('2d');\n      ctx.drawImage(img, 0, 0);\n      resolve({ dataUrl: canvas.toDataURL('image/png'), width: img.naturalWidth, height: img.naturalHeight });\n    } catch (error) {\n      console.error(error);\n      resolve(null);\n    }\n  };\n  img.onerror = () => resolve(null);\n  img.src = url;\n});\n\n"""
if 'const loadImageAsDataUrl = ' not in text:
    if anchor not in text:
        raise SystemExit('newId anchor not found')
    text = text.replace(anchor, helper + anchor, 1)

old_footer = """  const drawPdfFooter = (doc) => {\n    const pageWidth = doc.internal.pageSize.getWidth();\n    const pageHeight = doc.internal.pageSize.getHeight();\n    doc.setDrawColor(203, 213, 225);\n    doc.line(12, pageHeight - PDF_FOOTER_HEIGHT, pageWidth - 12, pageHeight - PDF_FOOTER_HEIGHT);\n    doc.setFontSize(7);\n    doc.setTextColor(100);\n    doc.text(`LogZélia · ${currentConfig.nome || 'Horário'}`, 12, pageHeight - 2.5);\n  };"""
new_footer = """  const drawPdfFooter = async (doc) => {\n    const footerImg = await loadImageAsDataUrl(topoMiniImg);\n    if (!footerImg?.dataUrl) return;\n\n    const pageWidth = doc.internal.pageSize.getWidth();\n    const pageHeight = doc.internal.pageSize.getHeight();\n    const footerHeight = PDF_FOOTER_RESERVED_HEIGHT;\n\n    doc.addImage(\n      footerImg.dataUrl,\n      'PNG',\n      0,\n      pageHeight - footerHeight,\n      pageWidth,\n      footerHeight,\n    );\n  };"""
if old_footer not in text:
    raise SystemExit('drawPdfFooter snippet not found')
text = text.replace(old_footer, new_footer, 1)

old_call = 'for (let page = 1; page <= doc.getNumberOfPages(); page += 1) { doc.setPage(page); drawPdfFooter(doc); }'
new_call = 'for (let page = 1; page <= doc.getNumberOfPages(); page += 1) { doc.setPage(page); await drawPdfFooter(doc); }'
if old_call not in text:
    raise SystemExit('drawPdfFooter call not found')
text = text.replace(old_call, new_call, 1)

path.write_text(text, encoding='utf-8')
