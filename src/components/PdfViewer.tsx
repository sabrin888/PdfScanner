"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { useI18n } from "@/context/I18nContext";
import type { OcrWord } from "@/lib/ocr";

interface Props {
  pdfBytes: Uint8Array;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  wordOverlays?: OcrWord[];
  selectedWord?: OcrWord | null;
  /** "select-word": clicking overlay selects the word under the cursor
   *  "place-sign": clicking anywhere reports CSS coordinates */
  clickMode?: "select-word" | "place-sign" | null;
  onWordClick?: (word: OcrWord) => void;
  onCanvasClick?: (cssX: number, cssY: number) => void;
}

export interface PdfViewerHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer(
  { pdfBytes, currentPage, totalPages, onPageChange, wordOverlays, selectedWord, clickMode, onWordClick, onCanvasClick },
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

      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) }).promise;
      if (cancelled) return;
      const page = await pdf.getPage(currentPage);
      if (cancelled) return;

      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      const containerWidth = containerRef.current?.clientWidth ?? 680;
      const dpr = window.devicePixelRatio || 1;
      const baseViewport = page.getViewport({ scale: 1 });

      const cssWidth = Math.min(containerWidth - 4, 900);
      const scale = cssWidth / baseViewport.width;

      const viewport = page.getViewport({ scale: scale * dpr });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${(viewport.height / dpr)}px`;

      const ctx = canvas.getContext("2d")!;
      await page.render({ canvasContext: ctx, viewport }).promise;
    })();
    return () => { cancelled = true; };
  }, [pdfBytes, currentPage]);

  // Draw word overlays and selected word highlight
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

    const dpr = window.devicePixelRatio || 1;

    if (wordOverlays?.length) {
      ctx.strokeStyle = "rgba(59,130,246,0.9)";
      ctx.fillStyle = "rgba(59,130,246,0.15)";
      ctx.lineWidth = 1.5 * dpr;
      for (const w of wordOverlays) {
        ctx.fillRect(w.x0 * dpr, w.y0 * dpr, (w.x1 - w.x0) * dpr, (w.y1 - w.y0) * dpr);
        ctx.strokeRect(w.x0 * dpr, w.y0 * dpr, (w.x1 - w.x0) * dpr, (w.y1 - w.y0) * dpr);
      }
    }

    // Orange highlight for selected word
    if (selectedWord) {
      const sw = selectedWord;
      ctx.fillStyle = "rgba(234,88,12,0.3)";
      ctx.strokeStyle = "rgba(234,88,12,1)";
      ctx.lineWidth = 2 * dpr;
      ctx.fillRect(sw.x0 * dpr, sw.y0 * dpr, (sw.x1 - sw.x0) * dpr, (sw.y1 - sw.y0) * dpr);
      ctx.strokeRect(sw.x0 * dpr, sw.y0 * dpr, (sw.x1 - sw.x0) * dpr, (sw.y1 - sw.y0) * dpr);
    }
  }, [wordOverlays, selectedWord]);

  function handleOverlayClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const cssX = e.clientX - rect.left;
    const cssY = e.clientY - rect.top;

    if (clickMode === "place-sign" && onCanvasClick) {
      onCanvasClick(cssX, cssY);
      return;
    }

    if (clickMode === "select-word" && onWordClick && wordOverlays?.length) {
      const dpr = window.devicePixelRatio || 1;
      // word bboxes are in physical pixels; click offsetX/Y are CSS pixels → convert
      const physX = cssX * dpr;
      const physY = cssY * dpr;
      for (const w of wordOverlays) {
        if (physX >= w.x0 && physX <= w.x1 && physY >= w.y0 && physY <= w.y1) {
          onWordClick(w);
          return;
        }
      }
    }
  }

  const safeTotal = totalPages || 1;
  const cursorStyle =
    clickMode === "select-word" ? "pointer" :
    clickMode === "place-sign" ? "crosshair" :
    "default";

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div ref={containerRef} className="w-full flex justify-center">
        <div className="relative shadow-xl rounded overflow-hidden bg-white">
          <canvas ref={canvasRef} className="block" />
          <canvas
            ref={overlayRef}
            className="absolute inset-0"
            style={{
              pointerEvents: clickMode ? "auto" : "none",
              cursor: cursorStyle,
            }}
            onClick={handleOverlayClick}
          />
          {/* Click-mode hint banner */}
          {clickMode && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none select-none whitespace-nowrap">
              {clickMode === "select-word"
                ? t("hint_click_word")
                : t("hint_click_place")}
            </div>
          )}
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
