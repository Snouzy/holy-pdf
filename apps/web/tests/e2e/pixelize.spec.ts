import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("turns the pages into pictures with no text left", async ({ page }) => {
  await page.goto("/en/pixelize-pdf");
  await chooseFiles(page, [await pdfFile("letter.pdf", ["Dear", "Sincerely"])]);
  const { name, bytes } = await exportWith(page, "Pixelize the PDF");
  expect(name).toBe("letter-pixelized.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => [p.text, p.width, p.height])).toEqual([["", 595, 842], ["", 595, 842]]);
});
