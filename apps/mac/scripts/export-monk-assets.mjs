import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The site moves a tool from `upcoming` to `cast` the day it ships it: the accessory is read from either.
const accessory = ({ cast, upcoming }, tool) => (cast[tool] ?? upcoming[tool]).accessory;

// Each tool owns `owned` and nothing else in the asset catalog. Signing also owns its folder's Contents.json.
const monks = {
  sign: {
    label: "Signing", owned: "Signing", imageset: "monk-sign.imageset/",
    pose: ({ cast }) => ({ accessory: cast.sign.accessory, mood: "happy" }),
  },
  merge: {
    label: "Merging", owned: "Merging/monk-merge.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast.merge.accessory, mood: cast.merge.mood }),
  },
  organize: {
    label: "Organizing", owned: "Organizing/monk-organize.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast.organize.accessory, mood: cast.organize.mood }),
  },
  watermark: {
    label: "Watermarking", owned: "Watermarking/monk-watermark.imageset", imageset: "",
    pose: (site) => ({ accessory: accessory(site, "watermark"), mood: "happy" }),
  },
  split: {
    label: "Splitting", owned: "Splitting/monk-split.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast.split.accessory, mood: cast.split.mood }),
  },
  "page-numbers": {
    label: "PageNumbers", owned: "PageNumbers/monk-page-numbers.imageset", imageset: "",
    // Brother Binder already holds the sheet with a smile.
    pose: (site) => ({ accessory: accessory(site, "page-numbers"), mood: "focus" }),
  },
  protect: {
    label: "Protecting", owned: "Protection/monk-protect.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast.protect.accessory, mood: cast.protect.mood }),
  },
  unlock: {
    label: "Unlocking", owned: "Protection/monk-unlock.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast.unlock.accessory, mood: cast.unlock.mood }),
  },
  compress: {
    label: "Compressing", owned: "Compressing/monk-compress.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast.compress.accessory, mood: cast.compress.mood }),
  },
  ocr: {
    label: "Reading", owned: "Reading/monk-ocr.imageset", imageset: "",
    // Brother Lens already holds the loupe with a smile.
    pose: (site) => ({ accessory: accessory(site, "ocr"), mood: "focus" }),
  },
  redact: {
    label: "Redacting", owned: "Redacting/monk-redact.imageset", imageset: "",
    pose: (site) => ({ accessory: accessory(site, "redact"), mood: "focus" }),
  },
  "images-to-pdf": {
    label: "ImagesToPDF", owned: "Images/monk-images-to-pdf.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast["jpg-to-pdf"].accessory, mood: cast["jpg-to-pdf"].mood }),
  },
  "pdf-to-images": {
    label: "PDFToImages", owned: "Images/monk-pdf-to-images.imageset", imageset: "",
    // The site gives both image tools the same pose: on one home screen they need two faces.
    pose: ({ cast }) => ({ accessory: cast["pdf-to-jpg"].accessory, mood: "focus" }),
  },
  flatten: {
    label: "Flattening", owned: "Flattening/monk-flatten.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast.flatten.accessory, mood: cast.flatten.mood }),
  },
  "pages-per-sheet": {
    label: "Sheets", owned: "Sheets/monk-pages-per-sheet.imageset", imageset: "",
    // Brother Binder and Brother Folio already hold the sheet, with the site's two other faces.
    pose: ({ cast }) => ({ accessory: cast["pages-per-sheet"].accessory, mood: "joy" }),
  },
  "split-in-half": {
    label: "Halving", owned: "Halving/monk-split-in-half.imageset", imageset: "",
    // Brother Scissors already holds the scissors with the site's face for this tool.
    pose: ({ cast }) => ({ accessory: cast["split-in-half"].accessory, mood: "happy" }),
  },
  pixelize: {
    label: "Pixelizing", owned: "Pixelizing/monk-pixelize.imageset", imageset: "",
    // Brother Frame and Brother Illuminator already hold the frame, with the site's two other faces.
    pose: ({ cast }) => ({ accessory: cast.pixelize.accessory, mood: "joy" }),
  },
  bookmarks: {
    label: "Bookmarks", owned: "Bookmarks/monk-bookmarks.imageset", imageset: "",
    // The site has no such tool yet. The book is the closest thing a monk holds, with the face no other book has here.
    pose: () => ({ accessory: "book", mood: "joy" }),
  },
  overlay: {
    label: "Overlaying", owned: "Overlaying/monk-overlay.imageset", imageset: "",
    // The site has no such tool yet. Brother Stamp holds the stamp with a smile here, and with a frown on the site.
    pose: () => ({ accessory: "stamp", mood: "joy" }),
  },
  "pdf-to-word": {
    label: "Word", owned: "Word/monk-pdf-to-word.imageset", imageset: "",
    // Brother Quill already holds the quill with the site's face for this tool.
    pose: ({ cast }) => ({ accessory: cast["pdf-to-word"].accessory, mood: "joy" }),
  },
  edit: {
    label: "Editing", owned: "Editing/monk-edit.imageset", imageset: "",
    // Brother Copyist holds the quill with joy on the Mac, Brother Quill with a smile: the site's face would make twins.
    pose: ({ cast }) => ({ accessory: cast.edit.accessory, mood: "focus" }),
  },
  extract: {
    label: "Extracting", owned: "Extracting/monk-extract.imageset", imageset: "",
    pose: ({ cast }) => ({ accessory: cast["extract-pages"].accessory, mood: cast["extract-pages"].mood }),
  },
};

const root = fileURLToPath(new URL("../../../", import.meta.url));
const web = join(root, "apps", "web");
const catalog = join(root, "apps/mac/PDFToolbox/Assets.xcassets");
const usage = "Usage: node apps/mac/scripts/export-monk-assets.mjs [sign|merge|organize|watermark|split|extract|page-numbers|protect|unlock|compress|ocr|redact|images-to-pdf|pdf-to-images|flatten|pages-per-sheet|split-in-half|pixelize|bookmarks|overlay|pdf-to-word|edit] [--write]";
const update = process.argv.includes("--write");
const names = process.argv.slice(2).filter((argument) => argument !== "--write");
if (names.length > 1 || names.some((name) => !Object.hasOwn(monks, name))) throw new Error(usage);
const selected = names.length === 0 ? Object.keys(monks) : names;

// Reuse the site's installed renderer and Vite without adding native-app dependencies.
const requireWeb = createRequire(join(web, "package.json"));
const requireVitest = createRequire(requireWeb.resolve("vitest/package.json"));
const { createServer } = await import(pathToFileURL(requireVitest.resolve("vite")).href);
const { h } = requireWeb("preact");
const { render } = requireWeb("preact-render-to-string");
const css = readFileSync(join(web, "src/styles/tokens.css"), "utf8");

function variables(selector) {
  const body = css.split(`${selector} {`)[1]?.split("}")[0];
  if (body === undefined) throw new Error(`tokens.css has no ${selector} block`);
  return new Map([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()]));
}

function resolve(svg, theme, label) {
  const result = svg.replace(/var\(--([a-z0-9-]+)\)/g, (_, name) => {
    const value = theme.get(name);
    if (value === undefined) throw new Error(`tokens.css has no --${name}`);
    return value;
  });
  if (result.includes("var(") || /<text\b/.test(result) || [...result.matchAll(/<svg\b/g)].length !== 1) {
    throw new Error(`${label} SVG must have resolved colors, no text and no nested SVG`);
  }
  return result;
}

const light = variables(":root");
const dark = new Map([...light, ...variables(':root[data-theme="dark"]')]);
const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const info = { author: "xcode", version: 1 };
// Its own cache folder: with the site's, Vite would discard the dependencies a running `pnpm dev` serves.
const server = await createServer({
  root: web,
  configFile: false,
  cacheDir: join(tmpdir(), "holy-pdf-mac-export"),
  server: { middlewareMode: true, watch: null },
  oxc: { jsx: { runtime: "automatic", importSource: "preact" } },
});

try {
  const { Monk } = await server.ssrLoadModule("/src/illustrations/Monk.tsx");
  const site = await server.ssrLoadModule("/src/cast.ts");
  for (const name of selected) {
    const { label, owned, imageset, pose } = monks[name];
    const output = join(catalog, owned);
    const svg = render(h(Monk, { size: 200, ...pose(site) })).replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const files = new Map([
      ...(imageset ? [["Contents.json", json({ info })]] : []),
      [`${imageset}light.svg`, resolve(svg, light, label)],
      [`${imageset}dark.svg`, resolve(svg, dark, label)],
      [`${imageset}Contents.json`, json({
        images: [
          { filename: "light.svg", idiom: "universal" },
          { appearances: [{ appearance: "luminosity", value: "dark" }], filename: "dark.svg", idiom: "universal" },
        ],
        info,
        properties: { "preserves-vector-representation": true },
      })],
    ]);
    for (const [path, expected] of files) {
      const destination = join(output, path);
      if (update) {
        mkdirSync(dirname(destination), { recursive: true });
        writeFileSync(destination, expected);
      } else if (readFileSync(destination, "utf8") !== expected) {
        throw new Error(`${path} is stale: run node apps/mac/scripts/export-monk-assets.mjs ${name} --write`);
      }
    }
    const actual = readdirSync(output, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => relative(output, join(entry.parentPath, entry.name)));
    if (actual.length !== files.size || actual.some((path) => !files.has(path))) {
      throw new Error(`${label} asset catalog contains unexpected files`);
    }
    console.log(`${label} assets ${update ? "updated" : "verified"}: ${files.size} files, light and dark.`);
  }
} finally {
  await server.close();
}
