import preact from "@preact/preset-vite";
import { cp } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const sitePublic = new URL("../web/public/", import.meta.url);

// The OCR and Scanner workers read their files by absolute path on the origin: the site serves them from its public
// folder, the app embeds those folders and leaves the films and the pages behind.
const siteAssets: Plugin = {
  name: "site-assets",
  apply: "build",
  async writeBundle() {
    for (const dir of ["ocr", "scan", "licenses"]) await cp(new URL(dir, sitePublic), new URL(`dist-app/${dir}/`, import.meta.url), { recursive: true });
  },
};

export default defineConfig(({ mode }) => {
  const smoke = mode === "smoke";
  return {
    root: smoke ? "smoke" : "app",
    cacheDir: "../node_modules/.vite",
    publicDir: smoke ? false : fileURLToPath(sitePublic),
    plugins: smoke ? [] : [preact(), siteAssets],
    resolve: { dedupe: ["preact", "preact/hooks", "preact/compat"] },
    server: { port: 1420, strictPort: true },
    build: { outDir: smoke ? "../dist-smoke" : "../dist-app", emptyOutDir: true, target: "esnext", copyPublicDir: false },
    worker: { format: "es" },
  };
});
