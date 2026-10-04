import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("lays a letterhead under every page of a letter, keeping both texts", async ({ page }) => {
  await page.goto("/en/overlay-pdf");
  await chooseFiles(page, [await pdfFile("letter.pdf", ["Dear", "Sincerely"])]);
  const verb = page.getByRole("button", { name: "Overlay the PDFs", exact: true });
  await expect(verb).toBeDisabled();
  await page.locator(".layer-choice input[type=file]").setInputFiles(await pdfFile("letterhead.pdf", ["Holy"]));
  await expect(page.locator(".layer-name")).toContainText("letterhead.pdf · 1 page");
  await page.getByText("Under the pages").click();
  const { name, bytes } = await exportWith(page, "Overlay the PDFs");
  expect(name).toBe("letter-overlaid.pdf");
  expect((await readWithPdfjs(bytes)).map((read) => [...read.text].sort().join(""))).toEqual([[..."DearHoly"].sort().join(""), [..."SincerelyHoly"].sort().join("")]);
});

test("refuses a protected PDF to lay on, and says what to do", async ({ page }) => {
  await page.goto("/fr/superposer-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  await page.locator(".layer-choice input[type=file]").setInputFiles(await pdfFile("secret.pdf", ["Secret"], "1234"));
  await expect(page.getByRole("alert")).toHaveText("Ce PDF est protégé : déverrouillez-le d'abord avec Frère Passe-partout.");
  await expect(page.getByRole("button", { name: "Superposer les PDF", exact: true })).toBeDisabled();
});
