// Recorder: starts the app through its demo kit, runs a walkthrough script with Playwright and captures a
// phone-sized video of exactly the walkthrough section (the template's 40 s), plus the caption and
// microphone timings the assembler needs. Generic: everything app-specific comes from the kit.
import { launch } from "./browser.mjs";
import fs from "node:fs";
import path from "node:path";
import { WIDTH, HEIGHT, SECTIONS } from "./template.mjs";
import * as mic from "./fake-mic.mjs";

const WALK = SECTIONS.find((s) => s.key === "walkthrough").seconds;

// Captions and tap rings drawn into the page, so they are part of the recording
const OVERLAY = () => {
  const css = `#__demoCap{position:fixed;left:10px;right:10px;bottom:14px;z-index:2147483647;background:rgba(29,26,23,.94);color:#fff;
    font:600 15px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;padding:10px 13px;border-radius:12px;box-shadow:0 4px 18px rgba(0,0,0,.25);
    transition:opacity .25s;pointer-events:none}
  #__demoCap:empty{opacity:0}
  .__demoTap{position:fixed;z-index:2147483647;width:44px;height:44px;margin:-22px 0 0 -22px;border-radius:50%;border:3px solid #e07b39;background:rgba(224,123,57,.25);
    pointer-events:none;animation:__demoTap .7s ease-out forwards}
  @keyframes __demoTap{from{transform:scale(.4);opacity:1}to{transform:scale(1.3);opacity:0}}`;
  const add = () => {
    if (document.getElementById("__demoCap")) return;
    const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    const cap = document.createElement("div"); cap.id = "__demoCap"; document.body.appendChild(cap);
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", add); else add();
  window.__demoCaption = (t) => { add(); document.getElementById("__demoCap").textContent = t || ""; };
  window.__demoTap = (x, y) => { const d = document.createElement("div"); d.className = "__demoTap"; d.style.left = x + "px"; d.style.top = y + "px"; document.body.appendChild(d); setTimeout(() => d.remove(), 800); };
};

/**
 * kit: the app's demo kit (see demo/CONTRACT.md). walk: a walkthrough module. Returns
 * { video, offset, captions: [{ t, text }], mic: { file, t } | null, viewport, log } with times in seconds
 * from the start of the walkthrough section.
 */
export async function record({ kit, walk, proposal, outDir, headless = true }) {
  fs.mkdirSync(outDir, { recursive: true });
  const viewport = kit.viewport || { width: 390, height: 693 };
  const micMode = walk.micMode || "inject";
  const micFile = walk.audio ? await walk.audio({ outDir }) : null;
  // Headless Chromium screencasts (which Playwright's video uses) at CSS-pixel size unless the device scale
  // is forced; with it, a 390×693 phone viewport is captured at 780×1386 and fills the 720×1280 frame sharply
  const args = ["--force-device-scale-factor=2", ...(micFile ? mic.chromiumArgs(micMode, micFile) : [])];
  const browser = await launch({ headless, args }, { video: true });
  const srv = await kit.start({ browser });
  const log = [];
  try {
    const videoDir = path.join(outDir, "raw");
    fs.rmSync(videoDir, { recursive: true, force: true });
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: false, recordVideo: { dir: videoDir, size: { width: WIDTH, height: HEIGHT } } });
    if (micFile) await mic.attach(context, micMode, micFile);
    await context.addInitScript(OVERLAY);
    const t0 = Date.now(); // the video starts (close to) here
    const page = await context.newPage();
    page.on("pageerror", (e) => log.push(`pageerror: ${e.message}`));
    page.on("dialog", (d) => d.accept());
    await page.goto(srv.loadUrl(walk.query || ""));
    if (kit.ready) await kit.ready(page);

    let begin = null;
    const captions = [];
    const now = () => (Date.now() - begin) / 1000;
    const demo = {
      proposal,
      kit,
      /** Show a caption (it is also narrated from this moment). */
      say: async (text) => { captions.push({ t: now(), text }); await page.evaluate((t) => window.__demoCaption(t), text); },
      clear: () => page.evaluate(() => window.__demoCaption("")),
      /** Click with a visible tap ring. */
      tap: async (selector) => {
        const el = page.locator(selector).first();
        await el.scrollIntoViewIfNeeded();
        const b = await el.boundingBox();
        if (b) await page.evaluate(([x, y]) => window.__demoTap(x, y), [b.x + b.width / 2, b.y + b.height / 2]);
        await page.waitForTimeout(250);
        await el.click();
      },
      scrollTo: (selector, block = "start") => page.locator(selector).first().evaluate((el, block) => el.scrollIntoView({ behavior: "smooth", block }), block),
      wait: (ms) => page.waitForTimeout(ms),
      /** Wait until `sec` seconds into the walkthrough. */
      at: async (sec) => { const ms = (sec - now()) * 1000; if (ms > 0) await page.waitForTimeout(ms); else log.push(`at(${sec}) reached late, at ${now().toFixed(1)} s`); },
      elapsed: now,
    };
    if (walk.setup) await walk.setup({ page, demo });
    begin = Date.now();
    const pageBegin = await page.evaluate(() => performance.now());
    await walk.run({ page, demo });
    const used = now();
    if (used > WALK) log.push(`walkthrough ran ${used.toFixed(1)} s; the template keeps the first ${WALK} s`);
    else await page.waitForTimeout((WALK - used) * 1000 + 300);
    const micInfo = micFile ? await page.evaluate(() => window.__demoMic || null) : null;
    const video = page.video();
    await context.close();
    const raw = await video.path();
    const out = path.join(outDir, "walkthrough.webm");
    fs.renameSync(raw, out);
    fs.rmSync(videoDir, { recursive: true, force: true });
    return {
      video: out, offset: (begin - t0) / 1000, captions, viewport, log, seconds: Math.min(used, WALK),
      mic: micInfo ? { file: micFile, t: (micInfo.startedAt - pageBegin) / 1000 } : null,
    };
  } finally {
    await srv.close();
    await browser.close();
  }
}
