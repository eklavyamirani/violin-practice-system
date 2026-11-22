// Builds the violin demo fixture: a synthetic progress file (the app's own "Download progress" format)
// that makes the app look lived-in: about four weeks of Path practice with reviews and medals, a practice
// plan with its days ticked off, and a practice log. No personal data: every run is made up here.
//
// It does not hand-write the app's data model. It opens the real app headless, sets the clock to each
// made-up practice session, and feeds made-up runs through the app's own finishRun(), so the history,
// Path states, medals, XP and practice log are exactly what the app itself would have saved.
//
//   node demo/kit/fixture/generate.mjs [--end YYYY-MM-DD] [--out file]   (default: demo/.cache/progress-<end>.json)
//
// --end is the last practice day (default: yesterday, so the streak is live and today is still open).
// The same --end always gives the same file (seeded random numbers).
import { launch } from "../../runner/browser.mjs";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "../../runner/static-server.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP_ROOT = path.resolve(HERE, "../../..");
export const DAYS = 28;

const PLAN = {
  format: "fingerboard-coach/plan@1",
  title: "Path, six days a week",
  goal: "Finish Stage 1 and keep the reviews clean",
  schedule: { days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], minutes: 20 },
  sessions: [
    { name: "Reviews first", steps: [{ tune: true, minutes: 2 }, { path: "reviews", minutes: 8 }, { path: "next", minutes: 10 }] },
    { name: "New ground", steps: [{ tune: true, minutes: 2 }, { path: "next", minutes: 14 }, { path: "reviews", minutes: 4 }] },
  ],
};

const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export function defaultEnd(now = new Date()) { const d = new Date(now); d.setDate(d.getDate() - 1); return isoDay(d); }

export async function generate({ end = defaultEnd(), browser: shared } = {}) {
  const srv = await serveStatic(APP_ROOT);
  const browser = shared || (await launch());
  try {
    const [y, m, d] = end.split("-").map(Number);
    const endDay = new Date(y, m - 1, d);
    const first = new Date(endDay); first.setDate(first.getDate() - (DAYS - 1));
    const ctx = await browser.newContext();
    // The app shuffles a little (review order, bonus skills): seed its Math.random so the file is repeatable
    await ctx.addInitScript((seed) => {
      let s = seed >>> 0;
      Math.random = () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    }, 0xa11ce ^ Number(end.replace(/-/g, "")));
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (dlg) => dlg.accept());
    await page.clock.setFixedTime(new Date(first.getFullYear(), first.getMonth(), first.getDate(), 18, 0));
    await page.goto(srv.url + "index.html");
    await page.waitForFunction(() => typeof finishRun === "function" && typeof DB === "object");
    // The plan is imported on the first day, the way a person would paste it
    await page.evaluate((text) => importPlan(text), JSON.stringify(PLAN));

    // The sessions: the clock is set from here before each run, so every timestamp is the made-up one
    const rnd = mulberry32(0x5eed ^ Number(end.replace(/-/g, "")));
    await page.evaluate(install, 0x5eed ^ Number(end.replace(/-/g, "")));
    const summary = { days: 0, runs: 0 };
    for (let di = 0; di < DAYS; di++) {
      if (OFF_DAYS.has(di)) continue;
      const day = new Date(first); day.setDate(day.getDate() + di);
      // A short morning session on most days and an evening one: each session's first try is the one that counts
      const sessions = rnd() < 0.7 ? [7 * 60 + 15, 18 * 60] : [18 * 60];
      for (const startMin of sessions) {
        let t = day.getTime() + (startMin + Math.floor(rnd() * 60)) * 60000;
        const nRuns = 4 + Math.floor(rnd() * 4);
        for (let k = 0; k < nRuns; k++) {
          t += (2 + Math.floor(rnd() * 3)) * 60000;
          await page.clock.setFixedTime(t);
          await page.evaluate((di) => window.__demoRun(di), di);
          summary.runs++;
        }
      }
      await page.evaluate(() => window.__demoPlanDay());
      summary.days++;
    }
    Object.assign(summary, await page.evaluate(() => window.__demoDone()));
    if (errors.length) throw new Error("app errors while generating the fixture:\n" + errors.join("\n"));
    const progress = await page.evaluate(() => Sync.backup(DB, Date.now()));
    await ctx.close();
    return { progress, summary };
  } finally {
    if (!shared) await browser.close();
    await srv.close();
  }
}

// Days off: three in the first three weeks, none in the last ten (a live streak)
const OFF_DAYS = new Set([4, 11, 17]);
function mulberry32(seed) {
  let s = seed >>> 0;
  return () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// Runs inside the app page and defines the per-run step. Everything it calls (startRun, finishRun,
// pathNextId, pathLevel, DB, ...) is the app's own; only the notes' landings are made up.
function install(seed) {
  let s = seed >>> 0;
  const rnd = () => { s += 0x6d2b79f5; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  // The made-up player: a high 2nd finger on sharps and a low 4th finger, and landings that tighten
  // with each skill's practice
  const habit = (it) => ((it.label || "").includes("♯") && it.finger === "2" ? 10 : it.finger === "4" ? -5 : 0);
  const tries = {};
  window.__demoRun = (di) => {
    DB.settings.view = "path";
    DB.selected = pathNextId();
    applyConfig();
    const ex = exById(DB.selected);
    const st = DB.path.states[ex.nodeId];
    DB.settings.bpm = st ? st.tempo : ex.startBpm;
    DB.settings.per = ex.per;
    // startRun in Flow mode sets the run up without a microphone; then it becomes the Tempo run it stands for
    DB.settings.mode = "flow";
    startRun();
    DB.settings.mode = "tempo";
    const P = pathLevel(ex), beatMs = 60000 / DB.settings.bpm, slot = beatMs / ex.per;
    run.mode = "tempo";
    run.tempo = { bpm: DB.settings.bpm, per: ex.per, beatMs, slot, tolMs: P.L.onsetMs, t0: 0, lat: 0, outLat: 0, evalIdx: 0, counting: false, onTime: 0 };
    const n = (tries[ex.nodeId] = (tries[ex.nodeId] || 0) + 1);
    const skill = Math.min(1, 0.25 + n / 10 + di / 40);
    const sd = 11 - 8.5 * skill, tsd = 45 - 35 * skill, wrongP = 0.04 * (1 - skill);
    run.results = run.seq.map((it) => {
      const wrong = rnd() < wrongP ? it.midi + (rnd() < 0.5 ? -1 : 1) : null;
      const cents = Math.round((habit(it) * (1 - skill * 0.3) + gauss() * sd) * 10) / 10;
      const timing = Math.round(gauss() * tsd);
      const inTune = wrong === null && Math.abs(cents) <= run.tol, onTime = Math.abs(timing) <= run.tempo.tolMs;
      const ns = (DB.notes[it.key] ||= { n: 0, recent: [], wrong: 0 });
      ns.n++; ns.recent.push(Math.round(cents)); if (ns.recent.length > 20) ns.recent.shift(); if (wrong !== null) ns.wrong++;
      return { item: it, cents, wrong, ok: inTune && onTime, inTune, timing, onTime, missed: false, ms: slot };
    });
    run.xp = run.results.filter((x) => x.ok).length * 10;
    finishRun();
  };
  // The plan's day: each step's time and tick, as the Plan tab would have counted them
  window.__demoPlanDay = () => {
    if (!DB.plan) return;
    const key = dayKey();
    const sess = PlanIO.sessionIndex(DB.plan, DB.planLog, key);
    const steps = DB.plan.sessions[sess].steps;
    DB.planLog[key] = { plan: DB.plan.id, session: sess, secs: Object.fromEntries(steps.map((x, i) => [i, x.minutes * 60 - Math.floor(rnd() * 90)])), done: Object.fromEntries(steps.map((x, i) => [i, true])) };
    save();
  };
  window.__demoDone = () => {
    $("#results").hidden = true;
    DB.settings.mode = "flow";
    save();
    const states = {};
    for (const v of Object.values(DB.path.states)) states[v.status] = (states[v.status] || 0) + 1;
    return { xp: DB.xp, states };
  };
}

// CLI
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const end = arg("--end", defaultEnd());
  // Default: the cache file the serve command reads, so generating by hand also warms it
  const out = path.resolve(arg("--out", path.join(HERE, `../../.cache/progress-${end}.json`)));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const { progress, summary } = await generate({ end });
  fs.writeFileSync(out, JSON.stringify(progress, null, 1) + "\n");
  console.log(`wrote ${path.relative(process.cwd(), out)}: ${summary.days} practice days ending ${end}, ${summary.runs} runs, ${summary.xp} XP`);
  console.log(summary.states);
}
