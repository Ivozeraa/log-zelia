import { jsPDF } from 'jspdf';
import topoMiniImg from '../assets/images/topo_mini.png';

const PDF_FOOTER_HEIGHT = 18;
let patched = false;

const loadImageAsDataUrl = async (url) => {
  if (!url || typeof window === 'undefined') return null;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Falha ao carregar footer: HTTP ${response.status}`);

    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error('Não foi possível carregar o footer do PDF:', error);
    return null;
  }
};

// Pré-carrega a imagem assim que o módulo é importado. Isso evita o problema
// de chamar doc.save() antes que a imagem termine de ser carregada.
const footerDataUrlPromise = loadImageAsDataUrl(topoMiniImg);

const addFooterToPdf = async (doc) => {
  const footerDataUrl = await footerDataUrlPromise;
  if (!footerDataUrl) return false;

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

  return true;
};

if (!patched && typeof jsPDF?.prototype?.save === 'function') {
  patched = true;
  const originalSave = jsPDF.prototype.save;

  // O exportador atual não usa await em doc.save(). Portanto, o wrapper não
  // pode simplesmente ser async: precisamos segurar o save original até que
  // o footer esteja realmente incorporado ao documento.
  jsPDF.prototype.save = function patchedSave(...args) {
    const filename = String(args[0] || '');

    if (!filename.startsWith('horario_')) {
      return originalSave.apply(this, args);
    }

    void addFooterToPdf(this)
      .catch((error) => {
        console.error('Não foi possível adicionar o footer ao PDF:', error);
      })
      .finally(() => {
        originalSave.apply(this, args);
      });

    return this;
  };
}
