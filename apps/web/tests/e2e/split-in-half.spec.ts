import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("cuts every page into a top and a bottom half", async ({ page }) => {
  await page.goto("/en/split-pages-in-half");
  await chooseFiles(page, [await pdfFile("book.pdf", ["One", "Two"])]);
  await page.getByRole("radio", { name: /^Top \| bottom/ }).check();
  const { name, bytes } = await exportWith(page, "Cut the pages");
  expect(name).toBe("book-halves.pdf");
  const pages = await readWithPdfjs(bytes);
  expect(pages).toHaveLength(4);
  expect(pages.every(({ width, height }) => width > height)).toBe(true);
});
