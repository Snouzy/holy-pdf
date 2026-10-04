import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  fullyParallel: true,
  // Every page compiles PDFium: with three browsers at once, thumbnails can take several seconds.
  expect: { timeout: 15_000 },
  use: { baseURL: "http://localhost:8787" },
  webServer: {
    command: "pnpm exec wrangler dev --port 8787",
    url: "http://localhost:8787/en",
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    { name: "chromium", testDir: "tests/e2e", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", testDir: "tests/e2e", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", testDir: "tests/e2e", use: { ...devices["Desktop Safari"] } },
    // Timings, not correctness: run on demand with `pnpm bench`, never in CI.
    { name: "bench", testDir: "tests/bench", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 1600 } } },
  ],
});
