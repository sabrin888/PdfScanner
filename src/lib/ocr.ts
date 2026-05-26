import { createWorker } from "tesseract.js";

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  conf: number;
}

/**
 * Run OCR on a canvas element — fully offline (no CDN).
 *
 * The worker script, WASM engine, and English language data are all served
 * from /public so OCR works without any network access. Somali is written in
 * the Latin alphabet, so the English model reads printed Somali text correctly
 * at the character level (Tesseract ships no dedicated Somali model).
 */
export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (pct: number) => void
): Promise<OcrWord[]> {
  const workerOpts = {
    workerPath: "/tesseract-worker.min.js",
    corePath: "/tesseract-core",   // local WASM engine (Tesseract picks the variant)
    langPath: "/tessdata",         // local eng.traineddata.gz
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (!onProgress) return;
      if (m.status === "loading language traineddata") {
        onProgress(Math.round(m.progress * 40));
      } else if (m.status === "initializing api") {
        onProgress(50);
      } else if (m.status === "recognizing text") {
        onProgress(50 + Math.round(m.progress * 50));
      }
    },
  };

  const worker = await createWorker("eng", 1, workerOpts);
  try {
    const result = await worker.recognize(canvas);
    return extractWords(result.data.blocks ?? []);
  } finally {
    await worker.terminate();
  }
}

function extractWords(blocks: Tesseract.Block[]): OcrWord[] {
  const words: OcrWord[] = [];
  for (const block of blocks) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        for (const word of line.words) {
          const text = word.text.trim();
          if (!text || word.confidence < 20) continue;
          const { x0, y0, x1, y1 } = word.bbox;
          words.push({ text, x0, y0, x1, y1, conf: Math.round(word.confidence) });
        }
      }
    }
  }
  return words;
}
