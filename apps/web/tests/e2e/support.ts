import { readFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";
import { expect, type Locator, type Page } from "@playwright/test";
import { closeDoc, openPdf } from "../../src/engine/documents";
import type { Pdfium } from "../../src/engine/pdfium";
import { pixelizePdf } from "../../src/engine/pixelize";
import { transformPdf } from "../../src/engine/transform";
import type { Bookmark } from "../../src/engine/types";
import { encodeTestJpeg, formPdf, loadTestPdfium, photoPdf, textPdf } from "../engine/support";
import { loadCv, pagePhoto, sidewaysTextPhoto } from "../scan/support";
import { encode as encodeJpeg } from "jpeg-js";

let pdfium: Promise<Pdfium> | undefined;

/** One page with a text field "name" (Jean), a checked box "ok" and a combo "city" (Lyon): see `formPdf`. */
export const formFile = () => ({ name: "form.pdf", mimeType: "application/pdf", buffer: Buffer.from(formPdf()) });

export async function pdfFile(name: string, labels: string[], password?: string) {
  pdfium ??= loadTestPdfium();
  return { name, mimeType: "application/pdf", buffer: Buffer.from(textPdf(await pdfium, labels, {}, password)) };
}

export async function bookmarkedPdfFile(name: string, labels: string[], bookmarks: Bookmark[]) {
  pdfium ??= loadTestPdfium();
  const p = await pdfium;
  const doc = openPdf(p, textPdf(p, labels));
  try {
    return { name, mimeType: "application/pdf", buffer: Buffer.from(transformPdf(p, doc, { kind: "bookmarks", bookmarks })) };
  } finally {
    closeDoc(p, doc);
  }
}

/** A PDF cut at 80 %, as a download that stopped: PDFium cannot open it. */
export async function truncatedPdfFile(name: string, labels: string[]) {
  const whole = (await pdfFile(name, labels)).buffer;
  return { name, mimeType: "application/pdf", buffer: whole.subarray(0, Math.floor(whole.length * 0.8)) };
}

/** Pages that show their label in a picture, with no text: what a scanner makes. */
export async function scannedPdfFile(name: string, labels: string[]) {
  pdfium ??= loadTestPdfium();
  const p = await pdfium;
  const doc = openPdf(p, textPdf(p, labels));
  const bytes = await pixelizePdf(p, doc, 150, encodeTestJpeg);
  closeDoc(p, doc);
  return { name, mimeType: "application/pdf", buffer: Buffer.from(bytes) };
}

/** A JPEG photo of an A4 page lying askew on a dark desk. */
export async function deskPhotoFile(name: string) {
  const cv = await loadCv();
  // An A4 ratio in pixels: 0.66 × 1200 wide, 0.71 × 1600 high, about √2.
  const quad = { topLeft: { x: 0.17, y: 0.13 }, topRight: { x: 0.83, y: 0.15 }, bottomRight: { x: 0.84, y: 0.84 }, bottomLeft: { x: 0.16, y: 0.82 } };
  const photo = pagePhoto(cv, quad);
  const jpeg = encodeJpeg({ data: photo.data, width: photo.cols, height: photo.rows }, 90).data;
  photo.delete();
  return { name, mimeType: "image/jpeg", buffer: Buffer.from(jpeg) };
}

/** A JPEG photo of a page of text, lying sideways on a desk. */
export async function sidewaysPageFile(name: string, lines: string[]) {
  const cv = await loadCv();
  const quad = { topLeft: { x: 0.12, y: 0.1 }, topRight: { x: 0.88, y: 0.1 }, bottomRight: { x: 0.88, y: 0.9 }, bottomLeft: { x: 0.12, y: 0.9 } };
  const photo = sidewaysTextPhoto(cv, quad, lines);
  const jpeg = encodeJpeg({ data: photo.data, width: photo.cols, height: photo.rows }, 92).data;
  photo.delete();
  return { name, mimeType: "image/jpeg", buffer: Buffer.from(jpeg) };
}

export async function photoPdfFile(name: string, labels: string[]) {
  pdfium ??= loadTestPdfium();
  return { name, mimeType: "application/pdf", buffer: Buffer.from(photoPdf(await pdfium, labels, { width: 1600, height: 2200 })) };
}

export async function chooseFiles(page: Page, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await page.locator("input[type=file]").first().setInputFiles(files);
}

/** Playwright cannot drag from the desktop: the page gets the same events a file dropped from Finder fires. */
export async function dragFiles(
  page: Page,
  selector: string,
  files: { name: string; mimeType: string; buffer: Buffer }[],
  types = ["dragenter", "dragover", "drop"],
) {
  const encoded = files.map(({ name, mimeType, buffer }) => ({ name, mimeType, bytes: buffer.toString("base64") }));
  await page.evaluate(
    ({ selector, encoded, types }) => {
      const transfer = new DataTransfer();
      for (const { name, mimeType, bytes } of encoded) {
        transfer.items.add(new File([Uint8Array.from(atob(bytes), (char) => char.charCodeAt(0))], name, { type: mimeType }));
      }
      const target = document.querySelector(selector);
      for (const type of types) target?.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: transfer }));
    },
    { selector, encoded, types },
  );
}

/** An island listens only once its effects have run, a little after hydration: a drag sent sooner is lost. */
export async function hoverFiles(page: Page, selector: string, files: { name: string; mimeType: string; buffer: Buffer }[]) {
  await expect(async () => {
    await dragFiles(page, selector, files, ["dragenter"]);
    await expect(page.locator("html")).toHaveAttribute("data-dropping", "", { timeout: 500 });
  }).toPass();
}

export async function expectThumbnails(page: Page, count: number) {
  await expect(page.locator(".pages img")).toHaveCount(count);
}

const looks = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return [style.backgroundColor, style.borderColor, style.color, style.boxShadow, style.transform, style.outlineStyle, style.textDecorationLine].join("|");
  });

/** Hovering must change how the control itself looks: its colours, shadow, position, outline or underline. */
export async function expectHoverFeedback(locator: Locator) {
  await locator.page().mouse.move(1, 1);
  const before = await looks(locator);
  await locator.hover();
  await expect.poll(() => looks(locator)).not.toBe(before);
}

/** A control that cannot act, or a picture that is no control, must look the same under the pointer. */
export async function expectNoHoverFeedback(locator: Locator) {
  await locator.page().mouse.move(1, 1);
  const before = await looks(locator);
  await locator.hover();
  await locator.evaluate(async (element) => {
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await Promise.all(element.getAnimations().map((animation) => animation.finished));
  });
  expect(await looks(locator)).toBe(before);
}

/** Runs a tool with its verb button, then downloads what the result page offers. */
export async function exportWith(page: Page, verb: string) {
  await page.getByRole("button", { name: verb, exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /^(Download|Télécharger)/ }).click();
  const download = await downloading;
  return { name: download.suggestedFilename(), bytes: new Uint8Array(await readFile(await download.path())) };
}

/** dnd-kit measures the pages in the frames after a pickup; an arrow key pressed before that is ignored. */
export async function nextFrames(page: Page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/** An RGB PNG of one colour, encoded here: no image library, no photo on disk. */
export function solidPng(width: number, height: number, [red, green, blue]: [number, number, number]): Buffer {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set([red, green, blue], 1 + x * 3);
  const chunk = (type: string, data: Buffer) => {
    const typed = Buffer.concat([Buffer.from(type), data]);
    const frame = Buffer.alloc(8);
    frame.writeUInt32BE(data.length, 0);
    frame.writeUInt32BE(crc32(typed), 4);
    return Buffer.concat([frame.subarray(0, 4), typed, frame.subarray(4)]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** The outermost elements past the right edge, outside any scroller: names the culprit when a page overflows. */
export function overflowing(page: Page): Promise<string> {
  return page.evaluate(() => {
    const scrolls = (element: Element) => ["auto", "scroll", "hidden", "clip"].includes(getComputedStyle(element).overflowX);
    const inScroller = (element: Element) => { for (let up = element.parentElement; up; up = up.parentElement) if (scrolls(up)) return true; return false; };
    return [...document.querySelectorAll("body *")]
      .filter((element) => element.getBoundingClientRect().right > innerWidth + 0.5 && (element.parentElement?.getBoundingClientRect().right ?? 0) <= innerWidth + 0.5 && !inScroller(element))
      .slice(0, 5)
      .map((element) => `${element.tagName.toLowerCase()}.${element.className} → ${Math.round(element.getBoundingClientRect().right)} px « ${element.textContent?.trim().slice(0, 40)} »`)
      .join("; ");
  });
}

export async function switchLanguage(page: Page, name: string) {
  const header = page.locator(".site-header");
  await header.locator(".language-menu summary").click();
  await header.locator(".language-drop").getByRole("link", { name, exact: true }).click();
}
