"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import { useI18n } from "@/context/I18nContext";

export interface Region { x: number; y: number; w: number; h: number }
export interface RgbColor { r: number; g: number; b: number }

interface Props {
  pdfBytes: Uint8Array;
  currentPage: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  /** "place-sign": single click reports a point.
   *  "drag-replace": drag a rectangle; reports the region + sampled bg colour. */
  clickMode?: "place-sign" | "drag-replace" | null;
  onCanvasClick?: (cssX: number, cssY: number) => void;
  onRegionSelected?: (rect: Region, bg: RgbColor) => void;
  /** Committed region to keep highlighted (e.g. while the user types the replacement) */
  selectedRegion?: Region | null;
}

export interface PdfViewerHandle {
  getCanvas: () => HTMLCanvasElement | null;
}

function sampleBackground(
  base: HTMLCanvasElement, rx: number, ry: number, rw: number, rh: number, dpr: number
): RgbColor {
  const ctx = base.getContext("2d", { willReadFrequently: true })!;
  const px = Math.max(0, Math.round(rx * dpr));
  const py = Math.max(0, Math.round(ry * dpr));
  const pw = Math.min(base.width - px, Math.round(rw * dpr));
  const ph = Math.min(base.height - py, Math.round(rh * dpr));
  if (pw <= 1 || ph <= 1) return { r: 255, g: 255, b: 255 };
  const data = ctx.getImageData(px, py, pw, ph).data;
  // Dominant colour = background (text/logos are a minority of pixels)
  const counts = new Map<string, number>();
  for (let i = 0; i < data.length; i += 4) {
    const key = `${data[i] & 0xf0},${data[i + 1] & 0xf0},${data[i + 2] & 0xf0}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  let best = "240,240,240", bestN = 0;
  counts.forEach((n, k) => { if (n > bestN) { bestN = n; best = k; } });
  let [r, g, b] = best.split(",").map((v) => Math.min(255, Number(v) + 8));
  // Snap near-white / near-black to pure values so the cover box is invisible
  // on the common plain-white (or solid-black) background.
  if (r >= 240 && g >= 240 && b >= 240) { r = g = b = 255; }
  else if (r <= 24 && g <= 24 && b <= 24) { r = g = b = 0; }
  return { r, g, b };
}

const PdfViewer = forwardRef<PdfViewerHandle, Props>(function PdfViewer(
  { pdfBytes, currentPage, totalPages, onPageChange, clickMode, onCanvasClick, onRegionSelected, selectedRegion },
  ref
) {
  const { t } = useI18n();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ active: boolean; sx: number; sy: number; cx: number; cy: number }>({
    active: false, sx: 0, sy: 0, cx: 0, cy: 0,
  });
  const [, forceRedraw] = useState(0);

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
      canvas.style.height = `${viewport.height / dpr}px`;
      const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
      await page.render({ canvasContext: ctx, viewport }).promise;
      drawOverlay();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfBytes, currentPage]);

  function drawOverlay() {
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

    // Live drag rectangle
    if (dragRef.current.active) {
      const { sx, sy, cx, cy } = dragRef.current;
      const x = Math.min(sx, cx), y = Math.min(sy, cy);
      const w = Math.abs(cx - sx), h = Math.abs(cy - sy);
      ctx.fillStyle = "rgba(59,130,246,0.15)";
      ctx.strokeStyle = "rgba(59,130,246,0.95)";
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([6 * dpr, 4 * dpr]);
      ctx.fillRect(x * dpr, y * dpr, w * dpr, h * dpr);
      ctx.strokeRect(x * dpr, y * dpr, w * dpr, h * dpr);
      ctx.setLineDash([]);
    } else if (selectedRegion) {
      const r = selectedRegion;
      ctx.fillStyle = "rgba(234,88,12,0.18)";
      ctx.strokeStyle = "rgba(234,88,12,1)";
      ctx.lineWidth = 2 * dpr;
      ctx.fillRect(r.x * dpr, r.y * dpr, r.w * dpr, r.h * dpr);
      ctx.strokeRect(r.x * dpr, r.y * dpr, r.w * dpr, r.h * dpr);
    }
  }

  // Redraw overlay when committed selection changes
  useEffect(drawOverlay, [selectedRegion]);

  function relCoords(e: React.MouseEvent): { x: number; y: number } {
    const overlay = overlayRef.current!;
    const rect = overlay.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function onDown(e: React.MouseEvent) {
    if (clickMode !== "drag-replace") return;
    const { x, y } = relCoords(e);
    dragRef.current = { active: true, sx: x, sy: y, cx: x, cy: y };
    forceRedraw((n) => n + 1);
    drawOverlay();
  }
  function onMove(e: React.MouseEvent) {
    if (!dragRef.current.active) return;
    const { x, y } = relCoords(e);
    dragRef.current.cx = x;
    dragRef.current.cy = y;
    drawOverlay();
  }
  function onUp(e: React.MouseEvent) {
    if (clickMode === "place-sign") {
      const { x, y } = relCoords(e);
      onCanvasClick?.(x, y);
      return;
    }
    if (!dragRef.current.active) return;
    const { sx, sy, cx, cy } = dragRef.current;
    dragRef.current.active = false;
    const x = Math.min(sx, cx), y = Math.min(sy, cy);
    const w = Math.abs(cx - sx), h = Math.abs(cy - sy);
    drawOverlay();
    if (w < 5 || h < 5) return; // ignore tiny/accidental drags
    const base = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const bg = sampleBackground(base, x, y, w, h, dpr);
    onRegionSelected?.({ x, y, w, h }, bg);
  }

  const safeTotal = totalPages || 1;
  const cursor = clickMode === "place-sign" ? "crosshair" : clickMode === "drag-replace" ? "crosshair" : "default";

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      <div ref={containerRef} className="w-full flex justify-center">
        <div className="relative shadow-xl rounded overflow-hidden bg-white">
          <canvas ref={canvasRef} className="block" />
          <canvas
            ref={overlayRef}
            className="absolute inset-0"
            style={{ pointerEvents: clickMode ? "auto" : "none", cursor }}
            onMouseDown={onDown}
            onMouseMove={onMove}
            onMouseUp={onUp}
            onMouseLeave={() => { if (dragRef.current.active) { dragRef.current.active = false; drawOverlay(); } }}
          />
          {clickMode && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none select-none whitespace-nowrap">
              {clickMode === "drag-replace" ? t("hint_drag_region") : t("hint_click_place")}
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
