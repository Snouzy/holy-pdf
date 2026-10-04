import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export function structuredPdf(version = "1.7"): Uint8Array<ArrayBuffer> {
  const stream = (dictionary: string, contents: string) => `<<${dictionary}/Length ${Buffer.byteLength(contents)}>>\nstream\n${contents}\nendstream`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R/Outlines 7 0 R/Metadata 10 0 R/StructTreeRoot 11 0 R/MarkInfo<</Marked true>>/AcroForm<</Fields[14 0 R]/DA(/Helv 10 Tf 0 g)/DR<</Font<</Helv 5 0 R>>>>>>/Names<</Dests<</Names[(chapter)[3 0 R /Fit]]>>/EmbeddedFiles<</Names[(notes.txt)16 0 R]>>>>>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>/Annots[9 0 R 14 0 R]/StructParents 0>>",
    stream("", "/P <</MCID 0>> BDC BT /F1 12 Tf 20 200 Td (Keep this text) Tj ET EMC\n" + "q Q\n".repeat(4000)),
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
    "<</Title(Keep this title)/Author(Test author)>>",
    "<</Type/Outlines/First 8 0 R/Last 8 0 R/Count 1>>",
    "<</Title(Chapter)/Parent 7 0 R/Dest(chapter)>>",
    "<</Type/Annot/Subtype/Link/Rect[0 0 100 20]/Dest(chapter)>>",
    stream("/Type/Metadata/Subtype/XML", '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:description>Keep this XMP</dc:description></rdf:Description></rdf:RDF></x:xmpmeta>'),
    "<</Type/StructTreeRoot/K[12 0 R]/ParentTree 13 0 R/ParentTreeNextKey 1>>",
    "<</Type/StructElem/S/P/P 11 0 R/Pg 3 0 R/K 0/Alt(A retained paragraph)>>",
    "<</Nums[0[12 0 R]]>>",
    "<</Type/Annot/Subtype/Widget/FT/Tx/T(Name)/V(Ada)/Rect[0 30 100 50]/P 3 0 R/F 4>>",
    stream("/Type/EmbeddedFile", "Keep this attachment."),
    "<</Type/Filespec/F(notes.txt)/UF(notes.txt)/EF<</F 15 0 R>>>>",
  ];
  let body = `%PDF-${version}\n`;
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(body);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<</Size ${objects.length + 1}/Root 1 0 R/Info 6 0 R>>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

export async function structure(bytes: Uint8Array<ArrayBuffer>) {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 });
  try {
    const doc = await task.promise;
    const page = await doc.getPage(1);
    const metadata = await doc.getMetadata();
    const annotations = await page.getAnnotations();
    const destination = await doc.getDestination("chapter");
    return {
      pages: doc.numPages,
      text: (await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(""),
      title: (metadata.info as Record<string, unknown>).Title,
      xmp: metadata.metadata?.getRaw(),
      outlines: (await doc.getOutline())?.map(({ title, dest }) => ({ title, dest })),
      destination: await doc.getPageIndex(destination?.[0]),
      links: annotations.filter((item) => item.subtype === "Link").map((item) => item.dest),
      fields: annotations.filter((item) => item.subtype === "Widget").map(({ fieldName, fieldValue }) => ({ fieldName, fieldValue })),
      tags: JSON.stringify(await page.getStructTree()).replace(/p\d+R\d*_/g, "page_"),
      attachments: await Promise.all([...(await doc.getAttachments() ?? [])].map(async ([key, { filename }]) => ({ filename, content: new TextDecoder().decode((await doc.getAttachmentContent(key)) ?? undefined) }))),
    };
  } finally {
    await task.destroy();
  }
}

