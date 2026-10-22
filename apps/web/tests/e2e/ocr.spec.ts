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

test("reads Portuguese with its accents on the Brazilian page", async ({ page }) => {
  test.slow();
  await page.goto("/pt-br/ocr-pdf");
  const sentence = "Não há informação sobre a ação, nem sobre a conclusão.";
  // Read in French and English, this sentence came out as "Nao ha informaçäo sobre a açäo".
  await chooseFiles(page, [await scannedPdfFile("digitalizado.pdf", [sentence], 20)]);
  const { bytes } = await exportWith(page, "Reconhecer o texto");
  const [read] = await readWithPdfjs(bytes);
  expect(read?.text.trim()).toBe(sentence);
});

test("says so when every page already has its text", async ({ page }) => {
  await page.goto("/fr/ocr-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour tout le monde, voici une page qui a déjà son texte"])]);
  await page.getByRole("button", { name: "Lire le texte", exact: true }).click();
  await expect(page.getByText("Toutes les pages ont déjà leur texte : il n'y a rien à lire.")).toBeVisible();
});
