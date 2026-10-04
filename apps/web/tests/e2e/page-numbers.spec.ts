import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("numbers the pages of a range in the chosen format and corner", async ({ page }) => {
  await page.goto("/en/page-numbers-pdf");
  await chooseFiles(page, [await pdfFile("report.pdf", ["Cover", "Intro", "Body"])]);
  await page.getByRole("radio", { name: /^1 \/ 12/ }).check();
  await page.getByRole("radio", { name: "Bottom right" }).check();
  await page.getByRole("radio", { name: /^A range of pages/ }).check();
  await page.getByLabel("From page").fill("2");
  const { name, bytes } = await exportWith(page, "Number the pages");
  expect(name).toBe("report-numbered.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["Cover", expect.stringMatching(/^Intro.*1 \/ 2$/), expect.stringMatching(/^Body.*2 \/ 2$/)]);
});
