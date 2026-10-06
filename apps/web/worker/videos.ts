type Env = { ASSETS: { fetch(request: Request): Promise<Response> } };

/** Static assets answer a Range request with the whole file; Safari, and every browser on iOS, play a video only from 206 answers. */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const asset = await env.ASSETS.fetch(request);
    const headers = new Headers(asset.headers);
    headers.set("Accept-Ranges", "bytes");
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("Range") ?? "");
    const ifRange = request.headers.get("If-Range");
    if (request.method !== "GET" || asset.status !== 200 || !range || (ifRange && ifRange !== asset.headers.get("ETag"))) {
      return new Response(asset.body, { status: asset.status, headers });
    }
    const body = await asset.arrayBuffer();
    const size = body.byteLength;
    const [, from = "", to = ""] = range;
    const start = from === "" ? Math.max(0, size - Number(to)) : Number(from);
    const end = from === "" || to === "" ? size - 1 : Math.min(Number(to), size - 1);
    if ((from === "" && to === "") || start > end) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};
