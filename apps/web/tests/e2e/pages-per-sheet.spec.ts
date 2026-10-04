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
