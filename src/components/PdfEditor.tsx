"use client";

import { useRef, useState, useCallback } from "react";
import { useI18n } from "@/context/I18nContext";
import PdfUpload from "./PdfUpload";
import PdfViewer, { PdfViewerHandle } from "./PdfViewer";
import Toolbar, { ToolId } from "./Toolbar";
import OcrTool from "./tools/OcrTool";
import FindTool from "./tools/FindTool";
import ReplaceTool from "./tools/ReplaceTool";
import AnnotateTool from "./tools/AnnotateTool";
import SignTool from "./tools/SignTool";
import FillTool from "./tools/FillTool";
import type { OcrWord } from "@/lib/ocr";

interface HistoryEntry {
  operation: string;
  params: object;
  time: string;
}

export default function PdfEditor() {
  const { t } = useI18n();
  const viewerRef = useRef<PdfViewerHandle>(null);

  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [filename, setFilename] = useState("");
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [wordOverlays, setWordOverlays] = useState<OcrWord[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  async function handleFile(bytes: Uint8Array, name: string) {
    // Show the editor immediately — don't block on pdfjs loading
    setPdfBytes(bytes);
    setFilename(name);
    setCurrentPage(1);
    setActiveTool(null);
    setWordOverlays([]);
    setHistory([]);
    setTotalPages(0); // PdfViewer will render; we get page count separately

    // Get page count in the background
    try {
      const pdfjsLib = (await import("pdfjs-dist")).default;
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice() }).promise;
      setTotalPages(pdf.numPages);
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: name, page_count: pdf.numPages }),
        });
        const data = await res.json();
        if (data.id) setSessionId(data.id);
      } catch {
        // DB unavailable — continue without history tracking
      }
    } catch {
      // pdfjs failed to parse — editor still shows with page count 1
      setTotalPages(1);
    }
  }

  const handleResult = useCallback(
    async (newBytes: Uint8Array, operation: string, params: object) => {
      setPdfBytes(newBytes);
      const entry: HistoryEntry = { operation, params, time: new Date().toLocaleTimeString() };
      setHistory((h) => [entry, ...h]);
      if (sessionId) {
        try {
          await fetch("/api/operations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, operation, params }),
          });
        } catch {}
      }
    },
    [sessionId]
  );

  function download() {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const base = filename.replace(/\.pdf$/i, "");
    a.href = url;
    a.download = `${base}-edited.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const getCanvas = useCallback(() => viewerRef.current?.getCanvas() ?? null, []);

  if (!pdfBytes) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full px-4 py-16 min-h-[70vh]">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2">{t("app_title")}</h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10">{t("app_subtitle")}</p>
        <PdfUpload onFile={handleFile} />
      </div>
    );
  }

  return (
    <div className="flex flex-1 w-full gap-4 p-4">
      {/* Toolbar */}
      <div className="flex-shrink-0">
        <Toolbar activeTool={activeTool} onSelect={(id) => setActiveTool(id === activeTool ? null : id)} />
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 min-w-0 overflow-auto flex items-start justify-center">
        <PdfViewer
          ref={viewerRef}
          pdfBytes={pdfBytes}
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          wordOverlays={activeTool === "find" ? wordOverlays : []}
        />
      </div>

      {/* Right Panel */}
      <div className="flex-shrink-0 w-72 flex flex-col gap-3">
        {/* Download */}
        <button
          onClick={download}
          className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t("download_button")}
        </button>

        {/* Active Tool Panel */}
        {activeTool && (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 text-sm">
              {t(`tool_${activeTool}`)}
            </h3>
            {activeTool === "ocr" && (
              <OcrTool pdfBytes={pdfBytes} pageIndex={currentPage - 1} getCanvas={getCanvas} onResult={handleResult} />
            )}
            {activeTool === "find" && (
              <FindTool getCanvas={getCanvas} onWords={setWordOverlays} />
            )}
            {activeTool === "replace" && (
              <ReplaceTool pdfBytes={pdfBytes} pageIndex={currentPage - 1} getCanvas={getCanvas} onResult={handleResult} />
            )}
            {activeTool === "annotate" && (
              <AnnotateTool pdfBytes={pdfBytes} pageIndex={currentPage - 1} onResult={handleResult} />
            )}
            {activeTool === "sign" && (
              <SignTool pdfBytes={pdfBytes} pageIndex={currentPage - 1} onResult={handleResult} />
            )}
            {activeTool === "fill" && (
              <FillTool pdfBytes={pdfBytes} onResult={handleResult} />
            )}
          </div>
        )}

        {/* History */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 p-4 flex-1 overflow-hidden flex flex-col">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-2 text-sm">{t("history_title")}</h3>
          <div className="flex-1 overflow-y-auto space-y-1.5">
            {history.length === 0 ? (
              <p className="text-xs text-slate-400">{t("history_empty")}</p>
            ) : (
              history.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="w-2 h-2 mt-0.5 rounded-full bg-blue-500 flex-shrink-0" />
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{e.operation}</span>
                    <span className="text-slate-400 ml-1">{e.time}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* New file */}
        <button
          onClick={() => { setPdfBytes(null); setSessionId(null); }}
          className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
        >
          ← {t("upload_button")}
        </button>
      </div>
    </div>
  );
}
