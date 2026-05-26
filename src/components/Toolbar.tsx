"use client";

import { useI18n } from "@/context/I18nContext";

export type ToolId = "ocr" | "replace" | "annotate" | "sign" | "fill";

const TOOLS: Array<{ id: ToolId; icon: React.ReactNode }> = [
  {
    id: "ocr",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714a2.25 2.25 0 00.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.698-1.338 2.698H4.136c-1.368 0-2.337-1.698-1.338-2.698L4.2 15.3" />
      </svg>
    ),
  },
  {
    id: "replace",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
      </svg>
    ),
  },
  {
    id: "annotate",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
      </svg>
    ),
  },
  {
    id: "sign",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
  },
  {
    id: "fill",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  },
];

interface Props {
  activeTool: ToolId | null;
  onSelect: (id: ToolId) => void;
  orientation?: "horizontal" | "vertical";
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
}

export default function Toolbar({
  activeTool, onSelect, orientation = "vertical",
  canUndo = false, canRedo = false, onUndo, onRedo,
}: Props) {
  const { t } = useI18n();

  const undoBtn = (compact?: boolean) => (
    <button
      key="undo"
      onClick={onUndo}
      disabled={!canUndo}
      title="Undo (Ctrl+Z)"
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30
        ${compact ? "flex-shrink-0" : ""}
        text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
      </svg>
      <span className="text-[10px] leading-none">Undo</span>
    </button>
  );

  const redoBtn = (compact?: boolean) => (
    <button
      key="redo"
      onClick={onRedo}
      disabled={!canRedo}
      title="Redo (Ctrl+Y)"
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-30
        ${compact ? "flex-shrink-0" : ""}
        text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" />
      </svg>
      <span className="text-[10px] leading-none">Redo</span>
    </button>
  );

  if (orientation === "horizontal") {
    return (
      <div className="flex flex-row gap-1 px-2 py-1 overflow-x-auto bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        {undoBtn(true)}
        {redoBtn(true)}
        <div className="w-px self-stretch bg-slate-200 dark:bg-slate-700 mx-1" />
        {TOOLS.map(({ id, icon }) => (
          <button
            key={id}
            onClick={() => onSelect(id)}
            title={t(`tool_${id}`)}
            className={`
              flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-xs font-medium
              flex-shrink-0 transition-all
              ${activeTool === id
                ? "bg-blue-600 text-white shadow"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
              }
            `}
          >
            {icon}
            <span className="text-[10px]">{t(`tool_${id}`)}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-2 bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700">
      {undoBtn()}
      {redoBtn()}
      <div className="h-px bg-slate-200 dark:bg-slate-700 mx-1 my-0.5" />
      {TOOLS.map(({ id, icon }) => (
        <button
          key={id}
          onClick={() => onSelect(id)}
          title={t(`tool_${id}`)}
          className={`
            flex flex-col items-center gap-1 px-3 py-2 rounded-lg text-xs font-medium transition-all
            ${activeTool === id
              ? "bg-blue-600 text-white shadow-md"
              : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            }
          `}
        >
          {icon}
          <span className="text-[10px] leading-none">{t(`tool_${id}`)}</span>
        </button>
      ))}
    </div>
  );
}
