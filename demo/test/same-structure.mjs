// Run after two demos: node demo/test/same-structure.mjs demo/out/a/a.demo.json demo/out/b/b.demo.json
// Checks that both videos have the same sections, starts and lengths (to the frame) and total length.
import fs from "node:fs";
import { SECTIONS, TOTAL, FPS } from "../runner/template.mjs";

const reports = process.argv.slice(2).map((f) => JSON.parse(fs.readFileSync(f, "utf8")));
if (reports.length < 2) { console.error("usage: same-structure.mjs <a.demo.json> <b.demo.json> [...]"); process.exit(2); }
const frame = 1 / FPS;
let bad = 0;
const fail = (m) => { bad++; console.log("FAIL", m); };
for (const r of reports) {
  if (Math.abs(r.duration - TOTAL) > frame) fail(`${r.proposal}: ${r.duration} s, not ${TOTAL} s`);
  r.sections.forEach((s, i) => {
    if (s.key !== SECTIONS[i].key) fail(`${r.proposal}: section ${i} is ${s.key}`);
    if (Math.abs(s.duration - SECTIONS[i].seconds) > frame) fail(`${r.proposal}: ${s.key} is ${s.duration} s, not ${SECTIONS[i].seconds} s`);
  });
  console.log(`${r.proposal}: ${r.duration} s · ${r.sections.map((s) => `${s.key} ${s.start}–${+(s.start + s.duration).toFixed(3)}`).join(" · ")} · ${r.video.width}×${r.video.height} ${r.video.codec} ${r.video.profile} ${r.video.pix_fmt} + ${r.audio.codec}`);
}
console.log(bad ? `${bad} problem(s)` : `same structure and timing in all ${reports.length}`);
process.exit(bad ? 1 : 0);
