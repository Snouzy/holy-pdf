import { expect, test } from "@playwright/test";
import { gradientJpeg, readWithPdfjs, withOrientation } from "../engine/support";
import { chooseFiles, dragFiles, expectThumbnails, exportWith, hoverFiles, pdfFile, solidPng } from "./support";

test("turns a phone photo upright on its page", async ({ page }) => {
  await page.goto("/en/jpg-to-pdf");
  const photo = { name: "photo.jpg", mimeType: "image/jpeg", buffer: Buffer.from(withOrientation(gradientJpeg, 6)) };
  await chooseFiles(page, [photo]);
  await expectThumbnails(page, 1);
  const { name, bytes } = await exportWith(page, "Make the PDF");
  expect(name).toBe("photo-converted.pdf");
  const [first] = await readWithPdfjs(bytes);
  expect(first?.rotation).toBe(90);
});

test("refuses a text file renamed to .pdf", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [{ name: "notes.pdf", mimeType: "application/pdf", buffer: Buffer.from("just some text") }]);
  await expect(page.getByRole("alert")).toHaveText("This file format is not supported.");
});

test("offers to turn images into pages on Merge", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"]), { name: "red.png", mimeType: "image/png", buffer: solidPng(300, 200, [200, 30, 30]) }]);
  const question = page.getByRole("dialog");
  await expect(question).toContainText("red.png is an image. Shall I turn it into a PDF page before merging?");
  await question.getByRole("button", { name: "Leave out" }).click();
  await expectThumbnails(page, 1);
  await expect(page.getByRole("alert")).toHaveCount(0);
  await chooseFiles(page, [
    { name: "blue.png", mimeType: "image/png", buffer: solidPng(200, 300, [30, 30, 200]) },
    { name: "green.png", mimeType: "image/png", buffer: solidPng(200, 300, [30, 200, 30]) },
  ]);
  await expect(question).toContainText("These are 2 images. Shall I turn them into PDF pages before merging?");
  // The dialog lives beside the board, not inside it: its buttons must still wear the board's style, not the browser's.
  await expect(question.getByRole("button", { name: "Convert" })).toHaveCSS("font-weight", "700");
  await question.getByRole("button", { name: "Convert" }).click();
  await expectThumbnails(page, 3);
  await expect(page.locator(".file-tab")).toHaveCount(3);
  const { name, bytes } = await exportWith(page, "Merge the PDFs");
  expect(name).toBe("a-merged.pdf");
  const pages = await readWithPdfjs(bytes);
  expect(pages.map((p) => p.text)).toEqual(["A1", "", ""]);
  expect(pages.slice(1).map((p) => [p.width, p.height])).toEqual([[595, 842], [595, 842]]);
});

test("opens a protected PDF with its password and writes it unprotected", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("secret.pdf", ["S1"], "open-sesame")]);
  await expect(page.getByRole("alert")).toHaveText("This PDF is protected by a password.");
  await page.getByLabel("Password").fill("wrong");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong password.");
  await page.getByLabel("Password").fill("open-sesame");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expectThumbnails(page, 1);
  const { bytes } = await exportWith(page, "Merge the PDFs");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["S1"]);
});

test("never sends anything but GET requests for the site's own files", async ({ page, context }) => {
  const requests: string[] = [];
  context.on("request", (request) => requests.push(`${request.method()} ${new URL(request.url()).origin}`));
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await exportWith(page, "Merge the PDFs");
  expect(new Set(requests)).toEqual(new Set(["GET http://localhost:8787"]));
});

test("opens a file chosen before the page is interactive", async ({ page }) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(/\/_astro\/Board\.[^/]+\.js$/, async (route) => {
    await held;
    await route.continue();
  });
  await page.goto("/en/merge-pdf", { waitUntil: "commit" });
  await chooseFiles(page, [await pdfFile("early.pdf", ["E1"])]);
  release();
  await expectThumbnails(page, 1);
});

test("renders only the pages near the screen", async ({ page }) => {
  // Firefox needs up to 20 s for the first of 600 pages while the other browsers load the machine.
  test.slow();
  await page.goto("/en/organize-pdf");
  const labels = Array.from({ length: 600 }, (_, i) => `P${i + 1}`);
  await chooseFiles(page, [await pdfFile("long.pdf", labels)]);
  await expect(page.locator(".pages li.page")).toHaveCount(600);
  await expect(page.locator(".pages li.page").first().locator("img")).toBeVisible({ timeout: 45_000 });
  // Rendering all 600 text pages takes about 3 s: after that, only the pages near the screen may have images.
  await page.waitForTimeout(3000);
  expect(await page.locator(".pages img").count()).toBeLessThan(150);
  await page.locator(".pages li.page").last().scrollIntoViewIfNeeded();
  await expect(page.locator(".pages li.page").last().locator("img")).toBeVisible({ timeout: 45_000 });
});

test("opens a file dropped anywhere on the page", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  const files = [await pdfFile("a.pdf", ["A1"])];
  await hoverFiles(page, "footer", files);
  await expect(page.locator(".drop-overlay")).toBeVisible();
  await dragFiles(page, "footer", files, ["dragover", "drop"]);
  await expect(page.locator(".drop-overlay")).toBeHidden();
  await expectThumbnails(page, 1);
});

test("shows a placeholder card for a file while it opens, and lets it be removed", async ({ page }) => {
  await page.route(/\.wasm$/, () => {});
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expect(page.locator(".pages .skeleton")).toHaveCount(1);
  await expect(page.locator(".pages .skeleton .caption")).toHaveText("a.pdf");
  await expect(page.locator(".file-tab.opening")).toHaveCount(1);
  await page.getByRole("button", { name: "Remove this file, a.pdf" }).click();
  await expect(page.getByText("Choose PDF files")).toBeVisible();
});

test("turns a PNG into a page", async ({ page }) => {
  await page.goto("/en/jpg-to-pdf");
  await chooseFiles(page, [{ name: "scan.png", mimeType: "image/png", buffer: solidPng(300, 200, [200, 30, 30]) }]);
  await expectThumbnails(page, 1);
  const { bytes } = await exportWith(page, "Make the PDF");
  const pages = await readWithPdfjs(bytes);
  expect(pages.map((p) => [p.width, p.height])).toEqual([[842, 595]]);
});

test("keeps the files when switching language", async ({ page }) => {
  await page.goto("/fr/fusionner-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"]), await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 2);
  await page.locator(".site-header").getByRole("link", { name: "English" }).click();
  await expect(page).toHaveURL(/\/en\/merge-pdf$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^Merge PDF files\s📎$/);
  await expectThumbnails(page, 2);
  const { name, bytes } = await exportWith(page, "Merge the PDFs");
  expect(name).toBe("a-merged.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["A1", "B1"]);
});

test("keeps a long file name inside a phone screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile(`${"a-very-long-file-name-".repeat(6)}.pdf`, ["A1"])]);
  await expectThumbnails(page, 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

test("the monk says what to do, and the pages come back as they were", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await expect(page.locator(".bubble-text")).toHaveText("1 file, 1 page. Drag the pages into the order you want.");
  await page.getByRole("button", { name: "Merge the PDFs", exact: true }).click();
  await expect(page.getByRole("heading", { level: 2, name: "Your PDFs are joined" })).toBeFocused();
  await page.getByRole("button", { name: "Back to the pages" }).click();
  await expectThumbnails(page, 1);
  await expect(page.getByRole("button", { name: "Merge the PDFs", exact: true })).toBeFocused();
});

test("keeps an unbreakable file name inside a phone screen while it opens", async ({ page }) => {
  await page.route(/\.wasm$/, () => {});
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile(`Scan_${"0".repeat(56)}.pdf`, ["A1"])]);
  await expect(page.locator(".bubble")).toContainText("Reading Scan_");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
});

for (const [colorScheme, surface] of [["light", "rgb(255, 255, 255)"], ["dark", "rgb(27, 33, 56)"]] as const) {
  test(`writes a failed file's message on the plain surface, ${colorScheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/en/merge-pdf");
    await chooseFiles(page, [await pdfFile("a.pdf", ["A1"]), { name: "photo.pdf", mimeType: "application/pdf", buffer: solidPng(40, 30, [200, 30, 30]) }]);
    const failed = page.locator(".file-tab.failed");
    await expect(failed).toBeVisible();
    expect(await failed.evaluate((tab) => getComputedStyle(tab).backgroundColor)).toBe(surface);
  });
}

test("names each image under it, with its weight on hover, and no file tabs", async ({ page }) => {
  await page.goto("/en/jpg-to-pdf");
  await chooseFiles(page, [
    { name: "red.png", mimeType: "image/png", buffer: solidPng(300, 200, [200, 30, 30]) },
    { name: "blue.png", mimeType: "image/png", buffer: solidPng(300, 200, [30, 30, 200]) },
  ]);
  await expectThumbnails(page, 2);
  await expect(page.locator(".file-tab")).toHaveCount(0);
  await expect(page.locator(".page .caption")).toHaveText(["red.png", "blue.png"]);
  await expect(page.locator(".bubble-text")).toHaveText("2 images. Drag the images into the order you want.");
  const tip = page.locator(".page .caption-tip").first();
  await expect(tip).toBeHidden();
  await page.locator(".page .caption").first().hover();
  await expect(tip).toBeVisible();
  await expect(tip).toContainText("red.png");
  await expect(tip).toContainText(/\d+\sKB/);
  const box = await tip.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(120);
});

test("keeps the tab of an image that could not be read", async ({ page }) => {
  await page.goto("/en/jpg-to-pdf");
  await chooseFiles(page, [
    { name: "red.png", mimeType: "image/png", buffer: solidPng(300, 200, [200, 30, 30]) },
    { name: "notes.png", mimeType: "image/png", buffer: Buffer.from("just some text") },
  ]);
  await expectThumbnails(page, 1);
  await expect(page.locator(".file-tab")).toHaveCount(1);
  await expect(page.getByRole("alert")).toHaveText("This file format is not supported.");
});
