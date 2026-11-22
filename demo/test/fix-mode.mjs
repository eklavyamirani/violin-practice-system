// Run: node demo/test/fix-mode.mjs [--url <app base URL>]
// The Watch line and Fix mode end to end: headless Chromium, the demo kit's synthetic practice history, and
// scripted violin-like audio fed to the page as its microphone. Checks the acceptance criteria of proposal #27
// (miss, set reset, break, nothing scored in the break, three-miss break, done, the progression, what ends a
// fix, and that fix repetitions leave the note history, XP, medals, path and practice log alone), in Path and in
// Free practice.
//
// Without --url it serves this checkout. With --url (e.g. a preview) it tests that app instead; the history is
// put into this test browser's own storage before the page loads, so nothing is loaded on the server.
import { chromium } from "playwright";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import kit from "../kit/kit.mjs";
import { fixtureFor, STORE_KEY, DEMO_SETTINGS } from "../kit/serve.mjs";
import { drillId } from "../kit/audio/passages.mjs";
import { render, writeWav } from "../kit/audio/synth.mjs";
import * as mic from "../runner/fake-mic.mjs";

const args = process.argv.slice(2), ui = args.indexOf("--url");
const BASE = ui >= 0 ? args[ui + 1].replace(/\/$/, "") : null;
const PATH_DRILL = drillId("pattern:1:23", "asc_desc"); // Stage 1, D string: the fixture's high 2nd finger lands sharp here
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "violin-fix-"));
let bad = 0, n = 0;
const check = (name, ok, got) => { n++; console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `: ${JSON.stringify(got)}`}`); if (!ok) bad++; };
const log = (s) => console.log(`     ${s}`);

/** Repetitions of the target (or of from → target), each followed by a rest so the app hears the bow stop. */
function fixWav(name, target, { from = null, reps, breakAfter = 4, breakSec = 10.8, sec = 0.8, rest = 0.6, leadIn = 1.2, extra = [] }) {
  const passage = [];
  reps.forEach((cents, i) => {
    if (from) passage.push({ midi: from.midi, cents: 0, sec: 0.7 });
    if (Array.isArray(cents)) passage.push({ midi: cents[0], cents: 0, sec: 0.5 }); // a wrong note on the way
    passage.push({ midi: target.midi, cents: Array.isArray(cents) ? cents[1] : cents, sec });
    passage.push({ rest: i + 1 === breakAfter ? breakSec : rest });
  });
  passage.push(...extra);
  const file = path.join(tmp, `${name}.wav`);
  writeWav(file, render(passage, { leadIn }).samples);
  return file;
}

let srv = null, db = null;
async function open(browser, wav, { view = "path" } = {}) {
  const ctx = await browser.newContext({ viewport: kit.viewport });
  if (wav) await mic.attach(ctx, "inject", wav);
  let page;
  if (BASE) {
    await ctx.addInitScript(({ key, value }) => { if (!sessionStorage.getItem("fixTestSeeded")) { localStorage.setItem(key, value); sessionStorage.setItem("fixTestSeeded", "1"); } },
      { key: STORE_KEY, value: JSON.stringify(db) });
    page = await ctx.newPage();
    await page.goto(`${BASE}/index.html`);
  } else {
    page = await ctx.newPage();
    await page.goto(srv.loadUrl());
  }
  await kit.ready(page);
  if (view === "free") {
    // Free practice in G major on the D and A strings in 1st position: the same physical spots as the Path skill
    await page.evaluate(() => { DB.settings.view = "free"; DB.cfg = { tonic: "G", type: "major", strings: ["D", "A"], positions: [1] }; applyConfig(); renderAll(); });
    const id = await page.evaluate(() => (EXERCISES.find((e) => !e.hunt && !e.rhythm && !e.custom && e.notes.some((x) => x.string === "D") && Fix.watchOut(e.notes, DB.notes)) || {}).id);
    await page.evaluate((x) => selectEx(x), id);
  } else await page.evaluate((x) => selectEx(x), PATH_DRILL);
  return { ctx, page };
}

const progress = (page) => page.evaluate(() => JSON.stringify({ notes: DB.notes, xp: DB.xp, ex: DB.ex, path: DB.path, log: DB.log.length, runs: DB.runs, days: DB.days, sessions: DB.sessions.length }));
const watchInfo = (page) => page.evaluate(() => {
  const ex = exById(DB.selected), w = Fix.watchOut(ex.notes, DB.notes), a = w && Fix.approach(ex.notes, w.it);
  const chip = document.querySelector("#path .chip.watch");
  return { drill: drillLabel(ex), shown: !$("#watchOut").hidden, text: $("#watchOut").innerText, chip: chip && chip.innerText, tol: drillTol(ex),
    target: w && { midi: w.it.midi, name: noteName(w.it.midi), key: w.it.key, avg: Math.round(w.avg), n: w.n }, from: a && { midi: a.midi, name: noteName(a.midi) },
    buttons: [...document.querySelectorAll("#watchOut button")].map((b) => b.id) };
});

// Follows a fix until it is done (or the time runs out), keeping each new state
async function follow(page, until = (s) => s.phase === "done", ms = 45000) {
  await page.waitForFunction(() => fix !== null, null, { timeout: 10000 }); // the button opens the microphone first
  const seen = [], t0 = Date.now();
  for (;;) {
    const s = await page.evaluate(() => fix && { phase: fix.phase, sets: fix.sets, count: fix.count, reps: fix.reps.length, misses: Fix.misses(fix), last: fix.last && fix.last.cents !== null ? Math.round(fix.last.cents) : null, why: fix.breakWhy, kind: fix.kind, run: !!run });
    if (s && (!seen.length || JSON.stringify(seen.at(-1)) !== JSON.stringify(s))) seen.push(s);
    if (!s || until(s) || Date.now() - t0 > ms) break;
    await page.waitForTimeout(40);
  }
  return seen;
}

const browser = await chromium.launch({ args: mic.chromiumArgs("inject") });
try {
  if (BASE) { db = { ...(await fixtureFor(undefined, { browser })).progress, settings: { ...DEMO_SETTINGS } }; console.log(`Testing ${BASE}`); }
  else { srv = await kit.start({ browser }); console.log(`Testing this checkout (${srv.url})`); }

  // ---------- Watch line (criteria 1–4) ----------
  let { ctx, page } = await open(browser, null);
  const W = await watchInfo(page);
  log(`${W.drill}: ${W.text.split("\n")[0]}`);
  check("1. Watch line names the note, the amount and which way", W.shown && W.target && /Watch .+ string, finger .+ landings averaged [+−-]?\d+¢ (sharp|flat)\. Aim a hair (lower|higher)/.test(W.text), W);
  check("2. that note's chip is marked", !!W.chip && /[↑↓]/.test(W.chip), W.chip);
  check("5. both buttons on the Watch line", W.buttons.includes("fixNoteBtn") && W.buttons.includes("fixMoveBtn"), W.buttons);
  const quietDrill = await page.evaluate(() => { const ex = EXERCISES.find((e) => !e.hunt && !e.rhythm && e.notes.length && !Fix.watchOut(e.notes, DB.notes)); if (!ex) return null; selectEx(ex.id); return { drill: drillLabel(ex), shown: !$("#watchOut").hidden }; });
  check("3. nothing shows for a drill with no consistent miss", quietDrill && !quietDrill.shown, quietDrill);
  await page.evaluate((x) => selectEx(x), PATH_DRILL);
  const during = await page.evaluate(async () => { await startAudio(); startRun(); const r = { shown: !$("#watchOut").hidden, marked: !!document.querySelector("#path .chip.watch") }; stopRun(); return r; });
  check("3. nothing shows during a run", !during.shown && !during.marked, during);
  // A clean run's landings: the line updates (here a run of in-tune target landings pulls the average in)
  const upd = await page.evaluate((key) => { const before = Fix.watchOut(exById(DB.selected).notes, DB.notes).avg; DB.notes[key].recent.push(0, 0, 0, 0, 0, 0, 0, 0, 0, 0); DB.notes[key].recent.splice(0, 10); buildPath(); const w = Fix.watchOut(exById(DB.selected).notes, DB.notes); return { before, after: w ? w.avg : null, shown: !$("#watchOut").hidden }; }, W.target.key);
  check("4. the line follows the note history (rebuilt after a run)", upd.after === null ? !upd.shown : Math.abs(upd.after) < Math.abs(upd.before), upd);
  await ctx.close();

  const T = W.target, FROM = W.from;
  log(`target ${T.name} (${T.key}), average ${T.avg}¢ over ${T.n}; approach ${FROM && FROM.name}; tolerance ±${W.tol}¢`);

  // ---------- Fix this note: miss, 3 clean, break, 3 clean (criteria 5–7, 9) ----------
  ({ ctx, page } = await open(browser, fixWav("note", T, { reps: [30, 3, -2, 4, 2, -3, 1] })));
  let before = await progress(page);
  await page.click("#fixNoteBtn");
  let seen = await follow(page);
  log(`states: ${seen.map((s) => `${s.phase}${s.phase === "break" ? `(${s.why})` : ""} ${s.sets}/${s.count} reps ${s.reps}`).filter((x, i, a) => a.indexOf(x) === i).join(" → ")}`);
  check("6. +30¢ is a miss and empties the set", seen.some((s) => s.reps === 1 && s.misses === 1 && s.count === 0 && s.last >= 20), seen.slice(0, 4));
  check("7. three clean fill set 1, then a 10-second break", seen.some((s) => s.phase === "break" && s.sets === 1 && s.why === "set"), seen.map((s) => s.phase));
  const brk = seen.filter((s) => s.phase === "break");
  check("7. nothing scored during the break", brk.length > 0 && brk.every((s) => s.reps === 4), brk);
  check("7. after set 2 the fix is done", seen.at(-1).phase === "done" && seen.at(-1).sets === 2 && seen.at(-1).reps === 7, seen.at(-1));
  check("hands-free never starts a run during a fix", seen.every((s) => !s.run));
  let panel = await page.$eval("#fixPanel", (e) => e.innerText);
  check("7. done panel says to come back once or twice more today", /Done for now/.test(panel) && /once or twice more today/.test(panel), panel);
  check("9. note history, XP, medals, path and practice log untouched", (await progress(page)) === before, "changed");
  await page.click("#fixStop");
  let after = await page.evaluate(() => ({ fixes: DB.fixes, watch: $("#watchOut").innerText, fix: !!fix }));
  const rec = after.fixes[0];
  check("9. the fix is logged apart, every repetition's cents", after.fixes.length === 1 && rec.done && rec.clean === 6 && rec.misses === 1 && rec.kind === "note" && rec.reps.length === 7 && rec.reps[0].c >= 20 && !rec.reps[0].ok, rec);
  check("9. the Watch line still judges from real drills and counts today's fix", /Fixed 1× today/.test(after.watch) && /averaged/.test(after.watch), after.watch);
  log(`logged: ${JSON.stringify({ note: rec.note, kind: rec.kind, tol: rec.tol, cents: rec.reps.map((r) => r.c) })}`);
  await ctx.close();

  // ---------- Three misses in a row: a break (criterion 8) ----------
  ({ ctx, page } = await open(browser, fixWav("misses", T, { reps: [30, 28, 33, 2], breakAfter: 99 })));
  await page.click("#fixNoteBtn");
  seen = await follow(page, (s) => s.phase === "break", 20000);
  check("8. three misses in a row: a 10-second break", seen.at(-1).phase === "break" && seen.at(-1).why === "misses" && seen.at(-1).misses === 3 && seen.at(-1).count === 0, seen.at(-1));
  panel = await page.$eval("#fixPanel", (e) => e.innerText);
  check("8. the break counts down", /misses in a row/.test(panel) && /\d+ s/.test(panel), panel);
  await page.keyboard.press("Escape");
  after = await page.evaluate(() => ({ fix: !!fix, fixes: DB.fixes.length, done: DB.fixes[0] && DB.fixes[0].done, panel: !$("#fixPanel").hidden }));
  check("10. Escape ends a fix (logged, not done)", !after.fix && !after.panel && after.fixes === 1 && after.done === false, after);
  await ctx.close();

  // ---------- A wrong note on the way ----------
  ({ ctx, page } = await open(browser, fixWav("wrong", T, { reps: [[T.midi - 1, 0], 2], breakAfter: 99 })));
  await page.click("#fixNoteBtn");
  seen = await follow(page, (s) => s.reps >= 2, 15000);
  const wr = await page.evaluate(() => fix.reps);
  check("6. a wrong note on the way is a miss, the next clean one counts", wr.length === 2 && !wr[0].ok && wr[0].wrong === T.midi - 1 && wr[1].ok, wr);
  await ctx.close();

  // ---------- Fix this progression (criterion 5) ----------
  ({ ctx, page } = await open(browser, fixWav("progression", T, { from: FROM, reps: [2, 3, -1, 1, 2, -2], breakAfter: 3 })));
  before = await progress(page);
  await page.click("#fixMoveBtn");
  seen = await follow(page);
  check(`5. progression ${FROM.name} → ${T.name}: 6 clean, done`, seen.at(-1).phase === "done" && seen.at(-1).reps === 6 && seen.at(-1).kind === "progression", seen.at(-1));
  check("hands-free never starts a run during the progression", seen.every((s) => !s.run));
  check("9. progression leaves progress untouched", (await progress(page)) === before, "changed");
  await ctx.close();

  // ---------- Free practice, and what ends a fix (criterion 10) ----------
  ({ ctx, page } = await open(browser, fixWav("free", T, { reps: [1, 2, 3, 1], breakAfter: 99 }), { view: "free" }));
  const FW = await watchInfo(page);
  log(`free practice: ${FW.drill}: ${FW.text.split("\n")[0]}`);
  check("Free practice: the Watch line and Fix buttons show too", FW.shown && FW.buttons.includes("fixNoteBtn"), FW);
  await page.click("#fixNoteBtn");
  seen = await follow(page, (s) => s.reps >= 1, 15000);
  check("Free practice: a fix repetition is heard", seen.at(-1).reps >= 1, seen.at(-1));
  await page.click("#startBtn").catch(() => {});
  let ends = await page.evaluate(async () => { const r0 = { fix: !!fix, startHidden: $("#startBtn").hidden }; await startAudio(); startRun(); return { ...r0, after: !!fix, run: !!run }; });
  check("10. starting a run ends a fix", ends.startHidden && !ends.after && ends.run, ends);
  ends = await page.evaluate(async () => { stopRun(); $("#fixNoteBtn").click(); await new Promise((r) => setTimeout(r, 300)); const on = !!fix; const other = EXERCISES.find((e) => e.id !== DB.selected && !e.hunt); selectEx(other.id); return { on, after: !!fix }; });
  check("10. choosing another drill ends a fix", ends.on && !ends.after, ends);
  ends = await page.evaluate(async () => { selectEx(EXERCISES.find((e) => !e.hunt && !e.rhythm && Fix.watchOut(e.notes, DB.notes)).id); $("#fixNoteBtn").click(); await new Promise((r) => setTimeout(r, 300)); const on = !!fix; document.querySelector("#fixStop").click(); return { on, after: !!fix, start: !$("#startBtn").hidden }; });
  check("10. Stop ends a fix", ends.on && !ends.after && ends.start, ends);
  await ctx.close();
} finally {
  if (srv) await srv.close();
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(bad ? `\n${bad} of ${n} failed` : `\nall ${n} passed`);
process.exit(bad ? 1 : 0);
