// Run: node test/piece-view.test.js — checks the Piece tab's layout choice by width, the review timeline's data and its tap targets.
const V = require("../piece-view.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };

// Layout by width, with 8 px of hysteresis around each boundary
check("first pick by width", [V.pickLayout(120, null), V.pickLayout(199, null), V.pickLayout(200, null), V.pickLayout(450, null), V.pickLayout(451, null)].join() === "pill,pill,compact,compact,full");
check("pill holds just past 200", V.pickLayout(205, "pill") === "pill" && V.pickLayout(208, "pill") === "compact");
check("compact holds just under 200 and just over 450", V.pickLayout(193, "compact") === "compact" && V.pickLayout(191, "compact") === "pill" && V.pickLayout(458, "compact") === "compact" && V.pickLayout(459, "compact") === "full");
check("full holds just under 450", V.pickLayout(443, "full") === "full" && V.pickLayout(442, "full") === "compact");
check("a big jump ignores hysteresis", V.pickLayout(1000, "pill") === "full" && V.pickLayout(100, "full") === "pill");

// Needle and tempo bar
check("needle clamps at ±50¢", V.needlePct(-80) === 0 && V.needlePct(12) === 62 && V.needlePct(90) === 100);
const f = V.driftFill(-6);
check("dragging 6% fills left of centre", Math.abs(f.left - 30) < 1e-9 && Math.abs(f.width - 20) < 1e-9, f);
check("tone matches colorFor", [V.tone(15, 15), V.tone(30, 15), V.tone(31, 15)].join() === "good,near,bad");

// Review timeline from a saved report
const report = {
  toleranceCents: 15, summary: { durationSec: 10 }, metronome: { bpm: 120, subdivision: 2, beatsPerBar: 4 }, timing: { kind: "metronome" },
  notes: Array.from({ length: 20 }, (_, i) => ({ t: i * 0.25 * (1 / 1.06), note: "A4", durMs: 200, cents: i === 7 ? -40 : 3, timingMs: undefined })),
  moments: [{ at: "0:01", t: 7 * 0.25 / 1.06, what: "A4 −40¢ flat" }, { at: "0:03", t: 3, what: "sped up ~6%" }],
};
report.notes.forEach((n) => { const ms = n.t * 1000, q = 250; n.timingMs = ms - Math.round(ms / q) * q; });
const r = V.review(report);
check("review keeps every note with its tone", r.notes.length === 20 && r.notes[7].tone === "bad" && r.notes[0].tone === "good");
check("pitch pin takes its note's tone, others amber", r.pins[0].tone === "bad" && r.pins[1].tone === "near", r.pins);
check("tempo curve against the click reads rushing", r.tempo.length > 5 && r.tempo.every((c) => c.pct > 4), r.tempo.map((c) => c.pct));
check("whole take drift against the click", Math.abs(V.takeDrift(report) - 6) < 1, V.takeDrift(report));
check("free timing uses its own curve", V.tempoCurve({ timing: { tempoCurve: [{ t: 1, pct: 2 }] }, notes: [] })[0].pct === 2);

// Tap targets
check("nearest pin within a fingertip", V.nearestPin([100, 200], 118) === 0 && V.nearestPin([100, 200], 150) === -1 && V.nearestPin([100, 130], 120) === 1);
const s = V.spreadPins([10, 20, 30, 500], 44, 0, 520);
check("close pins spread 44 px apart", s[1] - s[0] >= 44 && s[2] - s[1] >= 44 && s[3] === 500, s);
const e = V.spreadPins([480, 500, 510], 44, 0, 520);
check("pins at the right edge spread leftwards", e[2] <= 520 && e[1] <= e[2] - 44 && e[0] <= e[1] - 44, e);

console.log(fails ? `${fails} failures` : "all pass");
process.exit(fails ? 1 : 0);
