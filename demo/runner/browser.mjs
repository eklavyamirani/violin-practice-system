// Which Playwright drives Chromium. Normally the runner's own, pinned in demo/package.json, with the browser
// that `npx --prefix demo playwright install chromium` puts on the machine. A machine that already has a
// Playwright and its browsers, and must not download others (a cloud session's image), is used as it is:
//
//   DEMO_PLAYWRIGHT=<directory of a playwright package>   use exactly that one
//
// Without it: the pinned Playwright if its Chromium launches (and, for recording, its video encoder works);
// otherwise the first other installed Playwright that does: the global npm root, NODE_PATH,
// /usr/local/lib/node_modules, /usr/lib/node_modules (playwright, playwright-core or @playwright/test).
// The choice is printed once and kept for the rest of the run.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const PACKAGES = ["playwright", "playwright-core", path.join("@playwright", "test")];

function load(dir, how) {
  const mod = createRequire(path.join(dir, "package.json"))(dir);
  if (!mod.chromium) throw new Error(`${dir} has no chromium export`);
  const version = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).version;
  return { dir, version, how, chromium: mod.chromium };
}

/** Playwright packages to try, in order: [{ dir, how }]. */
export function candidates(env = process.env) {
  if (env.DEMO_PLAYWRIGHT) return [{ dir: path.resolve(env.DEMO_PLAYWRIGHT), how: "DEMO_PLAYWRIGHT" }];
  const out = [];
  try { out.push({ dir: path.dirname(require.resolve("playwright/package.json")), how: "pinned" }); } catch {}
  const npmRoot = spawnSync("npm", ["root", "-g"], { encoding: "utf8", timeout: 15000 });
  const roots = [
    npmRoot.status === 0 ? npmRoot.stdout.trim() : null,
    ...(env.NODE_PATH || "").split(path.delimiter),
    "/usr/local/lib/node_modules", "/usr/lib/node_modules",
  ].filter(Boolean);
  for (const root of roots) for (const p of PACKAGES) {
    const dir = path.join(root, p);
    if (fs.existsSync(path.join(dir, "package.json"))) out.push({ dir, how: "installed on this machine" });
  }
  const seen = new Set();
  return out.filter((c) => { const r = fs.realpathSync(c.dir); return seen.has(r) ? false : seen.add(r); });
}

// The video check waits this long for its first frame
const FIRST_FRAME_MS = 15000;
const within = (p, ms, why) => {
  let timer;
  return Promise.race([p, new Promise((_, no) => { timer = setTimeout(() => no(new Error(why)), ms); })]).finally(() => clearTimeout(timer));
};

// Launches, and for recording also records a moment of video, which needs that Playwright's ffmpeg.
// The check waits for the video's first frame before closing: Playwright starts a page's video (and resolves
// video.path()) at its first frame, and in older releases (1.57 at least) closing a page before that frame
// leaves its ffmpeg waiting for input for ever, which keeps node from exiting after the run.
async function tryOne(c, opts, video) {
  const pw = load(c.dir, c.how);
  const browser = await pw.chromium.launch(opts);
  if (video) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "demo-video-check-"));
    try {
      const ctx = await browser.newContext({ recordVideo: { dir, size: { width: 64, height: 64 } } });
      const page = await ctx.newPage();
      await page.setContent('<body style="margin:0;background:#e07b39"></body>');
      await within(page.video().path(), FIRST_FRAME_MS, `video recording got no frame in ${FIRST_FRAME_MS / 1000} s`);
      await ctx.close();
    } catch (e) { await browser.close(); throw e; } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  }
  return { pw, browser };
}

let chosen = null;
const firstLine = (e) => String(e && e.message || e).split("\n").find((l) => l.trim()) || "failed";

/**
 * Launches Chromium with the first Playwright that works here. `video: true` also checks video recording.
 * Prints which one it used, once per run.
 */
export async function launch(opts = {}, { video = false } = {}) {
  if (chosen) return chosen.chromium.launch(opts);
  const tried = [];
  for (const c of candidates()) {
    try {
      const { pw, browser } = await tryOne(c, opts, video);
      chosen = pw;
      const note = tried.length ? `; skipped ${tried.map((t) => `${t.label} (${t.why})`).join(", ")}` : "";
      console.log(`[demo] browser: Playwright ${pw.version} (${pw.how}, ${pw.dir}), Chromium ${browser.version()}${note}`);
      return browser;
    } catch (e) {
      let label = c.dir;
      try { label = `Playwright ${load(c.dir, c.how).version} (${c.how})`; } catch {}
      tried.push({ label, why: firstLine(e) });
    }
  }
  throw new Error(`No Playwright here could ${video ? "launch Chromium and record video" : "launch Chromium"}:\n` +
    tried.map((t) => `  ${t.label}: ${t.why}`).join("\n") +
    "\nInstall the pinned one's browser (npx --prefix demo playwright install chromium), or point DEMO_PLAYWRIGHT at an installed Playwright whose browsers are on this machine.");
}

/** The Playwright in use (after the first launch), e.g. for reports. */
export const inUse = () => (chosen ? { version: chosen.version, how: chosen.how, dir: chosen.dir } : null);
