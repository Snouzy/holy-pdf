import { copyFile, readdir, rename, rmdir } from "node:fs/promises";
import preact from "@astrojs/preact";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

// Cloudflare serves the nearest 404.html: one per language folder, and the English one at the root.
const notFoundPages = {
  name: "not-found-pages",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      for (const entry of await readdir(dir, { withFileTypes: true })) {
        const folder = new URL(`${entry.name}/404/`, dir);
        if (!entry.isDirectory() || !(await readdir(folder).catch(() => [])).includes("index.html")) continue;
        await rename(new URL("index.html", folder), new URL(`${entry.name}/404.html`, dir));
        await rmdir(folder);
      }
      await copyFile(new URL("en/404.html", dir), new URL("404.html", dir));
    },
  },
};

export default defineConfig({
  site: process.env.SITE_URL ?? "http://localhost:8787",
  output: "static",
  trailingSlash: "never",
  build: { format: "directory", inlineStylesheets: "always" },
  vite: {
    worker: { format: "es" },
    // `astro dev` keeps its pre-bundled dependencies apart: a build or a check run beside it would rewrite them and
    // break the running server (504 « Outdated Optimize Dep »).
    cacheDir: process.argv.includes("dev") ? "node_modules/.vite-dev" : "node_modules/.vite",
    // Astro's own scripts stay in the page whatever their size: a script request at load costs the home a simulated round trip of LCP.
    build: {
      assetsInlineLimit: (file) => (file.includes("_astro_type_script_") ? true : undefined),
      rollupOptions: {
        output: {
          // Vite wraps each dynamic import in a preload helper; inside the Preact chunk it costs no extra request. The hooks, the JSX
          // runtime and the icons ride along: every island loads them, and each request of its own delays the document's end (the LCP).
          manualChunks: (id) =>
            id.includes("vite/preload-helper") || /\/node_modules\/preact\//.test(id) || id.endsWith("/src/illustrations/Icon.tsx") ? "preact" : undefined,
        },
      },
    },
  },
  integrations: [preact({ compat: true }), sitemap({ filter: (page) => !page.endsWith("/404") }), notFoundPages],
});
