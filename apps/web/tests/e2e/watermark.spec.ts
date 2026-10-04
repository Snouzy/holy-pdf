import { expect, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test("adds the typed watermark, refuses a text its font cannot write, and uses the default text when empty", async ({ page }) => {
  await page.goto("/en/watermark-pdf");
  await chooseFiles(page, [await pdfFile("quote.pdf", ["Quote", "Terms"])]);
  const text = page.getByLabel("Watermark text");
  await text.fill("Draft 🙂");
  await expect(page.getByRole("alert")).toContainText("cannot write");
  await expect(page.getByRole("button", { name: "Add the watermark", exact: true })).toBeDisabled();
  await text.fill("Draft é");
  // The alert leaves and the swatches move up: click them once they stand still.
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("radio", { name: "Gray" }).check();
  const { name, bytes } = await exportWith(page, "Add the watermark");
  expect(name).toBe("quote-watermarked.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => p.text.includes("Draft é"))).toEqual([true, true]);
  await page.getByRole("button", { name: "Watermark another PDF" }).click();
  await chooseFiles(page, [await pdfFile("memo.pdf", ["Memo"])]);
  await page.getByLabel("Watermark text").fill("");
  const second = await exportWith(page, "Add the watermark");
  expect((await readWithPdfjs(second.bytes))[0]?.text).toContain("CONFIDENTIAL");
});
