// Run: node demo/test/scripted-audio.mjs [runs=3]
// The kit's scripted audio is repeatable: the app (with the fixture) hears the Stage 1 D-string pattern
// played with a high 2nd finger, and every run flags the same notes by about the same amount.
// Headless, no video, about 15 s a run.
import { launch } from "../runner/browser.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import kit from "../kit/kit.mjs";
import { playDrill, drillId, highSecondFinger, inTune } from "../kit/audio/passages.mjs";
import * as mic from "../runner/fake-mic.mjs";

const RUNS = +(process.argv[2] || 3), NODE = "pattern:1:23", DIR = "asc_desc";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "violin-demo-audio-"));

async function once(browser, srv, wav) {
  const ctx = await browser.newContext({ viewport: kit.viewport });
  await mic.attach(ctx, "inject", wav);
  const page = await ctx.newPage();
  await page.goto(srv.loadUrl());
  await kit.ready(page);
  await page.evaluate((id) => selectEx(id), drillId(NODE, DIR));
  await page.click("#startBtn");
  await page.waitForSelector("#results:not([hidden])", { timeout: 25000 });
  const out = await page.evaluate((id) => {
    const e = DB.runs[recKey(id)].runs[0];
    return { score: e.score, landings: e.landings.map((l) => ({ note: l.note, cents: l.cents, inTune: l.inTune })), tips: e.coachNotes };
  }, drillId(NODE, DIR));
  await ctx.close();
  return out;
}

const browser = await launch({ args: mic.chromiumArgs("inject") });
const srv = await kit.start({ browser });
let bad = 0;
try {
  for (const [name, detune] of [["high 2nd finger", highSecondFinger], ["in tune", inTune]]) {
    const wav = playDrill(path.join(tmp, `${name.replace(/\s/g, "-")}.wav`), NODE, { dir: DIR, detune }).file;
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await once(browser, srv, wav));
    console.log(`\n${name}:`);
    runs.forEach((r, i) => console.log(`  run ${i + 1}: ${Math.round(r.score * 100)}% · ${r.landings.map((l) => `${l.note} ${l.cents > 0 ? "+" : ""}${Math.round(l.cents)}`).join(" ")}`));
    const flagged = runs.map((r) => r.landings.filter((l) => !l.inTune).map((l) => l.note).join(","));
    const expect = name === "in tune" ? "" : "F#4,F#4";
    for (const f of flagged) if (f.replace(/♯/g, "#") !== expect) { bad++; console.log(`  FAIL: out of tune ${f || "(none)"}, expected ${expect || "(none)"}`); }
    const spread = Math.max(...runs.flatMap((r, i) => r.landings.map((l, k) => Math.abs(l.cents - runs[0].landings[k].cents))));
    console.log(`  same notes flagged in every run: ${new Set(flagged).size === 1 ? "yes" : "NO"} · largest difference between runs: ${spread.toFixed(1)}¢`);
    if (name !== "in tune") console.log(`  coach: ${runs[0].tips.find((t) => /sharp/.test(t)) || runs[0].tips[0]}`);
  }
} finally {
  await srv.close(); await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(bad ? `\n${bad} problem(s)` : "\nrepeatable");
process.exit(bad ? 1 : 0);
