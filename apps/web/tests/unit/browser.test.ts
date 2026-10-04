import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = join(import.meta.dirname, "../../src");
const modules = readdirSync(src, { recursive: true, encoding: "utf8" }).filter((file) => /\.tsx?$/.test(file));

// Islands import these modules in the browser, where `process` does not exist; the build hides it by dropping unused code, `astro dev` does not.
describe("modules an island may import", () => {
  it.each(modules)("%s never reads process.env", (file) => {
    expect(readFileSync(join(src, file), "utf8")).not.toMatch(/process\.env/);
  });
});
