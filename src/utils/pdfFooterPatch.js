import { jsPDF } from 'jspdf';

const PDF_FOOTER_HEIGHT = 18;
const TOPO_MINI_URL = 'https://raw.githubusercontent.com/Ivozeraa/log-zelia/main/src/assets/images/topo_mini.png';

const loadImageAsDataUrl = async (url) => {
  if (!url || typeof window === 'undefined') return null;

  const response = await fetch(url, { mode: 'cors', cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Falha ao carregar footer: HTTP ${response.status}`);
  }

  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

export const addPdfFooter = async (doc) => {
  const footerDataUrl = await loadImageAsDataUrl(TOPO_MINI_URL);
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
