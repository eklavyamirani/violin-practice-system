// Run: node demo/test/landing.mjs [--url <app base URL>] [--shots <dir>]
// Clean landings and coaching by context, end to end: headless Chromium, the real app, and scripted violin-like
// audio fed to the page as its microphone (demo/runner/fake-mic.mjs). Fresh storage, no fixture.
//  1. Flow: a finger that lands 35¢ flat and slides in is scored where it landed, and a note fixed while held is
//     marked; the coach's notes name the habit and point to Place mode.
//  2. Place: a miss (off, or slid) stays on the note until a clean placement after a lift; the first try is scored.
//  3. A drill in D major with an F natural on the E string: the notes after it sag, and the coach's notes say the
//     hand went back with the finger; coming down sharper is named too. The practice log carries the patterns.
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "../runner/static-server.mjs";
import { writeWav } from "../kit/audio/synth.mjs";
import { renderGlides } from "../kit/audio/glides.mjs";
import * as mic from "../runner/fake-mic.mjs";

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import("playwright")); } catch { ({ chromium } = require("playwright")); }

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2), opt = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const BASE = opt("--url") ? opt("--url").replace(/\/$/, "") : null, SHOTS = opt("--shots");
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "violin-landing-"));
let bad = 0;
const check = (name, ok, got) => { console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `: ${JSON.stringify(got)}`}`); if (!ok) bad++; };

const wav = (name, passage, o) => { const f = path.join(tmp, `${name}.wav`); writeWav(f, renderGlides(passage, o)); return f; };

let srv = null;
const browser = await chromium.launch({ args: mic.chromiumArgs("inject") });
async function open(wavFile, setup) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 693 }, deviceScaleFactor: 1 });
  if (wavFile) await mic.attach(ctx, "inject", wavFile);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => { bad++; console.log("FAIL page error:", e.message); });
  await page.goto(`${BASE || srv.url.replace(/\/$/, "")}/index.html`);
  await page.waitForFunction(() => typeof DB === "object" && typeof startRun === "function");
  await page.evaluate(setup);
  return { ctx, page };
}
// Start the run from a hand-picked drill (the mic, and so the audio, starts here), wait for the results
async function play(page, id, ms = 40000) {
  await page.evaluate(async (x) => { selectEx(x); await startAudio(); startRun(); }, id);
  await page.waitForFunction(() => !$("#results").hidden, null, { timeout: ms });
  return page.evaluate(() => { const e = DB.runs[recKey(DB.selected)], r = e.runs[0]; return { coach: r.coachNotes, landings: r.landings, mode: r.mode, score: r.score, tips: $("#resultsBox .tips").innerText }; });
}
const shot = async (page, name) => { if (SHOTS) { await page.locator("#resultsBox").screenshot({ path: path.join(SHOTS, `${name}.png`) }); console.log(`     screenshot ${name}.png`); } };
const freeD = (mode) => `() => { DB.settings.view = "free"; DB.settings.mode = "${mode}"; DB.settings.handsFree = false; DB.settings.tier = 1; DB.settings.hear = false; DB.cfg = { tonic: "D", type: "major", strings: ["A"], positions: [1] }; applyConfig(); renderAll(); }`;

try {
  if (!BASE) srv = await serveStatic(ROOT);
  console.log(`Testing ${BASE || "this checkout"}`);

  // The A string in 1st position, D major: A B C♯ D E and back
  const probe = await open(null, eval(freeD("flow")));
  const drill = await probe.page.evaluate(() => { const ex = EXERCISES.find((e) => e.role === "build" && e.notes.every((n) => n.string === "A") && !e.id.startsWith("down")); return { id: ex.id, name: ex.name, notes: ex.notes.map((n) => ({ midi: n.midi, finger: n.finger, label: n.label + n.oct })) }; });
  await probe.ctx.close();
  console.log(`     drill: ${drill.name}: ${drill.notes.map((n) => n.label).join(" ")}`);
  const N = drill.notes;

  // ---------- 1. Flow ----------
  const SLID = new Set([2, 4, 7]), HELD = 3; // stopped notes only
  const flowPassage = N.map((n, i) => SLID.has(i) ? { midi: n.midi, sec: 0.6, path: [[0, -35], [110, -35], [180, 0]] }
    : i === HELD ? { midi: n.midi, sec: 0.95, path: [[0, -28], [420, -28], [520, 0]] } : { midi: n.midi, cents: 0, sec: 0.6 });
  let { ctx, page } = await open(wav("flow", flowPassage), eval(freeD("flow")));
  let r = await play(page, drill.id);
  const L = r.landings;
  check("1. slid-in notes are scored where they landed (≈ −35¢)", [...SLID].every((i) => L[i].cents <= -27 && L[i].cents >= -43), [...SLID].map((i) => L[i].cents));
  check("1. and marked as moved after landing", [...SLID].every((i) => L[i].fixCents > 20), [...SLID].map((i) => L[i].fixCents));
  check("1. fixed while held: landed −28¢, then moved", L[HELD].cents <= -22 && L[HELD].fixCents > 18, L[HELD]);
  check("1. clean notes: no correction", L.every((l, i) => SLID.has(i) || i === HELD || (l.fixCents === undefined && Math.abs(l.cents) < 8)), L.map((l) => [l.cents, l.fixCents]));
  check("1. coach names the habit and points to Place mode", /moved the finger after it landed on 4 of \d+/.test(r.tips) && r.tips.includes("Place"), r.coach);
  const chart = await page.evaluate(() => [...document.querySelectorAll("#resultsBox svg text")].map((t) => t.textContent).filter((t) => t.includes("↝")).length);
  check("1. the chart marks them ↝", chart === 4, chart);
  await shot(page, "1-flow-slides");
  await ctx.close();

  // ---------- 2. Place ----------
  // Note 1 lands 30¢ flat (held steady) then is placed again cleanly; note 2 slides in, then is placed again; the rest are clean
  const placePassage = [];
  N.forEach((n, i) => {
    if (i === 1) placePassage.push({ midi: n.midi, cents: -30, sec: 0.55 }, { rest: 0.45 });
    if (i === 2) placePassage.push({ midi: n.midi, sec: 0.55, path: [[0, -30], [100, -30], [170, 0]] }, { rest: 0.45 });
    placePassage.push({ midi: n.midi, cents: 0, sec: 0.55 }, { rest: 0.45 });
  });
  ({ ctx, page } = await open(wav("place", placePassage), eval(freeD("place"))));
  const msgs = [];
  await page.exposeFunction("__msg", (m) => msgs.push(m));
  await page.evaluate(() => { const o = setMsg; window.setMsg = setMsg = (m, c) => { window.__msg(m); return o(m, c); }; });
  r = await play(page, drill.id);
  check("2. Place runs are recorded as place", r.mode === "place", r.mode);
  check("2. the off note: first try scored (−30¢), took 2 tries", r.landings[1].cents <= -24 && r.landings[1].tries === 2 && !r.landings[1].inTune, r.landings[1]);
  check("2. the slid note: scored where it landed, slide kept, 2 tries", r.landings[2].cents <= -22 && r.landings[2].fixCents > 20 && r.landings[2].tries === 2, r.landings[2]);
  check("2. the rest went down clean first time", r.landings.every((l, i) => i === 1 || i === 2 || (l.tries === 1 && l.inTune)), r.landings.map((l) => [l.cents, l.tries]));
  check("2. score counts first tries only", Math.abs(r.score - (N.length - 2) / N.length) < 0.01, r.score);
  check("2. a miss says lift, don't slide", msgs.some((m) => /Don't slide it: lift the finger/.test(m)) && msgs.some((m) => /slid \d+¢\. Don't fix it on the string/.test(m)), msgs.filter((m) => m.startsWith("✗")));
  check("2. coach: first placements and the notes that needed more", r.tips.includes(`First placement clean on ${N.length - 2} of ${N.length}`) && /Needed more tries: .+\(2\)/.test(r.tips), r.coach);
  await shot(page, "2-place");
  await ctx.close();

  // ---------- 3. Accidental on the E string ----------
  const E = (note, finger) => ({ note, string: "E", finger, ...(finger ? { position: 1 } : {}) });
  const def = { format: "fingerboard-coach/drill@1", title: "F natural test", key: "D major",
    notes: [E("E5", 0), E("F#5", 1), E("G5", 2), E("A5", 3), E("B5", 4), E("A5", 3), E("G5", 2), E("F#5", 1), E("E5", 0), E("F5", 1), E("G5", 2), E("A5", 3), E("G5", 2), E("F#5", 1), E("E5", 0)] };
  const cents = [0, 2, 0, 1, 0, 15, 14, 15, 0, -2, -19, -21, 13, 14, 0];
  const midi = { E5: 76, "F#5": 78, G5: 79, A5: 81, B5: 83, F5: 77 };
  ({ ctx, page } = await open(wav("accidental", def.notes.map((n, i) => ({ midi: midi[n.note], cents: cents[i], sec: 0.5 }))), eval(freeD("flow"))));
  await page.click(`.tabs button[data-tab="drills"]`);
  await page.fill("#importText", JSON.stringify(def));
  await page.click("#importBtn");
  const id = await page.evaluate(() => EXERCISES.find((e) => e.custom && e.name === "F natural test").id);
  r = await play(page, id);
  check("3. after F natural: the next notes are compared and named, hand went back", /After F5 \(E string, finger 1, 1st\), the next notes ran −1\d¢ against the same notes elsewhere/.test(r.tips) && r.tips.includes("The hand went back with the finger"), r.coach);
  check("3. coming down sharper on the same notes", /Coming down, the same notes ran \+1\d¢/.test(r.tips), r.coach);
  await shot(page, "3-accidental");
  const lg = await page.evaluate(() => PracticeLog.build(DB.log, "all", { now: Date.now(), a4: 440, customs: [], pieces: [] }).patterns);
  check("3. practice log: afterFrameChange names F5 on E", lg.afterFrameChange && lg.afterFrameChange[0].note === "F5" && lg.afterFrameChange[0].avgDeltaCents < -10, lg.afterFrameChange);
  check("3. practice log: byDirection", lg.byDirection && lg.byDirection.downMinusUp > 10, lg.byDirection);
  await ctx.close();
} finally {
  await browser.close();
  if (srv) await srv.close();
}
console.log(bad ? `${bad} failed` : "all passed");
process.exit(bad ? 1 : 0);
