"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/context/I18nContext";
import { replaceRegion } from "@/lib/pdfProcessor";
import type { Region, RgbColor } from "../PdfViewer";

interface Props {
  pdfBytes: Uint8Array;
  pageIndex: number;
  getCanvas: () => HTMLCanvasElement | null;
  onResult: (bytes: Uint8Array, operation: string, params: object) => void;
  region: Region | null;
  bgColor: RgbColor | null;
  onStartDrag: () => void;
  onClearRegion: () => void;
}

function toHex({ r, g, b }: RgbColor): string {
  return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string): RgbColor {
  return {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
}

export default function ReplaceTool({
  pdfBytes, pageIndex, getCanvas, onResult, region, bgColor, onStartDrag, onClearRegion,
}: Props) {
  const { t } = useI18n();
  const [newText, setNewText] = useState("");
  const [color, setColor] = useState<RgbColor>({ r: 255, g: 255, b: 255 });
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");

  // When a fresh region is selected, adopt its sampled background colour
  useEffect(() => {
    if (bgColor) setColor(bgColor);
  }, [bgColor]);

  async function apply() {
    if (!region) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const cssW = parseFloat(canvas.style.width) || canvas.width;
    const cssH = parseFloat(canvas.style.height) || canvas.height;
    setStatus("running");
    try {
      const newBytes = await replaceRegion(
        pdfBytes, pageIndex, region, newText.trim(), color, null, cssW, cssH
      );
      onResult(newBytes, newText.trim() ? "replace_region" : "erase_region", {
        pageIndex, replacement: newText.trim() || "(erased)",
      });
      setStatus("done");
      setNewText("");
      onClearRegion();
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("replace_desc")}</p>

      {/* Step 1: drag a region */}
      {!region && (
        <>
          <button
            onClick={onStartDrag}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5" />
            </svg>
            {t("replace_select_area")}
          </button>
          <p className="text-xs text-slate-400">{t("replace_hint")}</p>
          {status === "done" && (
            <p className="text-sm text-green-600 dark:text-green-400">{t("replace_done")}</p>
          )}
        </>
      )}

      {/* Step 2: region selected → choose colour + type replacement */}
      {region && (
        <div className="space-y-3">
          <div className="rounded-lg bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 p-3 text-sm text-orange-700 dark:text-orange-300">
            {t("replace_area_selected")}
          </div>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("replace_new_label")}</span>
            <input
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              placeholder={t("replace_new_placeholder")}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
              autoFocus
            />
          </label>

          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("replace_bg_label")}</span>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="color"
                value={toHex(color)}
                onChange={(e) => setColor(fromHex(e.target.value))}
                className="h-9 w-12 rounded border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent"
              />
              <span className="text-xs text-slate-400">{t("replace_bg_hint")}</span>
            </div>
          </label>

          {status === "error" && <p className="text-sm text-red-500">{t("error_generic")}</p>}

          <div className="flex gap-2">
            <button
              onClick={apply}
              disabled={status === "running"}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {status === "running" ? t("replace_running") : (newText.trim() ? t("replace_apply") : t("replace_erase"))}
            </button>
            <button
              onClick={() => { onClearRegion(); onStartDrag(); }}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm transition-colors"
            >
              {t("replace_redraw")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
