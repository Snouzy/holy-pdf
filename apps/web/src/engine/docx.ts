import { strToU8, zipSync } from "fflate";

export type WordRun = { text: string; font: string; size: number; bold: boolean; italic: boolean };
export type WordBlock = { kind: "text"; runs: WordRun[] } | { kind: "picture"; jpeg: Uint8Array; width: number; height: number };
/** Sizes in points. */
export type WordPage = { width: number; height: number; blocks: WordBlock[] };

/** An inch, or a quarter of a small page: a label 100 points wide would be left with no room, and a negative picture width. */
const marginOf = (page: { width: number; height: number }) => Math.min(72, page.width / 4, page.height / 4);
const twips = (points: number) => Math.round(points * 20);
const emus = (points: number) => Math.round(points * 12700);
const namespaces = [
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"',
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"',
  'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"',
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"',
  'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"',
].join(" ");
const header = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const officeDocument = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

/** A .docx with one Word page per PDF page, all at the size of the first. */
export function docxOf(pages: WordPage[]): Uint8Array<ArrayBuffer> {
  const media: Uint8Array[] = [];
  const first = pages[0] ?? { width: 595.28, height: 841.89 };
  const margin = marginOf(first);
  const body = pages.map((page, index) => (index > 0 ? '<w:p><w:r><w:br w:type="page"/></w:r></w:p>' : "")
    + page.blocks.map((block) => (block.kind === "text" ? paragraph(block.runs) : picture(block, media, first.width - 2 * margin))).join("")).join("");
  const section = `<w:sectPr><w:pgSz w:w="${twips(first.width)}" w:h="${twips(first.height)}"/>`
    + `<w:pgMar w:top="${twips(margin)}" w:right="${twips(margin)}" w:bottom="${twips(margin)}" w:left="${twips(margin)}" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>`;
  const relations = [`<Relationship Id="rIdStyles" Type="${officeDocument}/styles" Target="styles.xml"/>`,
    ...media.map((_, index) => `<Relationship Id="rIdImage${index + 1}" Type="${officeDocument}/image" Target="media/image${index + 1}.jpeg"/>`)];
  return zipSync({
    "[Content_Types].xml": strToU8(`${header}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
      + '<Default Extension="jpeg" ContentType="image/jpeg"/>'
      + '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
      + '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'),
    "_rels/.rels": strToU8(`${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
      + `<Relationship Id="rId1" Type="${officeDocument}/officeDocument" Target="word/document.xml"/></Relationships>`),
    "word/document.xml": strToU8(`${header}<w:document ${namespaces}><w:body>${body}${section}</w:body></w:document>`),
    "word/styles.xml": strToU8(`${header}<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults>`
      + '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="22"/></w:rPr></w:rPrDefault>'
      + '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>'),
    "word/_rels/document.xml.rels": strToU8(`${header}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relations.join("")}</Relationships>`),
    ...Object.fromEntries(media.map((jpeg, index) => [`word/media/image${index + 1}.jpeg`, jpeg])),
  });
}

function paragraph(runs: WordRun[]): string {
  return `<w:p>${runs.map(({ text, font, size, bold, italic }) => {
    const name = escape(font);
    return `<w:r><w:rPr><w:rFonts w:ascii="${name}" w:hAnsi="${name}" w:cs="${name}"/>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}`
      + `<w:sz w:val="${Math.min(1638, Math.max(2, Math.round(size * 2)))}"/></w:rPr><w:t xml:space="preserve">${escape(text)}</w:t></w:r>`;
  }).join("")}</w:p>`;
}

function picture(block: Extract<WordBlock, { kind: "picture" }>, media: Uint8Array[], textWidth: number): string {
  media.push(block.jpeg);
  const id = media.length;
  const scale = Math.min(1, textWidth / block.width);
  const [cx, cy] = [emus(block.width * scale), emus(block.height * scale)];
  return `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/>`
    + '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic>'
    + `<pic:nvPicPr><pic:cNvPr id="${id}" name="image${id}.jpeg"/><pic:cNvPicPr/></pic:nvPicPr>`
    + `<pic:blipFill><a:blip r:embed="rIdImage${id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>`
    + `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>`
    + "</pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>";
}

/** XML 1.0 has no place for most control characters, even escaped: Word refuses the file. */
function escape(text: string): string {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
