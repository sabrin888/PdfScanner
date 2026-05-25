import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { OcrWord } from "./ocr";

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return [r, g, b];
}

export async function addOcrLayer(
  pdfBytes: Uint8Array,
  pageIndex: number,
  words: OcrWord[],
  canvasWidth: number,
  canvasHeight: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageIndex];
  const { width: pdfW, height: pdfH } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const scaleX = pdfW / canvasWidth;
  const scaleY = pdfH / canvasHeight;

  for (const w of words) {
    const x = w.x0 * scaleX;
    const pdfY = pdfH - w.y1 * scaleY;
    const boxH = (w.y1 - w.y0) * scaleY;
    const fontSize = Math.max(4, boxH * 0.9);
    page.drawText(w.text, {
      x,
      y: pdfY,
      size: fontSize,
      font,
      color: rgb(1, 1, 1),
      opacity: 0.01,
    });
  }
  return doc.save();
}

export async function replaceText(
  pdfBytes: Uint8Array,
  pageIndex: number,
  words: OcrWord[],
  findText: string,
  newText: string,
  fontSize: number | null,
  fgHex: string,
  bgHex: string,
  canvasWidth: number,
  canvasHeight: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageIndex];
  const { width: pdfW, height: pdfH } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const scaleX = pdfW / canvasWidth;
  const scaleY = pdfH / canvasHeight;

  const matched = words.filter((w) =>
    w.text.toLowerCase().includes(findText.toLowerCase())
  );

  if (matched.length === 0) return pdfBytes;

  const [bgR, bgG, bgB] = hexToRgb(bgHex);
  const [fgR, fgG, fgB] = hexToRgb(fgHex);

  for (const w of matched) {
    const x0 = w.x0 * scaleX;
    const x1 = w.x1 * scaleX;
    const y0pdf = pdfH - w.y1 * scaleY;
    const y1pdf = pdfH - w.y0 * scaleY;
    const boxH = y1pdf - y0pdf;
    const boxW = x1 - x0;

    page.drawRectangle({
      x: x0,
      y: y0pdf,
      width: boxW,
      height: boxH,
      color: rgb(bgR, bgG, bgB),
    });

    const fs = fontSize ?? boxH * 0.8;
    page.drawText(newText, {
      x: x0,
      y: y0pdf + boxH * 0.18,
      size: Math.max(4, fs),
      font,
      color: rgb(fgR, fgG, fgB),
    });
  }
  return doc.save();
}

export async function annotateText(
  pdfBytes: Uint8Array,
  pageIndex: number,
  x: number,
  y: number,
  text: string,
  fontSize: number,
  colorHex: string
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageIndex];
  const { height: pdfH } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const [r, g, b] = hexToRgb(colorHex);
  page.drawText(text, {
    x,
    y: pdfH - y,
    size: fontSize,
    font,
    color: rgb(r, g, b),
  });
  return doc.save();
}

export async function annotateBox(
  pdfBytes: Uint8Array,
  pageIndex: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  colorHex: string,
  lineWidth: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageIndex];
  const { height: pdfH } = page.getSize();
  const [r, g, b] = hexToRgb(colorHex);
  page.drawRectangle({
    x: x0,
    y: pdfH - y1,
    width: x1 - x0,
    height: y1 - y0,
    borderColor: rgb(r, g, b),
    borderWidth: lineWidth,
  });
  return doc.save();
}

export async function annotateHighlight(
  pdfBytes: Uint8Array,
  pageIndex: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageIndex];
  const { height: pdfH } = page.getSize();
  page.drawRectangle({
    x: x0,
    y: pdfH - y1,
    width: x1 - x0,
    height: y1 - y0,
    color: rgb(1, 1, 0),
    opacity: 0.4,
  });
  return doc.save();
}

export async function stampSignature(
  pdfBytes: Uint8Array,
  pageIndex: number,
  imageBytes: Uint8Array,
  x: number,
  y: number,
  w: number,
  h: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageIndex];
  const { height: pdfH } = page.getSize();
  const img = await doc.embedPng(imageBytes);
  page.drawImage(img, {
    x,
    y: pdfH - y - h,
    width: w,
    height: h,
  });
  return doc.save();
}

export async function fillFormFields(
  pdfBytes: Uint8Array,
  fields: Record<string, string>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  for (const [name, value] of Object.entries(fields)) {
    try {
      const field = form.getField(name);
      if (field.constructor.name === "PDFTextField") {
        (field as import("pdf-lib").PDFTextField).setText(value);
      } else if (field.constructor.name === "PDFCheckBox") {
        if (value === "true") (field as import("pdf-lib").PDFCheckBox).check();
        else (field as import("pdf-lib").PDFCheckBox).uncheck();
      }
    } catch {
      // field not found or unsupported type — skip
    }
  }
  form.flatten();
  return doc.save();
}


export async function getFormFieldsAsync(
  pdfBytes: Uint8Array
): Promise<Array<{ name: string; type: string; value: string }>> {
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  return form.getFields().map((f) => ({
    name: f.getName(),
    type: f.constructor.name.replace("PDF", ""),
    value: f.constructor.name === "PDFTextField"
      ? ((f as import("pdf-lib").PDFTextField).getText() ?? "")
      : f.constructor.name === "PDFCheckBox"
        ? String((f as import("pdf-lib").PDFCheckBox).isChecked())
        : "",
  }));
}
