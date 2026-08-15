const PDF_FOOTER_HEIGHT = 18;
import topoMiniImg from '../assets/images/topo_mini.png';

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

export const addPdfFooter = async (doc) => {
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
