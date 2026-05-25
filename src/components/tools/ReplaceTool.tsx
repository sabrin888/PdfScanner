"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { ocrCanvas } from "@/lib/ocr";
import { replaceWordByBbox } from "@/lib/pdfProcessor";
import type { OcrWord } from "@/lib/ocr";

interface Props {
  pdfBytes: Uint8Array;
  pageIndex: number;
  getCanvas: () => HTMLCanvasElement | null;
  onResult: (bytes: Uint8Array, operation: string, params: object) => void;
  /** Words scanned from the page (set by this tool, stored in parent) */
  ocrWords: OcrWord[];
  /** Word the user clicked on the canvas */
  selectedWord: OcrWord | null;
  /** Called after OCR so parent can show clickable overlays */
  onWordsLoaded: (words: OcrWord[]) => void;
  /** Called to activate word-selection click mode on the canvas */
  onStartWordSelect: () => void;
}

export default function ReplaceTool({
  pdfBytes, pageIndex, getCanvas, onResult,
  ocrWords, selectedWord, onWordsLoaded, onStartWordSelect,
}: Props) {
  const { t } = useI18n();
  const [scanStatus, setScanStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [newText, setNewText] = useState("");
  const [applyStatus, setApplyStatus] = useState<"idle" | "done" | "error">("idle");

  async function scan() {
    const canvas = getCanvas();
    if (!canvas) return;
    setScanStatus("running");
    setProgress(0);
    try {
      const words = await ocrCanvas(canvas, setProgress);
      onWordsLoaded(words);
      setScanStatus("done");
      // Immediately activate click mode so user can click a word
      onStartWordSelect();
    } catch {
      setScanStatus("error");
    }
  }

  async function apply() {
    if (!selectedWord || !newText) return;
    const canvas = getCanvas();
    if (!canvas) return;
    setApplyStatus("idle");
    try {
      const newBytes = await replaceWordByBbox(
        pdfBytes, pageIndex, selectedWord, newText, null, canvas.width, canvas.height
      );
      onResult(newBytes, "replace_word", { pageIndex, original: selectedWord.text, replacement: newText });
      setApplyStatus("done");
      setNewText("");
    } catch {
      setApplyStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("replace_desc")}</p>

      {/* Step 1: Scan the page */}
      {scanStatus === "idle" && (
        <button
          onClick={scan}
          className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          {t("replace_scan")}
        </button>
      )}

      {scanStatus === "running" && (
        <div className="space-y-1.5">
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-slate-400">{t("replace_scanning")} ({progress}%)</p>
        </div>
      )}

      {scanStatus === "error" && (
        <p className="text-sm text-red-500">{t("error_ocr")}</p>
      )}

      {/* Step 2: Click a word on the document */}
      {scanStatus === "done" && ocrWords.length > 0 && !selectedWord && (
        <div className="space-y-2">
          <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-3 text-sm text-blue-700 dark:text-blue-300">
            {t("replace_click_word")}
          </div>
          <button
            onClick={onStartWordSelect}
            className="w-full py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition-colors"
          >
            {t("replace_reselect")}
          </button>
        </div>
      )}

      {/* Step 3: Word selected – type replacement */}
      {selectedWord && (
        <div className="space-y-3">
          <div className="rounded-lg bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-700 p-3">
            <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">{t("replace_selected")}</p>
            <p className="font-mono text-sm font-bold text-orange-800 dark:text-orange-200">{selectedWord.text}</p>
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
          {applyStatus === "done" && (
            <p className="text-sm text-green-600 dark:text-green-400">{t("replace_done")}</p>
          )}
          {applyStatus === "error" && (
            <p className="text-sm text-red-500">{t("error_generic")}</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={apply}
              disabled={!newText}
              className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {t("replace_apply")}
            </button>
            <button
              onClick={onStartWordSelect}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg text-sm transition-colors"
            >
              {t("replace_reselect")}
            </button>
          </div>
        </div>
      )}

      {scanStatus === "done" && ocrWords.length === 0 && (
        <p className="text-sm text-yellow-600 dark:text-yellow-400">{t("replace_no_words")}</p>
      )}
    </div>
  );
}
