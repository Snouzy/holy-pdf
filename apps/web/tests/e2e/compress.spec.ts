import { readFile } from "node:fs/promises";
import { expect, test, type BrowserContext } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, dragFiles, hoverFiles, pdfFile, photoPdfFile } from "./support";

async function breakCompactorModule(context: BrowserContext) {
  let injected = 0;
  let broken = true;
  const parentWorker = /\/worker-[^/]+\.js/;
  // Chromium and Firefox do not expose the initial nested-worker script to routing.
  // Give that worker a real missing URL by changing its parent's bundled URL instead.
  await context.route(parentWorker, async (route) => {
    if (!broken) return route.continue();
    const response = await route.fetch();
    const body = (await response.text()).replace(/qpdf\.worker-[\w-]+\.js/g, () => {
      injected++;
      return "qpdf.worker-intentionally-unavailable.js";
    });
    await route.fulfill({ response, body });
  });
  // Not unroute: it can hang for good when the board restarts its engine and that request is paused on the route.
  return { count: () => injected, restore: () => { broken = false; } };
}

test("compresses a PDF with a photo, and shows how much lighter it is", async ({ page }) => {
  const qpdfRequests: string[] = [];
  page.on("request", (request) => {
    if (/qpdf.*\.wasm/.test(request.url())) qpdfRequests.push(request.url());
  });
  const photo = await photoPdfFile("report.pdf", ["Page 1"]);
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [photo]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await expect(page.getByRole("radio", { name: /^Recommended/ })).toBeChecked();
  expect(qpdfRequests).toHaveLength(0);
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await expect(page.locator(".result h2")).toHaveText(/^Your PDF is \d+% lighter$/);
  await expect(page.locator(".size-bars")).toBeVisible();
  expect(qpdfRequests).toHaveLength(1);
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the PDF" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("report-compressed.pdf");
  const bytes = new Uint8Array(await readFile(await download.path()));
  expect(bytes.length).toBeLessThan(photo.buffer.length / 2);
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["Page 1"]);
});

test("gives the file back as it was when it cannot get smaller", async ({ page }) => {
  const text = await pdfFile("notes.pdf", ["Only text"]);
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [text]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await expect(page.locator(".result h2")).toBeVisible();
  const firstDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the PDF" }).click();
  const compacted = await readFile(await (await firstDownload).path());
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [{ ...text, buffer: compacted }]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await expect(page.locator(".result h2")).toHaveText("This PDF was already well pressed");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the PDF" }).click();
  const bytes = new Uint8Array(await readFile(await (await downloading).path()));
  expect(Buffer.from(bytes)).toEqual(compacted);
});

test("keeps a document containing a digital signature byte for byte", async ({ page, context }) => {
  const brokenModule = await breakCompactorModule(context);
  const objects = [
    "<</Type/Catalog/Pages 2 0 R/AcroForm<</Fields[5 0 R]>>>>",
    "<</Type/Pages/Count 1/Kids[3 0 R]>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<<>>/Contents 4 0 R/Annots[5 0 R]>>",
    "<</Length 0>>stream\n\nendstream",
    "<</Type/Annot/Subtype/Widget/FT/Sig/T(Signature)/Rect[0 0 1 1]/P 3 0 R/V 6 0 R>>",
    "<</Type/Sig/Filter/Adobe.PPKLite/SubFilter/adbe.pkcs7.detached/ByteRange[0 1 2 3]/Contents<00>>",
  ];
  let pdf = "%PDF-1.7\n";
  const offsets = objects.map((body, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
    return offset;
  });
  const xref = pdf.length;
  pdf += `xref\n0 7\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Size 7/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  const bytes = Buffer.from(pdf);
  const qpdfRequests: string[] = [];
  page.on("request", (request) => { if (/qpdf.*\.wasm/.test(request.url())) qpdfRequests.push(request.url()); });
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [{ name: "signed.pdf", mimeType: "application/pdf", buffer: bytes }]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await expect(page.locator(".result h2")).toHaveText("This PDF was already well pressed");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the PDF" }).click();
  expect(await readFile(await (await downloading).path())).toEqual(bytes);
  expect(brokenModule.count()).toBeGreaterThan(0);
  expect(qpdfRequests).toHaveLength(0);
});

for (const [asset, pattern] of [["WASM", /qpdf.*\.wasm/], ["module", /qpdf\.worker-[^/]+\.js/]] as const) {
  test(`can retry after the compactor ${asset} fails to load`, async ({ page, context, browserName }) => {
    let blocked = 0;
    const brokenModule = asset === "module" && browserName !== "webkit"
      ? await breakCompactorModule(context) : undefined;
    let blocking = !brokenModule;
    if (blocking) await context.route(pattern, (route) => (blocking ? (blocked++, route.abort()) : route.continue()));
    await page.goto("/en/compress-pdf");
    await chooseFiles(page, [await photoPdfFile("retry.pdf", ["Retry"])]);
    await expect(page.locator(".file-card img")).toHaveCount(1);
    await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
    await expect.poll(() => brokenModule?.count() ?? blocked).toBeGreaterThan(0);
    await expect(page.getByText("The PDF engine could not load. Check your connection.")).toBeVisible();
    if (brokenModule) brokenModule.restore();
    else blocking = false;
    await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
    await expect(page.locator(".result h2")).toHaveText(/^Your PDF is \d+% lighter$/);
  });
}

test("comes back to the settings with the file and the level", async ({ page }) => {
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [await pdfFile("notes.pdf", ["P1"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await page.getByRole("radio", { name: /^Extreme/ }).check();
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await page.getByRole("button", { name: "Change the settings" }).click();
  await expect(page.getByRole("radio", { name: /^Extreme/ })).toBeChecked();
  await expect(page.locator(".file-card")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Compress the PDF", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await expect(page.locator(".result h2")).toBeVisible();
});

test("shows the progress in the verb button", async ({ page }) => {
  await page.goto("/en/compress-pdf");
  // Six pages of photos take long enough for the bar to show.
  await chooseFiles(page, [await photoPdfFile("report.pdf", ["P1", "P2", "P3", "P4", "P5", "P6"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await expect(page.getByRole("progressbar", { name: "Pressing…" })).toBeVisible();
  await expect(page.locator(".result h2")).toBeVisible();
});

test("takes PDFs dropped anywhere on the page, empty, with a file, and on the result", async ({ page }) => {
  await page.goto("/en/compress-pdf");
  const drop = async (name: string) => {
    const files = [await pdfFile(name, ["A1"])];
    await hoverFiles(page, "footer", files);
    await expect(page.locator(".drop-overlay")).toBeVisible();
    await dragFiles(page, "footer", files, ["dragover", "drop"]);
    await expect(page.locator(".drop-overlay")).toBeHidden();
  };
  await drop("a.pdf");
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await drop("b.pdf");
  await expect(page.locator(".file-card img")).toHaveCount(2);
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await expect(page.locator(".result h2")).toBeVisible();
  await drop("c.pdf");
  await expect(page.locator(".result")).toHaveCount(0);
  await expect(page.locator(".file-card img")).toHaveCount(3);
});
