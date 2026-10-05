import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("protects a PDF once both passwords match, and the copy opens with that password only", async ({ page }) => {
  await page.goto("/en/protect-pdf");
  await chooseFiles(page, [await pdfFile("contract.pdf", ["Contract"])]);
  const verb = page.getByRole("button", { name: "Protect the PDF", exact: true });
  await expect(verb).toBeDisabled();
  await page.getByLabel("Password", { exact: true }).fill("s3cret");
  await page.getByLabel("Confirm the password").fill("s3cre");
  await expect(page.getByRole("alert")).toHaveText("The two passwords do not match.");
  await expect(verb).toBeDisabled();
  await page.getByLabel("Confirm the password").fill("s3cret");
  await expect(verb).toBeEnabled();
  const { name, bytes } = await exportWith(page, "Protect the PDF");
  expect(name).toBe("contract-protected.pdf");
  // The copy is encrypted: the preview opens it with the password just set.
  await page.getByRole("button", { name: "View", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Preview" });
  await expect(preview).toContainText("Page 1 of 1");
  await expect(preview.locator("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(readWithPdfjs(bytes)).rejects.toThrow();
  expect((await readWithPdfjs(bytes, "s3cret")).map((p) => p.text)).toEqual(["Contract"]);
});

test("unlocks a PDF opened with its password, and the copy opens without one", async ({ page }) => {
  await page.goto("/en/unlock-pdf");
  await chooseFiles(page, [await pdfFile("statement.pdf", ["Statement"], "open-sesame")]);
  await page.getByLabel("Password").fill("open-sesame");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  const { name, bytes } = await exportWith(page, "Unlock the PDF");
  expect(name).toBe("statement-unlocked.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["Statement"]);
});
