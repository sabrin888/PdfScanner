"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { stampSignatureAtCss } from "@/lib/pdfProcessor";

interface Props {
  pdfBytes: Uint8Array;
  pageIndex: number;
  getCanvas: () => HTMLCanvasElement | null;
  onResult: (bytes: Uint8Array, operation: string, params: object) => void;
  /** CSS-pixel position where user clicked on the document */
  signClickPos: { cssX: number; cssY: number } | null;
  /** Called to enable click-to-place mode on the canvas */
  onActivatePlace: () => void;
}

export default function SignTool({ pdfBytes, pageIndex, getCanvas, onResult, signClickPos, onActivatePlace }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [sigW, setSigW] = useState("150");
  const [sigH, setSigH] = useState("60");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  function handleImage(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer;
      setImageBytes(new Uint8Array(buf));
      setPreview(URL.createObjectURL(file));
      setStatus("idle");
    };
    reader.readAsArrayBuffer(file);
  }

  async function apply() {
    if (!imageBytes || !signClickPos) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const cssWidth = parseFloat(canvas.style.width) || canvas.width;
    const cssHeight = parseFloat(canvas.style.height) || canvas.height;
    const w = parseFloat(sigW) || 150;
    const h = parseFloat(sigH) || 60;
    // Center the signature on the click point
    const x = signClickPos.cssX - w / 2;
    const y = signClickPos.cssY - h / 2;
    try {
      const newBytes = await stampSignatureAtCss(
        pdfBytes, pageIndex, imageBytes,
        x, y, w, h, cssWidth, cssHeight
      );
      onResult(newBytes, "sign", { pageIndex, x, y, w, h });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("sign_desc")}</p>

      {/* Upload signature image */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-4 text-center cursor-pointer hover:border-blue-400 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/png"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImage(f); }}
        />
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="signature preview" className="max-h-16 mx-auto object-contain" />
        ) : (
          <p className="text-sm text-slate-400">{t("sign_upload")}</p>
        )}
      </div>

      {/* Size controls */}
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("sign_w")}</span>
          <input type="number" value={sigW} onChange={(e) => setSigW(e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("sign_h")}</span>
          <input type="number" value={sigH} onChange={(e) => setSigH(e.target.value)}
            className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
        </label>
      </div>

      {/* Placement */}
      {!imageBytes ? (
        <p className="text-xs text-slate-400 italic">{t("sign_upload_first")}</p>
      ) : !signClickPos ? (
        <button
          onClick={onActivatePlace}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {t("sign_click_to_place")}
        </button>
      ) : (
        <div className="space-y-2">
          <div className="rounded-lg bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-3 text-sm text-green-700 dark:text-green-300">
            {t("sign_position_set")} ({Math.round(signClickPos.cssX)}, {Math.round(signClickPos.cssY)})
          </div>
          {status === "done" && <p className="text-sm text-green-600 dark:text-green-400">{t("sign_done")}</p>}
          {status === "error" && <p className="text-sm text-red-500">{t("error_generic")}</p>}
          <div className="flex gap-2">
            <button
              onClick={apply}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              {t("sign_run")}
            </button>
            <button
              onClick={onActivatePlace}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm transition-colors"
            >
              {t("sign_reposition")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
