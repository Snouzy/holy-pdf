import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, truncatedPdfFile } from "./support";

test("repairs a PDF cut short, with every page it still holds", async ({ page }) => {
  await page.goto("/fr/reparer-pdf");
  await chooseFiles(page, [await truncatedPdfFile("rapport.pdf", ["Un", "Deux", "Trois"])]);
  await expect(page.locator(".file-card")).toContainText("3 pages");
  const { name, bytes } = await exportWith(page, "Réparer le PDF");
  expect(name).toBe("rapport-repare.pdf");
  expect((await readWithPdfjs(bytes)).map((read) => read.text)).toEqual(["Un", "Deux", "Trois"]);
});

test("says when nothing in a file can be read", async ({ page }) => {
  await page.goto("/en/repair-pdf");
  await chooseFiles(page, [{ name: "noise.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.7\nnot a PDF\n") }]);
  await expect(page.locator(".file-card")).toContainText("This PDF is too damaged: nothing in it can be read.");
  await expect(page.getByRole("button", { name: "Repair the PDF", exact: true })).toBeDisabled();
});
