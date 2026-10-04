import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("flattens a PDF into a copy that keeps its text", async ({ page }) => {
  await page.goto("/en/flatten-pdf");
  await chooseFiles(page, [await pdfFile("form.pdf", ["Form"])]);
  const { name, bytes } = await exportWith(page, "Flatten the PDF");
  expect(name).toBe("form-flattened.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["Form"]);
});
