import { expect, test } from "@playwright/test";
import { chooseFiles, pdfFile } from "./support";

for (const width of [1280, 390]) {
  test(`adds text directly and offers placement at the clicked position at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 1280 ? 720 : 844 });
    await page.goto("/en/sign-pdf");
    await chooseFiles(page, [await pdfFile("insert.pdf", ["Contract"])]);
    await page.getByRole("button", { name: "Text", exact: true }).click();
    await page.getByLabel("Your text", { exact: true }).fill("Read and approved");
    const add = page.locator(".go").getByRole("button", { name: "Add to this page", exact: true });
    await expect(add).toBeEnabled();
    if (width === 1280) {
      await page.locator(".panel-content").evaluate((element) => { element.scrollTop = 0; });
      const action = (await add.boundingBox())!;
      const footer = (await page.locator(".go").boundingBox())!;
      const content = (await page.locator(".panel-content").boundingBox())!;
      expect(action.y).toBeGreaterThan(64);
      expect(action.y).toBeGreaterThanOrEqual(footer.y);
      expect(content.y + content.height).toBeLessThanOrEqual(action.y);
      expect(action.y + action.height).toBeLessThanOrEqual(720);
      expect(await add.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
      })).toBe(true);
      await page.screenshot({ path: test.info().outputPath("visible-add-without-panel-scroll.png") });
      await page.mouse.click(action.x + action.width / 2, action.y + action.height / 2);
    } else await add.click();
    await expect(page.locator(".signature-placement")).toHaveCount(1);
    await page.locator(".signature-page-image").click({ position: { x: 20, y: 20 } });
    await expect(page.locator(".is-selected")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Add here", exact: true })).toHaveCount(0);
    // Typing updates the candidate without a preparatory click.
    await page.getByLabel("Your text", { exact: true }).fill("M. B.");
    await expect(add).toBeEnabled();
    await page.getByRole("button", { name: "Rotate the page 90°", exact: true }).click();
    await page.getByRole("button", { name: "Zoom in", exact: true }).click();
    await page.locator(".signature-page-frame").scrollIntoViewIfNeeded();
    const sheet = (await page.locator(".signature-sheet").boundingBox())!;
    const point = { x: sheet.x + sheet.width * 0.65, y: sheet.y + sheet.height * 0.35 };
    await page.mouse.click(point.x, point.y);
    await page.getByRole("button", { name: "Add here", exact: true }).click();
    await expect(page.locator(".signature-placement")).toHaveCount(2);
    const placed = page.locator(".signature-placement").last();
    const center = await placed.evaluate((element) => {
      const style = (element as HTMLElement).style;
      return { x: parseFloat(style.left) + parseFloat(style.width) / 2, y: parseFloat(style.top) + parseFloat(style.height) / 2 };
    });
    expect(center.x).toBeCloseTo(35, 0);
    expect(center.y).toBeCloseTo(35, 0);
    await expect(page.getByRole("button", { name: "Add here", exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Sign the PDF", exact: true }).click();
    await expect(page.getByRole("button", { name: "Download the PDF", exact: true })).toBeVisible();
  });
}

test("never places a stale candidate after clearing text or switching modes", async ({ page }) => {
  await page.goto("/en/sign-pdf");
  await chooseFiles(page, [await pdfFile("draft.pdf", ["Contract"])]);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  const input = page.getByLabel("Your text", { exact: true });
  const add = page.locator(".go").getByRole("button", { name: "Add to this page", exact: true });
  await input.fill("Draft");
  await expect(add).toBeEnabled();
  await input.fill("");
  await expect(add).toBeDisabled();
  await page.locator(".signature-page-image").click({ position: { x: 40, y: 40 } });
  await expect(page.getByRole("button", { name: "Add here", exact: true })).toHaveCount(0);
  await input.fill("Signed");
  await add.click();
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  await page.locator(".signature-page-image").click({ position: { x: 40, y: 40 } });
  await expect(page.getByRole("button", { name: "Add here", exact: true })).toHaveCount(0);
  await expect(page.locator(".signature-placement")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Sign the PDF", exact: true })).toBeEnabled();
});

for (const lang of ["en", "fr"] as const) {
  for (const width of [1280, 390]) {
    test(`keeps the document and help stable while typing and selecting in ${lang} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(lang === "en" ? "/en/sign-pdf" : "/fr/signer-pdf");
      await chooseFiles(page, [await pdfFile("stable.pdf", ["Contract"])]);
      await page.getByRole("button", { name: lang === "en" ? "Text" : "Texte", exact: true }).click();
      await expect(page.locator(".signature-page-image")).toBeVisible();
      const help = page.locator("#signature-movement-help");
      const initialText = await help.locator('span[aria-hidden="false"]').innerText();
      await page.evaluate(() => {
        const help = document.querySelector<HTMLElement>("#signature-movement-help")!;
        const frame = document.querySelector<HTMLElement>(".signature-page-frame")!;
        const samples: { height: number; top: number; text: string }[] = [];
        const sample = () => samples.push({ height: help.getBoundingClientRect().height, top: frame.getBoundingClientRect().top + window.scrollY, text: help.querySelector('[aria-hidden="false"]')!.textContent! });
        const observer = new MutationObserver(sample);
        observer.observe(help, { attributes: true, subtree: true, childList: true, characterData: true });
        sample();
        Object.assign(window, { helpSamples: samples, stopHelpSampling: () => { sample(); observer.disconnect(); } });
      });
      const input = page.locator(".signature-typed input");
      const add = page.locator(".go .signature-add");
      await input.pressSequentially("Read and approved", { delay: 35 });
      await expect(add).toBeEnabled();
      await input.fill("");
      await expect(add).toBeDisabled();
      await input.pressSequentially("M. B.", { delay: 35 });
      await expect(add).toBeEnabled();
      const beforeSelection = await page.evaluate(() => (window as any).helpSamples);
      expect(beforeSelection.every((sample: { text: string }) => sample.text === initialText)).toBe(true);
      await add.click();
      await expect(page.locator(".signature-placement.is-selected")).toHaveCount(1);
      await page.locator(".signature-page-image").click({ position: { x: 20, y: 20 } });
      await expect(page.locator(".signature-placement.is-selected")).toHaveCount(0);
      const samples = await page.evaluate(() => { (window as any).stopHelpSampling(); return (window as any).helpSamples as { height: number; top: number }[]; });
      for (const sample of samples) {
        expect(sample.height).toBeCloseTo(samples[0]!.height, 1);
        expect(sample.top).toBeCloseTo(samples[0]!.top, 1);
      }
    });
  }
}
