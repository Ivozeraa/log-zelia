import { toast } from 'react-toastify'
import { jsPDF } from 'jspdf'

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

patchJsPdfSaveFilename()

export const notify = {
  success: (msg) => toast.success(msg),
  error: (msg) => toast.error(msg),
  warning: (msg) => toast.warning(msg),
  info: (msg) => toast.info(msg),
}
