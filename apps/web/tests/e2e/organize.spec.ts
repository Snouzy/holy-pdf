import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, expectThumbnails, exportWith, nextFrames, pdfFile } from "./support";

test("merges two files in the order they were added", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2"]), await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 3);
  const { name, bytes } = await exportWith(page, "Merge the PDFs");
  expect(name).toBe("a-merged.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["A1", "A2", "B1"]);
});

test("reorders pages with the keyboard", async ({ page }) => {
  await page.goto("/en/organize-pdf");
  await chooseFiles(page, [await pdfFile("doc.pdf", ["P1", "P2", "P3"])]);
  await expectThumbnails(page, 3);
  const announcement = page.getByRole("status");
  await page.getByRole("button", { name: "Page 3", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(announcement).toHaveText("Picked up Page 3.");
  await nextFrames(page);
  await page.keyboard.press("ArrowLeft");
  await expect(announcement).toHaveText("Page 3 moved over Page 2.");
  await page.keyboard.press("ArrowLeft");
  await expect(announcement).toHaveText("Page 3 moved over Page 1.");
  await page.keyboard.press("Space");
  await expect(announcement).toHaveText("Page 3 dropped at Page 1.");
  const { bytes } = await exportWith(page, "Tidy up the pages");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["P3", "P1", "P2"]);
});

test("deletes a page, and brings it back with undo", async ({ page }) => {
  await page.goto("/en/delete-pdf-pages");
  await chooseFiles(page, [await pdfFile("doc.pdf", ["P1", "P2", "P3"])]);
  await expectThumbnails(page, 3);
  await page.getByRole("button", { name: "Delete page, Page 1" }).click();
  await page.getByRole("button", { name: "Delete page, Page 2" }).click();
  await page.keyboard.press("ControlOrMeta+z");
  const { bytes } = await exportWith(page, "Delete the pages");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["P2", "P3"]);
});

test("extracts the selected pages", async ({ page }) => {
  await page.goto("/en/extract-pdf-pages");
  await chooseFiles(page, [await pdfFile("doc.pdf", ["P1", "P2", "P3", "P4"])]);
  await expectThumbnails(page, 4);
  await page.getByRole("checkbox", { name: "Select page, Page 4" }).check();
  await page.getByRole("checkbox", { name: "Select page, Page 2" }).check();
  const { name, bytes } = await exportWith(page, "Extract the pages");
  expect(name).toBe("doc-extracted.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["P2", "P4"]);
});

test("rotates every page", async ({ page }) => {
  await page.goto("/en/rotate-pdf");
  await chooseFiles(page, [await pdfFile("doc.pdf", ["P1", "P2"])]);
  await expectThumbnails(page, 2);
  await page.getByRole("button", { name: "Rotate all" }).click();
  const { bytes } = await exportWith(page, "Rotate the PDF");
  expect((await readWithPdfjs(bytes)).map((p) => p.rotation)).toEqual([90, 90]);
});

test("reorders pages with the mouse", async ({ page }) => {
  await page.goto("/en/organize-pdf");
  await chooseFiles(page, [await pdfFile("doc.pdf", ["P1", "P2", "P3"])]);
  await expectThumbnails(page, 3);
  const from = await page.getByRole("button", { name: "Page 3", exact: true }).boundingBox();
  const to = await page.getByRole("button", { name: "Page 1", exact: true }).boundingBox();
  if (!from || !to) throw new Error("page cells have no box");
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 - 20, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(page.getByRole("status")).toHaveText("Page 3 dropped at Page 1.");
  // dnd-kit swallows every click for 50 ms after a drop, so that the drop is not also a click.
  await page.waitForTimeout(100);
  const { bytes } = await exportWith(page, "Tidy up the pages");
  expect((await readWithPdfjs(bytes)).map((p) => p.text)).toEqual(["P3", "P1", "P2"]);
});
