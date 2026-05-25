"use client";

import { useI18n } from "@/context/I18nContext";
import { useRef, useState } from "react";

interface Props {
  onFile: (bytes: Uint8Array, filename: string) => void;
}

export default function PdfUpload({ onFile }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFile(file: File) {
    if (!file.name.toLowerCase().endsWith(".pdf")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const buf = e.target?.result as ArrayBuffer;
      onFile(new Uint8Array(buf), file.name);
    };
    reader.readAsArrayBuffer(file);
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
      }}
      onClick={() => inputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-4 w-full max-w-xl mx-auto
        border-2 border-dashed rounded-2xl p-12 cursor-pointer select-none
        transition-all duration-200
        ${dragging
          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/40"
          : "bg-white dark:bg-slate-800 border-slate-300 dark:border-slate-500 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-700/60"
        }
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <svg className="w-14 h-14 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
      <div className="text-center">
        <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
          {t("upload_prompt")}
        </p>
        <p className="text-sm text-slate-400 mt-1">{t("upload_hint")}</p>
      </div>
      <button
        type="button"
        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        {t("upload_button")}
      </button>
    </div>
  );
}
