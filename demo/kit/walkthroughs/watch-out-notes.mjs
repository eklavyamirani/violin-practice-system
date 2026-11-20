// Walkthrough for demo/proposals/watch-out-notes.json. Needs the prototype: run it on the branch
// claude/proto-watch-out-notes (it adds the #watchOut line to index.html).
// The fixture's made-up player has a high 2nd finger, so the Stage 1 D-string pattern flags F♯; the
// scripted audio then plays that pattern with F♯ +32¢, and the line updates after the run.
import { playDrill, drillId, highSecondFinger, outPath } from "../audio/passages.mjs";

const NODE = "pattern:1:23", DIR = "asc_desc";
const watch = (page) => page.evaluate(() => { const w = watchOutNote(exById(DB.selected).notes); return w && { note: w.it.label, string: w.it.string, avg: Math.round(w.avg) }; });
const spoken = (w) => `${w.note.replace("♯", " sharp").replace("♭", " flat")} on the ${w.string} string`;
const cents = (n) => `${n > 0 ? "plus" : "minus"} ${Math.abs(n)} cents`;

export default {
  query: "",
  audio: ({ outDir }) => playDrill(outPath(outDir, "mic-high-2nd-finger"), NODE, { dir: DIR, detune: highSecondFinger }).file,
  setup: async ({ page }) => {
    const ok = await page.evaluate(() => typeof watchOutNote === "function");
    if (!ok) throw new Error("This walkthrough needs the prototype branch claude/proto-watch-out-notes (no watchOutNote in index.html).");
    await page.evaluate((id) => { selectEx(id); window.scrollTo(0, 0); }, drillId(NODE, DIR));
  },
  run: async ({ page, demo }) => {
    const before = await watch(page);
    if (!before) throw new Error("The fixture flags no note for this drill; the walkthrough expects one.");
    await demo.say("New: before you start, a Watch line names the note this drill keeps missing.");
    await demo.at(5.5);
    await demo.say(`Here it's ${spoken(before)}: ${cents(before.avg)} over its last twenty landings.`);
    await demo.at(12);
    await demo.say("Now play the drill, with the same high second finger.");
    await demo.at(14.5);
    await demo.tap("#startBtn");
    await page.waitForSelector("#results:not([hidden])", { timeout: 20000 });
    await demo.say("The run confirms it: both F sharps land about thirty cents sharp.");
    await demo.at(Math.max(demo.elapsed() + 4, 27));
    await demo.tap("#rClose");
    await page.evaluate(() => window.scrollTo(0, 0));
    const after = await watch(page);
    await demo.say(after ? `Back on the drill, the line has already updated: ${cents(after.avg)}.` : "Back on the drill, the line has cleared.");
    await demo.at(35);
    await demo.say("The aim: fix it on the first try, not after a missed run.");
  },
};
