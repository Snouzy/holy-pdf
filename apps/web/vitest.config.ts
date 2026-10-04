import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", include: ["tests/unit/**/*.test.ts", "tests/engine/**/*.test.ts", "tests/scan/**/*.test.ts", "tests/scanner/**/*.test.ts"] } },
      { test: { name: "seo", include: ["tests/seo/**/*.test.ts"] } },
    ],
  },
});
