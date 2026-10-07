import { expect, type Locator, test } from "@playwright/test";
import { chooseFiles, expectHoverFeedback, expectNoHoverFeedback, expectThumbnails, pdfFile } from "./support";

async function expectAllAnswer(controls: Locator[]) {
  for (const control of controls) await expectHoverFeedback(control);
}

test("the home answers the pointer", async ({ page }) => {
  await page.goto("/en");
  const header = page.locator(".site-header");
  const footer = page.locator(".site-footer");
  await expectAllAnswer([
    page.locator(".tool-card").first(),
    page.locator(".more-soon"),
    page.getByRole("button", { name: "Compact view" }),
    page.getByRole("searchbox", { name: "Search a tool" }),
    page.locator(".categories").getByRole("button", { name: /^Convert/ }),
    page.getByRole("switch", { name: "Show the monks in meditation" }),
    page.getByRole("combobox", { name: "What you want to do" }),
    page.locator(".hero .go"),
    page.locator(".use-text a").first(),
    page.locator(".check a"),
    page.locator(".faq-more"),
    page.locator(".cta-tools a").first(),
    page.locator(".cta-all"),
    header.locator(".brand"),
    header.getByRole("link", { name: "Merge PDF" }),
    header.getByRole("button", { name: "Dark mode" }),
    header.locator(".language-menu summary"),
    footer.locator(".footer-links a").first(),
    footer.getByRole("button", { name: "Dark mode" }),
    footer.locator(".socials a").first(),
  ]);
});

test("a monk in meditation is no link, and does not answer the pointer", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("switch", { name: "Show the monks in meditation" }).click();
  await expectNoHoverFeedback(page.locator(".tool-card.asleep").first());
});

test("the empty search answers the pointer", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("searchbox", { name: "Search a tool" }).fill("excel");
  await expectHoverFeedback(page.getByRole("button", { name: "See all the monks" }));
});

test("an empty tool page answers the pointer", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await expectAllAnswer([page.locator(".dropzone .button"), page.locator("main summary").first(), page.locator(".related a").first()]);
});

test("the page board answers the pointer", async ({ page }) => {
  await page.goto("/en/merge-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2"]), await pdfFile("b.pdf", ["B1"])]);
  await expectThumbnails(page, 3);
  const first = page.locator(".page").first();
  await expectAllAnswer([
    page.locator(".add-tile .button"),
    page.locator(".file-tab .file-close").first(),
    first.getByRole("button", { name: /^Rotate 90°/ }),
    first.getByRole("button", { name: /^Delete page/ }),
    // The thumbnail takes the pointer, but the outline goes around the sheet inside it.
    first.locator(".page-sheet"),
    page.getByRole("button", { name: "Merge the PDFs", exact: true }),
  ]);
  await expectNoHoverFeedback(page.getByRole("button", { name: "Undo" }));
  await first.getByRole("button", { name: /^Rotate 90°/ }).click();
  await expectHoverFeedback(page.getByRole("button", { name: "Undo" }));
});

test("the file cards and the levels of Compress answer the pointer", async ({ page }) => {
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [await pdfFile("notes.pdf", ["P1"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await expectAllAnswer([
    page.locator(".choice").filter({ hasText: "Extreme" }),
    page.locator(".file-card .file-close"),
    page.locator(".file-cards > .button"),
    page.locator(".below"),
  ]);
  await expectNoHoverFeedback(page.locator(".file-card .page-sheet"));
});

test("the tiles, the switch and the help of PDF to JPG answer the pointer", async ({ page }) => {
  await page.goto("/en/pdf-to-jpg");
  await chooseFiles(page, [await pdfFile("course.pdf", ["P1"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await expectAllAnswer([
    page.locator(".choice").filter({ hasText: "Extract images" }),
    page.locator(".switch .choice").filter({ hasText: "High" }),
    page.getByRole("button", { name: "Extract images: help" }),
  ]);
});

test("the cuts of Split answer the pointer", async ({ page }) => {
  await page.goto("/en/split-pdf");
  await chooseFiles(page, [await pdfFile("a.pdf", ["A1", "A2", "A3"])]);
  await expectThumbnails(page, 3);
  await expectHoverFeedback(page.locator(".cut").first());
});

test("the result answers the pointer", async ({ page }) => {
  await page.goto("/en/compress-pdf");
  await chooseFiles(page, [await pdfFile("notes.pdf", ["P1"])]);
  await expect(page.locator(".file-card img")).toHaveCount(1);
  await page.getByRole("button", { name: "Compress the PDF", exact: true }).click();
  await expect(page.locator(".result h2")).toBeVisible();
  await expectAllAnswer([
    page.getByRole("button", { name: "Download the PDF" }),
    page.getByRole("button", { name: "View" }),
    page.getByRole("button", { name: "Change the settings" }),
    page.getByRole("button", { name: "Compress another PDF" }),
  ]);
});
