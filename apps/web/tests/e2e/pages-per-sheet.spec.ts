import { unzipSync } from "fflate";
import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("lays two pages on each landscape sheet", async ({ page }) => {
  await page.goto("/en/pages-per-sheet");
  await chooseFiles(page, [await pdfFile("slides.pdf", ["A", "B", "C"])]);
  await page.getByRole("radio", { name: /^2 pages/ }).check();
  const { name, bytes } = await exportWith(page, "Lay out the sheets");
  expect(name).toBe("slides-per-sheet.pdf");
  const sheets = await readWithPdfjs(bytes);
  expect(sheets.map(({ width, height }) => width > height)).toEqual([true, true]);
  expect(sheets.map((sheet) => sheet.text.replace(/\s/g, ""))).toEqual(["AB", "C"]);
});

test("keeps two input PDFs as two separate N-up outputs", async ({ page }) => {
  await page.goto("/en/pages-per-sheet");
  await chooseFiles(page, [
    await pdfFile("alpha.pdf", ["A1", "A2", "A3"]),
    await pdfFile("beta.pdf", ["B1", "B2"]),
  ]);
  await page.getByRole("radio", { name: /^2 pages/ }).check();
  const { name, bytes } = await exportWith(page, "Lay out the sheets");
  expect(name).toMatch(/\.zip$/);

  const files = unzipSync(bytes);
  expect(Object.keys(files)).toEqual(["alpha-per-sheet.pdf", "beta-per-sheet.pdf"]);
  const alpha = await readWithPdfjs(files["alpha-per-sheet.pdf"]!);
  const beta = await readWithPdfjs(files["beta-per-sheet.pdf"]!);
  expect(alpha.map((sheet) => sheet.text.replace(/\s/g, ""))).toEqual(["A1A2", "A3"]);
  expect(beta.map((sheet) => sheet.text.replace(/\s/g, ""))).toEqual(["B1B2"]);
  expect(alpha.every(({ width, height }) => width > height)).toBe(true);
  expect(beta.every(({ width, height }) => width > height)).toBe(true);
});
