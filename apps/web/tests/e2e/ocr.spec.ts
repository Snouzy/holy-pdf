import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile, scannedPdfFile } from "./support";

test("reads the text of a scanned page and lays it over the page", async ({ page }) => {
  test.slow();
  await page.goto("/en/ocr-pdf");
  await chooseFiles(page, [await scannedPdfFile("scan.pdf", ["Holy"])]);
  const { name, bytes } = await exportWith(page, "Read the text");
  expect(name).toBe("scan-ocr.pdf");
  const [read] = await readWithPdfjs(bytes);
  expect(read?.text).toMatch(/Holy/i);
});

test("says so when every page already has its text", async ({ page }) => {
  await page.goto("/fr/ocr-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour tout le monde, voici une page qui a déjà son texte"])]);
  await page.getByRole("button", { name: "Lire le texte", exact: true }).click();
  await expect(page.getByText("Toutes les pages ont déjà leur texte : il n'y a rien à lire.")).toBeVisible();
});
