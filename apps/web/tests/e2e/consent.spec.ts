import { expect, type Page, test } from "@playwright/test";
import { chooseFiles, expectThumbnails, pdfFile, switchLanguage } from "./support";

/** Runs only on a build with GA4_ID: `pnpm verify:full` makes one for Lighthouse. */
async function open(page: Page) {
  const loads: string[] = [];
  await page.route("https://www.googletagmanager.com/**", (route) => {
    loads.push(route.request().url());
    return route.fulfill({ contentType: "text/javascript", body: "" });
  });
  await page.goto("/en/merge-pdf");
  const id = await page.locator(".consent").getAttribute("data-measurement-id", { timeout: 1000 }).catch(() => null);
  test.skip(id === null, "built without GA4_ID");
  return { loads, id: id! };
}

const banner = (page: Page) => page.getByRole("complementary", { name: /Audience measurement|Mesure d'audience/ });
const commands = (page: Page) => page.evaluate(() => (window.dataLayer ?? []).map((entry) => Array.from(entry as IArguments)));

test("asks before measuring, and remembers a refusal", async ({ page }) => {
  const { loads } = await open(page);
  await expect(banner(page)).toBeVisible();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(banner(page)).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(banner(page)).toBeHidden();
  expect(loads).toEqual([]);
  expect(await commands(page)).toEqual([]);
});

test("measures after the visitor accepts, with the tool's name only", async ({ page }) => {
  const { loads, id } = await open(page);
  await page.getByRole("button", { name: "Accept" }).click();
  await expect(banner(page)).toBeHidden();
  await expect.poll(() => loads).toEqual([`https://www.googletagmanager.com/gtag/js?id=${id}`]);
  await chooseFiles(page, [await pdfFile("private-name.pdf", ["A1"])]);
  await expectThumbnails(page, 1);
  await page.getByRole("button", { name: "Merge the PDFs", exact: true }).click();
  await expect(page.locator(".result h2")).toBeVisible();
  expect((await commands(page)).at(-1)).toEqual(["event", "tool_done", { tool: "merge" }]);
  expect(JSON.stringify(await commands(page))).not.toContain("private-name");
  await page.reload();
  await expect(banner(page)).toBeHidden();
  await expect.poll(() => loads.length).toBe(2);
});

test("withdraws from the footer, erases the cookies and gives the focus back", async ({ page, context }) => {
  const { id } = await open(page);
  await page.getByRole("button", { name: "Accept" }).click();
  await context.addCookies([{ name: "_ga", value: "GA1.1.1.1", url: "http://localhost:8787" }]);
  const settings = page.getByRole("button", { name: "Cookie settings" });
  await settings.click();
  await expect(banner(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Decline" })).toBeFocused();
  await page.getByRole("button", { name: "Decline" }).click();
  await expect(banner(page)).toBeHidden();
  await expect(settings).toBeFocused();
  expect((await context.cookies()).map(({ name }) => name)).not.toContain("_ga");
  expect(await page.evaluate((flag) => Reflect.get(window, flag), `ga-disable-${id}`)).toBe(true);
});

test("asks again after six months", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("analytics", `granted:${Date.now() - 183 * 864e5}`));
  const { loads } = await open(page);
  await expect(banner(page)).toBeVisible();
  expect(loads).toEqual([]);
});

test("keeps the question, then the answer, across a language switch", async ({ page }) => {
  await open(page);
  await expect(banner(page)).toBeVisible();
  await switchLanguage(page, "Français");
  await expect(page).toHaveURL(/\/fr\/fusionner-pdf$/);
  await expect(page.getByRole("button", { name: "Accepter" })).toBeVisible();
  await page.getByRole("button", { name: "Refuser" }).click();
  await switchLanguage(page, "English");
  await expect(page).toHaveURL(/\/en\/merge-pdf$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(banner(page)).toBeHidden();
});
