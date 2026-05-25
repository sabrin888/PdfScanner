"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { ocrCanvas, type OcrWord } from "@/lib/ocr";

interface Props {
  getCanvas: () => HTMLCanvasElement | null;
  onWords: (words: OcrWord[]) => void;
}

export default function FindTool({ getCanvas, onWords }: Props) {
  const { t } = useI18n();
  const [ocrLang, setOcrLang] = useState("eng");
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [words, setWords] = useState<OcrWord[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");

  async function run() {
    const canvas = getCanvas();
    if (!canvas) return;
    setStatus("running");
    setError("");
    try {
      const result = await ocrCanvas(canvas, ocrLang, setProgress);
      setWords(result);
      onWords(result);
      setStatus("done");
    } catch {
      setError(t("error_ocr"));
      setStatus("error");
    }
  }

  const displayed = filter
    ? words.filter((w) => w.text.toLowerCase().includes(filter.toLowerCase()))
    : words;

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("find_desc")}</p>
      <select
        value={ocrLang}
        onChange={(e) => setOcrLang(e.target.value)}
        className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
      >
        <option value="eng">English</option>
        <option value="som">Somali</option>
        <option value="ara">Arabic</option>
        <option value="fra">French</option>
      </select>
      {status === "running" && (
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      )}
      {status === "error" && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={run}
        disabled={status === "running"}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
      >
        {status === "running" ? t("find_running") : t("find_run")}
      </button>
      {words.length > 0 && (
        <div className="space-y-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("find_search")}
            className="w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
          />
          <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 text-xs">
            <table className="w-full">
              <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                <tr>
                  {["find_word", "find_x0", "find_y0", "find_x1", "find_y1", "find_conf"].map((k) => (
                    <th key={k} className="px-2 py-1 text-left font-medium text-slate-600 dark:text-slate-300">
                      {t(k)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayed.length === 0 ? (
                  <tr><td colSpan={6} className="px-2 py-2 text-slate-400">{t("find_empty")}</td></tr>
                ) : (
                  displayed.map((w, i) => (
                    <tr key={i} className="border-t border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-2 py-1 font-medium text-slate-800 dark:text-slate-200">{w.text}</td>
                      <td className="px-2 py-1 text-slate-500">{Math.round(w.x0)}</td>
                      <td className="px-2 py-1 text-slate-500">{Math.round(w.y0)}</td>
                      <td className="px-2 py-1 text-slate-500">{Math.round(w.x1)}</td>
                      <td className="px-2 py-1 text-slate-500">{Math.round(w.y1)}</td>
                      <td className="px-2 py-1 text-slate-500">{w.conf}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
