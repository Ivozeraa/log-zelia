import { jsPDF } from 'jspdf';
import topoMiniImg from '../assets/images/topo_mini.png';

const PDF_FOOTER_HEIGHT = 18;
let patched = false;

const loadImageAsDataUrl = (url) => new Promise((resolve) => {
  if (!url) {
    resolve(null);
    return;
  }

  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    } catch (error) {
      console.error('Não foi possível preparar o footer do PDF:', error);
      resolve(null);
    }
  };
  img.onerror = () => resolve(null);
  img.src = url;
});

const addFooterToPdf = async (doc) => {
  const footerDataUrl = await loadImageAsDataUrl(topoMiniImg);
  if (!footerDataUrl) return;

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

if (!patched && typeof jsPDF?.prototype?.save === 'function') {
  patched = true;
  const originalSave = jsPDF.prototype.save;

  jsPDF.prototype.save = async function patchedSave(...args) {
    const filename = String(args[0] || '');

    if (filename.startsWith('horario_')) {
      try {
        await addFooterToPdf(this);
      } catch (error) {
        console.error('Não foi possível adicionar o footer ao PDF:', error);
      }
    }

    return originalSave.apply(this, args);
  };
}
