// Walkthrough for demo/proposals/watch-out-notes.json, round 2 (the owner's "iterate", 2026-11-21): the Watch
// line now opens a Fix mode for its note, or for the two-note progression into it, built on Molly Gebrian's microbreaks
// (three clean repetitions, a 10-second break, three more; a miss starts the set over).
// Needs the prototype branch claude/proto-watch-out-notes (fixApproach / startFix in index.html).
// The fixture's made-up player has a high 2nd finger, so the Stage 1 D-string pattern flags F♯. The scripted
// audio plays F♯ once 30 cents sharp (a miss), three times in tune, then, after the break, three more.
import { drillId, drillNotes, playFix, outPath } from "../audio/passages.mjs";

const NODE = "pattern:1:23", DIR = "asc_desc";
const REPS = [30, 3, -2, 4, 2, -3, 1]; // the first lands sharp; the break comes after the 4th repetition (3 clean)
const target = () => drillNotes(NODE, DIR).find((n) => n.label.includes("♯") && n.finger === "2");
const spoken = (s) => s.replace("♯", " sharp").replace("♭", " flat");
const fixState = (page) => page.evaluate(() => fix && { phase: fix.phase, sets: fix.sets, count: fix.count, reps: fix.reps, last: fix.last && Math.round(fix.last.cents) });
const until = async (page, fn, ms = 20000) => { const t = Date.now(); for (;;) { const s = await fixState(page); if (s && fn(s)) return s; if (Date.now() - t > ms) throw new Error(`Fix mode never reached the expected state: ${JSON.stringify(s)}`); await page.waitForTimeout(100); } };

// Bring the Fix panel just under the app's sticky header, above the caption bar.
const panelInView = (page) => page.evaluate(() => {
  const head = Math.max(0, ...[...document.querySelectorAll("body *")].filter((e) => ["sticky", "fixed"].includes(getComputedStyle(e).position))
    .map((e) => e.getBoundingClientRect()).filter((r) => r.top <= 1 && r.bottom < 320).map((r) => r.bottom));
  window.scrollBy({ top: document.querySelector("#fixPanel").getBoundingClientRect().top - head - 8, behavior: "smooth" });
});

export default {
  query: "",
  audio: ({ outDir }) => playFix(outPath(outDir, "mic-fix-note"), target(), { reps: REPS, rest: 1.0, missRest: 2.6 }).file,
  setup: async ({ page }) => {
    const ok = await page.evaluate(() => typeof startFix === "function");
    if (!ok) throw new Error("This walkthrough needs the prototype branch claude/proto-watch-out-notes, round 2 (no startFix in index.html).");
    await page.evaluate((id) => { selectEx(id); window.scrollTo(0, 0); }, drillId(NODE, DIR));
    if (!(await page.$("#fixNoteBtn"))) throw new Error("The fixture flags no note for this drill; the walkthrough expects F sharp.");
  },
  run: async ({ page, demo }) => {
    const t = target(), note = spoken(t.label);
    const move = await page.evaluate(() => { const ex = exById(DB.selected), w = watchOutNote(ex.notes), f = w && fixApproach(ex.notes, w.it); return f && f.label; });
    await demo.say(`Round two. The Watch line now opens a fix for ${note}.`);
    await demo.at(3.6);
    await demo.say("Molly Gebrian's microbreaks: three clean, ten seconds' rest, three more.");
    await demo.at(7.4);
    await demo.tap("#fixNoteBtn");
    await page.waitForFunction(() => fix !== null && !document.querySelector("#fixPanel").hidden);
    await panelInView(page);
    const miss = await until(page, (s) => s.reps >= 1);
    await demo.say(`A miss, ${Math.abs(miss.last)} cents sharp, starts the set over.`);
    await until(page, (s) => s.phase === "break");
    await demo.say("Set one is clean. Now ten seconds of rest: much of the gain comes in the pause.");
    await demo.wait(5200);
    await demo.say("Fix reps stay out of the note history, so tomorrow's drill is the real test.");
    await until(page, (s) => s.phase === "done", 15000);
    await demo.say("Done for now. Come back once or twice today.");
    await demo.wait(2400);
    await demo.tap("#fixStop");
    if (move) {
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await demo.wait(500);
      await demo.tap("#fixMoveBtn");
      await page.waitForFunction(() => fix !== null && fix.kind === "move");
      await panelInView(page);
      await demo.say(`Fix this progression does the same for ${spoken(move)} to ${note}.`);
    }
  },
};
