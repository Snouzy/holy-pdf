import { expect, type Page, test } from "@playwright/test";
import { chooseFiles, pdfFile, solidPng } from "./support";

async function placeSignature(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto("/en/sign-pdf");
  await chooseFiles(page, [await pdfFile("move.pdf", ["Document"])]);
  await expect(page.getByAltText("PDF page preview 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Import an image", exact: true }).click();
  await page.getByLabel("Choose a PNG, JPG or JPEG", { exact: true }).setInputFiles({ name: "signature.png", mimeType: "image/png", buffer: solidPng(150, 30, [30, 50, 140]) });
  await page.getByRole("button", { name: "Add to this page", exact: true }).click();
}

for (const width of [1280, 390]) {
  test(`moves a signature with its four-arrow handle, by pointer and by keyboard, at ${width}px`, async ({ page }) => {
    await placeSignature(page, width);
    const placement = page.locator(".signature-placement");
    const position = () => placement.evaluate((element) => [parseFloat((element as HTMLElement).style.left), parseFloat((element as HTMLElement).style.top)]);
    const handle = page.getByRole("button", { name: "Move the signature", exact: true });
    // Scrolled to the bottom edge, the handle sits under the floating page bar.
    await handle.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const [left = 0, top = 0] = await position();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 - 30, box.y + box.height / 2 - 20, { steps: 8 });
    await page.mouse.up();
    const [movedLeft = 0, movedTop = 0] = await position();
    expect(movedLeft).toBeLessThan(left);
    expect(movedTop).toBeLessThan(top);
    await expect(page.locator(".signature-placement.is-selected")).toHaveCount(1);
    // Two presses in a row: the second one starts from the first, none is lost.
    await handle.press("ArrowRight");
    await handle.press("ArrowRight");
    await expect.poll(async () => (await position())[0]).toBeCloseTo(movedLeft + 1, 3);
  });
}

test("keeps the three signature modes the same size, on one line, in Draw and in Text", async ({ page }) => {
  await placeSignature(page, 1280);
  const modes = page.locator(".signature-modes button");
  const sizes = () => modes.evaluateAll((buttons) => buttons.map((button) => [Math.round(button.getBoundingClientRect().width), Math.round(button.getBoundingClientRect().height)]));
  await page.getByRole("button", { name: "Draw", exact: true }).click();
  const draw = await sizes();
  expect(new Set(draw.map(([, height]) => height)).size).toBe(1);
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await page.getByLabel("Your text", { exact: true }).fill("Mathias Bradiceanu");
  expect(await sizes()).toEqual(draw);
  // Headless browsers hide scrollbars: check that the longest label still fits once a classic 15 px scrollbar takes its share.
  await page.evaluate(() => document.fonts.ready);
  const figtree = await page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    const width = (font: string) => { context.font = font; return context.measureText("Import an image").width; };
    return width('700 14px "Figtree Variable", monospace') !== width("700 14px monospace");
  });
  test.skip(!figtree, "The site font did not load in this run: a fallback font's width says nothing about the tabs.");
  const room = await page.getByRole("button", { name: "Import an image", exact: true }).evaluate((button) => {
    const style = getComputedStyle(button);
    const range = document.createRange();
    range.selectNodeContents(button);
    const text = range.getBoundingClientRect().width;
    const content = button.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const gutter = getComputedStyle(button.closest(".panel-content")!).scrollbarGutter;
    return { spare: content - 15 / 3 - text, gutter };
  });
  expect(room.gutter).toBe("stable");
  expect(room.spare).toBeGreaterThanOrEqual(0);
});

test("brings a focused signature control above the floating page bar", async ({ page }) => {
  await placeSignature(page, 1280);
  const handle = page.getByRole("button", { name: "Move the signature", exact: true });
  await handle.evaluate((element) => {
    const top = element.getBoundingClientRect().top + scrollY;
    scrollTo(0, top - innerHeight + 30);
  });
  await handle.focus();
  const reachable = await handle.evaluate((element) => {
    const box = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2));
  });
  expect(reachable).toBe(true);
});
