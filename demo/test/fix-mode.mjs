// Run: node demo/test/fix-mode.mjs
// Prototype round 2 (watch-out-notes): Fix mode heard through the kit's scripted audio. Checks the miss, the
// set reset, the 10-second break, the done state, that the note history is untouched, and the progression mode.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import kit from "../kit/kit.mjs";
import { drillId, drillNotes, playFix } from "../kit/audio/passages.mjs";
import * as mic from "../runner/fake-mic.mjs";

const NODE = "pattern:1:23", DIR = "asc_desc";
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "violin-fix-"));
const notes = drillNotes(NODE, DIR), target = notes.find((n) => n.label.includes("♯") && n.finger === "2");
let bad = 0;
const check = (name, ok, got) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `: ${JSON.stringify(got)}`}`); if (!ok) bad++; };

async function session(browser, srv, wav, kind) {
  const ctx = await browser.newContext({ viewport: kit.viewport });
  await mic.attach(ctx, "inject", wav);
  const page = await ctx.newPage();
  await page.goto(srv.loadUrl());
  await kit.ready(page);
  await page.evaluate((id) => selectEx(id), drillId(NODE, DIR));
  const hist = await page.evaluate(() => JSON.stringify(DB.notes));
  await page.click(kind === "move" ? "#fixMoveBtn" : "#fixNoteBtn");
  await page.waitForFunction(() => fix !== null, null, { timeout: 10000 });
  const seen = [];
  const t0 = Date.now();
  for (;;) {
    const s = await page.evaluate(() => fix && { phase: fix.phase, sets: fix.sets, count: fix.count, reps: fix.reps, misses: fix.misses, last: fix.last && Math.round(fix.last.cents), kind: fix.kind, steps: fix.steps.map((x) => x.label) });
    if (s && (!seen.length || JSON.stringify(seen[seen.length - 1]) !== JSON.stringify(s))) seen.push(s);
    if (!s || s.phase === "done" || Date.now() - t0 > 40000) break;
    await page.waitForTimeout(50);
  }
  const panel = await page.$eval("#fixPanel", (e) => e.innerText);
  await page.click("#fixStop");
  const after = await page.evaluate(() => ({ hist: JSON.stringify(Object.fromEntries(Object.entries(DB.notes))), fixes: DB.fixes, watch: document.querySelector("#watchOut").innerText }));
  await ctx.close();
  return { seen, panel, hist, after };
}

const browser = await chromium.launch({ args: mic.chromiumArgs("inject") });
const srv = await kit.start({ browser });
try {
  // Fix this note: miss (+30), 3 clean, break, 3 clean
  let wav = playFix(path.join(tmp, "note.wav"), target, { reps: [30, 3, -2, 4, 2, -3, 1] }).file;
  let r = await session(browser, srv, wav, "note");
  const phases = r.seen.map((s) => s.phase);
  check("first repetition is a miss and empties the set", r.seen.some((s) => s.reps === 1 && s.misses === 1 && s.count === 0 && s.last >= 20), r.seen);
  check("three clean fill set 1, then a break", r.seen.some((s) => s.phase === "break" && s.sets === 1), phases);
  check("after the break, three more: done", r.seen.at(-1).phase === "done" && r.seen.at(-1).sets === 2 && r.seen.at(-1).reps === 7, r.seen.at(-1));
  const brk = r.seen.findIndex((s) => s.phase === "break");
  check("nothing scored during the break", r.seen.slice(brk).filter((s) => s.phase === "break").every((s) => s.reps === 4), r.seen.slice(brk));
  check("done panel says what's next", /Done for now/.test(r.panel) && /once or twice more today/.test(r.panel), r.panel);
  check("note history untouched by fix repetitions", r.after.hist === r.hist, "DB.notes changed");
  const log = Object.values(r.after.fixes || {}).flat();
  check("fix logged apart, done, 6 clean of 7", log.length === 1 && log[0].done && log[0].clean === 6 && log[0].reps === 7 && log[0].kind === "note", log);
  check("Watch line counts today's fix", /Fixed 1× today/.test(r.after.watch), r.after.watch);
  // Three misses in a row: a break
  wav = playFix(path.join(tmp, "misses.wav"), target, { reps: [30, 28, 33, 2], breakAfter: 99 }).file;
  const ctx2 = await browser.newContext({ viewport: kit.viewport });
  await mic.attach(ctx2, "inject", wav);
  const p2 = await ctx2.newPage(); await p2.goto(srv.loadUrl()); await kit.ready(p2);
  await p2.evaluate((id) => selectEx(id), drillId(NODE, DIR)); await p2.click("#fixNoteBtn");
  await p2.waitForFunction(() => fix && fix.misses === 3, null, { timeout: 15000 });
  const s2 = await p2.evaluate(() => ({ phase: fix.phase, why: fix.breakWhy, count: fix.count }));
  check("three misses in a row: a 10-second break", s2.phase === "break" && s2.why === "misses" && s2.count === 0, s2);
  await ctx2.close();
  // Fix this progression: approach note then target
  const from = await (async () => { const c = await browser.newContext(); const p = await c.newPage(); await p.goto(srv.loadUrl()); await kit.ready(p);
    const f = await p.evaluate((id) => { selectEx(id); const ex = exById(DB.selected); const w = watchOutNote(ex.notes); const a = fixApproach(ex.notes, w.it); return a && { midi: a.midi, label: a.label }; }, drillId(NODE, DIR)); await c.close(); return f; })();
  check("progression has an approach note", !!from, from);
  wav = playFix(path.join(tmp, "move.wav"), target, { from, reps: [2, 3, -1, 1, 2, -2], breakAfter: 3 }).file;
  r = await session(browser, srv, wav, "move");
  check(`progression ${from && from.label} → ${target.label}: 6 clean, done`, r.seen.at(-1).phase === "done" && r.seen.at(-1).reps === 6 && r.seen.at(-1).kind === "move", r.seen.at(-1));
} finally {
  await srv.close(); await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(bad ? `\n${bad} problem(s)` : "\nall passed");
process.exit(bad ? 1 : 0);
