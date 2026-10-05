import { h } from "preact";
import { render } from "preact-render-to-string";
import { describe, expect, it } from "vitest";
import { upcomingIds } from "../../src/cast";
import { Avatar, avatarClip } from "../../src/illustrations/Avatar";
import { Icon } from "../../src/illustrations/Icon";
import { Monk } from "../../src/illustrations/Monk";
import { Scene } from "../../src/illustrations/Scene";
import { ToolIcon } from "../../src/illustrations/ToolIcon";
import { toolIds } from "../../src/tools";

const hexColor = /#[0-9a-fA-F]{3,6}\b/;

describe("Monk", () => {
  const accessories = ["stapler", "scissors", "sheet", "eraser", "loupe", "arrows", "frame", "quill", "stamp", "lock", "book", "phone"] as const;

  it.each(accessories.flatMap((accessory) => (["all", "prop"] as const).map((layer) => [accessory, layer] as const)))(
    "draws the %s over the hands, layer %s",
    (accessory, layer) => {
      const svg = render(h(Monk, { size: 100, accessory, layer }));
      expect(svg.indexOf(`class="accessory-${accessory}"`)).toBeGreaterThan(svg.lastIndexOf('<circle cx="126" cy="166"'));
    },
  );

  it("is decoration, 1.1 times as tall as wide", () => {
    const svg = render(h(Monk, { size: 140 }));
    expect(svg).toMatch(/^<svg[^>]*aria-hidden="true"/);
    expect(svg).toContain('width="140"');
    expect(svg).toContain('height="154"');
  });

  it("draws only its own accessory", () => {
    const svg = render(h(Monk, { size: 80, accessory: "stapler" }));
    expect(svg).toContain("accessory-stapler");
    expect(svg).not.toMatch(/accessory-(?!stapler)/);
  });

  it("draws only the accessory and the right hand on the prop layer", () => {
    const svg = render(h(Monk, { size: 80, accessory: "loupe", layer: "prop" }));
    expect(svg).toContain("accessory-loupe");
    expect(svg).not.toContain("monk-body");
    expect(svg.match(/<circle cx="126"/g)).toHaveLength(1);
    expect(svg).not.toContain('cx="74"');
  });

  it("wears the halo only when asked", () => {
    expect(render(h(Monk, { size: 48, halo: true }))).toContain("monk-halo");
    expect(render(h(Monk, { size: 48 }))).not.toContain("monk-halo");
  });

  it("sleeps with closed eyes and Zz", () => {
    expect(render(h(Monk, { size: 46, mood: "sleep" }))).toContain("monk-sleep");
    expect(render(h(Monk, { size: 46, mood: "happy" }))).not.toContain("monk-sleep");
  });

  it("draws its Zz in the page ink, since they float on the page", () => {
    expect(render(h(Monk, { size: 46, mood: "sleep" }))).toMatch(/<path d="M150 24[^"]*"[^>]*stroke="var\(--ink\)"/);
  });

  it.each(["stapler", "scissors", "sheet", "eraser", "loupe", "arrows", "frame", "quill", "stamp", "lock", "book", "phone"] as const)(
    "takes the colors of its %s from CSS variables",
    (accessory) => {
      expect(render(h(Monk, { size: 80, accessory, mood: "joy", halo: true }))).not.toMatch(hexColor);
    },
  );
});

describe("Scene", () => {
  it.each(["merge", "split", "organize", "delete", "extract", "rotate", "images", "pdf-to-jpg", "compress", "sign", "scan", "protect", "unlock", "page-numbers", "watermark", "flatten", "pages-per-sheet", "split-in-half", "pixelize"] as const)("draws the %s sheet only", (kind) => {
    const svg = render(h(Scene, { kind, size: 150 }));
    expect(svg).toContain(`scene-${kind}`);
    expect(svg).not.toMatch(new RegExp(`class="scene-(?!${kind}")`));
    expect(svg).not.toMatch(hexColor);
    expect(svg).toContain('aria-hidden="true"');
  });
});

describe("Avatar", () => {
  it("clips the robe with the lower half of the circle", () => {
    expect(avatarClip(80)).toBe("path('M0 0 H100 V68 H90 A40 40 0 0 1 10 68 H0 Z')");
    expect(avatarClip(40)).toBe("path('M0 0 H50 V34 H45 A20 20 0 0 1 5 34 H0 Z')");
  });

  it("puts the accessory layer over the clipped monk", () => {
    const html = render(h(Avatar, { accessory: "stapler", mood: "joy", diameter: 80, tint: "var(--organize-tint)" }));
    expect(html.match(/<svg/g)).toHaveLength(2);
    expect(html).toContain("clip-path");
    expect(html).toContain("var(--organize-tint)");
    expect(html).toMatch(/^<span[^>]*aria-hidden="true"/);
  });
});

describe("Icon", () => {
  it("strokes in the text color and hides from screen readers", () => {
    const svg = render(h(Icon, { name: "rotate" }));
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('aria-hidden="true"');
    expect(svg).toContain('width="20"');
  });
});

describe("ToolIcon", () => {
  it("gives every tool, ready or asleep, its own line icon, as decoration", () => {
    const drawings = [...toolIds, ...upcomingIds].map((id) => render(h(ToolIcon, { id })));
    for (const svg of drawings) {
      expect(svg).toMatch(/^<svg[^>]*aria-hidden="true"[^>]*>/);
      expect(svg).toMatch(/stroke="currentColor"/);
      expect(svg).toMatch(/<(path|rect|circle|line|polyline|polygon)\b/);
    }
    expect(new Set(drawings).size).toBe(drawings.length);
  });
});
