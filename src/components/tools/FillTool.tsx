"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/context/I18nContext";
import { getFormFieldsAsync, fillFormFields } from "@/lib/pdfProcessor";

interface Props {
  pdfBytes: Uint8Array;
  onResult: (bytes: Uint8Array, operation: string, params: object) => void;
}

interface Field {
  name: string;
  type: string;
  value: string;
}

export default function FillTool({ pdfBytes, onResult }: Props) {
  const { t } = useI18n();
  const [fields, setFields] = useState<Field[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "done" | "error">("idle");

  useEffect(() => {
    setLoading(true);
    getFormFieldsAsync(pdfBytes).then((f) => {
      setFields(f);
      const init: Record<string, string> = {};
      f.forEach((field) => { init[field.name] = field.value; });
      setValues(init);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [pdfBytes]);

  async function run() {
    try {
      const newBytes = await fillFormFields(pdfBytes, values);
      onResult(newBytes, "fill", { fields: values });
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (loading) return <p className="text-sm text-slate-400">{t("processing")}</p>;

  if (fields.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">{t("fill_no_fields")}</p>;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500 dark:text-slate-400">{t("fill_desc")}</p>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {fields.map((f) => (
          <label key={f.name} className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {f.name} <span className="text-slate-400">({f.type})</span>
            </span>
            <input
              value={values[f.name] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              className="mt-1 w-full px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
            />
          </label>
        ))}
      </div>
      {status === "done" && <p className="text-sm text-green-600 dark:text-green-400">{t("fill_done")}</p>}
      {status === "error" && <p className="text-sm text-red-500">{t("error_generic")}</p>}
      <button
        onClick={run}
        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
      >
        {t("fill_run")}
      </button>
    </div>
  );
}
