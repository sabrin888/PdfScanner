"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useI18n } from "@/context/I18nContext";

interface Props {
  pdfBytes: Uint8Array;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  wordOverlays?: Array<{ x0: number; y0: number; x1: number; y1: number; text: string }>;
}

export interface PdfViewerHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer(
  { pdfBytes, currentPage, totalPages, onPageChange, wordOverlays },
  ref
) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // pdfjs-dist v5 uses named exports — do NOT use .default
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      if (cancelled) return;
      const page = await pdf.getPage(currentPage);
      if (cancelled) return;

      // Calculate scale to fill container width
      const containerWidth = containerRef.current?.clientWidth ?? 600;
      const baseViewport = page.getViewport({ scale: 1 });
      const scale = Math.min((containerWidth - 8) / baseViewport.width, 2.5);

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;

      // pdfjs v5 render signature requires canvas + canvasContext
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    })();
    return () => { cancelled = true; };
  }, [pdfBytes, currentPage]);

  // Draw word overlays on top
  useEffect(() => {
    const overlay = overlayRef.current;
    const base = canvasRef.current;
    if (!overlay || !base) return;
    overlay.width = base.width;
    overlay.height = base.height;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!wordOverlays?.length) return;
    ctx.strokeStyle = "rgba(59, 130, 246, 0.9)";
    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    ctx.lineWidth = 1.5;
    for (const w of wordOverlays) {
      ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
      ctx.strokeRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
    }
  }, [wordOverlays]);

  const safeTotal = totalPages || 1;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Canvas area */}
      <div ref={containerRef} className="w-full flex justify-center">
        <div className="relative shadow-xl rounded overflow-hidden bg-white">
          <canvas ref={canvasRef} className="block max-w-full" />
          <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />
        </div>
      </div>

      {/* Page controls */}
      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 flex-wrap justify-center">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
        >
          ←
        </button>
        <span className="px-2">
          {t("page_label")} <strong>{currentPage}</strong> {t("of_label")} {safeTotal}
        </span>
        <button
          onClick={() => onPageChange(Math.min(safeTotal, currentPage + 1))}
          disabled={currentPage >= safeTotal}
          className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
        >
          →
        </button>
      </div>
    </div>
  );
});

export default PdfViewer;
