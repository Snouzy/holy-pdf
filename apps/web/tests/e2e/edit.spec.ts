import { expect, type Page, test } from "@playwright/test";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { closeDoc, openPdf, savePdf, setRgba } from "../../src/engine/documents";
import { renderPage } from "../../src/engine/render";
import { gradientJpeg, loadTestPdfium, photoPdf, readWithPdfjs } from "../engine/support";
import { pageObjects } from "../../src/engine/pageObjects";
import { chooseFiles, exportWith, formFile, pdfFile } from "./support";

test.use({ viewport: { width: 1280, height: 1400 } });

async function drag(page: Page, from: [number, number], to: [number, number]) {
  const box = (await page.locator(".edit-layer").boundingBox())!;
  await page.mouse.move(box.x + box.width * from[0], box.y + box.height * from[1]);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * to[0], box.y + box.height * to[1], { steps: 5 });
  await page.mouse.up();
}

test("types a text on the page, draws a rectangle, undoes a stroke, and saves both", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  const verb = page.getByRole("button", { name: "Enregistrer les modifications", exact: true });
  await expect(page.locator(".edit-layer")).toBeVisible();
  await expect(verb).toBeDisabled();
  await page.getByRole("button", { name: "Texte", exact: true }).click();
  await drag(page, [0.1, 0.1], [0.1, 0.1]);
  await page.keyboard.type("Merci");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Rectangle", exact: true }).click();
  await drag(page, [0.5, 0.5], [0.8, 0.7]);
  await page.getByRole("button", { name: "Crayon", exact: true }).click();
  await drag(page, [0.2, 0.8], [0.4, 0.9]);
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
  await expect(page.locator(".edit-layer polyline")).toHaveCount(0);
  const { name, bytes } = await exportWith(page, "Enregistrer les modifications");
  expect(name).toBe("lettre-modifie.pdf");
  expect((await readWithPdfjs(bytes))[0]?.text).toContain("Merci");
  const p = await loadTestPdfium();
  const doc = openPdf(p, bytes);
  const { pixels, width } = renderPage(p, doc, 0, 595);
  closeDoc(p, doc);
  const grey = (x: number, y: number) => pixels[(Math.round(y * 842) * width + Math.round(x * 595)) * 4]!;
  // The rectangle's left edge is drawn, its inside is not; the undone stroke left nothing.
  expect([grey(0.5, 0.6) < 100, grey(0.65, 0.6), grey(0.3, 0.85)]).toEqual([true, 255, 255]);
});

test("refuses a letter the PDF's fonts cannot write", async ({ page }) => {
  await page.goto("/en/edit-pdf");
  await chooseFiles(page, [await pdfFile("letter.pdf", ["Hello"])]);
  await expect(page.locator(".edit-layer")).toBeVisible();
  await page.getByRole("button", { name: "Text", exact: true }).click();
  await drag(page, [0.1, 0.1], [0.1, 0.1]);
  await page.keyboard.type("Iași");
  await expect(page.getByRole("alert")).toContainText("cannot write");
  await expect(page.getByRole("button", { name: "Save the changes", exact: true })).toBeDisabled();
});

test("undoes a typed text in one step, and a stray click with the text tool leaves no step", async ({ page }) => {
  await page.goto("/en/edit-pdf");
  await chooseFiles(page, [await pdfFile("letter.pdf", ["Hello"])]);
  await expect(page.locator(".edit-layer")).toBeVisible();
  const text = page.getByRole("button", { name: "Text", exact: true });
  await text.click();
  await drag(page, [0.1, 0.1], [0.1, 0.1]);
  await page.keyboard.type("One");
  await page.keyboard.press("Escape");
  await text.click();
  await drag(page, [0.5, 0.5], [0.5, 0.5]);
  await page.keyboard.press("Escape");
  await expect(page.locator(".edit-layer .edit-text")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".edit-layer .edit-text")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".edit-layer .edit-text")).toHaveText("One");
});

test("corrects a text the PDF already had, in place, and deletes another object", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour", "Adieu"])]);
  const ready = page.locator(".edit-layer[data-objects=ready]");
  await expect(ready).toBeVisible();
  // textPdf writes its label at 120 points from (80, 400): the glyphs sit around 45 % of the page's height.
  const box = (await page.locator(".edit-layer").boundingBox())!;
  await page.mouse.dblclick(box.x + box.width * 0.3, box.y + box.height * 0.5);
  const typing = page.locator(".edit-typing");
  await expect(typing).toHaveValue("Bonjour");
  await typing.fill("Salut");
  // Enter ends the typing: a line of the document stays one line.
  await page.keyboard.press("Enter");
  await expect(page.locator(".edit-typing")).toHaveClass(/is-idle/);
  await page.getByRole("button", { name: "Page suivante" }).click();
  await expect(ready).toBeVisible();
  await page.mouse.click(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await expect(page.getByText("Objet du document")).toBeVisible();
  await page.getByRole("button", { name: "Supprimer", exact: true }).click();
  const { bytes } = await exportWith(page, "Enregistrer les modifications");
  expect((await readWithPdfjs(bytes)).map((read) => read.text)).toEqual(["Salut", ""]);
});

test("moves a text the PDF already had, and undoes the move", async ({ page }) => {
  await page.goto("/en/edit-pdf");
  await chooseFiles(page, [await pdfFile("letter.pdf", ["Hello"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await drag(page, [0.3, 0.5], [0.5, 0.3]);
  await expect(page.locator(".edit-original")).toBeVisible();
  const selection = (await page.locator(".edit-original").boundingBox())!;
  const layer = (await page.locator(".edit-layer").boundingBox())!;
  expect(selection.y).toBeLessThan(layer.y + layer.height * 0.35);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".edit-original")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save the changes", exact: true })).toBeDisabled();
});

test("posts a note, marks words and links a zone, which readers find as annotations", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await page.getByRole("button", { name: "Note", exact: true }).click();
  await drag(page, [0.8, 0.2], [0.8, 0.2]);
  await page.getByLabel("Note").fill("À relire");
  await page.getByLabel("Auteur").fill("Mathias");
  await page.getByRole("button", { name: "Surligner le texte", exact: true }).click();
  await drag(page, [0.1, 0.44], [0.95, 0.52]);
  await expect(page.locator(".edit-layer .edit-highlight")).toHaveCount(1);
  await page.getByRole("button", { name: "Lien", exact: true }).click();
  await drag(page, [0.1, 0.7], [0.5, 0.75]);
  const save = page.getByRole("button", { name: "Enregistrer les modifications", exact: true });
  await expect(save).toBeDisabled();
  await page.getByLabel("Adresse web").fill("https://holy.pdf/");
  const { bytes } = await exportWith(page, "Enregistrer les modifications");
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const pdf = await task.promise;
  const annotations = (await (await pdf.getPage(1)).getAnnotations()) as Array<Record<string, unknown>>;
  await task.destroy();
  expect(annotations.map((annotation) => annotation.subtype)).toEqual(["Text", "Highlight", "Link"]);
  expect([(annotations[0]!.contentsObj as { str: string }).str, (annotations[0]!.titleObj as { str: string }).str, annotations[2]!.url]).toEqual(["À relire", "Mathias", "https://holy.pdf/"]);
});

test("adds a picture, turns and crops it, and turns a picture of the document", async ({ page }) => {
  const p = await loadTestPdfium();
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [{ name: "photo.pdf", mimeType: "application/pdf", buffer: Buffer.from(photoPdf(p, ["Photo"], { width: 40, height: 30 })) }]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await page.locator('input[type="file"][accept^="image"]').setInputFiles({ name: "logo.jpg", mimeType: "image/jpeg", buffer: Buffer.from(gradientJpeg) });
  await expect(page.locator(".edit-layer image")).toHaveCount(1);
  await page.getByRole("button", { name: "Pivoter à droite", exact: true }).click();
  await expect(page.locator(".edit-layer .edit-picture")).toHaveAttribute("viewBox", "0 0 32 48");
  await page.getByRole("button", { name: "Recadrer", exact: true }).click();
  const frame = (await page.locator(".edit-crop .edit-original").boundingBox())!;
  const handle = page.locator('.edit-crop [data-handle="se"]');
  const corner = (await handle.boundingBox())!;
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(frame.x + frame.width / 2, frame.y + frame.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Appliquer le recadrage", exact: true }).click();
  await expect(page.locator(".edit-layer .edit-picture")).toHaveAttribute("viewBox", /^0 0 1[4-8] 2[2-6]$/);
  // The document's own photo fills the top of the page: turn it.
  await page.getByRole("button", { name: "Sélection", exact: true }).click();
  const layer = (await page.locator(".edit-layer").boundingBox())!;
  await page.mouse.click(layer.x + layer.width * 0.1, layer.y + layer.height * 0.1);
  await expect(page.getByText("Objet du document")).toBeVisible();
  await page.getByRole("button", { name: "Pivoter à droite", exact: true }).click();
  const { bytes } = await exportWith(page, "Enregistrer les modifications");
  const doc = openPdf(p, bytes);
  const pictures = pageObjects(p, doc, 0, [], new Map()).objects.filter((object) => object.kind === "image");
  closeDoc(p, doc);
  expect(pictures).toHaveLength(2);
  const across = { x: pictures[0]!.corners!.topRight.x - pictures[0]!.corners!.topLeft.x, y: pictures[0]!.corners!.topRight.y - pictures[0]!.corners!.topLeft.y };
  expect([Math.abs(across.x) < 1, across.y > 100]).toEqual([true, true]);
});

test("draws a text box whose lines wrap at its width, on screen and in the file", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await page.getByRole("button", { name: "Texte", exact: true }).click();
  await drag(page, [0.1, 0.1], [0.4, 0.15]);
  // The field takes the box's width on screen: the page's scale must be known by then.
  const layer = (await page.locator(".edit-layer").boundingBox())!;
  const field = (await page.locator(".edit-typing").boundingBox())!;
  expect(Math.abs(field.width - layer.width * 0.3)).toBeLessThan(3);
  await page.keyboard.type("Le renard brun saute par-dessus le chien paresseux, encore et encore.");
  await page.keyboard.press("Escape");
  const lines = page.locator(".edit-layer .edit-text tspan");
  expect(await lines.count()).toBeGreaterThan(2);
  const { bytes } = await exportWith(page, "Enregistrer les modifications");
  const read = (await readWithPdfjs(bytes))[0]!.text;
  expect(read.replace(/\s+/g, " ")).toContain("Le renard brun saute");
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const pdf = await task.promise;
  const items = (await (await pdf.getPage(1)).getTextContent()).items.filter((item) => "str" in item && item.str.startsWith("Le renard") || ("str" in item && item.str.includes("paresseux")));
  await task.destroy();
  expect(items.length).toBeGreaterThanOrEqual(2);
});

test("zooms the page, and still measures the typing field right", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  const before = (await page.locator(".edit-sheet").boundingBox())!;
  await page.getByRole("button", { name: "Agrandir", exact: true }).click();
  await page.getByRole("button", { name: "Agrandir", exact: true }).click();
  await expect(page.getByRole("button", { name: "Taille normale" })).toHaveText("150%");
  const after = (await page.locator(".edit-sheet").boundingBox())!;
  expect(after.width / before.width).toBeGreaterThan(1.4);
  await page.getByRole("button", { name: "Texte", exact: true }).click();
  const layer = (await page.locator(".edit-layer").boundingBox())!;
  await page.mouse.move(layer.x + layer.width * 0.1, layer.y + layer.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(layer.x + layer.width * 0.4, layer.y + layer.height * 0.15, { steps: 5 });
  await page.mouse.up();
  const field = (await page.locator(".edit-typing").boundingBox())!;
  expect(Math.abs(field.width - layer.width * 0.3)).toBeLessThan(3);
});

test("picks a tool by its key, shown on its button, except while typing", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Rectangle", exact: true }).locator(".edit-key")).toHaveText("r");
  await page.keyboard.press("r");
  await expect(page.getByRole("button", { name: "Rectangle", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("l");
  await expect(page.getByRole("button", { name: "Ligne", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("t");
  await drag(page, [0.1, 0.1], [0.1, 0.1]);
  await page.keyboard.type("rl");
  await expect(page.locator(".edit-typing")).toHaveValue("rl");
  await page.keyboard.press("Escape");
  await page.keyboard.press("v");
  await expect(page.getByRole("button", { name: "Sélection", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("draws a circle with Shift held", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await page.keyboard.press("o");
  const box = (await page.locator(".edit-layer").boundingBox())!;
  await page.keyboard.down("Shift");
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.3, { steps: 5 });
  await page.mouse.up();
  await page.keyboard.up("Shift");
  const ellipse = page.locator(".edit-layer ellipse");
  await expect(ellipse).toHaveCount(1);
  expect(Math.abs(Number(await ellipse.getAttribute("rx")) - Number(await ellipse.getAttribute("ry")))).toBeLessThan(0.01);
});

test("says that a page-sized picture is the page, when it is selected", async ({ page }) => {
  const p = await loadTestPdfium();
  const doc = p.FPDF_CreateNewDocument();
  const sheet = p.FPDFPage_New(doc, 0, 595, 842);
  const image = p.FPDFPageObj_NewImageObj(doc);
  setRgba(p, image, { kind: "rgba", width: 2, height: 2, pixels: new Uint8ClampedArray([200, 200, 200, 255, 220, 220, 220, 255, 220, 220, 220, 255, 200, 200, 200, 255]) });
  p.FPDFImageObj_SetMatrix(image, 595, 0, 0, 842, 0, 0);
  p.FPDFPage_InsertObject(sheet, image);
  p.FPDFPage_GenerateContent(sheet);
  p.FPDF_ClosePage(sheet);
  const bytes = savePdf(p, doc);
  p.FPDF_CloseDocument(doc);
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [{ name: "scan.pdf", mimeType: "application/pdf", buffer: Buffer.from(bytes) }]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  const layer = (await page.locator(".edit-layer").boundingBox())!;
  await page.mouse.click(layer.x + layer.width * 0.5, layer.y + layer.height * 0.5);
  await expect(page.getByText("Cette page est une image, comme un scan")).toBeVisible();
});

test("stamps a word, changes it, dates it, and writes it into the file", async ({ page }) => {
  await page.goto("/en/edit-pdf");
  await chooseFiles(page, [await pdfFile("letter.pdf", ["Hello"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await page.keyboard.press("b");
  await drag(page, [0.5, 0.2], [0.5, 0.2]);
  await expect(page.locator(".edit-layer .edit-stamp text").first()).toHaveText("APPROVED");
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await page.keyboard.press("b");
  await drag(page, [0.5, 0.2], [0.5, 0.2]);
  await expect(page.locator(".edit-layer .edit-stamp text").first()).toHaveText("APPROUVÉ");
  await page.getByRole("radio", { name: "PAYÉ" }).click();
  await expect(page.locator(".edit-layer .edit-stamp text").first()).toHaveText("PAYÉ");
  await page.getByLabel("Ajouter la date du jour").check();
  await expect(page.locator(".edit-layer .edit-stamp text")).toHaveCount(2);
  await page.getByLabel("Autre texte").fill("Șef");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeDisabled();
  await page.getByLabel("Autre texte").fill("PAYÉ");
  const { bytes } = await exportWith(page, "Enregistrer les modifications");
  const read = (await readWithPdfjs(bytes))[0]!.text;
  expect([read.includes("PAYÉ"), read.includes(String(new Date().getFullYear()))]).toEqual([true, true]);
});

test("fills a form's fields in place: a text, a box, a list, and writes the values into the file", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [formFile()]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await expect(page.locator(".edit-layer .edit-field")).toHaveCount(6);
  await expect(page.getByText("Cliquez dans un champ du formulaire")).toBeVisible();
  await drag(page, [0.33, 0.225], [0.33, 0.225]);
  const typing = page.locator("textarea.edit-typing");
  await expect(typing).toHaveValue("Jean");
  await typing.fill("Marie Curie");
  await page.keyboard.press("Enter");
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  // Twice: the second click lands before the listing knows the first, and the draft tells the state.
  await drag(page, [0.2, 0.35], [0.2, 0.35]);
  await drag(page, [0.2, 0.35], [0.2, 0.35]);
  await drag(page, [0.608, 0.356], [0.608, 0.356]);
  await drag(page, [0.33, 0.48], [0.33, 0.48]);
  await page.locator("select.edit-choice").selectOption("Paris");
  await expect(page.locator("select.edit-choice")).toHaveCount(0);
  await drag(page, [0.667, 0.225], [0.667, 0.225]);
  await page.keyboard.type("7500123");
  await expect(typing).toHaveValue("75001");
  await page.keyboard.press("Enter");
  await drag(page, [0.33, 0.225], [0.33, 0.225]);
  await expect(typing).toHaveValue("Marie Curie");
  await page.keyboard.press("Escape");
  await page.keyboard.press("t");
  await drag(page, [0.5, 0.7], [0.5, 0.7]);
  await page.keyboard.type("abcdefgh");
  await expect(typing).toHaveValue("abcdefgh");
  await page.keyboard.press("Escape");
  const { bytes } = await exportWith(page, "Enregistrer les modifications");
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const annotations = await (await (await task.promise).getPage(1)).getAnnotations() as { fieldName: string; fieldValue: unknown }[];
  await task.destroy();
  expect(Object.fromEntries(annotations.map((annotation) => [annotation.fieldName, annotation.fieldValue]))).toEqual({ name: "Marie Curie", ok: "Yes", city: ["Paris"], code: "75001", choice: "A" });
});

test("refuses a new field named like one the form already has", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [formFile()]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await page.keyboard.press("f");
  await drag(page, [0.5, 0.7], [0.5, 0.7]);
  await page.getByLabel("Nom").fill("name");
  await expect(page.getByRole("alert")).toContainText("Page 1");
  await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeDisabled();
  await page.getByLabel("Nom").fill("surnom");
  await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeEnabled();
});

test("adds a text field and a dropdown to a page, names them, and a reader finds them", async ({ page }) => {
  await page.goto("/fr/modifier-pdf");
  await chooseFiles(page, [await pdfFile("lettre.pdf", ["Bonjour"])]);
  await expect(page.locator(".edit-layer[data-objects=ready]")).toBeVisible();
  await page.keyboard.press("f");
  await expect(page.getByText("Cliquez là où poser le champ")).toBeVisible();
  await drag(page, [0.5, 0.2], [0.5, 0.2]);
  await expect(page.locator(".edit-layer .edit-added-field text")).toHaveText("Champ 1");
  await page.getByLabel("Nom").fill("Prénom");
  // The shortcut is for the page, not for a field of the panel.
  await page.getByLabel("Nom").blur();
  await page.keyboard.press("f");
  await page.getByRole("radio", { name: "Liste déroulante" }).click();
  await drag(page, [0.2, 0.4], [0.8, 0.45]);
  await page.getByLabel("Options, une par ligne").fill("Paris\nLyon");
  await page.getByLabel("Nom").fill("Prénom");
  await expect(page.getByRole("alert")).toHaveText("Page 1 : chaque champ a besoin d'un nom à lui, sans point, et une liste de ses options.");
  await expect(page.getByRole("button", { name: "Enregistrer les modifications" })).toBeDisabled();
  await page.getByLabel("Nom").fill("Ville");
  const { bytes } = await exportWith(page, "Enregistrer les modifications");
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  const annotations = await (await (await task.promise).getPage(1)).getAnnotations() as { fieldName: string; fieldType: string; options?: { displayValue: string }[] }[];
  await task.destroy();
  expect(annotations.map((annotation) => [annotation.fieldName, annotation.fieldType, (annotation.options ?? []).map((option) => option.displayValue)])).toEqual([["Prénom", "Tx", []], ["Ville", "Ch", ["Paris", "Lyon"]]]);
});
