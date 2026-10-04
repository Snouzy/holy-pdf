import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = join(import.meta.dirname, "../../src");
const ranges = [...readFileSync(join(src, "styles/fonts.ts"), "utf8").matchAll(/U\+([0-9A-F]+)(?:-([0-9A-F]+))?/g)].map(([, from = "", to]) => [
  Number.parseInt(from, 16),
  Number.parseInt(to ?? from, 16),
]);
const covered = (code: number) => ranges.some(([from = 0, to = 0]) => code >= from && code <= to);
const texts = [
  ...["i18n/fr.ts", "i18n/en.ts", "i18n/frSite.ts", "i18n/enSite.ts", "i18n/pages.ts", "signature/text.ts", "signature/TypedSignature.tsx"].map((file) => join(src, file)),
  ...["content/tools", "content/pages", "content/articles"].flatMap((folder) =>
    readdirSync(join(src, folder), { recursive: true, encoding: "utf8" })
      .filter((file) => /\.mdx?$/.test(file))
      .map((file) => join(src, folder, file)),
  ),
];
const emoji = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/u;
// Neither font ever drew these signs: the system font does.
const systemSigns = new Set(["✕", "⌘", "↻"]);

describe("the font subset", () => {
  it.each(texts)("covers every letter of %s", (file) => {
    const missing = [...new Set(readFileSync(file, "utf8"))].filter((char) => char > " " && !emoji.test(char) && !systemSigns.has(char) && !covered(char.codePointAt(0) ?? 0));
    expect(missing).toEqual([]);
  });
});
