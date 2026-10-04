// The site serves Tesseract itself: copies its worker, its three LSTM cores and the language data into public/ocr.
// The browser picks one core by what its WebAssembly supports, so all three must be there.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const root = (name, from) => dirname(require.resolve(`${name}/package.json`, from && { paths: [from] }));
const tesseract = root("tesseract.js");
const core = root("tesseract.js-core", tesseract);
const out = new URL("../public/ocr/", import.meta.url).pathname;

mkdirSync(join(out, "core"), { recursive: true });
mkdirSync(join(out, "lang"), { recursive: true });
copyFileSync(join(tesseract, "dist/worker.min.js"), join(out, "worker.min.js"));
for (const variant of ["lstm", "simd-lstm", "relaxedsimd-lstm"]) {
  copyFileSync(join(core, `tesseract-core-${variant}.wasm.js`), join(out, "core", `tesseract-core-${variant}.wasm.js`));
}
for (const language of ["fra", "eng", "ron"]) {
  copyFileSync(join(root(`@tesseract.js-data/${language}`), "4.0.0_best_int", `${language}.traineddata.gz`), join(out, "lang", `${language}.traineddata.gz`));
}
