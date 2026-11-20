// Walkthrough: the app (as on main) hearing an out-of-tune passage. Scripted audio plays the Stage 1
// D-string pattern with a high 2nd finger (both F♯s +32¢); the results name F♯ as the miss.
// Used by the template check (demo/test/proposals/out-of-tune-check.json) and as the repeatable check
// for the kit's scripted audio.
import { playDrill, drillId, highSecondFinger, outPath } from "../audio/passages.mjs";

const NODE = "pattern:1:23", DIR = "asc_desc";

export default {
  query: "",
  audio: ({ outDir }) => playDrill(outPath(outDir, "mic-high-2nd-finger"), NODE, { dir: DIR, detune: highSecondFinger }).file,
  setup: async ({ page }) => {
    await page.evaluate((id) => { selectEx(id); window.scrollTo(0, 0); }, drillId(NODE, DIR));
  },
  run: async ({ page, demo }) => {
    await demo.say("Four weeks of made-up practice: a streak, a level, a plan.");
    await demo.at(5);
    await demo.say("Scripted audio plays this D-string pattern with a high second finger.");
    await demo.at(9);
    await demo.tap("#startBtn");
    await page.waitForSelector("#results:not([hidden])", { timeout: 20000 });
    await demo.say("The app hears it. Both F sharps land about thirty cents sharp.");
    await demo.wait(2500);
    await demo.scrollTo("#resultsBox .tips");
    await demo.at(29);
    await demo.say("The coach's notes name the note and what to change.");
    await demo.at(36);
    await demo.say("Same input, same result, every run.");
  },
};
