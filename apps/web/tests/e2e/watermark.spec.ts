import { expect, test } from "@playwright/test";
import { closeDoc, openPdf } from "../../src/engine/documents";
import { renderPage } from "../../src/engine/render";
import { loadTestPdfium, readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile, solidPng } from "./support";

test("adds the typed watermark, refuses a text its font cannot write, and uses the default text when empty", async ({ page }) => {
  await page.goto("/en/watermark-pdf");
  await chooseFiles(page, [await pdfFile("quote.pdf", ["Quote", "Terms"])]);
  const text = page.getByLabel("Watermark text");
  await text.fill("Draft 🙂");
  await expect(page.getByRole("alert")).toContainText("cannot write");
  await expect(page.getByRole("button", { name: "Add the watermark", exact: true })).toBeDisabled();
  await text.fill("Draft é");
  // The alert leaves and the swatches move up: click them once they stand still.
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("radio", { name: "Gray" }).check();
  const { name, bytes } = await exportWith(page, "Add the watermark");
  expect(name).toBe("quote-watermarked.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => p.text.includes("Draft é"))).toEqual([true, true]);
  await page.getByRole("button", { name: "Watermark another PDF" }).click();
  await chooseFiles(page, [await pdfFile("memo.pdf", ["Memo"])]);
  await page.getByLabel("Watermark text").fill("");
  const second = await exportWith(page, "Add the watermark");
  expect((await readWithPdfjs(second.bytes))[0]?.text).toContain("CONFIDENTIAL");
});

test("previews the mark live, tiles it, burns it into the page, and takes a photo", async ({ page }) => {
  await page.goto("/fr/filigrane-pdf");
  await chooseFiles(page, [{ name: "carte.png", mimeType: "image/png", buffer: solidPng(600, 380, [235, 235, 235]) }]);
  await page.getByRole("button", { name: "Convertir", exact: true }).click();
  const lines = page.locator(".mark-sheet svg text");
  await expect(page.locator(".mark-sheet img")).toBeVisible();
  await expect(lines).toHaveCount(1);
  await page.getByText("En mosaïque", { exact: true }).click();
  expect(await lines.count()).toBeGreaterThan(5);
  await expect(page.getByRole("checkbox", { name: /Incruster dans la page/ })).toBeChecked();
  await page.getByLabel("Texte du filigrane").fill("Pour l'agence Dupont");
  await expect(lines.first()).toContainText("Pour l'agence Dupont");
  const { bytes } = await exportWith(page, "Ajouter le filigrane");
  expect((await readWithPdfjs(bytes))[0]?.text).toBe("");
  const p = await loadTestPdfium();
  const doc = openPdf(p, bytes);
  const { pixels, width, height } = renderPage(p, doc, 0, 300);
  closeDoc(p, doc);
  let reddish = 0;
  for (let at = 0; at < width * height * 4; at += 4) if (pixels[at]! - pixels[at + 1]! > 30) reddish++;
  expect(reddish).toBeGreaterThan(1000);
});
