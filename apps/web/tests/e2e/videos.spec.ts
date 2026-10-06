import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const path = "/videos/holy-pdf-en.mp4";
const file = readFile(join(import.meta.dirname, "../../public", path));

test("serves the film in byte ranges, as Safari needs to play it", async ({ request }) => {
  const bytes = await file;
  const size = bytes.length;
  const whole = await request.get(path);
  expect(whole.status()).toBe(200);
  expect(whole.headers()["accept-ranges"]).toBe("bytes");

  for (const [range, start, end] of [["bytes=0-1", 0, 1], ["bytes=1000-", 1000, size - 1], ["bytes=-10", size - 10, size - 1], ["bytes=-99999999", 0, size - 1]] as const) {
    const part = await request.get(path, { headers: { Range: range } });
    expect(part.status(), range).toBe(206);
    expect(part.headers()["content-range"], range).toBe(`bytes ${start}-${end}/${size}`);
    expect(Buffer.compare(await part.body(), bytes.subarray(start, end + 1)), range).toBe(0);
  }

  const beyond = await request.get(path, { headers: { Range: `bytes=${size}-` } });
  expect(beyond.status()).toBe(416);
  expect(beyond.headers()["content-range"]).toBe(`bytes */${size}`);
  const changed = await request.get(path, { headers: { Range: "bytes=0-1", "If-Range": "\"another-version\"" } });
  expect(changed.status()).toBe(200);
});
