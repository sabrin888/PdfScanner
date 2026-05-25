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
  /** Returns the canvas rendered at full pixel resolution (may be dpr×CSS size) */
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

  useImperativeHandle(ref, () => ({ getCanvas: () => canvasRef.current }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      // Pass a COPY — pdfjs transfers the buffer to its worker and detaches it,
      // which would corrupt the bytes we keep in React state for editing.
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
      if (cancelled) return;
      const page = await pdf.getPage(currentPage);
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      // Fit to container width, then multiply by devicePixelRatio for sharp rendering
      const containerWidth = containerRef.current?.clientWidth ?? 680;
      const dpr = window.devicePixelRatio || 1;
      const baseViewport = page.getViewport({ scale: 1 });

      // CSS display width = fill container (max 900px so large monitors don't over-stretch)
      const cssWidth = Math.min(containerWidth - 4, 900);
      const scale = cssWidth / baseViewport.width;

      // Physical canvas pixels = CSS size × dpr (crisp on Retina / high-DPI)
      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      // CSS size tells the browser how large to *display* it
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${(viewport.height / dpr)}px`;

      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => { cancelled = true; };
  }, [pdfBytes, currentPage]);

  // Draw word-find overlays on the overlay canvas (same physical size as base)
  useEffect(() => {
    const overlay = overlayRef.current;
    const base = canvasRef.current;
    if (!overlay || !base) return;
    overlay.width = base.width;
    overlay.height = base.height;
    overlay.style.width = base.style.width;
    overlay.style.height = base.style.height;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!wordOverlays?.length) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.strokeStyle = "rgba(59,130,246,0.9)";
    ctx.fillStyle = "rgba(59,130,246,0.15)";
    ctx.lineWidth = 1.5 * dpr;
    for (const w of wordOverlays) {
      ctx.fillRect(w.x0 * dpr, w.y0 * dpr, (w.x1 - w.x0) * dpr, (w.y1 - w.y0) * dpr);
      ctx.strokeRect(w.x0 * dpr, w.y0 * dpr, (w.x1 - w.x0) * dpr, (w.y1 - w.y0) * dpr);
    }
  }, [wordOverlays]);

  const safeTotal = totalPages || 1;

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div ref={containerRef} className="w-full flex justify-center">
        <div className="relative shadow-xl rounded overflow-hidden bg-white">
          <canvas ref={canvasRef} className="block" />
          <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 flex-wrap justify-center pb-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
        >
          ←
        </button>
        <span className="px-2 font-medium">
          {t("page_label")} {currentPage} {t("of_label")} {safeTotal}
        </span>
        <button
          onClick={() => onPageChange(Math.min(safeTotal, currentPage + 1))}
          disabled={currentPage >= safeTotal}
          className="px-4 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-700 disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors font-medium"
        >
          →
        </button>
      </div>
    </div>
  );
});

export default PdfViewer;
