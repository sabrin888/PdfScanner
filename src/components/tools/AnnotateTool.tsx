"use client";

import { useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { annotateText, annotateBox, annotateHighlight } from "@/lib/pdfProcessor";

type Kind = "text" | "box" | "highlight";

interface Props {
  pdfBytes: Uint8Array;
  pageIndex: number;
  onResult: (bytes: Uint8Array, operation: string, params: object) => void;
}

export default function AnnotateTool({ pdfBytes, pageIndex, onResult }: Props) {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>("text");
  const [value, setValue] = useState("");
  const [x, setX] = useState("50");
  const [y, setY] = useState("50");
  const [x0, setX0] = useState("50");
  const [y0, setY0] = useState("50");
  const [x1, setX1] = useState("200");
  const [y1, setY1] = useState("100");
  const [size, setSize] = useState("12");
  const [color, setColor] = useState("#000000");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  async function run() {
    setStatus("idle");
    try {
      let newBytes: Uint8Array;
      if (kind === "text") {
        newBytes = await annotateText(pdfBytes, pageIndex, parseFloat(x), parseFloat(y), value, parseFloat(size), color);
        onResult(newBytes, "annotate_text", { pageIndex, x, y, value, size, color });
      } else if (kind === "box") {
        newBytes = await annotateBox(pdfBytes, pageIndex, parseFloat(x0), parseFloat(y0), parseFloat(x1), parseFloat(y1), color, 1.5);
        onResult(newBytes, "annotate_box", { pageIndex, x0, y0, x1, y1, color });
      } else {
        newBytes = await annotateHighlight(pdfBytes, pageIndex, parseFloat(x0), parseFloat(y0), parseFloat(x1), parseFloat(y1));
        onResult(newBytes, "annotate_highlight", { pageIndex, x0, y0, x1, y1 });
      }
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("annotate_desc")}</p>
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
        {(["text", "box", "highlight"] as Kind[]).map((k) => (
          <button
            key={k}
            onClick={() => setKind(k)}
            className={`flex-1 py-1 text-xs font-medium rounded-md transition-colors ${
              kind === k ? "bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400" : "text-slate-500 dark:text-slate-400"
            }`}
          >
            {t(`annotate_${k}`)}
          </button>
        ))}
      </div>

      {kind === "text" && (
        <>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("annotate_value")}</span>
            <input value={value} onChange={(e) => setValue(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("annotate_x")}</span>
              <input type="number" value={x} onChange={(e) => setX(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("annotate_y")}</span>
              <input type="number" value={y} onChange={(e) => setY(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("annotate_size")}</span>
              <input type="number" value={size} onChange={(e) => setSize(e.target.value)}
                className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("annotate_color")}</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer" />
            </label>
          </div>
        </>
      )}

      {(kind === "box" || kind === "highlight") && (
        <>
          <p className="text-xs text-slate-400">{t("annotate_rect")}</p>
          <div className="grid grid-cols-2 gap-2">
            {[["x0", x0, setX0], ["y0", y0, setY0], ["x1", x1, setX1], ["y1", y1, setY1]].map(([label, val, setter]) => (
              <label key={label as string} className="block">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label as string}</span>
                <input type="number" value={val as string} onChange={(e) => (setter as (v: string) => void)(e.target.value)}
                  className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
              </label>
            ))}
          </div>
          {kind === "box" && (
            <label className="block">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t("annotate_color")}</span>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)}
                className="mt-1 w-full h-9 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer" />
            </label>
          )}
        </>
      )}

      {status === "done" && <p className="text-sm text-green-600 dark:text-green-400">{t("annotate_done")}</p>}
      {status === "error" && <p className="text-sm text-red-500">{t("error_generic")}</p>}
      <button
        onClick={run}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        {t("annotate_run")}
      </button>
    </div>
  );
}
