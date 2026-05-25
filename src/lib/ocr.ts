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
 * Run OCR on a canvas element with automatic language detection.
 * Tries English + Somali combined first; falls back to English-only if
 * the Somali language data is unavailable on the CDN.
 */
export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (pct: number) => void
): Promise<OcrWord[]> {
  const workerOpts = {
    workerPath: "/tesseract-worker.min.js",
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

  const runOcr = async (language: string): Promise<OcrWord[]> => {
    const worker = await createWorker(language, 1, workerOpts);
    try {
      const result = await worker.recognize(canvas);
      return extractWords(result.data.blocks ?? []);
    } finally {
      await worker.terminate();
    }
  };

  // Try eng+som (covers Somali Latin script + English); fall back to eng-only
  // if the Somali traineddata is unavailable on the CDN.
  try {
    return await runOcr("eng+som");
  } catch {
    try {
      return await runOcr("eng");
    } catch (err) {
      throw err;
    }
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
