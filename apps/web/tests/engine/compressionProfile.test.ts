import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { allowsObjectStreams } from "../../src/engine/compressionProfile";

const utf8 = (s: string) => Buffer.from(s);
const ordinary = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description title="Ordinary &amp; unprofiled"/></rdf:RDF></x:xmpmeta>';
const archival = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description xmlns:custom="http://www.aiim.org/pdfa/ns/id/" custom:part="1"/></rdf:RDF></x:xmpmeta>';

function pdf(xml?: Uint8Array, options: { filter?: string; catalog?: string; extra?: string; extraObjects?: Uint8Array[]; metadataType?: string } = {}): Uint8Array {
  const objects = [utf8(`<< /Type /Catalog ${xml ? "/Metadata 2 0 R" : ""} ${options.catalog ?? ""} >>`)];
  if (xml) objects.push(Buffer.concat([utf8(`<< ${options.metadataType ?? "/Type /Metadata /Subtype /XML"} /Length ${xml.length} ${options.filter ?? ""} >>\nstream\n`), xml, utf8("\nendstream")]));
  if (options.extra) objects.push(utf8(options.extra));
  if (options.extraObjects) objects.push(...options.extraObjects.map((bytes) => Buffer.from(bytes)));
  const parts = [utf8("%PDF-1.4\n")];
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
    parts.push(utf8(`${index + 1} 0 obj\n`), object, utf8("\nendobj\n"));
  });
  const at = parts.reduce((sum, part) => sum + part.length, 0);
  parts.push(utf8(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${at}\n%%EOF\n`));
  return Buffer.concat(parts);
}

describe("allowsObjectStreams", () => {
  it("allows a classic PDF without a profile and ordinary XMP", async () => {
    expect(await allowsObjectStreams(pdf())).toBe(true);
    expect(await allowsObjectStreams(pdf(utf8(ordinary)))).toBe(true);
  });
  it("does not confuse percentages or metadata-like text in strings with PDF syntax", async () => {
    expect(await allowsObjectStreams(pdf(undefined, { extra: "<< /Title (50% off (nested) /Metadata 99 0 R) /URI (https://example.com/a%20b) >>" }))).toBe(true);
    expect(await allowsObjectStreams(pdf(undefined, { catalog: "/Metadata%unsupported comment\n99 0 R" }))).toBe(false);
  });
  it.each(["/Filter /FlateDecode", "/Filter [ /FlateDecode ]", "/Filter /Fl"])("reads ordinary and archival Flate metadata: %s", async (filter) => {
    expect(await allowsObjectStreams(pdf(deflateSync(ordinary), { filter }))).toBe(true);
    expect(await allowsObjectStreams(pdf(deflateSync(archival), { filter }))).toBe(false);
  });
  it("blocks archival declarations regardless of namespace prefix or part", async () => {
    expect(await allowsObjectStreams(pdf(utf8(archival)))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8(archival.replace('part="1"', 'part="2"'))))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8(archival.replace("pdfa", "pd&#102;a"))))).toBe(false);
  });
  it("reads UTF-16 metadata and escaped PDF names", async () => {
    const le = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(archival, "utf16le")]);
    const be = Buffer.from(le).swap16();
    expect(await allowsObjectStreams(pdf(le))).toBe(false);
    expect(await allowsObjectStreams(pdf(be))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8(archival), { metadataType: "/Type /Meta#64ata /Subtype /XML" }))).toBe(false);
    expect(await allowsObjectStreams(pdf(Buffer.from(ordinary, "utf16le")))).toBe(true);
  });
  it("follows untyped metadata references and notices other metadata streams", async () => {
    expect(await allowsObjectStreams(pdf(utf8(archival), { metadataType: "" }))).toBe(false);
    const orphan = `<< /Type /Metadata /Subtype /XML /Length ${utf8(archival).length} >>\nstream\n${archival}\nendstream`;
    expect(await allowsObjectStreams(pdf(undefined, { extra: orphan }))).toBe(false);
    expect(await allowsObjectStreams(pdf(undefined, { catalog: "/Metadata 99 0 R" }))).toBe(false);
  });
  it("follows bounded metadata wrappers and refuses reference cycles", async () => {
    const wrapped = (xml: string) => pdf(undefined, { catalog: "/Metadata 2 0 R", extraObjects: [
      utf8("<< /Type /Metadata /Subtype /XML /Metadata 3 0 R >>"),
      Buffer.concat([utf8(`<< /Filter /FlateDecode /Length ${deflateSync(xml).length} >>\nstream\n`), deflateSync(xml), utf8("\nendstream")]),
    ] });
    expect(await allowsObjectStreams(wrapped(ordinary))).toBe(true);
    expect(await allowsObjectStreams(wrapped(archival))).toBe(false);
    expect(await allowsObjectStreams(pdf(undefined, { catalog: "/Metadata 2 0 R", extra: "<< /Type /Metadata /Metadata 2 0 R >>" }))).toBe(false);
  });
  it("blocks PDF/X declarations in Info or XMP", async () => {
    expect(await allowsObjectStreams(pdf(undefined, { extra: "<< /GTS_PDFXVersion (PDF/X-1a:2001) >>" }))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8(ordinary.replace("Ordinary", "PDF/X-4"))))).toBe(false);
    const custom = ordinary.replace('xmlns:x="adobe:ns:meta/"', 'xmlns:x="adobe:ns:meta/" xmlns:pdfx="http://ns.adobe.com/pdfx/1.3/"');
    expect(await allowsObjectStreams(pdf(utf8(custom)))).toBe(true);
    expect(await allowsObjectStreams(pdf(utf8(custom.replace("http://ns.adobe.com/pdfx/1.3/", "http://www.npes.org/pdfx/ns/id/"))))).toBe(false);
  });
  it("fails closed for unsupported, malformed and oversized metadata", async () => {
    expect(await allowsObjectStreams(pdf(utf8(ordinary), { filter: "/Filter /LZWDecode" }))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8(ordinary), { filter: "/Filter /FlateDecode" }))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8(ordinary), { filter: "/Filter [ /FlateDecode /ASCII85Decode ]" }))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8("not XML")))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8(ordinary.replace("&amp;", "&unknown;"))))).toBe(false);
    expect(await allowsObjectStreams(pdf(utf8(`<?xml encoding="iso-8859-1"?>${ordinary}`)))).toBe(false);
    expect(await allowsObjectStreams(pdf(deflateSync(" ".repeat(1_048_577)), { filter: "/Filter /FlateDecode" }))).toBe(false);
    expect(await allowsObjectStreams(utf8("%PDF-1.4\nnot a classic xref"))).toBe(false);
  });
});
