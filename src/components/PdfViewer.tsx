"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
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
  const [scale, setScale] = useState(1.5);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const pdfjsLib = (await import("pdfjs-dist")).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      const pdf = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      if (cancelled) return;
      const page = await pdf.getPage(currentPage);
      if (cancelled) return;

      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    })();
    return () => { cancelled = true; };
  }, [pdfBytes, currentPage, scale]);

  useEffect(() => {
    const overlay = overlayRef.current;
    const base = canvasRef.current;
    if (!overlay || !base) return;
    overlay.width = base.width;
    overlay.height = base.height;
    const ctx = overlay.getContext("2d")!;
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    if (!wordOverlays?.length) return;
    ctx.strokeStyle = "rgba(59, 130, 246, 0.8)";
    ctx.fillStyle = "rgba(59, 130, 246, 0.1)";
    ctx.lineWidth = 1.5;
    for (const w of wordOverlays) {
      ctx.fillRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
      ctx.strokeRect(w.x0, w.y0, w.x1 - w.x0, w.y1 - w.y0);
    }
  }, [wordOverlays, canvasRef.current?.width]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative shadow-2xl rounded overflow-hidden">
        <canvas ref={canvasRef} className="block" />
        <canvas ref={overlayRef} className="absolute inset-0 pointer-events-none" />
      </div>

      <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
        >
          {t("prev_page")}
        </button>
        <span>
          {t("page_label")} {currentPage} {t("of_label")} {totalPages}
        </span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 disabled:opacity-40 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
        >
          {t("next_page")}
        </button>
        <select
          value={scale}
          onChange={(e) => setScale(Number(e.target.value))}
          className="ml-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
        >
          {[0.75, 1, 1.25, 1.5, 2].map((s) => (
            <option key={s} value={s}>{Math.round(s * 100)}%</option>
          ))}
        </select>
      </div>
    </div>
  );
});

export default PdfViewer;
