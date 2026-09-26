// Run: node test/curriculum.test.js — checks the Path skill graph, its drills, run metrics and node progression.
const C = require("../curriculum.js");
const S = require("../scales.js");
const D = require("../drills.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };
const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), { got, want });

// ---------- The graph ----------
check("ids unique", new Set(C.NODES.map((n) => n.id)).size === C.NODES.length);
for (let s = 1; s < C.STAGES.length; s++) check(`stage ${s} has nodes`, C.NODES.some((n) => n.stage === s));
for (const n of C.NODES) {
  check(`${n.id} can be fingered`, n.kind === "shift" || !!C.lines(n));
  for (const id of n.prereq) check(`${n.id} prerequisite ${id} exists and comes earlier`, C.BY_ID[id] && C.BY_ID[id].order < n.order);
}
check("stages never go backwards in the list", C.NODES.every((n, i) => !i || n.stage >= C.NODES[i - 1].stage));
eq("starts with one finger pattern", C.NODES.filter((n) => !n.prereq.length).map((n) => n.id), ["pattern:1:23"]);

// Keys ordered by the positions two octaves need: G, A, B♭ in 1st; D needs 3rd; E and F need 5th
const fits = (k, ps) => !!S.findRun(k, S.SCALE_TYPES.major, ["G", "D", "A", "E"], ps, { octaves: 2 });
eq("two octaves in 1st position", ["G", "A", "Bb", "D", "E", "F"].map((k) => fits(k, [1])), [true, true, true, false, false, false]);
eq("two octaves with 1st & 3rd", ["D", "E", "F"].map((k) => fits(k, [1, 3])), [true, true, false]);
// ...but E only with the extended 4th finger for the top E6, so Path takes E through 5th
eq("E two octaves in 1st & 3rd needs the extension", S.findRun("E", S.SCALE_TYPES.major, ["G", "D", "A", "E"], [1, 3], { octaves: 2 }).up.slice(-1)[0].finger, "4x");
eq("two octaves with 1st, 3rd & 5th", ["E", "F"].map((k) => fits(k, [1, 3, 5])), [true, true]);
// C reaches C6 in 1st position only with an extended 4th finger, so Path takes it through 3rd
eq("C two octaves in 1st needs the extension", S.findRun("C", S.SCALE_TYPES.major, ["G", "D", "A", "E"], [1], { octaves: 2 }).up.slice(-1)[0].finger, "4x");
eq("C two octaves in Path shifts to 3rd", C.drill(C.BY_ID["scale:C-major:13:2"], "asc_desc").notes.filter((n) => n.shift).map((n) => n.shift + n.pos), ["up3", "down1"]);

// Implied prerequisites: patterns from the fingering, shift pairs from where the run shifts
eq("D major 2 oct needs A-string shifts", C.BY_ID["scale:D-major:13:2"].prereq.includes("shift:A:1-3"), true);
eq("E major 2 oct needs E-string shifts", ["shift:E:1-3", "shift:E:3-5"].every((id) => C.BY_ID["scale:E-major:135:2"].prereq.includes(id)), true);
eq("C major 1 oct needs the 1‿2 pattern", C.BY_ID["scale:C-major:1:1"].prereq, ["pattern:1:12"]);

// ---------- Drills ----------
const txt = (ns) => ns.map((n) => n.label + n.oct);
for (const n of C.NODES) for (const dir of C.DIRS) {
  const d = C.drill(n, dir), where = `${n.id} ${dir}`;
  check(`${where} no repeated pitch`, d.notes.every((x, i) => !i || x.midi !== d.notes[i - 1].midi));
  check(`${where} in the node's positions`, d.notes.every((x) => !x.pos || n.positions.includes(x.pos)) && d.notes.every((x) => n.strings.includes(x.string)));
  if (n.kind !== "shift") {
    const midis = d.notes.map((x) => x.midi);
    check(`${where} starts at the ${dir === "asc_desc" ? "bottom" : "top"}`, midis[0] === (dir === "asc_desc" ? Math.min : Math.max)(...midis));
  }
  const r = D.parseImport(JSON.stringify(D.fromSequence(d.name.slice(0, 80), d.notes)));
  check(`${where} exports as a valid drill`, !r.errors.length && !r.warnings.length, r.errors.concat(r.warnings).slice(0, 2));
}
const mel = C.drill(C.BY_ID["scale:A-melodic:1:1"], "desc_asc").notes;
eq("melodic minor from the top comes down natural", txt(mel.slice(0, 3)), ["A5", "G5", "F5"]);
eq("...and goes up melodic", txt(mel.slice(-3)), ["F♯5", "G♯5", "A5"]);
eq("arpeggio", txt(C.drill(C.BY_ID["arpeggio:G-major:1:1"], "asc_desc").notes), ["G3", "B3", "D4", "G4", "D4", "B3", "G3"]);
eq("broken thirds", txt(C.drill(C.BY_ID["thirds:G-major:1:1"], "asc_desc").notes.slice(0, 6)), ["G3", "B3", "A3", "C4", "B3", "D4"]);
eq("pattern drill includes the open string", txt(C.drill(C.BY_ID["pattern:1:01"], "asc_desc").notes), ["A4", "B♭4", "C5", "D5", "E5", "D5", "C5", "B♭4", "A4"]);
const up = C.drill(C.BY_ID["shift:A:1-3"], "asc_desc"), down = C.drill(C.BY_ID["shift:A:1-3"], "desc_asc");
eq("shift pairs up start low", [up.notes[0].pos, up.notes[1].shift], [1, "up"]);
eq("shift pairs down start high", [down.notes[0].pos, down.notes[1].shift], [3, "down"]);
eq("shift pairs frame", [up.frame, down.frame], ["1st ⇡ 3rd: 1→1 2→2 3→3 2→1", "3rd ⇣ 1st: 1→1 2→2 1→2 3→3"]);
eq("tempo range", [up.startBpm, up.targetBpm, up.per, C.drill(C.BY_ID["scale:G-major:1:2"], "asc_desc").per], [45, 60, 2, 4]);

// ---------- Measuring a run ----------
const G2 = C.BY_ID["scale:G-major:1:2"], gd = C.drill(G2, "asc_desc");
const res = (seq, f) => seq.map((it, i) => ({ cents: f(it, i), wrong: null, missed: false, timing: null }));
const ctx = { tonicPc: 7 };
const clean = C.measure(res(gd.notes, () => 2), gd.notes, ctx);
check("clean run passes mastery", C.judge(clean, "mastery").pass, C.judge(clean, "mastery").checks);
// Sharp coming down (the documented string-player bias)
const half = Math.ceil(gd.notes.length / 2);
const sharpDown = C.measure(res(gd.notes, (it, i) => (i >= half ? 18 : 0)), gd.notes, ctx);
eq("direction split", [sharpDown.ascCents, sharpDown.descCents], [0, 18]);
check("sharp descent fails mastery", !C.judge(sharpDown, "mastery").pass);
check("tip names the descent", C.tips(sharpDown).some((t) => t.includes("Coming down")), C.tips(sharpDown));
// Leading tone may sit a little high going up
const lt = C.measure(res(gd.notes, (it, i) => (it.midi % 12 === 6 && i < half ? 20 : 0)), gd.notes, ctx);
check("leading tone slack", lt.notes.filter((n) => n.midi % 12 === 6 && n.motion === "up").every((n) => n.adj === 12), lt.notes.filter((n) => n.midi % 12 === 6));
// G, D, A and E must ring at mastery: 10¢ off is fine on C, not on D
const ring = C.measure(res(gd.notes, (it) => (it.midi % 12 === 2 ? 10 : 0)), gd.notes, ctx);
check("ring notes judged tighter at mastery", C.judge(ring, "mastery").pct < C.judge(C.measure(res(gd.notes, (it) => (it.midi % 12 === 0 ? 10 : 0)), gd.notes, ctx), "mastery").pct);
// Uneven whole steps and octaves
const uneven = C.measure(res(gd.notes, (it, i) => (i % 2 ? 12 : -12)), gd.notes, ctx);
check("interval evenness", uneven.intervalEvennessCents > 20, uneven.intervalEvennessCents);
const octs = C.measure(res(gd.notes, (it) => (it.midi >= 67 ? 14 : 0)), gd.notes, ctx);
eq("octave consistency", octs.octaveConsistencyCents, 14);
// Tempo: timing counts, and IOI evenness is measured
const timed = gd.notes.map((it, i) => ({ cents: 0, wrong: null, missed: false, timing: i % 2 ? 40 : -40 }));
const tm = C.measure(timed, gd.notes, { tonicPc: 7, slotMs: 250 });
check("uneven rhythm fails", !C.judge(tm, "learning").pass && tm.ioiCV > 0.12, tm.ioiCV);
// Shifts: a sharp landing after a shift down
const cd = C.drill(C.BY_ID["scale:C-major:13:2"], "desc_asc");
const shiftBad = C.measure(res(cd.notes, (it) => (it.shift ? 30 : 0)), cd.notes, { tonicPc: 0 });
check("shift clean rate", C.judge(shiftBad, "learning").checks.find((c) => c.key === "shift").value === 0);

// ---------- Progression ----------
const node = C.BY_ID["pattern:1:23"], pd = C.drill(node, "asc_desc");
const good = C.measure(res(pd.notes, () => 1), pd.notes, { tonicPc: 2 });
const bad = C.measure(res(pd.notes, () => 30), pd.notes, { tonicPc: 2 });
let states = {};
const play = (dir, day, sid, { mode = "tempo", bpm, m = good } = {}) => {
  const out = C.recordAttempt(states, node, { t: 0, day, sid, dir, mode, bpm: bpm || (states[node.id] || { tempo: 45 }).tempo, metrics: m });
  if (out.state) states = { ...states, [node.id]: out.state };
  return out;
};
eq("new node", C.status(node, states), "new");
eq("locked node", C.status(C.BY_ID["scale:C-major:1:1"], states), "locked");
eq("lock-in doesn't count", play("asc_desc", "2026-01-01", 1, { mode: "lock" }).counted, false);
play("asc_desc", "2026-01-01", 1, { mode: "flow" }); play("desc_asc", "2026-01-01", 1, { mode: "flow" }); play("asc_desc", "2026-01-01", 1, { mode: "flow" });
eq("one direction isn't enough", states[node.id].status, "learning");
const toCons = play("desc_asc", "2026-01-01", 1, { mode: "flow" });
eq("both directions → consolidating", [states[node.id].status, toCons.events.map((e) => e.type)], ["consolidating", ["consolidating"]]);
// Tempo: three passes in a row need a first-try-of-session among them and both directions
play("asc_desc", "2026-01-01", 1); play("desc_asc", "2026-01-01", 1); play("asc_desc", "2026-01-01", 1);
eq("no cold probe, no tempo step", states[node.id].tempo, 45);
const stepUp = play("desc_asc", "2026-01-02", 2); // the first try of a new session completes the three
eq("tempo up 6%", [states[node.id].tempo, stepUp.events[0]], [48, { type: "tempoUp", from: 45, to: 48 }]);
play("asc_desc", "2026-01-02", 2, { m: bad });
const stepDown = play("desc_asc", "2026-01-02", 2, { m: bad });
eq("two misses → tempo down 8%", [states[node.id].tempo, stepDown.events.some((e) => e.type === "tempoDown")], [44, true]);
eq("big miss suggests a slower retry", stepDown.events.find((e) => e.type === "retry"), { type: "retry", bpm: 41 });
// Climb to the target one session at a time; mastery needs the target tempo, both directions and 2 days
let day = 3;
while (states[node.id].tempo < 60 && day < 40) {
  const d = `2026-01-${String(day).padStart(2, "0")}`;
  for (const dir of ["asc_desc", "desc_asc", "asc_desc"]) play(dir, d, day);
  day++;
}
eq("reached target", states[node.id].tempo, 60);
check("not mastered below target", states[node.id].status === "consolidating", states[node.id].status);
const last = `2026-01-${String(day).padStart(2, "0")}`;
let ev = [];
for (const dir of ["asc_desc", "desc_asc", "asc_desc", "desc_asc", "asc_desc", "desc_asc"]) ev = ev.concat(play(dir, last, day).events);
const m = ev.find((e) => e.type === "mastered");
check("mastered at target over several days", states[node.id].status === "mastered" && m, states[node.id]);
check("mastery unlocks the next nodes", m && m.unlocked.includes("scale:A-major:1:1") && m.unlocked.includes("pattern:1:12"), m);
eq("first review tomorrow", [states[node.id].box, states[node.id].due], [1, C.addDays(last, 1)]);
// A single great session can't master a node
{
  const n2 = C.BY_ID["scale:A-major:1:1"], d2 = C.drill(n2, "asc_desc");
  const g2 = C.measure(res(d2.notes, () => 0), d2.notes, { tonicPc: 9 });
  let st2 = {};
  for (let i = 0; i < 60; i++) {
    const o = C.recordAttempt(st2, n2, { t: 0, day: "2026-02-01", sid: 7, dir: C.DIRS[i % 2], mode: "tempo", bpm: 60, metrics: g2 });
    st2 = { ...st2, [n2.id]: o.state };
  }
  eq("one session never masters", st2[n2.id].status, "consolidating");
}
// Reviews: a first-try pass moves up a box; two first-try misses in a row send it back
const rv = (d, sid, mm) => play("desc_asc", d, sid, { m: mm, bpm: 60 });
const passed = rv(C.addDays(last, 1), 100, good);
eq("review pass", [states[node.id].box, passed.events[0].type], [2, "reviewPassed"]);
rv(C.addDays(last, 3), 101, bad);
eq("review miss", [states[node.id].status, states[node.id].box], ["review", 1]);
const reg = rv(C.addDays(last, 4), 102, bad);
eq("second miss regresses", [states[node.id].status, states[node.id].tempo, states[node.id].mastered], ["consolidating", 51, true]);
check("regress event", reg.events.some((e) => e.type === "regressed"), reg.events);
eq("dependents stay unlocked", C.unlocked(C.BY_ID["scale:A-major:1:1"], states), true);

// ---------- What's next ----------
const plan = (st, o = {}) => C.nextUp(st, { sid: 500, day: "2026-03-01", random: () => 0.3, ...o });
eq("first thing to practise", plan({}), { nodeId: "pattern:1:23", dir: "asc_desc", role: "focus", why: "New skill. Get the notes in tune first (Flow), then add the metronome (Tempo)." });
{
  const mastered = { status: "mastered", mastered: true, tempo: 60, box: 2, due: "2026-02-20", log: [{ sid: 1, dir: "asc_desc", pct: 1 }], coldDays: [], coldFails: 0 };
  const st = { "pattern:1:23": mastered };
  eq("due review comes first", [plan(st).nodeId, plan(st).role, plan(st).dir], ["pattern:1:23", "review", "desc_asc"]);
  const done = { "pattern:1:23": { ...mastered, log: mastered.log.concat({ sid: 500, dir: "desc_asc", pct: 1, passed: true }) } };
  eq("then the lowest-stage new skill", [plan(done).nodeId, plan(done).role], ["scale:A-major:1:1", "focus"]);
  // A weaker descent pulls the focus to start at the top
  const lop = { ...done, "scale:A-major:1:1": { status: "learning", mastered: false, tempo: 45, box: 0, due: null, coldDays: [], coldFails: 0,
    log: [{ sid: 1, dir: "asc_desc", pct: 0.95 }, { sid: 1, dir: "desc_asc", pct: 0.6 }] } };
  eq("lopsided → from the top", [plan(lop).nodeId, plan(lop).dir], ["scale:A-major:1:1", "desc_asc"]);
  // After 3 tries each way this session, move on (support work, then the next focus)
  const tries = ["asc_desc", "desc_asc"].flatMap((dir) => [0, 1, 2].map(() => ({ sid: 500, dir, pct: 0.5, passed: false })));
  const tired = { "pattern:1:23": { ...mastered, due: "2026-03-09" }, "scale:A-major:1:1": { ...lop["scale:A-major:1:1"], log: tries } };
  eq("support after a full focus block", [plan(tired).nodeId, plan(tired).role], ["pattern:1:23", "support"]);
  const supported = { ...tired, "pattern:1:23": { ...tired["pattern:1:23"], log: mastered.log.concat({ sid: 500, dir: "asc_desc", pct: 1, passed: true }) } };
  eq("then the next focus", [plan(supported).nodeId, plan(supported).role], ["scale:D-major:1:1", "focus"]);
}
eq("session id", [C.sessionId({ id: 5, day: "2026-01-01", last: 1000 }, 1000 + 60000, "2026-01-01"), C.sessionId({ id: 5, day: "2026-01-01", last: 1000 }, 1000 + 46 * 60000, "2026-01-01")], [5, 1000 + 46 * 60000]);

console.log(`${C.NODES.length} skills in ${C.STAGES.length - 1} stages`);
console.log(fails ? `${fails} failure(s)` : "all pass");
process.exit(fails ? 1 : 0);
