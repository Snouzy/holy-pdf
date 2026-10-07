import { expect, test } from "@playwright/test";
import { languages } from "../../src/tools";
import { overflowing } from "./support";

test("opens the tool named in the sentence, with its monk", async ({ page }) => {
  await page.goto("/fr");
  const go = page.getByRole("link", { name: "C'est parti →" });
  await expect(go).toHaveAttribute("href", "/fr/fusionner-pdf");
  await expect(page.locator("[data-monk]:visible")).toHaveText(/^Frère Agrafe s'en occupe/);
  const choice = page.getByRole("combobox", { name: "Ce que vous voulez faire" });
  await choice.click();
  await page.getByRole("option", { name: /compresser/ }).click();
  await expect(choice).toHaveText("compresser");
  await expect(choice).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("[data-monk]:visible")).toHaveText(/^Frère Pressoir s'en occupe/);
  await go.click();
  await expect(page).toHaveURL(/\/fr\/compresser-pdf$/);
});

test("lets the keyboard pick a verb in the sentence", async ({ page }) => {
  await page.goto("/en");
  const choice = page.getByRole("combobox", { name: "What you want to do" });
  const list = page.getByRole("listbox");
  await choice.focus();
  await page.keyboard.press("ArrowDown");
  await expect(choice).toHaveAttribute("aria-expanded", "true");
  await expect(list).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(choice).toHaveText("split");
  await expect(list).toBeHidden();
  await expect(choice).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.type("pi");
  await page.keyboard.press("Escape");
  await expect(list).toBeHidden();
  await expect(choice).toHaveText("split");
  await page.keyboard.press("Enter");
  await page.keyboard.type("pi");
  await page.keyboard.press("Enter");
  await expect(choice).toHaveText("pixelize");
  await expect(page.getByRole("link", { name: "Let's go →" })).toHaveAttribute("href", "/en/pixelize-pdf");
});

test("keeps the list of verbs at text size, and closes it on a click elsewhere", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/fr");
  await page.getByRole("combobox").click();
  const list = page.getByRole("listbox");
  expect((await list.boundingBox())?.height ?? 0).toBeLessThanOrEqual(420);
  expect(await page.getByRole("option").first().locator(".verb").evaluate((verb) => Number.parseFloat(getComputedStyle(verb).fontSize))).toBeLessThanOrEqual(20);
  await page.mouse.click(10, 300);
  await expect(list).toBeHidden();
});

test("shows the first row of monks on a laptop screen", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/fr");
  await expect(page.locator(".cards .tool-card").first()).toBeInViewport();
});

test("switches the tools to a compact view and remembers it", async ({ page }) => {
  await page.goto("/fr");
  const toggle = page.getByRole("button", { name: "Vue compacte" });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".compact")).toBeHidden();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".cards")).toBeHidden();
  await expect(page.locator(".compact li")).toHaveCount(28);
  await expect(page.locator(".compact a")).toHaveCount(27);
  await page.reload();
  await expect(page.locator(".compact")).toBeVisible();
  await page.getByRole("button", { name: "Vue compacte" }).click();
  await expect(page.locator(".cards")).toBeVisible();
});

test("puts the promises right under the title, centres the film under the sentence, and lists four proofs", async ({ page }) => {
  await page.goto("/en");
  const title = page.getByRole("heading", { level: 1 });
  await expect(title).toHaveText(/^Free online PDF tools, right in your browser\./);
  const promises = page.locator(".hero .promises");
  await expect(promises).toHaveText("Free · no file uploaded · no account");
  const titleBox = await title.boundingBox();
  const promisesBox = await promises.boundingBox();
  const sentence = await page.getByRole("combobox").boundingBox();
  expect(promisesBox!.y - (titleBox!.y + titleBox!.height)).toBeLessThanOrEqual(8);
  expect(promisesBox!.y + promisesBox!.height).toBeLessThan(sentence!.y);
  const hero = await page.locator(".hero").boundingBox();
  const watch = await page.locator(".hero .watch").boundingBox();
  expect(Math.abs(watch!.x + watch!.width / 2 - (hero!.x + hero!.width / 2))).toBeLessThanOrEqual(1);
  await expect(page.locator(".proofs strong")).toHaveText(["100% on your device", "0 upload", "No account", "GDPR"]);
});

test("signs the privacy promise with Frère Plume, then lists the proofs on a dark band below", async ({ page }) => {
  await page.goto("/fr");
  const note = page.locator(".privacy .note");
  await expect(note.getByRole("heading", { level: 2 })).toHaveText(/^Vos PDF ne quittent jamais votre appareil/);
  await expect(note.locator(".signature")).toHaveText("Frère Plume");
  const band = page.locator(".privacy .band");
  await expect(band.locator(".proofs li")).toHaveCount(4);
  await expect(band.getByRole("link", { name: "On vous montre comment →" })).toBeVisible();
  const noteBox = await note.boundingBox();
  const bandBox = await band.boundingBox();
  expect(bandBox!.y).toBeGreaterThan(noteBox!.y + noteBox!.height);
});

test("crowns the monk of « Pourquoi des moines ? » with a halo", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator(".story .monk-halo")).toBeVisible();
});

test("ends on six shortcuts to the main tools, beside a monk in the sun", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/fr");
  const band = page.locator(".cta");
  const shortcuts = band.locator(".cta-tools a");
  await expect(shortcuts).toHaveText([/^Fusionner\s*Frère Agrafe$/, /^Compresser\s*Frère Pressoir$/, /^Modifier\s*Frère Scribe$/, /^Signer\s*Frère Plume$/, /^Organiser\s*Frère Classeur$/, /^Créer\s*Frère Cadre$/]);
  await expect(band.getByRole("link", { name: "Voir tous les moines →" })).toHaveAttribute("href", "#at-work");
  await expect(band.locator(".cta-sun .monk-halo")).toBeVisible();
  const rows = () => shortcuts.evaluateAll((links) => new Set(links.map((link) => Math.round(link.getBoundingClientRect().top))).size);
  expect(await rows()).toBe(2);
  await page.setViewportSize({ width: 900, height: 800 });
  expect(await rows()).toBe(3);
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await rows()).toBe(6);
  await shortcuts.last().click();
  await expect(page).toHaveURL(/\/fr\/jpg-en-pdf$/);
});

test("lays the three steps out as a frieze without cards, stacked on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/fr");
  const steps = page.locator(".steps li");
  await expect(steps).toHaveCount(3);
  await expect(steps.first()).toHaveCSS("filter", "none");
  await expect(steps.first()).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(steps.first().locator(".halo")).toHaveCSS("border-radius", "50%");
  const rows = () => steps.evaluateAll((items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size);
  expect(await rows()).toBe(1);
  const thread = () => page.locator(".steps ol").evaluate((list) => getComputedStyle(list, "::before").display);
  expect(await thread()).toBe("block");
  await page.setViewportSize({ width: 390, height: 800 });
  expect(await rows()).toBe(3);
  expect(await thread()).toBe("none");
});

test("answers the common questions as a conversation, and leads to all the others", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator(".chat dt")).toHaveCount(7);
  await expect(page.locator(".chat dd")).toHaveCount(7);
  const last = page.locator(".chat dd").last();
  await last.scrollIntoViewIfNeeded();
  await expect(last).toHaveCSS("opacity", "1");
  await page.getByRole("link", { name: "Toutes les questions →" }).click();
  await expect(page).toHaveURL(/\/fr\/faq$/);
});

test("links the uses to their guide and tools", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("link", { name: "Follow the step-by-step guide →" }).click();
  await expect(page).toHaveURL(/\/en\/guides\/prepare-paperwork-as-one-pdf$/);
});

for (const width of [320, 390]) {
  test(`fits the home page in a ${width} px wide screen, even with fallback fonts`, async ({ page }) => {
    await page.route(/\.woff2$/, (route) => route.abort());
    await page.setViewportSize({ width, height: 800 });
    for (const lang of languages) {
      await page.goto(`/${lang}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth), `/${lang}: ${await overflowing(page)}`).toBe(width);
    }
  });
}

test("keeps each category of the compact view on one row, scrolled sideways", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/en");
  await page.getByRole("button", { name: "Compact view" }).click();
  const row = page.locator('.compact-row[data-category="organize"] ul');
  const rows = await row.locator("li").evaluateAll((items) => new Set(items.map((item) => Math.round(item.getBoundingClientRect().top))).size);
  expect(rows).toBe(1);
  expect(await row.evaluate((list) => list.scrollWidth > list.clientWidth)).toBe(true);
  await expect(row).toHaveClass(/\bmore\b/);
  await row.evaluate((list) => list.scrollTo({ left: list.scrollWidth }));
  await expect(row).not.toHaveClass(/\bmore\b/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1280);
});

for (const width of [320, 390]) {
  test(`keeps the open list of verbs inside a ${width} px wide screen`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/fr");
    await page.getByRole("combobox").click();
    const box = await page.getByRole("listbox").boundingBox();
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  });
}

test("leaves a gap between two verbs, so the chosen one and the one under the pointer never touch", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("combobox", { name: "Ce que vous voulez faire" }).click();
  const [first, second] = await page.getByRole("option").evaluateAll((options) => options.slice(0, 2).map((option) => option.getBoundingClientRect()));
  expect(second!.top - first!.bottom).toBeGreaterThanOrEqual(2);
});

test("clips the list of verbs and its scrollbar to the rounded panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await page.goto("/fr");
  await page.getByRole("combobox").click();
  const list = page.getByRole("listbox");
  expect(await list.evaluate((ul) => ul.scrollHeight > ul.clientHeight)).toBe(true);
  const panel = await list.evaluate((ul) => {
    const style = getComputedStyle(ul.parentElement ?? ul);
    return [style.overflow, style.borderTopRightRadius];
  });
  expect(panel).toEqual(["hidden", "16px"]);
});

test("opens the 30 second film over the page from its round preview, and stops it on Escape", async ({ page }) => {
  const requested: string[] = [];
  page.on("request", (request) => requested.push(request.url()));
  await page.goto("/fr", { waitUntil: "networkidle" });
  expect(requested.filter((url) => url.endsWith(".mp4")), "the page never loads the film by itself").toEqual([]);
  const film = page.getByRole("dialog", { name: "Holy PDF en 30 secondes" });
  await expect(film).toBeHidden();
  await page.getByRole("button", { name: "Voir Holy PDF en 30 secondes" }).click();
  await expect(film).toBeVisible();
  await expect(film.locator("video")).toHaveAttribute("src", "/videos/holy-pdf-fr.mp4");
  await page.keyboard.press("Escape");
  await expect(film).toBeHidden();
  expect(await page.locator("dialog video").evaluate((video: HTMLVideoElement) => video.paused)).toBe(true);
});

test("closes the film with its button", async ({ page }) => {
  await page.goto("/fr");
  await page.getByRole("button", { name: "Voir Holy PDF en 30 secondes" }).click();
  await page.getByRole("button", { name: "Fermer la vidéo" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("answers « Comment ça marche ? » with the film in the conversation", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.locator(".chat dt").first()).toHaveText("Comment ça marche ?");
  await expect(page.locator(".chat dd").first().locator("video")).toHaveAttribute("preload", "none");
});

test("plays the English film on the English page", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator(".chat dt").first()).toHaveText("How does it work?");
  await page.getByRole("button", { name: "Watch Holy PDF in 30 seconds" }).click();
  await expect(page.getByRole("dialog", { name: "Holy PDF in 30 seconds" }).locator("video")).toHaveAttribute("src", "/videos/holy-pdf-en.mp4");
});
