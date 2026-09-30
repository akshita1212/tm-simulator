/* CamelAML — production server
   Serves the built app from ./dist with no dependencies beyond Node itself.
   Real URLs such as /cases/AUTH-01/transactions fall back to index.html so a
   reload or a shared link lands on the right screen.
   Run `npm run build` first, then `npm start` (PORT defaults to 3000). */
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createGzip } from "node:zlib";

const ROOT = resolve(fileURLToPath(new URL(".", import.meta.url)), "dist");
const PORT = Number(process.env.PORT) || 3000;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json", ".webmanifest": "application/manifest+json", ".png": "image/png",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8"
};
const COMPRESS = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg", ".txt"]);

async function fileFor(pathname) {
  const p = normalize(join(ROOT, decodeURIComponent(pathname)));
  if (!p.startsWith(ROOT)) return null;
  try { const s = await stat(p); if (s.isFile()) return p; } catch {}
  return null;
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    let file = await fileFor(url.pathname);
    /* SPA fallback for app routes, but a missing asset stays a 404 */
    if (!file && !extname(url.pathname)) file = join(ROOT, "index.html");
    if (!file) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }

    const ext = extname(file);
    const headers = {
      "content-type": TYPES[ext] || "application/octet-stream",
      "x-content-type-options": "nosniff",
      "referrer-policy": "strict-origin-when-cross-origin",
      "cache-control": url.pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable"
        : ext === ".html" || file.endsWith("sw.js") ? "no-cache" : "public, max-age=3600"
    };
    if (COMPRESS.has(ext) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      headers["content-encoding"] = "gzip"; headers["vary"] = "accept-encoding";
      res.writeHead(200, headers);
      if (req.method === "HEAD") return res.end();
      return createReadStream(file).pipe(createGzip()).pipe(res);
    }
    res.writeHead(200, headers);
    if (req.method === "HEAD") return res.end();
    res.end(await readFile(file));
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain" }); res.end("Server error");
  }
});

server.listen(PORT, () => console.log("CamelAML running at http://localhost:" + PORT));
