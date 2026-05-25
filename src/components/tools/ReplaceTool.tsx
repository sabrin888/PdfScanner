"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { ocrCanvas } from "@/lib/ocr";
import { replaceText } from "@/lib/pdfProcessor";

interface Props {
  pdfBytes: Uint8Array;
  pageIndex: number;
  getCanvas: () => HTMLCanvasElement | null;
  onResult: (bytes: Uint8Array, operation: string, params: object) => void;
}

export default function ReplaceTool({ pdfBytes, pageIndex, getCanvas, onResult }: Props) {
  const { t, lang } = useI18n();
  const [findText, setFindText] = useState("");
  const [newText, setNewText] = useState("");
  const [fontSize, setFontSize] = useState("");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "notfound" | "error">("idle");
  const [progress, setProgress] = useState(0);

  async function run() {
    if (!findText || !newText) return;
    const canvas = getCanvas();
    if (!canvas) return;
    setStatus("running");
    setProgress(0);
    try {
      const words = await ocrCanvas(canvas, lang === "so" ? "som+eng" : "eng", setProgress);
      const fs = fontSize ? parseFloat(fontSize) : null;
      const newBytes = await replaceText(
        pdfBytes, pageIndex, words, findText, newText,
        fs, "#000000", "#ffffff", canvas.width, canvas.height
      );
      const matched = words.some((w) => w.text.toLowerCase().includes(findText.toLowerCase()));
      if (!matched) {
        setStatus("notfound");
        return;
      }
      onResult(newBytes, "replace", { pageIndex, findText, newText, fontSize: fs });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("replace_desc")}</p>
      <label className="block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("replace_find_label")}</span>
        <input
          value={findText}
          onChange={(e) => setFindText(e.target.value)}
          className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("replace_new_label")}</span>
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("replace_font_size")}</span>
        <input
          type="number"
          value={fontSize}
          onChange={(e) => setFontSize(e.target.value)}
          placeholder="auto"
          className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
        />
      </label>
      {status === "running" && (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {status === "done" && <p className="text-sm text-green-600 dark:text-green-400">{t("replace_done")}</p>}
      {status === "notfound" && <p className="text-sm text-yellow-600 dark:text-yellow-400">{t("replace_not_found")}</p>}
      {status === "error" && <p className="text-sm text-red-500">{t("error_generic")}</p>}
      <button
        onClick={run}
        disabled={status === "running" || !findText || !newText}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {status === "running" ? t("replace_running") : t("replace_run")}
      </button>
    </div>
  );
}
