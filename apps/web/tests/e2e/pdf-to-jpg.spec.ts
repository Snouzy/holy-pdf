import { readFile } from "node:fs/promises";
import { unzipSync } from "fflate";
import { expect, test } from "@playwright/test";
import { chooseFiles, pdfFile } from "./support";

test("turns each page into a JPG, in a .zip on a computer", async ({ page }) => {
  await page.goto("/en/pdf-to-jpg");
  await chooseFiles(page, [await pdfFile("course.pdf", ["P1", "P2", "P3"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await expect(page.getByText("3 pages, so 3 JPG images.")).toBeVisible();
  await page.getByRole("button", { name: "Convert to JPG", exact: true }).click();
  await expect(page.locator(".result h2")).toHaveText("Your 3 images are ready");
  await expect(page.locator(".result-thumbs img")).toHaveCount(3);
  await page.getByRole("button", { name: "View", exact: true }).click();
  const preview = page.getByRole("dialog", { name: "Preview" });
  await expect(preview).toContainText("Page 1 of 3");
  await expect(preview.locator("img")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download the 3 images" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("course-images.zip");
  const files = unzipSync(new Uint8Array(await readFile(await download.path())));
  expect(Object.keys(files)).toEqual(["course-1.jpg", "course-2.jpg", "course-3.jpg"]);
  expect([...(files["course-1.jpg"] ?? new Uint8Array()).subarray(0, 2)]).toEqual([0xff, 0xd8]);
});

test("opens and closes the help of a choice from the keyboard", async ({ page }) => {
  await page.goto("/en/pdf-to-jpg");
  await chooseFiles(page, [await pdfFile("course.pdf", ["P1"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  const help = page.getByRole("button", { name: "Extract images: help" });
  await help.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("The text is left out")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Pages to JPG/ })).toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByText("The text is left out")).toBeHidden();
});

test("says when a PDF holds no photo", async ({ page }) => {
  await page.goto("/en/pdf-to-jpg");
  await chooseFiles(page, [await pdfFile("notes.pdf", ["Only text"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await page.getByText("Only the photos in the PDF.").click();
  await page.getByRole("button", { name: "Convert to JPG", exact: true }).click();
  await expect(page.locator(".bubble-text")).toHaveText("This PDF holds no photo. Try “Pages to JPG”.");
});

test("saves the images through the share sheet on a phone", async ({ page }) => {
  await page.addInitScript(() => {
    const media = window.matchMedia.bind(window);
    window.matchMedia = (query: string) => (query === "(pointer: coarse)" ? { ...media(query), matches: true } : media(query));
    Object.assign(navigator, {
      canShare: () => true,
      share: async (data: ShareData) => {
        Reflect.set(window, "shared", (data.files ?? []).map((file) => file.name));
      },
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/pdf-to-jpg");
  await chooseFiles(page, [await pdfFile("course.pdf", ["P1", "P2", "P3"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Convert to JPG", exact: true })).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  await page.getByRole("button", { name: "Convert to JPG", exact: true }).click();
  await page.getByRole("button", { name: "Save the 3 images" }).click();
  await expect(page.getByText("In Photos, or in Files.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "shared"))).toEqual(["course-1.jpg", "course-2.jpg", "course-3.jpg"]);
});

test("gives the help button a 44 px target on a phone, and a tap there does not pick the choice", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/pdf-to-jpg");
  await chooseFiles(page, [await pdfFile("course.pdf", ["P1"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  const help = page.getByRole("button", { name: "Extract images: help" });
  await help.scrollIntoViewIfNeeded();
  const box = await help.boundingBox();
  if (!box) throw new Error("no help button");
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const hits = await page.evaluate(
    ({ x, y }) =>
      [[-21, -21], [21, -21], [-21, 21], [21, 21]].map(([dx = 0, dy = 0]) => document.elementFromPoint(x + dx, y + dy)?.closest("button")?.getAttribute("aria-label")),
    centre,
  );
  expect(hits).toEqual(Array(4).fill("Extract images: help"));
  await page.mouse.click(centre.x + 20, centre.y + 20);
  await expect(page.getByText("The text is left out")).toBeVisible();
  await expect(page.getByRole("radio", { name: /Pages to JPG/ })).toBeChecked();
});
