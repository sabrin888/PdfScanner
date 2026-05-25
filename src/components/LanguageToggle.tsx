"use client";

import { useI18n } from "@/context/I18nContext";

export default function LanguageToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex items-center gap-1 rounded-lg overflow-hidden border border-slate-300 dark:border-slate-600">
      <button
        onClick={() => setLang("en")}
        className={`px-3 py-1 text-sm font-medium transition-colors ${
          lang === "en"
            ? "bg-blue-600 text-white"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang("so")}
        className={`px-3 py-1 text-sm font-medium transition-colors ${
          lang === "so"
            ? "bg-blue-600 text-white"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
        }`}
      >
        SO
      </button>
    </div>
  );
}
