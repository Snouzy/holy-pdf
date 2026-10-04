import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(import.meta.dirname, "../../src/styles/tokens.css"), "utf8");
const [light = "", dark = ""] = css.split(':root[data-theme="dark"]');

function colors(block: string): Map<string, string> {
  return new Map([...block.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})\b/g)].map((match) => [match[1] ?? "", match[2] ?? ""]));
}

const schemes = { light: colors(light), dark: new Map([...colors(light), ...colors(dark)]) };

function luminance(hex: string): number {
  const channel = (start: number) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

const pairs = [
  ["ink", "bg"],
  ["ink", "surface"],
  ["ink-soft", "surface"],
  ["muted", "surface"],
  ["accent", "bg"],
  ["accent", "surface"],
  ["on-accent", "accent"],
  ["on-highlight", "highlight"],
  ["stamp", "surface"],
  ["organize", "surface"],
  ["convert", "surface"],
  ["edit", "surface"],
  ["optimize", "surface"],
  ["security", "surface"],
  ["on-footer", "footer"],
] as const;

describe.each(Object.entries(schemes))("%s colors", (_, scheme) => {
  it.each(pairs)("%s on %s reaches 4.5:1", (text, background) => {
    const foreground = scheme.get(text);
    const behind = scheme.get(background);
    expect(foreground, `--${text} is defined`).toBeDefined();
    expect(behind, `--${background} is defined`).toBeDefined();
    expect(contrast(foreground ?? "", behind ?? "")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps PDF pages white", () => {
    expect(scheme.get("paper")).toBe("#ffffff");
  });
});

it.each([...schemes.dark.keys()].filter((name) => name.endsWith("-tint")))("shows the dark --%s disc on a panel", (tint) => {
  expect(contrast(schemes.dark.get(tint) ?? "", schemes.dark.get("surface") ?? "")).toBeGreaterThanOrEqual(1.3);
});

it.each(["bg", "surface"])("shows the disc of a sleeping monk on the dark %s", (background) => {
  expect(contrast(schemes.dark.get("upcoming") ?? "", schemes.dark.get(background) ?? "")).toBeGreaterThanOrEqual(1.4);
});
