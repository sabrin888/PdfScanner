"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { useI18n } from "@/context/I18nContext";
import { saveDoc, loadDoc, clearDoc } from "@/lib/storage";
import PdfUpload from "./PdfUpload";
import PdfViewer, { PdfViewerHandle } from "./PdfViewer";
import Toolbar, { ToolId } from "./Toolbar";
import OcrTool from "./tools/OcrTool";
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
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [restoring, setRestoring] = useState(true);

  // Replace tool state
  const [ocrWords, setOcrWords] = useState<OcrWord[]>([]);
  const [selectedWord, setSelectedWord] = useState<OcrWord | null>(null);

  // Sign tool state
  const [signClickPos, setSignClickPos] = useState<{ cssX: number; cssY: number } | null>(null);

  // Canvas interaction mode
  const [canvasClickMode, setCanvasClickMode] = useState<"select-word" | "place-sign" | null>(null);

  // Clear interactive state whenever the active tool changes
  useEffect(() => {
    setCanvasClickMode(null);
    if (activeTool !== "replace") {
      setOcrWords([]);
      setSelectedWord(null);
    }
    if (activeTool !== "sign") {
      setSignClickPos(null);
    }
  }, [activeTool]);

  // Restore a previously-open document on first load
  useEffect(() => {
    let active = true;
    (async () => {
      const saved = await loadDoc();
      if (active && saved && saved.bytes.length > 0) {
        setPdfBytes(saved.bytes);
        setFilename(saved.filename);
        setTotalPages(saved.totalPages || 1);
        setCurrentPage(saved.currentPage || 1);
        setHistory(saved.history || []);
      }
      if (active) setRestoring(false);
    })();
    return () => { active = false; };
  }, []);

  // Persist whenever document or edits change
  useEffect(() => {
    if (restoring || !pdfBytes) return;
    saveDoc({ bytes: pdfBytes, filename, totalPages, currentPage, history });
  }, [pdfBytes, filename, totalPages, currentPage, history, restoring]);

  function newFile() {
    setPdfBytes(null);
    setSessionId(null);
    setHistory([]);
    setActiveTool(null);
    setOcrWords([]);
    setSelectedWord(null);
    setSignClickPos(null);
    setCanvasClickMode(null);
    clearDoc();
  }

  async function handleFile(bytes: Uint8Array, name: string) {
    setPdfBytes(bytes);
    setFilename(name);
    setCurrentPage(1);
    setActiveTool(null);
    setOcrWords([]);
    setSelectedWord(null);
    setSignClickPos(null);
    setCanvasClickMode(null);
    setHistory([]);
    setTotalPages(0);
    setShowPanel(false);

    try {
      const pdfjsLib = await import("pdfjs-dist");
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
      } catch { /* DB unavailable */ }
    } catch {
      setTotalPages(1);
    }
  }

  const handleResult = useCallback(
    async (newBytes: Uint8Array, operation: string, params: object) => {
      setPdfBytes(newBytes);
      // Clear interactive overlays after a successful edit
      setOcrWords([]);
      setSelectedWord(null);
      setSignClickPos(null);
      setCanvasClickMode(null);
      const entry: HistoryEntry = { operation, params, time: new Date().toLocaleTimeString() };
      setHistory((h) => [entry, ...h]);
      if (sessionId) {
        try {
          await fetch("/api/operations", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionId, operation, params }),
          });
        } catch { /* ignore */ }
      }
    },
    [sessionId]
  );

  function download() {
    if (!pdfBytes) return;
    const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.pdf$/i, "")}-edited.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function selectTool(id: ToolId) {
    setActiveTool(id === activeTool ? null : id);
    setShowPanel(true);
  }

  const getCanvas = useCallback(() => viewerRef.current?.getCanvas() ?? null, []);

  // ─── Canvas interaction callbacks ─────────────────────────────────────────
  function handleWordClick(word: OcrWord) {
    setSelectedWord(word);
    setCanvasClickMode(null); // deactivate click mode after selection
  }

  function handleCanvasClick(cssX: number, cssY: number) {
    setSignClickPos({ cssX, cssY });
    setCanvasClickMode(null); // deactivate after placement
  }

  // ─── Restoring ────────────────────────────────────────────────────────────
  if (restoring) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full min-h-[70vh] gap-3">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-slate-400">{t("processing")}</p>
      </div>
    );
  }

  // ─── Upload screen ────────────────────────────────────────────────────────
  if (!pdfBytes) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 w-full px-4 py-16 min-h-[70vh]">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-2 text-center">
          {t("app_title")}
        </h1>
        <p className="text-slate-500 dark:text-slate-400 mb-10 text-center text-sm sm:text-base">
          {t("app_subtitle")}
        </p>
        <PdfUpload onFile={handleFile} />
      </div>
    );
  }

  // Shared props for tool content
  const toolProps = {
    pdfBytes,
    currentPage,
    getCanvas,
    handleResult,
    ocrWords,
    selectedWord,
    onWordsLoaded: (words: OcrWord[]) => setOcrWords(words),
    onStartWordSelect: () => setCanvasClickMode("select-word"),
    onWordClick: handleWordClick,
    signClickPos,
    onActivatePlace: () => setCanvasClickMode("place-sign"),
  };

  // ─── Editor screen ────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col w-full flex-1">

      {/* Mobile toolbar */}
      <div className="md:hidden">
        <Toolbar activeTool={activeTool} onSelect={selectTool} orientation="horizontal" />
      </div>

      {/* Main area */}
      <div className="flex flex-1 w-full gap-3 p-3 md:p-4 min-h-0">

        {/* Desktop sidebar */}
        <div className="hidden md:flex flex-shrink-0">
          <Toolbar activeTool={activeTool} onSelect={selectTool} orientation="vertical" />
        </div>

        {/* PDF viewer */}
        <div className="flex-1 min-w-0 overflow-auto">
          <PdfViewer
            ref={viewerRef}
            pdfBytes={pdfBytes}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            wordOverlays={activeTool === "replace" ? ocrWords : []}
            selectedWord={activeTool === "replace" ? selectedWord : null}
            clickMode={canvasClickMode}
            onWordClick={handleWordClick}
            onCanvasClick={handleCanvasClick}
          />
        </div>

        {/* Desktop right panel */}
        <div className="hidden md:flex flex-shrink-0 w-72 flex-col gap-3">
          <RightPanel
            t={t}
            download={download}
            activeTool={activeTool}
            toolProps={toolProps}
            history={history}
            onNewFile={newFile}
          />
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="md:hidden flex flex-col border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        {activeTool && showPanel && (
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 max-h-72 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                {t(`tool_${activeTool}`)}
              </h3>
              <button
                onClick={() => setShowPanel(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <ToolContent activeTool={activeTool} toolProps={toolProps} />
          </div>
        )}

        <div className="flex gap-2 p-3">
          <button
            onClick={download}
            className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {t("download_button")}
          </button>
          <button
            onClick={newFile}
            className="px-4 py-2.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-300 dark:border-slate-600 rounded-xl transition-colors"
          >
            ← {t("upload_button")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared tool props type ───────────────────────────────────────────────────
interface ToolProps {
  pdfBytes: Uint8Array;
  currentPage: number;
  getCanvas: () => HTMLCanvasElement | null;
  handleResult: (bytes: Uint8Array, op: string, params: object) => Promise<void>;
  ocrWords: OcrWord[];
  selectedWord: OcrWord | null;
  onWordsLoaded: (words: OcrWord[]) => void;
  onStartWordSelect: () => void;
  onWordClick: (word: OcrWord) => void;
  signClickPos: { cssX: number; cssY: number } | null;
  onActivatePlace: () => void;
}

// ─── Shared tool content ─────────────────────────────────────────────────────
function ToolContent({ activeTool, toolProps }: { activeTool: ToolId; toolProps: ToolProps }) {
  const { pdfBytes, currentPage, getCanvas, handleResult, ocrWords, selectedWord,
    onWordsLoaded, onStartWordSelect, signClickPos, onActivatePlace } = toolProps;
  return (
    <>
      {activeTool === "ocr" && (
        <OcrTool pdfBytes={pdfBytes} pageIndex={currentPage - 1} getCanvas={getCanvas} onResult={handleResult} />
      )}
      {activeTool === "replace" && (
        <ReplaceTool
          pdfBytes={pdfBytes}
          pageIndex={currentPage - 1}
          getCanvas={getCanvas}
          onResult={handleResult}
          ocrWords={ocrWords}
          selectedWord={selectedWord}
          onWordsLoaded={onWordsLoaded}
          onStartWordSelect={onStartWordSelect}
        />
      )}
      {activeTool === "annotate" && (
        <AnnotateTool pdfBytes={pdfBytes} pageIndex={currentPage - 1} onResult={handleResult} />
      )}
      {activeTool === "sign" && (
        <SignTool
          pdfBytes={pdfBytes}
          pageIndex={currentPage - 1}
          getCanvas={getCanvas}
          onResult={handleResult}
          signClickPos={signClickPos}
          onActivatePlace={onActivatePlace}
        />
      )}
      {activeTool === "fill" && (
        <FillTool pdfBytes={pdfBytes} onResult={handleResult} />
      )}
    </>
  );
}

// ─── Desktop right panel ─────────────────────────────────────────────────────
function RightPanel({
  t, download, activeTool, toolProps, history, onNewFile,
}: {
  t: (k: string) => string;
  download: () => void;
  activeTool: ToolId | null;
  toolProps: ToolProps;
  history: HistoryEntry[];
  onNewFile: () => void;
}) {
  return (
    <>
      <button
        onClick={download}
        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold transition-colors flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        {t("download_button")}
      </button>

      {activeTool && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow border border-slate-200 dark:border-slate-700 p-4">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-3 text-sm">
            {t(`tool_${activeTool}`)}
          </h3>
          <ToolContent activeTool={activeTool} toolProps={toolProps} />
        </div>
      )}

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

      <button
        onClick={onNewFile}
        className="w-full py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
      >
        ← {t("upload_button")}
      </button>
    </>
  );
}
