import { expect, type Page, test } from "@playwright/test";
import { readWithPdfjs } from "../engine/support";
import { chooseFiles, exportWith, pdfFile } from "./support";

test.use({ viewport: { width: 1280, height: 1600 } });

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const sheet = page.locator(".redact-sheet");
  await expect(sheet.locator("img")).toBeVisible();
  const box = (await sheet.boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 5 });
  await page.mouse.up();
}

test("covers what the visitor drags over: that page loses its text, the others keep theirs", async ({ page }) => {
  await page.goto("/en/redact-pdf");
  await chooseFiles(page, [await pdfFile("letter.pdf", ["Dear", "Sincerely"])]);
  const verb = page.getByRole("button", { name: "Redact the PDF", exact: true });
  await drag(page, [0.05, 0.4], [0.9, 0.6]);
  await expect(page.locator(".redact-zone")).toHaveCount(1);
  await expect(verb).toBeEnabled();
  const { name, bytes } = await exportWith(page, "Redact the PDF");
  expect(name).toBe("letter-redacted.pdf");
  expect((await readWithPdfjs(bytes)).map((p) => [p.text, p.width, p.height])).toEqual([["", 595, 842], ["Sincerely", 595, 842]]);
});

test("takes a click for a click, and removes zones one by one or by page", async ({ page }) => {
  await page.goto("/fr/noircir-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Un", "Deux"])]);
  const verb = page.getByRole("button", { name: "Noircir le PDF", exact: true });
  const zones = page.locator(".redact-zone");
  await drag(page, [0.5, 0.5], [0.502, 0.502]);
  await expect(zones).toHaveCount(0);
  await expect(verb).toBeDisabled();
  await drag(page, [0.1, 0.1], [0.4, 0.2]);
  await drag(page, [0.1, 0.5], [0.4, 0.6]);
  await expect(zones).toHaveCount(2);
  await zones.first().getByRole("button", { name: "Retirer cette zone" }).click();
  await expect(zones).toHaveCount(1);
  await page.getByRole("button", { name: "Page suivante" }).click();
  await expect(zones).toHaveCount(0);
  await drag(page, [0.2, 0.2], [0.5, 0.4]);
  await expect(page.getByRole("combobox", { name: "Page" }).locator("option")).toHaveText(["1 ■", "2 ■"]);
  await page.getByRole("button", { name: "Vider cette page" }).click();
  await expect(zones).toHaveCount(0);
  await page.getByRole("button", { name: "Page précédente" }).click();
  await expect(zones).toHaveCount(1);
  await expect(verb).toBeEnabled();
});

test("moves a zone with its handle or the arrow keys, and keeps it inside the page", async ({ page }) => {
  await page.goto("/fr/noircir-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Un"])]);
  await drag(page, [0.1, 0.1], [0.4, 0.2]);
  const zone = page.locator(".redact-zone");
  const handle = zone.getByRole("button", { name: "Déplacer cette zone" });
  const sheet = (await page.locator(".redact-sheet").boundingBox())!;
  const before = (await zone.boundingBox())!;
  const grip = (await handle.boundingBox())!;
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
  await page.mouse.down();
  await page.mouse.move(grip.x + grip.width / 2 + sheet.width * 0.2, grip.y + grip.height / 2 + sheet.height * 0.3, { steps: 5 });
  await page.mouse.up();
  const moved = (await zone.boundingBox())!;
  expect(moved.x - before.x).toBeCloseTo(sheet.width * 0.2, -1);
  expect(moved.y - before.y).toBeCloseTo(sheet.height * 0.3, -1);
  expect(moved.width).toBeCloseTo(before.width, 0);
  await expect(zone).toHaveCount(1);
  await handle.focus();
  await page.keyboard.press("Shift+ArrowLeft");
  expect((await zone.boundingBox())!.x).toBeCloseTo(moved.x - sheet.width * 0.03, 0);
  const at = (await handle.boundingBox())!;
  await page.mouse.move(at.x + at.width / 2, at.y + at.height / 2);
  await page.mouse.down();
  await page.mouse.move(sheet.x + sheet.width + 40, sheet.y + sheet.height + 40, { steps: 5 });
  await page.mouse.up();
  const edge = (await zone.boundingBox())!;
  expect(edge.x + edge.width).toBeCloseTo(sheet.x + sheet.width, 0);
  expect(edge.y + edge.height).toBeCloseTo(sheet.y + sheet.height, 0);
});

test("keeps the cross and the handle small, each with a 44 px target", async ({ page }) => {
  await page.goto("/fr/noircir-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Un"])]);
  await drag(page, [0.1, 0.1], [0.6, 0.3]);
  const zone = page.locator(".redact-zone");
  for (const name of ["Retirer cette zone", "Déplacer cette zone"]) {
    const box = (await zone.getByRole("button", { name }).boundingBox())!;
    expect(box.width).toBeLessThanOrEqual(24);
    expect(box.height).toBeLessThanOrEqual(24);
  }
  const cross = (await zone.getByRole("button", { name: "Retirer cette zone" }).boundingBox())!;
  await page.mouse.click(cross.x + cross.width / 2 + 18, cross.y + cross.height / 2 - 18);
  await expect(zone).toHaveCount(0);
});
