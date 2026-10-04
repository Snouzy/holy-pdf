import { h } from "preact";
import { render } from "preact-render-to-string";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { type Category, cast, upcoming } from "../../src/cast";
import { avatarClip } from "../../src/illustrations/Avatar";
import { type Accessory, Monk, type Mood } from "../../src/illustrations/Monk";
import { Scene } from "../../src/illustrations/Scene";

// The Mac app draws the site's monks in the site's colors. This test writes them into the app's asset catalog,
// and fails when the catalog no longer matches the site.
const update = "run UPDATE_MAC_ASSETS=1 pnpm test";

type Theme = Map<string, string>;

const web = join(import.meta.dirname, "../..");
const generated = join(web, "../mac/PDFToolbox/Assets.xcassets/Generated");
const iconHead = join(web, "../mac/PDFToolbox/HolyPDF.icon/Assets/head.svg");

const css = readFileSync(join(web, "src/styles/tokens.css"), "utf8");
const light = variables(":root");
const dark: Theme = new Map([...light, ...variables(':root[data-theme="dark"]')]);

function variables(selector: string): Theme {
  const body = css.split(`${selector} {`)[1]?.split("}")[0];
  if (body === undefined) throw new Error(`tokens.css has no ${selector} block`);
  return new Map([...body.matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((match): [string, string] => [match[1]!, match[2]!.trim()]));
}

function resolve(svg: string, theme: Theme): string {
  return svg.replace(/var\(--([a-z0-9-]+)\)/g, (_, name: string) => {
    const value = theme.get(name);
    if (value === undefined) throw new Error(`tokens.css has no --${name}`);
    return value;
  });
}

const xmlns = (svg: string) => svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

/** `Avatar.tsx` at diameter 80, in one SVG: the tinted circle, the monk cut by `avatarClip`, the accessory over it. */
function avatar(accessory: Accessory, mood: Mood, category: Category): string {
  // Avatar.tsx draws a 110-wide monk from 5 left of the circle's box: the view box widens to keep the accessory whole.
  const layer = (part: "all" | "prop") =>
    `<g transform="translate(-5 0) scale(0.55)">${inner(render(h(Monk, { size: 200, accessory, mood, layer: part })))}</g>`;
  const clip = avatarClip(80).slice("path('".length, -"')".length);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-5 0 110 112" width="110" height="112">` +
    `<defs><clipPath id="robe"><path d="${clip}"/></clipPath></defs>` +
    `<circle cx="50" cy="68" r="40" fill="var(--${category}-tint)"/>` +
    `<g clip-path="url(#robe)">${layer("all")}</g>${layer("prop")}</svg>`
  );
}

/** The scene on its category's tint, as on the site's tool cards. */
function scene(category: Category): string {
  return xmlns(render(h(Scene, { kind: "scan", size: 120 })))
    .replace(/^(<svg[^>]*>)/, `$1<rect width="120" height="120" rx="14" fill="var(--${category}-tint)" stroke="none"/>`)
    .replaceAll("var(--scene-accent)", `var(--${category})`);
}

const scan = cast.scan;
const scannerMoods = ["happy", "focus", "joy", "oops"] as const satisfies readonly Mood[];
const sleeping = [...Object.entries(cast).filter(([id]) => id !== "scan").map(([, tool]) => tool), ...Object.values(upcoming)];

const images = new Map<string, string>([
  ["monk-scanner", xmlns(render(h(Monk, { size: 200, accessory: scan.accessory, mood: "happy" })))],
  ["scene-scan", scene(scan.category)],
  ...scannerMoods.map((mood) => [`avatar-scanner-${mood}`, avatar(scan.accessory, mood, scan.category)] as const),
  ...sleeping.map(({ accessory, category }) => [`sleep-${accessory}-${category}`, avatar(accessory, "sleep", category)] as const),
]);

const colors = { AccentColor: "accent", Highlight: "highlight", OnHighlight: "on-highlight", Stamp: "stamp" } as const;

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const info = { author: "xcode", version: 1 };
const darkAppearance = [{ appearance: "luminosity", value: "dark" }];

function components(token: string, theme: Theme) {
  const hex = theme.get(token);
  if (hex === undefined || !/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`--${token} is not a #rrggbb color`);
  const channel = (at: number) => `0x${hex.slice(at, at + 2).toUpperCase()}`;
  return { alpha: "1.000", blue: channel(5), green: channel(3), red: channel(1) };
}

function files(): Map<string, string> {
  const all = new Map<string, string>([["Contents.json", json({ info })]]);
  for (const [name, svg] of images) {
    all.set(`${name}.imageset/light.svg`, resolve(svg, light));
    all.set(`${name}.imageset/dark.svg`, resolve(svg, dark));
    all.set(
      `${name}.imageset/Contents.json`,
      json({
        images: [
          { filename: "light.svg", idiom: "universal" },
          { appearances: darkAppearance, filename: "dark.svg", idiom: "universal" },
        ],
        info,
        properties: { "preserves-vector-representation": true },
      }),
    );
  }
  for (const [name, token] of Object.entries(colors)) {
    all.set(
      `${name}.colorset/Contents.json`,
      json({
        colors: [
          { color: { "color-space": "srgb", components: components(token, light) }, idiom: "universal" },
          { appearances: darkAppearance, color: { "color-space": "srgb", components: components(token, dark) }, idiom: "universal" },
        ],
        info,
      }),
    );
  }
  return all;
}

/** The favicon's haloed head without its yellow disc: the icon file paints the yellow, full bleed. */
function head(): string {
  const favicon = readFileSync(join(web, "public/favicon.svg"), "utf8");
  const head = favicon
    .replace(/<circle cx="32" cy="32" r="32"[^>]*\/>/, "")
    .replace('viewBox="0 0 64 64"', 'viewBox="0 0 64 64" width="760" height="760"');
  if (!head.includes('width="760"') || head.includes('r="32"')) throw new Error("favicon.svg changed: update head()");
  return head;
}

function read(folder: string): Map<string, string> {
  if (!existsSync(folder)) return new Map();
  const entries = readdirSync(folder, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile() && !entry.name.startsWith("."));
  return new Map(entries.map((entry) => [relative(folder, join(entry.parentPath, entry.name)), readFileSync(join(entry.parentPath, entry.name), "utf8")]));
}

function write(expected: Map<string, string>) {
  rmSync(generated, { recursive: true, force: true });
  for (const [path, content] of expected) {
    mkdirSync(dirname(join(generated, path)), { recursive: true });
    writeFileSync(join(generated, path), content);
  }
}

const expected = files();
if (process.env["UPDATE_MAC_ASSETS"]) {
  write(expected);
  mkdirSync(dirname(iconHead), { recursive: true });
  writeFileSync(iconHead, head());
}

describe("Mac assets", () => {
  it("match the site's drawings and colors", () => {
    const actual = read(generated);
    expect([...actual.keys()].sort(), update).toEqual([...expected.keys()].sort());
    for (const [path, content] of expected) expect(actual.get(path), `${path} is stale: ${update}`).toBe(content);
  });

  it("hold only SVG that the Mac draws", () => {
    for (const [path, content] of expected) {
      if (!path.endsWith(".svg")) continue;
      expect(content, path).not.toContain("var(");
      expect(content, path).not.toContain("<text");
      expect(content.match(/<svg/g), path).toHaveLength(1);
      expect(content, path).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });

  it("dress the monks for dark mode", () => {
    expect(dark.get("robe")).not.toBe(light.get("robe"));
    expect(expected.get("avatar-scanner-happy.imageset/light.svg")).toContain(light.get("robe"));
    expect(expected.get("avatar-scanner-happy.imageset/dark.svg")).toContain(dark.get("robe"));
  });

  it("give the icon the favicon's haloed head", () => {
    expect(existsSync(iconHead) ? readFileSync(iconHead, "utf8") : undefined, update).toBe(head());
  });

  it("names a missing token", () => {
    expect(() => resolve('<path fill="var(--nope)"/>', light)).toThrow("tokens.css has no --nope");
  });

  it("draws a sleeping monk for every site tool but the Scanner", () => {
    expect(expected.has("sleep-stapler-organize.imageset/light.svg")).toBe(true);
    expect([...expected.keys()].some((path) => path.startsWith(`sleep-${scan.accessory}-`))).toBe(false);
  });
});
