import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";
import { chooseFiles, pdfFile, solidPng } from "./support";

for (const width of [1280, 390]) {
  test(`adds handwritten text and initials beside an existing signature at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const fonts: string[] = [];
    page.on("request", (request) => { if (request.url().includes("/fonts/signature/")) fonts.push(request.url()); });
    await page.goto("/en/sign-pdf");
    expect(fonts).toEqual([]);
    await chooseFiles(page, [await pdfFile("text.pdf", ["Contract"])]);
    await expect(page.getByAltText("PDF page preview 1", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Import an image", exact: true }).click();
    await page.getByLabel("Choose a PNG, JPG or JPEG", { exact: true }).setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: solidPng(150, 30, [200, 20, 30]) });
    await page.getByRole("button", { name: "Add to this page", exact: true }).click();
    const first = page.locator(".signature-placement").first();
    const originalImage = await first.locator("img").getAttribute("src");
    expect(fonts).toEqual([]);
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Your text", { exact: true }).fill("Lu et approuvé — Élodie");
    await expect(page.getByRole("button", { name: "Handwritten", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Add to this page", exact: true }).click();
    await expect(page.locator(".signature-placement")).toHaveCount(2);
    await expect(first.locator("img")).toHaveAttribute("src", originalImage!);
    await page.getByRole("button", { name: "Rotate the signature", exact: true }).press("Shift+ArrowRight");
    // Resizing an older signature must retain its own aspect ratio, not the text's ratio.
    const aspect = () => first.evaluate((element) => parseFloat((element as HTMLElement).style.width) / parseFloat((element as HTMLElement).style.height));
    const before = await aspect();
    await first.getByRole("button", { name: "Signature", exact: true }).press("+");
    expect(await aspect()).toBeCloseTo(before, 3);
    await page.getByLabel("Your text", { exact: true }).fill("É. M.");
    await page.getByRole("button", { name: "Simple", exact: true }).click();
    await page.getByRole("button", { name: "Add to this page", exact: true }).click();
    await expect(page.locator(".signature-placement")).toHaveCount(3);
    await page.getByRole("button", { name: "Draw", exact: true }).click();
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await expect(page.getByLabel("Your text", { exact: true })).toHaveValue("É. M.");
    expect(fonts).toHaveLength(1);
    expect(new URL(fonts[0]!).origin).toBe(new URL(page.url()).origin);
    await page.locator(".signature-typed").scrollIntoViewIfNeeded();
    await page.screenshot({ path: test.info().outputPath(`text-${width}.png`) });
    await page.getByRole("button", { name: "Sign the PDF", exact: true }).click();
    const pending = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download the PDF", exact: true }).click();
    const download = await pending;
    const loading = getDocument({ data: new Uint8Array(await readFile((await download.path())!)), useSystemFonts: true });
    const doc = await loading.promise;
    try {
      const pdfPage = await doc.getPage(1);
      expect((await pdfPage.getTextContent()).items.map((item) => "str" in item ? item.str : "").join("")).toBe("Contract");
      const operators = await pdfPage.getOperatorList();
      const images = operators.fnArray.flatMap((op, index) => op === OPS.paintImageXObject ? [operators.argsArray[index]![0]] : []);
      expect(images).toHaveLength(3);
      expect(new Set(images).size).toBe(3);
      for (const id of images.slice(1)) {
        const bitmap = await new Promise<{ width: number; height: number; data: Uint8ClampedArray }>((resolve) => pdfPage.objs.get(id, resolve));
        expect(bitmap.width * bitmap.height).toBeLessThanOrEqual(1_000_000);
        expect(bitmap.data.length).toBe(bitmap.width * bitmap.height * 4);
        expect(bitmap.data.some((value, index) => index % 4 === 3 && value === 0)).toBe(true);
        expect(bitmap.data.some((value, index) => index % 4 === 3 && value > 0)).toBe(true);
      }
    } finally { await loading.destroy(); }
  });
}

test("recovers from a handwriting font failure without exporting a fallback", async ({ page }) => {
  await page.route("**/fonts/signature/*.woff2", (route) => route.abort());
  await page.goto("/fr/signer-pdf");
  await chooseFiles(page, [await pdfFile("texte.pdf", ["Document"])]);
  await page.getByRole("button", { name: "Texte", exact: true }).click();
  await page.getByLabel("Votre texte", { exact: true }).fill("Lu et approuvé");
  await expect(page.getByRole("alert")).toContainText("style");
  await expect(page.getByRole("button", { name: "Ajouter sur cette page", exact: true })).toBeDisabled();
  await page.unroute("**/fonts/signature/*.woff2");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ajouter sur cette page", exact: true })).toBeEnabled();
  await page.getByLabel("Votre texte", { exact: true }).fill("   ");
  await expect(page.getByRole("button", { name: "Ajouter sur cette page", exact: true })).toBeDisabled();
  await expect(page.getByLabel("Votre texte", { exact: true })).toHaveAttribute("maxlength", "120");
});
