import { expect, test } from "@playwright/test";
import { chooseFiles, pdfFile, solidPng } from "./support";

for (const width of [1280, 390]) {
  test(`a rotated signature reaches the page edge and small signatures keep unobstructed controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/en/sign-pdf");
    await chooseFiles(page, [await pdfFile("edge.pdf", ["Document"])]);
    await expect(page.getByAltText("PDF page preview 1", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Import an image", exact: true }).click();
    await page.getByLabel("Choose a PNG, JPG or JPEG", { exact: true }).setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: solidPng(180, 36, [30, 50, 140]) });
    await page.getByRole("button", { name: "Add to this page", exact: true }).click();
    const rotate = page.getByRole("button", { name: "Rotate the signature", exact: true });
    // Keyboard rotation has its own test; here a synthetic key lost under load must not fail the edge checks.
    await expect(async () => {
      await rotate.press("Shift+ArrowRight");
      await expect(rotate).toHaveAttribute("title", /· 90°$/, { timeout: 300 });
    }).toPass();
    const placement = page.locator(".signature-placement");
    const move = placement.getByRole("button", { name: "Signature", exact: true });
    await move.scrollIntoViewIfNeeded();
    const before = (await placement.boundingBox())!;
    const sheet = (await page.locator(".signature-sheet").boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    await page.mouse.down();
    await page.mouse.move(Math.max(0, sheet.x - 40), before.y + before.height / 2, { steps: 12 });
    await page.mouse.up();
    expect((await placement.boundingBox())!.x).toBeCloseTo(sheet.x, 0);
    expect(await placement.evaluate((el) => parseFloat((el as HTMLElement).style.left))).toBeLessThan(0);
    // Return to the middle before checking that resizing keeps the center fixed.
    for (let i = 0; i < 8; i++) await move.press("Shift+ArrowRight");
    await expect(rotate).toHaveAttribute("title", /· 90°$/);
    const center = () => placement.evaluate((element) => {
      const style = (element as HTMLElement).style;
      return [parseFloat(style.left) + parseFloat(style.width) / 2, parseFloat(style.top) + parseFloat(style.height) / 2];
    });
    const centerBefore = await center();
    const resize = page.getByRole("button", { name: "Resize the signature", exact: true });
    for (let i = 0; i < 10; i++) await resize.press("-");
    const small = (await placement.boundingBox())!;
    const centerAfter = await center();
    expect(centerAfter[0]).toBeCloseTo(centerBefore[0]!, 3);
    expect(centerAfter[1]).toBeCloseTo(centerBefore[1]!, 3);
    const controls = (await page.locator(".signature-actions").boundingBox())!;
    expect(controls.y >= small.y + small.height || controls.y + controls.height <= small.y).toBe(true);
    const knob = await resize.locator("span").boundingBox();
    expect(knob!.width).toBeLessThanOrEqual(11);
    expect(knob!.height).toBeLessThanOrEqual(11);
    expect(await resize.evaluate((el) => Boolean(el.closest(".signature-placement")))).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`small-signature-${width}.png`), animations: "disabled" });
    // Clicking blank paper gives a clean preview without changing the signature.
    const geometry = await placement.getAttribute("style");
    await page.locator(".signature-page-image").click({ position: { x: 20, y: 20 } });
    await expect(placement).not.toHaveClass(/is-selected/);
    await expect(resize).toHaveCount(0);
    await expect(rotate).toHaveCount(0);
    await expect(placement).toHaveAttribute("style", geometry!);
    await expect(placement.locator("img")).toBeVisible();
    await move.click();
    await expect(resize).toBeVisible();
    await expect(rotate).toBeVisible();
    await move.press("Escape");
    await expect(placement).not.toHaveClass(/is-selected/);
    await move.focus();
    await expect(resize).toBeVisible();
    // Export a placement at the edge, including its negative pre-rotation x coordinate.
    for (let i = 0; i < 20; i++) await move.press("Shift+ArrowLeft");
    await page.getByRole("button", { name: "Sign the PDF", exact: true }).click();
    await expect(page.getByRole("button", { name: "Download the PDF", exact: true })).toBeVisible();
  });
}
