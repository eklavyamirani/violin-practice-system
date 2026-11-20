// Publish step: uploads the finished mp4 to the platform's Downloads app under demos/<app>/<proposal-id>/
// (eklavyamirani/app-platform#82) and returns the link the owner opens after signing in.
//
// It makes the same requests as the platform's `scripts/demo-upload` helper, with curl: a create-only POST of
// the video named <UTC time>-<file>, then a small <UTC time>-links.txt next to it (preview link, proposal
// link, note). Uploads never overwrite; the runner sends each file once per run and never retries.
//
// The token: DEMO_UPLOAD_TOKEN, or a file whose path is in DEMO_UPLOAD_TOKEN_FILE. It is handed to curl as a
// header on stdin (`-H @-`), so it is never in a process argument, a URL, a log, the report or a message.
// Without a token the video is still recorded and the runner says it did not upload.
//
//   DEMO_UPLOAD_HOST    the upload host (default below); the link uses the same host without "-upload"
//   DEMO_UPLOAD_CACERT  a CA file, for a local cluster
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export const DEFAULT_HOST = "downloads-upload.app.ekkylab.uk";
const MAX_BYTES = 200 * 1024 * 1024;
const APP_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

/** UTC stamp like 20261120T101500Z, as the helper names files. */
export const stamp = (d = new Date()) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
const safeName = (file) => path.basename(file).replace(/[^A-Za-z0-9._-]/g, "_");
const enc = (p) => p.split("/").map(encodeURIComponent).join("/");

/** The folder and file a video goes to; `remote` is the path the owner sees in Downloads. */
export function remotePath(p, file, at = new Date()) {
  const s = stamp(at);
  const dir = `${p.app}/${p.id}`;
  const name = `${s}-${safeName(file)}`;
  return { stamp: s, dir, name, links: `${s}-links.txt`, remote: `demos/${dir}/${name}` };
}

/** { token } or { token: null, why }. Never logs the token. */
export function readToken(env = process.env) {
  const direct = (env.DEMO_UPLOAD_TOKEN || "").trim();
  if (direct) return { token: direct };
  const f = env.DEMO_UPLOAD_TOKEN_FILE;
  if (!f) return { token: null, why: "no upload token (set DEMO_UPLOAD_TOKEN, or DEMO_UPLOAD_TOKEN_FILE to a file holding it)" };
  let t;
  try { t = fs.readFileSync(f, "utf8").trim(); } catch (e) { return { token: null, why: `can't read DEMO_UPLOAD_TOKEN_FILE ${f} (${e.code || e.message})` }; }
  return t ? { token: t } : { token: null, why: `DEMO_UPLOAD_TOKEN_FILE ${f} is empty` };
}

/** Where requests go and links point. `uploadBase`/`viewBase` are for tests (a local server). */
export function endpoint(env = process.env, over = {}) {
  const host = env.DEMO_UPLOAD_HOST || DEFAULT_HOST;
  if (!/^[a-z0-9.-]+$/.test(host)) throw new Error("DEMO_UPLOAD_HOST: a host name");
  return {
    uploadBase: over.uploadBase || `https://${host}`,
    viewBase: over.viewBase || `https://${host.replace("-upload.", ".")}`,
    cacert: env.DEMO_UPLOAD_CACERT || null,
    curl: over.curl || "curl",
  };
}

const STATUS = {
  401: "the token is missing, expired or revoked (the owner issues a new one)",
  403: "refused by the upload route (path, name or method) or outside demos/",
  404: "refused by the upload route (path, name or method) or outside demos/",
  409: "the file exists already (uploads never overwrite)",
  413: "larger than the route allows",
  429: "too many requests; wait a minute",
};

/** The curl arguments for one create-only upload. The token is not among them: it comes on stdin. */
export function curlArgs({ local, dir, name, ep }) {
  return ["-sS", ...(ep.cacert ? ["--cacert", ep.cacert] : []), "--max-time", "900", "-o", "/dev/null",
    "-w", "%{http_code}", "-H", "@-", "-H", "Content-Type: application/octet-stream", "--data-binary", `@${local}`,
    `${ep.uploadBase}/files/api/resources?source=downloads&path=/${dir}/${name}`];
}

/** One request. Resolves { name, at, status, ok, error }; `at` is the UTC time it was sent. */
function put({ local, dir, name, ep, token }) {
  const at = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  return new Promise((resolve) => {
    const child = spawn(ep.curl, curlArgs({ local, dir, name, ep }), { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => resolve({ name, at, status: null, ok: false, error: `curl didn't run (${e.code || e.message})` }));
    child.on("close", (code) => {
      const status = Number(out.trim()) || null;
      const clean = (s) => s.split(token).join("[token]").trim();
      if (code !== 0 && !status) return resolve({ name, at, status, ok: false, error: `upload failed (network): ${clean(err) || `curl exit ${code}`}` });
      if (status === 200 || status === 201) return resolve({ name, at, status, ok: true });
      resolve({ name, at, status, ok: false, error: `HTTP ${status}${STATUS[status] ? `: ${STATUS[status]}` : ""}` });
    });
    child.stdin.on("error", () => {}); // curl may exit before reading stdin
    child.stdin.end(`Authorization: Bearer ${token}\n`);
  });
}

/**
 * Uploads the video (unless there is no token or `skip`), then the links file.
 * Returns { uploaded, remote, link, folder, local, requests, message }; `message` is what the session tells
 * the owner, `requests` lists each request's file, UTC time and HTTP status.
 */
export async function publish({ proposal, file, preview, proposalLink, note, skip = false, env = process.env, over = {} }) {
  const r = remotePath(proposal, file);
  const local = file;
  const notUp = (why, requests = []) => ({ uploaded: false, remote: null, link: null, folder: null, local, requests,
    message: `Not uploaded: ${why}. The video is at ${file}; send it to the owner from the session.` });

  if (skip) return notUp("--no-upload");
  const { token, why } = readToken(env);
  if (!token) return notUp(why);
  if (!APP_RE.test(proposal.app)) return notUp(`app "${proposal.app}": lowercase letters, digits, dashes`);
  if (!ID_RE.test(proposal.id)) return notUp(`proposal id "${proposal.id}": letters, digits, . _ -`);
  if (!r.name.endsWith(".mp4")) return notUp("the upload route takes .mp4 videos only");
  const size = fs.statSync(file).size;
  if (!(size > 0 && size <= MAX_BYTES)) return notUp(`${size} bytes; the limit is ${MAX_BYTES}`);
  const ep = endpoint(env, over);

  const requests = [];
  const video = await put({ local: file, dir: r.dir, name: r.name, ep, token });
  requests.push(video);
  if (!video.ok) return notUp(video.error, requests);

  const linksFile = path.join(path.dirname(file), r.links);
  fs.writeFileSync(linksFile, [
    `Demo: ${proposal.app} / ${proposal.id}`, "",
    `- Video: ${r.name} (${size} bytes)`,
    `- Uploaded: ${video.at}`,
    ...(preview ? [`- Preview: ${preview}`] : []),
    ...(proposalLink ? [`- Proposal: ${proposalLink}`] : []),
    ...(note ? ["", note] : []),
  ].join("\n") + "\n");
  const links = await put({ local: linksFile, dir: r.dir, name: r.links, ep, token });
  requests.push(links);

  const link = `${ep.viewBase}/files/files/downloads/demos/${enc(`${r.dir}/${r.name}`)}`;
  const folder = `${ep.viewBase}/files/files/downloads/demos/${enc(r.dir)}/`;
  const extra = links.ok ? "" : ` (the links file was not uploaded: ${links.error})`;
  return { uploaded: true, remote: r.remote, link, folder, local, requests,
    message: `Uploaded to Downloads as ${r.remote}${extra}. Send the owner this link (it opens after sign-in):\n  ${link}` };
}
