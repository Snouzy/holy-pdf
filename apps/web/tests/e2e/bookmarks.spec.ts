import { expect, type Locator, test } from "@playwright/test";
import { readOutline } from "../engine/support";
import { bookmarkedPdfFile, chooseFiles, exportWith, pdfFile } from "./support";

const values = (inputs: Locator) => expect.poll(() => inputs.evaluateAll((all) => all.map((input) => (input as HTMLInputElement).value)));

test("adds a bookmark to the page shown, with its title or the page's, and puts one under another", async ({ page }) => {
  await page.goto("/fr/signets-pdf");
  await chooseFiles(page, [await pdfFile("cours.pdf", ["Un", "Deux", "Trois"])]);
  await expect(page.getByText("Ce PDF n'a pas encore de signet.")).toBeVisible();
  const verb = page.getByRole("button", { name: "Enregistrer les signets", exact: true });
  await expect(verb).toBeDisabled();
  await page.getByRole("button", { name: "Page suivante" }).click();
  await page.getByLabel("Titre du signet").first().fill("Chapitre 1");
  await page.getByRole("button", { name: "Ajouter un signet à la page 2" }).click();
  await page.getByRole("button", { name: "Page suivante" }).click();
  await page.getByRole("button", { name: "Ajouter un signet à la page 3" }).click();
  await values(page.locator(".bookmarks-list input")).toEqual(["Chapitre 1", "Page 3"]);
  await page.getByRole("button", { name: "Ranger sous le signet du dessus" }).nth(1).click();
  const { name, bytes } = await exportWith(page, "Enregistrer les signets");
  expect(name).toBe("cours-signets.pdf");
  expect((await readOutline(bytes)).map(({ title, level, page: at }) => [title, level, at])).toEqual([["Chapitre 1", 0, 1], ["Page 3", 1, 2]]);
});

test("lists the bookmarks the PDF has, refuses a blank title, and removes one", async ({ page }) => {
  await page.goto("/en/pdf-bookmarks");
  await chooseFiles(page, [await bookmarkedPdfFile("book.pdf", ["A", "B"], [
    { title: "Part", pageIndex: 0, level: 0 },
    { title: "Chapter", pageIndex: 1, level: 1 },
  ])]);
  const titles = page.locator(".bookmarks-list input");
  await values(titles).toEqual(["Part", "Chapter"]);
  await expect(page.getByRole("heading", { name: "Bookmarks: 2" })).toBeVisible();
  const verb = page.getByRole("button", { name: "Save the bookmarks", exact: true });
  await expect(verb).toBeDisabled();
  await page.getByRole("button", { name: "p. 2" }).click();
  await expect(page.getByRole("combobox", { name: "Page" })).toHaveValue("1");
  await titles.first().fill(" ");
  await expect(verb).toBeDisabled();
  await page.getByRole("button", { name: "Remove this bookmark" }).first().click();
  await values(titles).toEqual(["Chapter"]);
  const { bytes } = await exportWith(page, "Save the bookmarks");
  expect((await readOutline(bytes)).map(({ title, level, page: at }) => [title, level, at])).toEqual([["Chapter", 0, 1]]);
});
