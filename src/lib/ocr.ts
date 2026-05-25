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
 * Run OCR on a canvas element.
 *
 * The Tesseract worker script is served locally (/tesseract-worker.min.js)
 * so it works without a CDN. Language training data is fetched from jsDelivr
 * on first use and then cached in the browser's Cache Storage.
 *
 * If the requested language fails to download (e.g. "som" not on CDN),
 * the function automatically retries with English only.
 */
export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  lang: string,
  onProgress?: (pct: number) => void
): Promise<OcrWord[]> {
  const workerOpts = {
    // Use the local worker script — avoids CDN dependency for the JS file
    workerPath: "/tesseract-worker.min.js",
    // Language data comes from jsDelivr CDN (cached in browser after first load)
    // No langPath override needed — Tesseract.js builds the URL per-language
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      if (onProgress) {
        if (m.status === "loading language traineddata") {
          onProgress(Math.round(m.progress * 40));        // 0–40%: downloading lang
        } else if (m.status === "initializing api") {
          onProgress(50);
        } else if (m.status === "recognizing text") {
          onProgress(50 + Math.round(m.progress * 50));   // 50–100%: recognising
        }
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

  try {
    return await runOcr(lang);
  } catch (err) {
    // Somali traineddata may not be available on the CDN — fall back to English
    if (lang !== "eng") {
      console.warn(`OCR failed for lang="${lang}", retrying with "eng"`, err);
      return await runOcr("eng");
    }
    throw err;
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
