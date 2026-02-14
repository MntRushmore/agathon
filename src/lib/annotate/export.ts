import { jsPDF } from 'jspdf';
import type { Annotation, PageAnnotations } from './types';
import { renderAllAnnotations } from './drawing';

/**
 * Renders a single PDF page with annotations baked in onto a canvas,
 * then returns the canvas as an image data URL.
 */
async function renderPageWithAnnotations(
  fileDataUrl: string,
  pageIndex: number,
  annotations: Annotation[],
): Promise<{ dataUrl: string; width: number; height: number }> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

  const pdf = await pdfjsLib.getDocument(fileDataUrl).promise;
  const page = await pdf.getPage(pageIndex + 1);
  const scale = 2;
  const viewport = page.getViewport({ scale });

  // Create a canvas for the PDF page
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;

  // Render the PDF page
  await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;

  // Now overlay annotations at the same scale
  ctx.save();
  ctx.scale(scale, scale);
  renderAllAnnotations(ctx, annotations);
  ctx.restore();

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.92),
    width: viewport.width / scale,
    height: viewport.height / scale,
  };
}

/**
 * Renders an image file with annotations baked in.
 */
async function renderImageWithAnnotations(
  fileDataUrl: string,
  annotations: Annotation[],
): Promise<{ dataUrl: string; width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxDim = 1200;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;

      // Draw image
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Overlay annotations
      ctx.save();
      ctx.scale(scale, scale);
      renderAllAnnotations(ctx, annotations);
      ctx.restore();

      resolve({
        dataUrl: canvas.toDataURL('image/jpeg', 0.92),
        width: w,
        height: h,
      });
    };
    img.src = fileDataUrl;
  });
}

/**
 * Exports the annotated document as a PDF file and triggers download.
 */
export async function exportAnnotatedPDF(
  fileDataUrl: string,
  fileType: 'pdf' | 'image',
  totalPages: number,
  annotations: PageAnnotations,
): Promise<void> {
  let doc: jsPDF | null = null;

  if (fileType === 'pdf') {
    for (let i = 0; i < totalPages; i++) {
      const pageAnnotations = annotations[i] || [];
      const { dataUrl, width, height } = await renderPageWithAnnotations(
        fileDataUrl,
        i,
        pageAnnotations,
      );

      if (i === 0) {
        doc = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height],
        });
      } else {
        doc!.addPage([width, height], width > height ? 'landscape' : 'portrait');
      }

      doc!.addImage(dataUrl, 'JPEG', 0, 0, width, height);
    }
  } else {
    // Image file
    const pageAnnotations = annotations[0] || [];
    const { dataUrl, width, height } = await renderImageWithAnnotations(
      fileDataUrl,
      pageAnnotations,
    );

    doc = new jsPDF({
      orientation: width > height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [width, height],
    });

    doc.addImage(dataUrl, 'JPEG', 0, 0, width, height);
  }

  if (doc) {
    doc.save('annotated-document.pdf');
  }
}
