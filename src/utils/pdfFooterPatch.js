import topoMiniImg from '../assets/images/topo_mini.png';

const PDF_FOOTER_HEIGHT = 18;
const REPORT_FILENAME_PATCH_VERSION = '2';

const DISCIPLINE_ABBREVIATIONS = {
  EF: 'ED. FIS',
  MF: 'MAT. FIN',
  LP: 'LÍNG. PORT',
  LI: 'LÍNG. ING',
  FPAAC: 'F. CIDAD.',
  MC: 'MET. CIE.',
  FDI: 'FUN. INF.',
  PDS: 'PRO. SIS',
};

const escapePdfText = (value = '') => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\(/g, '\\(')
  .replace(/\)/g, '\\)')
  .replace(/\r?\n/g, ' ');

export const normalizeDisciplineText = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toUpperCase();

export const abbreviateDiscipline = (nome = '') => {
  const original = String(nome).trim();
  if (!original) return '';

  const normalized = normalizeDisciplineText(original);
  const exceptions = {
    'EDUCACAO FISICA': 'ED. FIS',
    'LINGUA PORTUGUESA': 'LÍNG. PORT',
    'LINGUA INGLESA': 'LÍNG. ING',
    'LINGUA ESTRANGEIRA INGLES': 'LÍNG. ING',
    'MATEMATICA FINANCEIRA': 'MAT. FIN',
    'FORMACAO PARA A CIDADANIA': 'F. CIDAD.',
    'METODOLOGIA CIENTIFICA': 'MET. CIE.',
    'FUNDAMENTOS DA INFORMATICA': 'FUN. INF.',
    'PROGRAMACAO DE SISTEMAS': 'PRO. SIS',
  };
  if (exceptions[normalized]) return exceptions[normalized];

  const stopWords = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'PARA', 'E']);
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3);

  const relevant = words.filter((word) => word.length > 1 && !stopWords.has(word));
  const source = relevant.length ? relevant : words;
  const parts = source.map((word) => word.slice(0, 3));
  return parts.join('. ');
};

const patchPdfDisciplineLabels = (doc) => {
  const pages = doc?.internal?.pages;
  if (!Array.isArray(pages)) return;

  const replacements = Object.entries(DISCIPLINE_ABBREVIATIONS);
  if (!replacements.length) return;

  for (let pageIndex = 1; pageIndex < pages.length; pageIndex += 1) {
    const page = pages[pageIndex];
    if (!Array.isArray(page)) continue;

    pages[pageIndex] = page.map((operation) => {
      if (typeof operation !== 'string' || !operation.includes('Tj')) return operation;

      let patched = operation;
      for (const [initials, abbreviation] of replacements) {
        const escapedInitials = escapePdfText(initials);
        const escapedAbbreviation = escapePdfText(abbreviation);
        const pattern = new RegExp(`\\(${escapedInitials}\\s*-\\s*`, 'g');
        patched = patched.replace(pattern, `(${escapedAbbreviation} - `);
      }
      return patched;
    });
  }
};

const loadImageAsDataUrl = async (url) => {
  if (!url || typeof window === 'undefined') return null;

  const img = new Image();
  img.crossOrigin = 'anonymous';
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return canvas.toDataURL('image/png');
};

const getTableCellRaw = (row, index) => {
  if (Array.isArray(row?.raw)) return row.raw[index];
  return row?.cells?.[index]?.raw ?? row?.cells?.[String(index)]?.raw ?? '';
};

const getReportFilename = (doc, originalFilename) => {
  const filename = String(originalFilename || '');
  const tableBody = Array.isArray(doc?.lastAutoTable?.body)
    ? doc.lastAutoTable.body
    : [];
  const currentYear = new Date().getFullYear();

  if (filename.startsWith('relatorio-alunos-')) {
    const turmaNames = [...new Set(
      tableBody
        .map((row) => String(getTableCellRaw(row, 2) || '').trim())
        .filter((turma) => turma && turma !== '—'),
    )];

    const turmaLabel = turmaNames.length === 1 ? turmaNames[0] : 'Todas as Turmas';
    return `Relatório de Ocorrências - ${turmaLabel} - ${currentYear}.pdf`;
  }

  if (filename === 'usuarios.pdf') {
    const schoolNames = [...new Set(
      tableBody
        .map((row) => String(getTableCellRaw(row, 3) || '').trim())
        .filter((school) => school && school !== '—'),
    )];

    const schoolLabel = schoolNames.length === 1 ? schoolNames[0] : 'Todas as Escolas';
    return `Relatório de Usuários - ${schoolLabel}.pdf`;
  }

  return filename;
};

const patchReportSaveFilename = (doc) => {
  if (!doc || doc.__logviewReportSaveFilenamePatched === REPORT_FILENAME_PATCH_VERSION || typeof doc.save !== 'function') return;

  const originalSave = doc.save.bind(doc);
  doc.save = (filename, options) => originalSave(getReportFilename(doc, filename), options);
  doc.__logviewReportSaveFilenamePatched = REPORT_FILENAME_PATCH_VERSION;
};

export const addPdfFooter = async (doc) => {
  patchPdfDisciplineLabels(doc);
  patchReportSaveFilename(doc);

  const footerDataUrl = await loadImageAsDataUrl(topoMiniImg);
  if (!footerDataUrl) throw new Error('Imagem topo_mini.png não foi carregada.');

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let page = 1; page <= doc.getNumberOfPages(); page += 1) {
    doc.setPage(page);
    doc.addImage(
      footerDataUrl,
      'PNG',
      0,
      pageHeight - PDF_FOOTER_HEIGHT,
      pageWidth,
      PDF_FOOTER_HEIGHT,
    );
  }
};

export { PDF_FOOTER_HEIGHT };
