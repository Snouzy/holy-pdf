import { defineConfig } from "vite";

export default defineConfig({
  root: "smoke",
  build: { outDir: "../dist-smoke", emptyOutDir: true, target: "esnext" },
  worker: { format: "es" },
});
