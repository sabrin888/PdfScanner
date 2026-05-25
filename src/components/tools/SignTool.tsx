"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { stampSignature } from "@/lib/pdfProcessor";

interface Props {
  pdfBytes: Uint8Array;
  pageIndex: number;
  onResult: (bytes: Uint8Array, operation: string, params: object) => void;
}

export default function SignTool({ pdfBytes, pageIndex, onResult }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageBytes, setImageBytes] = useState<Uint8Array | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [x, setX] = useState("50");
  const [y, setY] = useState("600");
  const [w, setW] = useState("150");
  const [h, setH] = useState("60");
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  function handleImage(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer;
      setImageBytes(new Uint8Array(buf));
      setPreview(URL.createObjectURL(file));
    };
    reader.readAsArrayBuffer(file);
  }

  async function run() {
    if (!imageBytes) {
      setStatus("error");
      return;
    }
    try {
      const newBytes = await stampSignature(
        pdfBytes, pageIndex, imageBytes,
        parseFloat(x), parseFloat(y), parseFloat(w), parseFloat(h)
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
          <img src={preview} alt="signature" className="max-h-16 mx-auto object-contain" />
        ) : (
          <p className="text-sm text-slate-400">{t("sign_upload")}</p>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {([["sign_x", x, setX], ["sign_y", y, setY], ["sign_w", w, setW], ["sign_h", h, setH]] as const).map(([label, val, setter]) => (
          <label key={label} className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{t(label)}</span>
            <input type="number" value={val} onChange={(e) => setter(e.target.value)}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100" />
          </label>
        ))}
      </div>
      {status === "done" && <p className="text-sm text-green-600 dark:text-green-400">{t("sign_done")}</p>}
      {status === "error" && <p className="text-sm text-red-500">{imageBytes ? t("error_generic") : t("sign_no_image")}</p>}
      <button
        onClick={run}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        {t("sign_run")}
      </button>
    </div>
  );
}
