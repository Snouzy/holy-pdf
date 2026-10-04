import { strFromU8, unzipSync } from "fflate";
import { expect, test } from "@playwright/test";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("turns a PDF into a Word document with its text, one page after another", async ({ page }) => {
  await page.goto("/en/pdf-to-word");
  await chooseFiles(page, [await pdfFile("letter.pdf", ["Dear", "Sincerely"])]);
  const { name, bytes } = await exportWith(page, "Convert to Word");
  expect(name).toBe("letter-word.docx");
  const xml = strFromU8(unzipSync(bytes)["word/document.xml"]!);
  expect([...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map(([, text]) => text)).toEqual(["Dear", "Sincerely"]);
  expect(xml.match(/w:type="page"/g)).toHaveLength(1);
});
