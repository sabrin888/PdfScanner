"use client";

import type { RecentFile } from "@/lib/storage";

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

interface Props {
  files: RecentFile[];
  onOpen: (file: RecentFile) => void;
  onDelete: (id: string) => void;
}

export default function RecentFiles({ files, onOpen, onDelete }: Props) {
  if (files.length === 0) return null;

  return (
    <div className="w-full max-w-2xl mx-auto mt-8">
      <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
        Recent Files
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {files.map((file) => (
          <div
            key={file.id}
            className="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm transition-all group cursor-pointer"
            onClick={() => onOpen(file)}
          >
            {/* PDF icon */}
            <div className="flex-shrink-0 w-9 h-9 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-red-500 dark:text-red-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate" title={file.filename}>
                {file.filename}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                {file.totalPages} {file.totalPages === 1 ? "page" : "pages"} · {relativeTime(file.savedAt)}
              </p>
            </div>

            {/* Delete button */}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(file.id); }}
              className="flex-shrink-0 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
              title="Remove from history"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
