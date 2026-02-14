'use client';

import { useEffect, useRef, useCallback } from 'react';

interface PDFRendererProps {
  fileDataUrl: string;
  fileType: 'pdf' | 'image';
  currentPage: number; // 0-indexed
  onDimensionsChange: (width: number, height: number) => void;
}

export function PDFRenderer({ fileDataUrl, fileType, currentPage, onDimensionsChange }: PDFRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfDocRef = useRef<any>(null);
  const renderTaskRef = useRef<any>(null);
  const renderingRef = useRef(false);

  const renderPDFPage = useCallback(async (pageIndex: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      try { renderTaskRef.current.cancel(); } catch {}
      renderTaskRef.current = null;
    }

    // Wait for any ongoing render to fully finish
    if (renderingRef.current) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    if (!pdfDocRef.current) {
      const pdfjsLib = await import('pdfjs-dist');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';
      pdfDocRef.current = await pdfjsLib.getDocument(fileDataUrl).promise;
    }

    const pdf = pdfDocRef.current;
    const page = await pdf.getPage(pageIndex + 1); // pdfjs is 1-indexed
    const scale = 2; // Retina
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.width = `${viewport.width / scale}px`;
    canvas.style.height = `${viewport.height / scale}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    renderingRef.current = true;
    const renderTask = page.render({ canvasContext: ctx, viewport });
    renderTaskRef.current = renderTask;

    try {
      await renderTask.promise;
      onDimensionsChange(viewport.width / scale, viewport.height / scale);
    } catch (e: any) {
      // Ignore cancellation errors
      if (e?.name !== 'RenderingCancelledException') {
        console.error('PDF render error:', e);
      }
    } finally {
      renderingRef.current = false;
      renderTaskRef.current = null;
    }
  }, [fileDataUrl, onDimensionsChange]);

  const renderImage = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const img = new window.Image();
    img.onload = () => {
      const scale = 2; // Retina
      // Constrain to reasonable max dimensions
      const maxDim = 1200;
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }

      canvas.width = w * scale;
      canvas.height = h * scale;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;

      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      onDimensionsChange(w, h);
    };
    img.src = fileDataUrl;
  }, [fileDataUrl, onDimensionsChange]);

  useEffect(() => {
    if (fileType === 'pdf') {
      renderPDFPage(currentPage);
    } else {
      renderImage();
    }

    return () => {
      // Cleanup: cancel in-progress render on unmount or re-render
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch {}
        renderTaskRef.current = null;
      }
    };
  }, [fileType, currentPage, renderPDFPage, renderImage]);

  return (
    <canvas
      ref={canvasRef}
      className="block"
      style={{ pointerEvents: 'none' }}
    />
  );
}
