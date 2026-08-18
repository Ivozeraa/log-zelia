import { toast } from 'react-toastify'
import { jsPDF } from 'jspdf'
import { setDefaults } from 'jspdf-autotable'
import logoImg from '../assets/images/logoEEEP.png'

const getTableCellRaw = (row, index) => {
  if (Array.isArray(row?.raw)) return row.raw[index]
  return row?.cells?.[index]?.raw ?? row?.cells?.[String(index)]?.raw ?? ''
}

const getFinalReportFilename = (doc, filename) => {
  const original = String(filename || '')
  const body = Array.isArray(doc?.lastAutoTable?.body) ? doc.lastAutoTable.body : []
  const year = new Date().getFullYear()

  if (original.startsWith('relatorio-alunos-')) {
    const turmas = [...new Set(
      body
        .map((row) => String(getTableCellRaw(row, 2) || '').trim())
        .filter((turma) => turma && turma !== '—'),
    )]

    const turmaLabel = turmas.length === 1 ? turmas[0] : 'Todas as Turmas'
    return `Relatório de Ocorrências - ${turmaLabel} - ${year}.pdf`
  }

  if (original === 'usuarios.pdf') {
    const escolas = [...new Set(
      body
        .map((row) => String(getTableCellRaw(row, 3) || '').trim())
        .filter((escola) => escola && escola !== '—'),
    )]

    const escolaLabel = escolas.length === 1 ? escolas[0] : 'Todas as Escolas'
    return `Relatório de Usuários - ${escolaLabel}.pdf`
  }

  return original
}

const patchJsPdfSaveFilename = () => {
  if (!jsPDF?.API?.save || jsPDF.API.__logviewFilenamePatch) return

  const originalSave = jsPDF.API.save
  jsPDF.API.save = function patchedSave(filename, options) {
    return originalSave.call(this, getFinalReportFilename(this, filename), options)
  }

  jsPDF.API.__logviewFilenamePatch = true
}

const getHeadValues = (table) => {
  const headRow = table?.head?.[0]
  if (!headRow) return []

  if (Array.isArray(headRow?.raw)) return headRow.raw.map((value) => String(value ?? '').trim())
  return Object.values(headRow?.cells || {}).map((cell) => String(cell?.raw ?? cell?.text?.[0] ?? '').trim())
}

const isUsersReport = (table) => {
  const headers = getHeadValues(table)
  return headers.length >= 5 && headers[0] === 'Nome' && headers[1] === 'E-mail' && headers[2] === 'Função' && headers[3] === 'Escola' && headers[4] === 'PDT'
}

const getUserReportSchoolName = (table) => {
  const schools = [...new Set(
    (table?.body || [])
      .map((row) => String(getTableCellRaw(row, 3) || '').trim())
      .filter((school) => school && school !== '—'),
  )]

  return schools.length === 1 ? schools[0] : 'Todas as escolas'
}

const drawFittedPdfText = (doc, text, { x, y, maxWidth, fontSize, minFontSize = 8, align = 'left' }) => {
  const value = String(text || '')
  let currentSize = fontSize

  doc.setFontSize(currentSize)
  while (currentSize > minFontSize && doc.getTextWidth(value) > maxWidth) {
    currentSize -= 0.5
    doc.setFontSize(currentSize)
  }

  doc.text(value, x, y, { align, maxWidth })
}

const configureUsersPdfDefaults = () => {
  setDefaults({
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
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    bodyStyles: {
      minCellHeight: 23,
    },
    willDrawPage: (data) => {
      if (!isUsersReport(data.table)) return

      const { doc, pageNumber, cursor } = data
      const pageWidth = doc.internal.pageSize.getWidth()
      const margin = 36
      const schoolName = getUserReportSchoolName(data.table)
      const today = new Date().toLocaleDateString('pt-BR')
      const reportTitle = 'RELATÓRIO DE USUÁRIOS'

      doc.setFillColor(255, 255, 255)
      doc.rect(0, 0, pageWidth, 108, 'F')
      doc.setFillColor(35, 146, 74)
      doc.rect(0, 0, pageWidth, 8, 'F')
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.8)

      if (pageNumber === 1) {
        doc.line(margin, 92, pageWidth - margin, 92)

        try {
          doc.addImage(logoImg, 'PNG', margin, 18, 56, 56)
        } catch (error) {
          console.warn('Logo da escola não pôde ser adicionada ao relatório:', error)
        }

        doc.setTextColor(15, 23, 42)
        doc.setFont('helvetica', 'bold')
        drawFittedPdfText(doc, schoolName, {
          x: margin + 70,
          y: 35,
          maxWidth: 225,
          fontSize: 14,
          minFontSize: 9,
        })

        doc.setFontSize(10)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(71, 85, 105)
        doc.text('LogView • Gestão escolar', margin + 70, 53)
        doc.text(`Emitido em ${today}`, margin + 70, 69)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(22, 101, 52)
        drawFittedPdfText(doc, reportTitle, {
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
        doc.text(`${data.table.body?.length || 0} registro(s) no relatório`, pageWidth - margin, 53, { align: 'right' })
      } else {
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(71, 85, 105)
        drawFittedPdfText(doc, schoolName, {
          x: margin,
          y: 28,
          maxWidth: 235,
          fontSize: 9,
          minFontSize: 7,
        })
        drawFittedPdfText(doc, reportTitle, {
          x: pageWidth - margin,
          y: 28,
          maxWidth: 220,
          fontSize: 9,
          minFontSize: 7,
          align: 'right',
        })
        doc.line(margin, 38, pageWidth - margin, 38)
      }

      if (cursor) {
        cursor.x = margin
        cursor.y = pageNumber === 1 ? 108 : 50
      }
    },
    didParseCell: (data) => {
      if (!isUsersReport(data.table) || data.section !== 'body') return

      if (data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold'
      }

      if (data.column.index === 4) {
        const value = String(data.cell.raw || '').toLowerCase()
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.halign = 'center'
        data.cell.styles.textColor = value === 'sim' ? [21, 128, 61] : [100, 116, 139]
      }
    },
    didDrawPage: (data) => {
      if (!isUsersReport(data.table)) return

      const { doc } = data
      const pageWidth = doc.internal.pageSize.getWidth()
      const pageHeight = doc.internal.pageSize.getHeight()
      const margin = 36

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
}

patchJsPdfSaveFilename()
configureUsersPdfDefaults()

export const notify = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  warning: (msg) => toast.warning(msg),
  info: (msg) => toast.info(msg),
}
