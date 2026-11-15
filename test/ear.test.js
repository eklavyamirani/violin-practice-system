// Run: node test/ear.test.js — checks the ear training stages, questions, grading and the cents ladder.
const E = require("../ear.js");
let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { fails++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};
const seq = (ns) => ns.map((n) => `${n.label}${n.oct}`);

// Stages: G major up and down, 1st position → through 3rd → three octaves through 5th
const [s1, s2, s3, s4] = E.STAGES.map(E.notes);
eq("one octave", [s1.length, seq(s1)[0], seq(s1)[7], seq(s1)[14]], [15, "G3", "G4", "G3"]);
eq("two octaves in 1st", [s2.length, seq(s2)[14], s2.every((n) => !n.pos || n.pos === 1)], [29, "G5", true]);
eq("two octaves through 3rd", [s3.length, seq(s3)[14], s3.some((n) => n.pos === 3), s3.every((n) => !n.pos || n.pos <= 3)], [29, "G5", true, true]);
eq("three octaves through 5th", [s4.length, seq(s4)[0], seq(s4)[21], s4.some((n) => n.pos === 5)], [43, "G3", "G6", true]);
eq("degrees", s1.map((n) => n.deg).join(""), "012345606543210");
eq("F♯ is the 7th", s1.filter((n) => n.label === "F♯").map((n) => n.deg), [6, 6]);

// Questions: never the reference note, cents from the ladder, about a quarter all in tune
const ear = { stages: {}, hist: [] };
const st = E.stateOf(ear, s1 && E.STAGES[0].id);
let clean = 0, first = 0;
for (let k = 0; k < 4000; k++) {
  const q = E.question(E.STAGES[0], st);
  if (q.off === null) clean++;
  else if (q.off === 0) first++;
  if (q.cents !== 50) { fails++; console.log("FAIL cents", q.cents); break; }
}
eq("never the first note", first, 0);
eq("about 1 in 4 clean", clean > 850 && clean < 1150, true);
const det = E.detune({ off: 3, dir: -1, cents: 25 }, 5);
eq("detune", det, [0, 0, 0, -25, 0]);

// Missed notes come up more often
const st2 = E.fresh();
st2.deg[6] = { f: [0, 5] };
let f7 = 0;
for (let k = 0; k < 4000; k++) { const q = E.question(E.STAGES[0], st2); if (q.off !== null && s1[q.off].deg === 6 && q.dir < 0) f7++; }
eq("weak spot weighted", f7 > 4000 * 0.75 * (2 / 28) * 2, true);

// Grading
const q = { stage: E.STAGES[0].id, cents: 25, off: 4, dir: -1 };
eq("hit", E.grade(q, { off: 4, dir: -1 }), { ok: true, kind: "hit" });
eq("wrong dir", E.grade(q, { off: 4, dir: 1 }).kind, "wrong-dir");
eq("wrong note", E.grade(q, { off: 5, dir: -1 }).kind, "wrong-note");
eq("missed", E.grade(q, { off: null, dir: 0 }).kind, "missed");
eq("clean", E.grade({ ...q, off: null, dir: 0 }, { off: null, dir: 0 }), { ok: true, kind: "clean" });
eq("false alarm", E.grade({ ...q, off: null, dir: 0 }, { off: 2, dir: 1 }).kind, "false-alarm");

// Ladder: 2 right → finer, 1 wrong → coarser, reversals, medals
const e2 = { stages: {}, hist: [] }, id = E.STAGES[0].id;
const ask = (ok) => {
  const s = E.stateOf(e2, id), qq = { stage: id, cents: E.LADDER[s.lvl], off: 1, dir: 1 };
  return E.record(e2, qq, { off: 1, dir: ok ? 1 : -1 }, E.grade(qq, { off: 1, dir: ok ? 1 : -1 }));
};
ask(true); eq("one right stays", e2.stages[id].lvl, 0);
eq("two right finer", ask(true).finer, true);
eq("now 40¢", E.LADDER[e2.stages[id].lvl], 40);
eq("one wrong coarser", ask(false).coarser, true);
eq("reversal at 40", e2.stages[id].revs, [40]);
eq("floor at 0", (ask(false), e2.stages[id].lvl), 0);
for (let k = 0; k < 6; k++) ask(true);
eq("best after 3 steps down", [e2.stages[id].best, E.LADDER[e2.stages[id].lvl], E.medalOf(30)], [30, 25, null]);
ask(true);
eq("medal when 25¢ is confirmed", ask(true).medal.icon, "🥉");
eq("history kept", [e2.hist.length, e2.hist[0].off, e2.hist[0].ok], [12, 1, true]);
eq("stats per degree", e2.stages[id].deg[1].s, [10, 12]);
eq("next stage until silver", E.nextStage(e2).id, id);
e2.stages[id].best = 15;
eq("next stage after silver", E.nextStage(e2).id, E.STAGES[1].id);
eq("threshold needs 4 reversals", E.threshold({ revs: [20, 25, 15] }), null);
eq("threshold", E.threshold({ revs: [50, 20, 25, 15, 20, 12, 15] }), 18);

// A long run of right answers bottoms out at 5¢
for (let k = 0; k < 40; k++) ask(true);
eq("ladder floor", E.LADDER[e2.stages[id].lvl], 5);

console.log(fails ? `${fails} failed` : "ear: all passed");
process.exit(fails ? 1 : 0);
