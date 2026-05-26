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

/**
 * Replace (or erase) a dragged rectangular region.
 *
 * The region is covered with the supplied background colour (sampled from the
 * page so it blends with coloured backgrounds / logos), then the new text — if
 * any — is written on top in a contrasting colour. Pass an empty newText to
 * simply erase the region.
 *
 * `rect` and the canvas dimensions are in CSS pixels (the size the page is
 * displayed at), so they map cleanly onto PDF points.
 */
export async function replaceRegion(
  pdfBytes: Uint8Array,
  pageIndex: number,
  rect: { x: number; y: number; w: number; h: number },
  newText: string,
  bgColor: { r: number; g: number; b: number },
  fontSize: number | null,
  canvasCssWidth: number,
  canvasCssHeight: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageIndex];
  const { width: pdfW, height: pdfH } = page.getSize();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const scaleX = pdfW / canvasCssWidth;
  const scaleY = pdfH / canvasCssHeight;

  const x = rect.x * scaleX;
  const boxW = rect.w * scaleX;
  const boxH = rect.h * scaleY;
  const y = pdfH - (rect.y + rect.h) * scaleY; // PDF origin is bottom-left

  // Cover the region with the sampled background colour
  page.drawRectangle({
    x, y, width: boxW, height: boxH,
    color: rgb(bgColor.r / 255, bgColor.g / 255, bgColor.b / 255),
  });

  // Write the replacement text, auto-sized to the box, in a contrasting colour
  if (newText) {
    const luminance = 0.299 * bgColor.r + 0.587 * bgColor.g + 0.114 * bgColor.b;
    const textColor = luminance > 140 ? rgb(0, 0, 0) : rgb(1, 1, 1);
    let fs = fontSize ?? boxH * 0.7;
    // Shrink to fit width if the text would overflow the box
    const maxW = boxW * 0.96;
    let textW = font.widthOfTextAtSize(newText, fs);
    while (textW > maxW && fs > 4) {
      fs -= 0.5;
      textW = font.widthOfTextAtSize(newText, fs);
    }
    page.drawText(newText, {
      x: x + boxW * 0.03,
      y: y + (boxH - fs) / 2 + fs * 0.12,
      size: Math.max(4, fs),
      font,
      color: textColor,
    });
  }

  return doc.save();
}

/** Stamp a signature image using CSS-pixel coordinates (converted to PDF space internally). */
export async function stampSignatureAtCss(
  pdfBytes: Uint8Array,
  pageIndex: number,
  imageBytes: Uint8Array,
  cssX: number,
  cssY: number,
  cssW: number,
  cssH: number,
  canvasCssWidth: number,
  canvasCssHeight: number
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const page = doc.getPages()[pageIndex];
  const { width: pdfW, height: pdfH } = page.getSize();
  const scaleX = pdfW / canvasCssWidth;
  const scaleY = pdfH / canvasCssHeight;

  const pdfX = cssX * scaleX;
  const sigH = cssH * scaleY;
  const pdfY = pdfH - cssY * scaleY - sigH;
  const sigW = cssW * scaleX;

  const img = await doc.embedPng(imageBytes);
  page.drawImage(img, { x: pdfX, y: pdfY, width: sigW, height: sigH });
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
