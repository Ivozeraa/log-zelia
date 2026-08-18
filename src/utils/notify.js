import { toast } from 'react-toastify'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import logoImg from '../assets/images/logoEEEP.png'
import { addPdfFooter } from './pdfFooterPatch'

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

const getFinalReportFilename = (doc, filename) => {
  const original = String(filename || '')
  const body = getUsersRows(doc)
  const year = new Date().getFullYear()

  if (original.startsWith('relatorio-alunos-')) {
    const turmas = [...new Set(
      body.map((row) => String(getTableCellRaw(row, 2) || '').trim()).filter((turma) => turma && turma !== '—'),
    )]
    const turmaLabel = turmas.length === 1 ? turmas[0] : 'Todas as Turmas'
    return `Relatório de Ocorrências - ${turmaLabel} - ${year}.pdf`
  }

  if (original === 'usuarios.pdf') {
    const escolas = [...new Set(
      body.map((row) => String(getTableCellRaw(row, 3) || '').trim()).filter((escola) => escola && escola !== '—'),
    )]
    const escolaLabel = escolas.length === 1 ? escolas[0] : 'Todas as Escolas'
    return `Relatório de Usuários - ${escolaLabel}.pdf`
  }

  return original
}

const drawFittedText = (doc, text, { x, y, maxWidth, fontSize, minFontSize = 8, align = 'left' }) => {
  const value = String(text || '')
  let currentSize = fontSize
  doc.setFontSize(currentSize)

  while (currentSize > minFontSize && doc.getTextWidth(value) > maxWidth) {
    currentSize -= 0.5
    doc.setFontSize(currentSize)
  }

  doc.text(value, x, y, { align, maxWidth })
}

const createStyledUsersPdf = async (sourceDoc) => {
  const rows = getUsersRows(sourceDoc).map((row) => [
    getTableCellRaw(row, 0) || '—',
    getTableCellRaw(row, 1) || '—',
    getTableCellRaw(row, 2) || '—',
    getTableCellRaw(row, 3) || '—',
    getTableCellRaw(row, 4) || 'Não',
  ])

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 36
  const today = new Date().toLocaleDateString('pt-BR')
  const schoolNames = [...new Set(rows.map((row) => String(row[3]).trim()).filter((name) => name && name !== '—'))]
  const schoolName = schoolNames.length === 1 ? schoolNames[0] : 'Todas as escolas'
  const reportTitle = 'RELATÓRIO DE USUÁRIOS'

  doc.setFillColor(35, 146, 74)
  doc.rect(0, 0, pageWidth, 8, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.8)
  doc.line(margin, 92, pageWidth - margin, 92)

  try {
    doc.addImage(logoImg, 'PNG', margin, 18, 56, 56)
  } catch (error) {
    console.warn('Logo da escola não pôde ser adicionada ao relatório:', error)
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  drawFittedText(doc, schoolName, {
    x: margin + 70,
    y: 35,
    maxWidth: 225,
    fontSize: 14,
    minFontSize: 9,
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(71, 85, 105)
  doc.text('LogView • Gestão escolar', margin + 70, 53)
  doc.text(`Emitido em ${today}`, margin + 70, 69)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(22, 101, 52)
  drawFittedText(doc, reportTitle, {
    x: pageWidth - margin,
    y: 35,
    maxWidth: 220,
    fontSize: 13,
    minFontSize: 10,
    align: 'right',
  })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(100, 116, 139)
  doc.text(`${rows.length} registro(s) no relatório`, pageWidth - margin, 53, { align: 'right' })

  autoTable(doc, {
    head: [['Nome', 'E-mail', 'Função', 'Escola', 'PDT']],
    body: rows,
    startY: 108,
    margin: { top: 108, left: margin, right: margin, bottom: 62 },
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
      halign: 'left',
      cellPadding: 6,
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    bodyStyles: { minCellHeight: 23 },
    columnStyles: {
      0: { cellWidth: 118, fontStyle: 'bold' },
      1: { cellWidth: 145 },
      2: { cellWidth: 80 },
      3: { cellWidth: 105 },
      4: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const value = String(data.cell.raw || '').toLowerCase()
        data.cell.styles.textColor = value === 'sim' ? [21, 128, 61] : [100, 116, 139]
      }
    },
    willDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFillColor(35, 146, 74)
        doc.rect(0, 0, pageWidth, 8, 'F')
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(71, 85, 105)
        drawFittedText(doc, schoolName, { x: margin, y: 28, maxWidth: 235, fontSize: 9, minFontSize: 7 })
        drawFittedText(doc, reportTitle, { x: pageWidth - margin, y: 28, maxWidth: 220, fontSize: 9, minFontSize: 7, align: 'right' })
        doc.setDrawColor(226, 232, 240)
        doc.line(margin, 38, pageWidth - margin, 38)
      }
    },
  })

  await addPdfFooter(doc)
  return doc
}

const patchJsPdfSave = () => {
  if (!jsPDF?.API?.save || jsPDF.API.__logviewSavePatch) return

  const originalSave = jsPDF.API.save
  jsPDF.API.save = async function patchedSave(filename, options) {
    if (isUsersPdf(this, filename) && !this.__logviewSavingStyledUsersPdf) {
      this.__logviewSavingStyledUsersPdf = true
      try {
        const styledDoc = await createStyledUsersPdf(this)
        const finalFilename = getFinalReportFilename(this, filename)
        return originalSave.call(styledDoc, finalFilename, options)
      } finally {
        this.__logviewSavingStyledUsersPdf = false
      }
    }

    const finalFilename = getFinalReportFilename(this, filename)
    return originalSave.call(this, finalFilename, options)
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
