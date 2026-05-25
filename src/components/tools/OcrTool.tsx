"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { ocrCanvas } from "@/lib/ocr";
import { addOcrLayer } from "@/lib/pdfProcessor";

interface Props {
  pdfBytes: Uint8Array;
  pageIndex: number;
  getCanvas: () => HTMLCanvasElement | null;
  onResult: (bytes: Uint8Array, operation: string, params: object) => void;
}

export default function OcrTool({ pdfBytes, pageIndex, getCanvas, onResult }: Props) {
  const { t } = useI18n();
  const [ocrLang, setOcrLang] = useState("eng");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [error, setError] = useState("");

  async function run() {
    const canvas = getCanvas();
    if (!canvas) return;
    setStatus("running");
    setProgress(0);
    setProgressLabel("Starting…");
    setError("");
    try {
      const words = await ocrCanvas(
        canvas,
        ocrLang,
        (pct) => {
          setProgress(pct);
          if (pct < 45) setProgressLabel("Downloading language data…");
          else if (pct < 55) setProgressLabel("Initialising OCR engine…");
          else setProgressLabel("Recognising text…");
        }
      );
      const newBytes = await addOcrLayer(pdfBytes, pageIndex, words, canvas.width, canvas.height);
      onResult(newBytes, "ocr", { pageIndex, lang: ocrLang, wordCount: words.length });
      setStatus("done");
    } catch (e) {
      setError(t("error_ocr"));
      setStatus("error");
      console.error("OCR error:", e);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("ocr_desc")}</p>

      <label className="block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
          OCR language / Luqadda OCR
        </span>
        <select
          value={ocrLang}
          onChange={(e) => setOcrLang(e.target.value)}
          className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        >
          <option value="eng">English</option>
          <option value="som">Somali (Soomaali)</option>
          <option value="ara">Arabic (عربي)</option>
          <option value="fra">French (Français)</option>
        </select>
        <p className="text-xs text-slate-400 mt-1">
          Language data (~5 MB) downloads on first use and is cached in your browser.
        </p>
      </label>

      {status === "running" && (
        <div className="space-y-1.5">
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">{progressLabel} ({progress}%)</p>
        </div>
      )}
      {status === "done" && (
        <p className="text-sm text-green-600 dark:text-green-400">{t("ocr_done")}</p>
      )}
      {status === "error" && (
        <p className="text-sm text-red-500">{error}</p>
      )}

      <button
        onClick={run}
        disabled={status === "running"}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {status === "running" ? t("ocr_running") : t("ocr_run")}
      </button>
    </div>
  );
}
