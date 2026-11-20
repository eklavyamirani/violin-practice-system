// A tiny static file server that runs inside the calling process (no background shell job).
import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".wav": "audio/wav", ".mp3": "audio/mpeg", ".webm": "video/webm", ".mp4": "video/mp4", ".ico": "image/x-icon" };

/**
 * Serve `root` on 127.0.0.1:`port` (0 = any free port). `routes` maps exact paths to handlers
 * (req, res) => void, checked before files. Resolves to { url, port, close }.
 */
export function serveStatic(root, { port = 0, routes = {} } = {}) {
  root = path.resolve(root);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, "http://x");
    if (routes[u.pathname]) return routes[u.pathname](req, res, u);
    let p = path.join(root, decodeURIComponent(u.pathname));
    if (!p.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
    fs.readFile(p, (err, data) => {
      if (err) { res.writeHead(404); return res.end("not found"); }
      res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      const p = server.address().port;
      resolve({ url: `http://localhost:${p}/`, port: p, close: () => new Promise((r) => server.close(r)) });
    });
  });
}
