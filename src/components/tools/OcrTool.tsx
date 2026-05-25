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
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");

  async function run() {
    const canvas = getCanvas();
    if (!canvas) return;
    setStatus("running");
    setProgress(0);
    setError("");
    try {
      const words = await ocrCanvas(canvas, lang === "so" ? "som+eng" : "eng", setProgress);
      const newBytes = await addOcrLayer(pdfBytes, pageIndex, words, canvas.width, canvas.height);
      onResult(newBytes, "ocr", { pageIndex, lang, wordCount: words.length });
      setStatus("done");
    } catch {
      setError(t("error_ocr"));
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("ocr_desc")}</p>
      {status === "running" && (
        <div className="space-y-1">
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">{progress}%</p>
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
