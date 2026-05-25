import Tesseract from "tesseract.js";

export interface OcrWord {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  conf: number;
}

export async function ocrCanvas(
  canvas: HTMLCanvasElement,
  lang: string,
  onProgress?: (pct: number) => void
): Promise<OcrWord[]> {
  const result = await Tesseract.recognize(canvas, lang, {
    logger: (m: Tesseract.LoggerMessage) => {
      if (m.status === "recognizing text" && onProgress) {
        onProgress(Math.round(m.progress * 100));
      }
    },
  });

  const words: OcrWord[] = [];
  const blocks = result.data.blocks ?? [];
  for (const block of blocks) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        for (const word of line.words) {
          const text = word.text.trim();
          if (!text || word.confidence < 0) continue;
          const { x0, y0, x1, y1 } = word.bbox;
          words.push({ text, x0, y0, x1, y1, conf: Math.round(word.confidence) });
        }
      }
    }
  }
  return words;
}
