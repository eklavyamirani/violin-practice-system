// Run: node demo/test/publish.test.mjs (needs curl; no network: uploads go to a local stand-in server).
// Checks the publish step: no token → no request and a clear "Not uploaded"; a refused upload → one request,
// the reason, no links file; an accepted one → video then links file, and the owner's link. The token must
// reach the server only as a header: never in curl's arguments, the URL, the result or the message.
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { publish, readToken, remotePath, stamp } from "../runner/publish.mjs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "demo-publish-test-"));
const video = path.join(tmp, "watch-out-notes.mp4");
fs.writeFileSync(video, Buffer.from("not really a video, but bytes all the same\n"));
const proposal = { app: "violin", id: "watch-out-notes" };
const TOKEN = `test-token-${Math.random().toString(36).slice(2)}`;

// curl, wrapped so every argument list is written down.
const argsLog = path.join(tmp, "curl-args.txt");
const curl = path.join(tmp, "curl-wrapper.sh");
fs.writeFileSync(curl, `#!/bin/sh\nprintf '%s\\n' "$@" >> '${argsLog}'\nexec curl "$@"\n`, { mode: 0o755 });

// A stand-in upload route answering every request with `status`.
async function server(status) {
  const seen = [];
  const s = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      seen.push({ method: req.method, url: req.url, auth: req.headers.authorization, type: req.headers["content-type"], body: Buffer.concat(chunks) });
      res.writeHead(status).end();
    });
  });
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${s.address().port}`;
  return { seen, over: { uploadBase: base, viewBase: "https://downloads.example.test", curl }, close: () => new Promise((r) => s.close(r)) };
}
const noToken = (pub) => {
  for (const part of [JSON.stringify(pub), pub.message]) assert.ok(!part.includes(TOKEN), "token leaked into the result");
};

let n = 0;
const t = async (name, f) => { await f(); n++; console.log("ok", name); };

await t("no token: nothing is sent, the message says it was not uploaded and where the video is", async () => {
  const srv = await server(200);
  const pub = await publish({ proposal, file: video, env: {}, over: srv.over });
  await srv.close();
  assert.equal(srv.seen.length, 0);
  assert.equal(pub.uploaded, false);
  assert.equal(pub.link, null);
  assert.match(pub.message, /^Not uploaded: no upload token/);
  assert.ok(pub.message.includes(video));
});

await t("an unreadable or empty token file is a clear no-token reason", async () => {
  assert.match(readToken({ DEMO_UPLOAD_TOKEN_FILE: path.join(tmp, "missing") }).why, /can't read DEMO_UPLOAD_TOKEN_FILE/);
  fs.writeFileSync(path.join(tmp, "empty"), "\n");
  assert.match(readToken({ DEMO_UPLOAD_TOKEN_FILE: path.join(tmp, "empty") }).why, /is empty/);
  assert.match(readToken({ DEMO_UPLOAD_TOKEN: "  " }).why, /no upload token/);
});

await t("--no-upload: nothing is sent even with a token", async () => {
  const srv = await server(200);
  const pub = await publish({ proposal, file: video, skip: true, env: { DEMO_UPLOAD_TOKEN: TOKEN }, over: srv.over });
  await srv.close();
  assert.equal(srv.seen.length, 0);
  assert.match(pub.message, /^Not uploaded: --no-upload/);
});

await t("refused upload (403): one request, no links file, the reason in the message", async () => {
  const srv = await server(403);
  const pub = await publish({ proposal, file: video, env: { DEMO_UPLOAD_TOKEN: TOKEN }, over: srv.over });
  await srv.close();
  assert.equal(srv.seen.length, 1);
  assert.equal(srv.seen[0].auth, `Bearer ${TOKEN}`);
  assert.equal(pub.uploaded, false);
  assert.equal(pub.link, null);
  assert.equal(pub.requests.length, 1);
  assert.equal(pub.requests[0].status, 403);
  assert.match(pub.requests[0].at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.match(pub.message, /^Not uploaded: HTTP 403: refused by the upload route/);
  noToken(pub);
});

await t("token expired (401) is named as such", async () => {
  const srv = await server(401);
  const pub = await publish({ proposal, file: video, env: { DEMO_UPLOAD_TOKEN: TOKEN }, over: srv.over });
  await srv.close();
  assert.match(pub.message, /HTTP 401: the token is missing, expired or revoked/);
});

await t("upload host unreachable: a network failure, not an upload", async () => {
  const srv = await server(200);
  await srv.close(); // nothing listens on that port any more
  const pub = await publish({ proposal, file: video, env: { DEMO_UPLOAD_TOKEN: TOKEN }, over: srv.over });
  assert.equal(pub.uploaded, false);
  assert.match(pub.message, /^Not uploaded: upload failed \(network\)/);
  noToken(pub);
});

await t("accepted upload: the video, then the links file, from a token file; the owner's link is printed", async () => {
  const srv = await server(200);
  const tokenFile = path.join(tmp, "token");
  fs.writeFileSync(tokenFile, TOKEN + "\n", { mode: 0o600 });
  const pub = await publish({ proposal, file: video, preview: "https://violin-pr-24.example.test/",
    proposalLink: "https://github.com/o/r/issues/27", note: "PR 24", env: { DEMO_UPLOAD_TOKEN_FILE: tokenFile }, over: srv.over });
  await srv.close();
  assert.equal(srv.seen.length, 2);
  const [v, l] = srv.seen;
  for (const r of srv.seen) {
    assert.equal(r.method, "POST");
    assert.equal(r.auth, `Bearer ${TOKEN}`);
    assert.equal(r.type, "application/octet-stream");
    assert.ok(!r.url.includes(TOKEN));
  }
  assert.match(v.url, /^\/files\/api\/resources\?source=downloads&path=\/violin\/watch-out-notes\/\d{8}T\d{6}Z-watch-out-notes\.mp4$/);
  assert.deepEqual(v.body, fs.readFileSync(video));
  assert.match(l.url, /path=\/violin\/watch-out-notes\/\d{8}T\d{6}Z-links\.txt$/);
  assert.match(l.body.toString(), /- Preview: https:\/\/violin-pr-24\.example\.test\/\n- Proposal: https:\/\/github\.com\/o\/r\/issues\/27\n\nPR 24\n$/);
  assert.equal(pub.uploaded, true);
  assert.equal(pub.remote, `demos/${v.url.split("path=/")[1]}`);
  assert.equal(pub.link, `https://downloads.example.test/files/files/downloads/${pub.remote}`);
  assert.ok(pub.message.includes(pub.link));
  assert.deepEqual(pub.requests.map((r) => r.status), [200, 200]);
  noToken(pub);
});

await t("the token never appears in curl's arguments", async () => {
  const args = fs.readFileSync(argsLog, "utf8");
  assert.ok(args.includes("-H\n@-\n"), "the header comes from stdin");
  assert.ok(!args.includes(TOKEN));
});

await t("remote names follow the helper: demos/<app>/<id>/<UTC stamp>-<file>", async () => {
  const at = new Date("2026-11-20T10:15:00.123Z");
  assert.equal(stamp(at), "20261120T101500Z");
  assert.deepEqual(remotePath(proposal, "/x/my demo.mp4", at),
    { stamp: "20261120T101500Z", dir: "violin/watch-out-notes", name: "20261120T101500Z-my_demo.mp4",
      links: "20261120T101500Z-links.txt", remote: "demos/violin/watch-out-notes/20261120T101500Z-my_demo.mp4" });
});

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`${n} passed`);
