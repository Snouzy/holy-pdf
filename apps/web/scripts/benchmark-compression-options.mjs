/** Prepare save-only baselines, or independently verify folders of benchmark PDFs.
 * node apps/web/scripts/benchmark-compression-options.mjs prepare
 * node apps/web/scripts/benchmark-compression-options.mjs verify [folder ...]
 */
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const source = join(root, "fixtures-private/compress");
const output = join(source, "runs/benchmark-options");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
function equivalent(a, b) {
  if (isDeepStrictEqual(a, b)) return true;
  if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) <= 0.001001;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keys = Object.keys(a).sort();
  return isDeepStrictEqual(keys, Object.keys(b).sort()) && keys.every((key) => equivalent(a[key], b[key]));
}
const names = readdirSync(source).filter((name) => name.endsWith(".pdf")).sort();
mkdirSync(output, { recursive: true });

async function prepare() {
  const { init } = await import("@embedpdf/pdfium");
  const wasm = readFileSync(createRequire(import.meta.url).resolve("@embedpdf/pdfium/pdfium.wasm"));
  const p = await init({ wasmBinary: wasm });
  p.PDFiumExt_Init();
  const folder = join(output, "save-only");
  mkdirSync(folder, { recursive: true });
  for (const name of names) {
    const bytes = readFileSync(join(source, name));
    const pointer = p.pdfium._malloc(bytes.length);
    p.pdfium.HEAPU8.set(bytes, pointer);
    const doc = p.FPDF_LoadMemDocument64(pointer, bytes.length, "");
    if (!doc) throw new Error(`Could not open ${name}`);
    const chunks = [];
    const callback = p.pdfium.addFunction((_self, data, size) => {
      chunks.push(p.pdfium.HEAPU8.slice(data, data + size));
      return 1;
    }, "iiii");
    const writer = p.pdfium._malloc(8);
    p.pdfium.setValue(writer, 1, "i32");
    p.pdfium.setValue(writer + 4, callback, "i32");
    try {
      if (!p.FPDF_SaveAsCopy(doc, writer, 0)) throw new Error(`Save failed ${name}`);
      writeFileSync(join(folder, name), Buffer.concat(chunks));
      console.log(`${name}: ${bytes.length} -> ${chunks.reduce((n, chunk) => n + chunk.length, 0)}`);
    } finally {
      p.pdfium.removeFunction(callback);
      p.pdfium._free(writer);
      p.FPDF_CloseDocument(doc);
      p.pdfium._free(pointer);
    }
  }
}

async function structure(path) {
  const task = getDocument({ data: new Uint8Array(readFileSync(path)), verbosity: 0 });
  try {
    const doc = await task.promise;
    async function destination(value) {
      const resolved = typeof value === "string" ? await doc.getDestination(value) : value;
      if (!Array.isArray(resolved)) return resolved ?? null;
      const [first, ...rest] = resolved;
      return [typeof first === "number" ? first : await doc.getPageIndex(first), ...rest];
    }
    async function outlines(nodes) {
      if (!nodes) return null;
      return Promise.all(nodes.map(async (node) => ({
        title: node.title, bold: node.bold, italic: node.italic, color: Array.from(node.color ?? []),
        url: node.url ?? null, action: node.action ?? null, dest: await destination(node.dest),
        items: await outlines(node.items),
      })));
    }
    const semanticIds = new Map();
    function stable(value, key = "") {
      if (key === "id" && typeof value === "string") return semanticIds.get(value) ?? value.replace(/^p\d+R(?:\d+)?_/, "page_").replace(/^\d+R(?:\d+)?$/, "object");
      if (Array.isArray(value)) return value.map((v) => stable(v));
      if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k], k)]));
      return value;
    }
    const metadata = await doc.getMetadata();
    const attachments = [];
    for (const [key, value] of await doc.getAttachments() ?? []) {
      const content = await doc.getAttachmentContent(key);
      attachments.push({ name: value.filename, sha256: content ? hash(content) : null });
    }
    const fields = await doc.getFieldObjects();
    const namedDestinations = [];
    for (const [name, value] of await doc.getDestinations()) namedDestinations.push([name, await destination(value)]);
    namedDestinations.sort(([a], [b]) => a.localeCompare(b));
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const annotations = await page.getAnnotations();
      annotations.forEach((annotation, index) => {
        const id = `page${n}:annotation${index}`;
        semanticIds.set(annotation.id, id);
        semanticIds.set(`pdfjs_internal_id_${annotation.id}`, id);
      });
      const links = [];
      for (const annotation of annotations) if (annotation.subtype === "Link") {
        links.push({ dest: await destination(annotation.dest), url: annotation.url ?? null, rect: annotation.rect });
      }
      const text = await page.getTextContent();
      pages.push({
        box: page.view, rotation: page.rotate,
        textSha256: hash(text.items.map((item) => item.str ?? "").join("\n")), links,
        structureTree: stable(await page.getStructTree()),
      });
      page.cleanup();
    }
    return {
      pages,
      outline: await outlines(await doc.getOutline()),
      namedDestinations,
      info: stable(Object.fromEntries(Object.entries(metadata.info).filter(([key]) => !["PDFFormatVersion", "IsLinearized"].includes(key)))),
      xmp: metadata.metadata?.getRaw() ?? null,
      fields: fields ? stable([...fields]) : null,
      attachments,
      markInfo: stable(await doc.getMarkInfo()),
    };
  } finally {
    await task.destroy();
  }
}

function pdfs(folder) {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? pdfs(join(folder, entry.name))
    : entry.name.endsWith(".pdf") ? [join(folder, entry.name)] : []);
}

async function verify() {
  const folders = process.argv.slice(3).map((folder) => resolve(folder));
  const targets = (folders.length ? folders : [output]).flatMap(pdfs).sort();
  const detailsFolder = join(output, "structure-details");
  mkdirSync(detailsFolder, { recursive: true });
  const report = { reader: "pdf.js 6.3.289", comparison: "Resolved destinations; text hash; page geometry; detailed accessibility tree with normalized object IDs; metadata excluding PDF version and linearization; fields; attachment hashes. Numerical tolerance 0.001pt for PDFium float32 conversion. Not visual or signature validation; non-link annotations, JavaScript and optional-content behavior are not checked.", results: [] };
  const expected = process.env.BENCH_EXPECT_PDFS ? Number(process.env.BENCH_EXPECT_PDFS) : null;
  const originals = new Map();
  for (const path of targets) {
    const name = path.split("/").at(-1);
    if (!names.includes(name)) continue;
    if (!originals.has(name)) originals.set(name, await structure(join(source, name)));
    const original = originals.get(name);
    try {
      const candidate = await structure(path);
      const differences = Object.keys(original).filter((key) => !equivalent(original[key], candidate[key]));
      const pageDifferences = candidate.pages.flatMap((page, index) => Object.keys(page).filter((key) => !equivalent(original.pages[index]?.[key], page[key])).map((key) => `${index + 1}:${key}`));
      const detailsPath = join(detailsFolder, `${hash(path).slice(0, 16)}.json`);
      report.results.push({ path, matches: !differences.length, differences, pageDifferences, ...(differences.length ? { detailsPath } : {}) });
      if (differences.length) {
        writeFileSync(detailsPath, JSON.stringify({ original, candidate }, null, 2));
      } else rmSync(detailsPath, { force: true });
      console.log(`${differences.length ? "DIFF" : "OK"} ${path.replace(`${root}/`, "")} ${differences.join(",")} ${pageDifferences.slice(0, 8).join(",")}`);
    } catch (error) {
      report.results.push({ path, matches: false, error: String(error) });
      console.log(`ERROR ${path}: ${error}`);
    }
    writeFileSync(join(output, process.env.BENCH_VERIFY_REPORT ?? "verification-results.json"), JSON.stringify(report, null, 2));
  }
  if (!report.results.length) throw new Error("No recognized benchmark PDFs were verified");
  if (expected !== null && report.results.length !== expected) throw new Error(`Expected ${expected} PDFs, verified ${report.results.length}`);
  if (report.results.some((result) => !result.matches)) process.exitCode = 1;
}

if (process.argv[2] === "prepare") await prepare();
else if (process.argv[2] === "verify") await verify();
else throw new Error("Expected prepare or verify [folder ...]");
