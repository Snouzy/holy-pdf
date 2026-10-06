import { expect, test } from "@playwright/test";
import { chooseFiles, deskPhotoFile, pdfFile } from "./support";

test("plays the tool's film on demand, then leads to the file chooser", async ({ page }) => {
  const films: string[] = [];
  page.on("request", (request) => request.url().includes("/videos/tools/redact-fr.mp4") && films.push(request.url()));
  await page.goto("/fr/noircir-pdf");
  const open = page.getByRole("button", { name: "Voir Frère Encrier à l'œuvre · 15 s" });
  await expect(open).toBeVisible();
  expect(films).toEqual([]);

  await open.click();
  const dialog = page.getByRole("dialog", { name: "Frère Encrier à l'œuvre" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("video")).toHaveAttribute("src", "/videos/tools/redact-fr.mp4");
  await expect.poll(() => films.length).toBeGreaterThan(0);

  await dialog.locator("video").evaluate((video) => video.dispatchEvent(new Event("ended")));
  const choose = dialog.getByRole("button", { name: "Choisir un PDF" });
  await expect(choose).toBeFocused();
  const chooser = page.waitForEvent("filechooser");
  await choose.click();
  await chooser;
  await expect(dialog).toBeHidden();
});

test("closes with Escape, gives the focus back, and steps aside once a file is in", async ({ page }) => {
  await page.goto("/en/redact-pdf");
  const open = page.getByRole("button", { name: "Watch Brother Inkpot at work · 15 s" });
  // Safari does not focus a clicked button, so only the keyboard has a focus to give back.
  await open.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Brother Inkpot at work" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(open).toBeFocused();
  expect(await page.locator("dialog.reel video").evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1"])]);
  await expect(open).toBeHidden();
});

test("steps aside on the Scanner once a photo is in, and offers photos at the end", async ({ page }) => {
  await page.goto("/fr/scanner");
  const open = page.getByRole("button", { name: "Voir Frère Déclic à l'œuvre · 15 s" });
  await open.click();
  const dialog = page.getByRole("dialog", { name: "Frère Déclic à l'œuvre" });
  await page.locator("dialog.reel video").evaluate((video) => video.dispatchEvent(new Event("ended")));
  await expect(dialog.getByRole("button", { name: "Choisir des photos" })).toBeFocused();
  await page.keyboard.press("Escape");
  await chooseFiles(page, [await deskPhotoFile("desk.jpg")]);
  await expect(page.locator(".scanner")).toBeVisible({ timeout: 60_000 });
  await expect(open).toBeHidden();
});

test("shows no film where the tool has none", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await expect(page.locator(".reel-open")).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("fills the screen", async ({ page }) => {
    await page.goto("/fr/noircir-pdf");
    await page.getByRole("button", { name: "Voir Frère Encrier à l'œuvre · 15 s" }).click();
    const box = await page.getByRole("dialog").boundingBox();
    expect(box).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  });
});
