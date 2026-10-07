import { readFileSync } from "node:fs";

// After a deploy, tells the IndexNow engines (Bing, Yandex, Naver…) every page of the built sitemap.
// Usage: SITE_URL=https://holy-pdf.com INDEXABLE=true node scripts/indexnow.mjs [--dry-run]
const site = process.env.SITE_URL;
if (process.env.INDEXABLE !== "true" || !site) {
  console.log("IndexNow: skipped, the site is not indexable.");
  process.exit(0);
}

const dist = new URL("../dist/", import.meta.url);
const key = readFileSync(new URL("indexnow.txt", dist), "utf8").trim();
const urlList = [...readFileSync(new URL("sitemap-0.xml", dist), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
const body = { host: new URL(site).host, key, keyLocation: new URL("indexnow.txt", site).href, urlList };

if (process.argv.includes("--dry-run")) {
  console.log(JSON.stringify(body));
  process.exit(0);
}

const served = await fetch(body.keyLocation);
if (!served.ok || (await served.text()).trim() !== key) {
  console.error(`IndexNow: ${body.keyLocation} does not serve the key (${served.status}).`);
  process.exit(1);
}

const response = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(body),
});
if (!response.ok) {
  console.error(`IndexNow: ${response.status} ${response.statusText} ${await response.text()}`);
  process.exit(1);
}
console.log(`IndexNow: ${urlList.length} URLs sent (${response.status}).`);
