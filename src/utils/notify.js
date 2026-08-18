import { toast } from 'react-toastify'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoImg from '../assets/images/logoEEEP.png'

const getTableCellRaw = (row, index) => {
  if (Array.isArray(row?.raw)) return row.raw[index]
  return row?.cells?.[index]?.raw ?? row?.cells?.[String(index)]?.raw ?? ''
}

const getUsersRows = (doc) => Array.isArray(doc?.lastAutoTable?.body) ? doc.lastAutoTable.body : []

const isUsersPdf = (doc, filename) => {
  if (filename !== 'usuarios.pdf') return false
  const head = doc?.lastAutoTable?.head?.[0]
  if (!head) return false

  const values = Array.isArray(head?.raw)
    ? head.raw.map((value) => String(value ?? '').trim())
    : Object.values(head?.cells || {}).map((cell) => String(cell?.raw ?? cell?.text?.[0] ?? '').trim())

  return values.length >= 5 &&
    values[0] === 'Nome' &&
    values[1] === 'E-mail' &&
    values[2] === 'Função' &&
    values[3] === 'Escola' &&
    values[4] === 'PDT'
}

const fitText = (doc, value, x, y, maxWidth, size, minSize, align = 'left') => {
  const text = String(value || '')
  let current = size
  doc.setFontSize(current)

  while (current > minSize && doc.getTextWidth(text) > maxWidth) {
    current -= 0.5
    doc.setFontSize(current)
  }

  doc.text(text, x, y, { align, maxWidth })
}

const getUserRowsForStyledPdf = (sourceDoc) => getUsersRows(sourceDoc).map((row) => [
  getTableCellRaw(row, 0) || '—',
  getTableCellRaw(row, 1) || '—',
  getTableCellRaw(row, 2) || '—',
  getTableCellRaw(row, 3) || '—',
  getTableCellRaw(row, 4) || 'Não',
  getTableCellRaw(row, 5) || '—',
])

const createStyledUsersPdf = (sourceDoc) => {
  const rows = getUserRowsForStyledPdf(sourceDoc)
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 36
  const today = new Date().toLocaleDateString('pt-BR')
  const schools = [...new Set(rows.map((row) => String(row[3]).trim()).filter((name) => name && name !== '—'))]
  const schoolName = schools.length === 1 ? schools[0] : 'Todas as escolas'
  const title = 'RELATÓRIO DE USUÁRIOS'

  doc.setFillColor(35, 146, 74)
  doc.rect(0, 0, pageWidth, 8, 'F')

  try {
    doc.addImage(logoImg, 'PNG', margin, 18, 56, 56)
  } catch (error) {
    console.warn('Logo da escola não pôde ser adicionada ao relatório:', error)
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  fitText(doc, schoolName, margin + 70, 35, 225, 14, 9)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(71, 85, 105)
  doc.setFontSize(10)
  doc.text('LogView • Gestão escolar', margin + 70, 53)
  doc.text(`Emitido em ${today}`, margin + 70, 69)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 101, 52)
  fitText(doc, title, pageWidth - margin, 35, 220, 13, 10, 'right')

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`${rows.length} registro(s) no relatório`, pageWidth - margin, 53, { align: 'right' })

  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.8)
  doc.line(margin, 92, pageWidth - margin, 92)

  autoTable(doc, {
    head: [['Nome', 'E-mail', 'Função', 'Escola', 'PDT', 'Criado em']],
    body: rows,
    startY: 108,
    margin: { top: 108, left: margin, right: margin, bottom: 48 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 5,
      lineColor: [226, 232, 240],
      lineWidth: 0.4,
      textColor: [30, 41, 59],
      overflow: 'linebreak',
      valign: 'middle',
    },
    headStyles: {
      fillColor: [35, 146, 74],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8.5,
      cellPadding: 6,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      minCellHeight: 23,
    },
    columnStyles: {
      0: { cellWidth: 112, fontStyle: 'bold' },
      1: { cellWidth: 145 },
      2: { cellWidth: 78 },
      3: { cellWidth: 105 },
      4: { cellWidth: 42, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 'auto', halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section !== 'body') return
      if (data.column.index === 4) {
        const value = String(data.cell.raw || '').toLowerCase()
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.halign = 'center'
        data.cell.styles.textColor = value === 'sim' ? [21, 128, 61] : [100, 116, 139]
      }
    },
    willDrawPage: (data) => {
      if (data.pageNumber <= 1) return

      doc.setFillColor(35, 146, 74)
      doc.rect(0, 0, pageWidth, 8, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(71, 85, 105)
      fitText(doc, schoolName, margin, 28, 235, 9, 7)
      fitText(doc, title, pageWidth - margin, 28, 220, 9, 7, 'right')
      doc.setDrawColor(226, 232, 240)
      doc.line(margin, 38, pageWidth - margin, 38)
    },
    didDrawPage: (data) => {
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.6)
      doc.line(margin, pageHeight - 34, pageWidth - margin, pageHeight - 34)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(100, 116, 139)
      doc.text('LogView • Gestão escolar', margin, pageHeight - 20)
      doc.text(`Página ${data.pageNumber}`, pageWidth - margin, pageHeight - 20, { align: 'right' })
    },
  })

  return doc
}

const getFinalReportFilename = (doc, filename) => {
  const original = String(filename || '')
  const body = getUsersRows(doc)
  const year = new Date().getFullYear()

  if (original.startsWith('relatorio-alunos-')) {
    const turmas = [...new Set(body.map((row) => String(getTableCellRaw(row, 2) || '').trim()).filter((turma) => turma && turma !== '—'))]
    const turmaLabel = turmas.length === 1 ? turmas[0] : 'Todas as Turmas'
    return `Relatório de Ocorrências - ${turmaLabel} - ${year}.pdf`
  }

  if (original === 'usuarios.pdf') {
    const escolas = [...new Set(body.map((row) => String(getTableCellRaw(row, 3) || '').trim()).filter((escola) => escola && escola !== '—'))]
    const escolaLabel = escolas.length === 1 ? escolas[0] : 'Todas as Escolas'
    return `Relatório de Usuários - ${escolaLabel}.pdf`
  }

  return original
}

const patchJsPdfSave = () => {
  if (!jsPDF?.API?.save || jsPDF.API.__logviewSavePatch) return

  const originalSave = jsPDF.API.save
  jsPDF.API.save = function patchedSave(filename, options) {
    if (isUsersPdf(this, filename) && !this.__logviewSavingStyledUsersPdf) {
      const finalFilename = getFinalReportFilename(this, filename)
      const styledDoc = createStyledUsersPdf(this)
      return originalSave.call(styledDoc, finalFilename, options)
    }

    return originalSave.call(this, getFinalReportFilename(this, filename), options)
  }

  jsPDF.API.__logviewSavePatch = true
}

patchJsPdfSave()

export const notify = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  warning: (msg) => toast.warning(msg),
  info: (msg) => toast.info(msg),
}
