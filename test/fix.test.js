// Run: node test/fix.test.js — checks the Watch line rule and Fix mode (fix.js) with synthetic steady pitches.
const F = require("../fix.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };

// ---------- The Watch line ----------
const it = (key, midi, extra = {}) => ({ key, midi, string: "D", finger: "2", pos: 1, ...extra });
const E4 = it("E4D", 64, { finger: "1" }), Fs4 = it("F#4D", 66), G4 = it("G4D", 67, { finger: "3" }), D4 = it("D4D", 62, { finger: "0", pos: null });
const seq = [D4, E4, Fs4, G4, Fs4, E4, D4];
const watch = (recent, more = {}) => F.watchOut(seq, { "F#4D": { recent }, ...more });

check("6¢ average, all one side: shows", watch([6, 6, 6, 6, 6, 6, 6, 6]) && watch([6, 6, 6, 6, 6, 6, 6, 6]).it === Fs4);
check("just under 6¢: nothing", watch([6, 6, 6, 6, 6, 6, 6, 5]) === null);
check("flat side too", watch([-8, -8, -8, -8, -8, -8, -8, -8]).avg === -8);
check("fewer than 8 landings: nothing", watch([20, 20, 20, 20, 20, 20, 20]) === null);
// 70% on the sharp side is enough, 60% isn't (the average is well over 6¢ in both)
check("70% one-sided: shows", watch([20, 20, 20, 20, 20, 20, 20, -5, -5, -5]) !== null);
check("60% one-sided (mixed): nothing", watch([30, 30, 30, 30, 30, 30, -5, -5, -5, -5]) === null);
check("zeros don't count as either side", watch([20, 20, 20, 20, 20, 0, 0, 0]) === null);
check("open strings are never flagged", F.watchOut(seq, { D4D: { recent: Array(10).fill(30) } }) === null);
check("no history: nothing", F.watchOut(seq, {}) === null);
const both = F.watchOut(seq, { "F#4D": { recent: Array(8).fill(10) }, G4D: { recent: Array(8).fill(-14) } });
check("the worse note wins", both.it === G4 && both.n === 8 && both.side === 1, both);

// The approach for Fix this progression: across a shift or a string crossing first
check("approach: the note before it", F.approach(seq, Fs4) === E4);
const A4 = it("A4A", 69, { string: "A", finger: "1", pos: 1 }), B4 = it("B4A", 71, { string: "A", finger: "2", pos: 1 });
const C5 = it("C5A3", 72, { string: "A", finger: "1", pos: 3 }), D5 = it("D5A3", 74, { string: "A", finger: "2", pos: 3 });
check("approach: a string crossing beats a same-string step", F.approach([G4, A4, B4, A4], A4) === G4);
check("approach: a shift beats a crossing", F.approach([G4, A4, B4, C5, D5, C5], C5) === B4 && F.approach([E4, A4, B4, D5, C5], C5) === D5);
check("approach: none when the note starts the drill", F.approach([Fs4, G4], Fs4) === null);

// ---------- Fix mode ----------
// Feeds a fix a performance: { midi, c, ms } notes and { rest } gaps, in 20 ms frames. The pitch counts as steady
// after 220 ms, as in the app. Returns every event.
function play(f, parts, t0 = 0) {
  let t = t0;
  const ev = [];
  for (const p of parts) {
    const ms = p.rest !== undefined ? p.rest : p.ms || 600;
    for (let e = 0; e < ms; e += 20, t += 20) {
      const sounding = p.rest === undefined, stable = sounding && e >= 220 ? p.midi + (p.c || 0) / 100 : null;
      const r = F.step(f, t, stable, sounding);
      if (r && r.type !== "tick") ev.push({ ...r, t });
    }
  }
  return { ev, t };
}
const note = (midi, c = 0, ms = 600) => ({ midi, c, ms });
const rest = (ms = 400) => ({ rest: ms });
const reps = (midi, cents) => cents.flatMap((c) => [note(midi, c), rest()]);
const repsOf = (r) => r.ev.filter((e) => e.type === "rep");

// Silver tolerance (±15¢): a miss empties the set, three clean fill it, then a break
let f = F.start({ kind: "note", target: Fs4, tol: 15, avg: 12 });
let r = play(f, reps(66, [20, 3, -2]));
check("±20¢ at Silver is a miss", repsOf(r)[0].ok === false && Math.round(repsOf(r)[0].cents) === 20, repsOf(r)[0]);
check("two clean after a miss: not a set yet", f.sets === 0 && f.count === 2 && f.phase === "play");
r = play(f, [note(66, 30), rest(), ...reps(66, [1, 2, 3])], r.t);
check("a miss empties the set", repsOf(r)[0].ok === false && f.sets === 1);
check("three clean in a row: set 1, then a 10-second break", f.phase === "break" && f.breakWhy === "set" && f.breakUntil === repsOf(r)[3].t + F.BREAK_MS, f.phase);

// Nothing is scored during the break, even a perfect note
const before = f.reps.length;
r = play(f, [note(66, 0, 3000), rest(2000), note(66, 0, 3000)], r.t);
check("nothing scored during the break", f.reps.length === before && f.phase === "break");
r = play(f, [rest(2000)], r.t);
check("after the break: listening again", f.phase === "play" && r.ev.some((e) => e.type === "breakEnd") && r.ev.some((e) => e.type === "listen"), r.ev);
r = play(f, reps(66, [4, -4, 15]), r.t);
check("set 2: done", f.phase === "done" && F.done(f) && F.clean(f) === 8 && F.misses(f) === 2, { phase: f.phase, reps: f.reps });
check("nothing more once done", play(f, reps(66, [0]), r.t).ev.length === 0 && f.reps.length === 10);

// The quiet gap: one long note counts once; a note with no gap after it doesn't count twice
f = F.start({ kind: "note", target: Fs4, tol: 25 });
r = play(f, [note(66, 0, 4000)]);
check("one long note counts once", repsOf(r).length === 1);
r = play(f, [rest(200), note(66, 0, 600)], r.t);
check("a gap shorter than 0.3 s isn't a new repetition", repsOf(r).length === 0 && f.reps.length === 1);
r = play(f, [rest(320), note(66, 0, 600)], r.t);
check("after 0.3 s of quiet it listens again", repsOf(r).length === 1 && f.reps.length === 2);

// Tolerance per medal level
for (const [tol, inside, outside] of [[25, 25, 26], [15, 15, 16], [10, 10, 11]]) {
  f = F.start({ kind: "note", target: Fs4, tol });
  r = play(f, reps(66, [inside, -inside, outside, -outside]));
  check(`±${tol}¢: ${inside} clean, ${outside} a miss`, repsOf(r).map((e) => e.ok).join() === "true,true,false,false", repsOf(r).map((e) => e.cents));
}

// Three misses in a row: a break too, and the set starts empty after it
f = F.start({ kind: "note", target: Fs4, tol: 15 });
r = play(f, [...reps(66, [2]), ...reps(66, [30, 28, 33])]);
check("three misses in a row: a 10-second break", f.phase === "break" && f.breakWhy === "misses" && f.count === 0 && f.sets === 0, f);
r = play(f, [rest(10500)], r.t);
r = play(f, reps(66, [1, 1]), r.t);
check("two misses, a clean one, two misses: no break", (() => {
  const g = F.start({ kind: "note", target: Fs4, tol: 15 });
  play(g, reps(66, [30, 30, 0, 30, 30]));
  return g.phase !== "break" && g.missRun === 2;
})());

// Wrong notes
f = F.start({ kind: "note", target: Fs4, tol: 25 });
r = play(f, [note(65, 0, 400), note(66, 0, 600), rest()]);
check("a wrong note on the way, then the target in tune: a miss", repsOf(r).length === 1 && !repsOf(r)[0].ok && repsOf(r)[0].wrong === 65 && f.reps[0].c === 0, f.reps);
r = play(f, [note(67, 0, 500), rest(500)], r.t);
check("a wrong note and then stopping: a miss with no cents", repsOf(r).length === 1 && f.reps[1].c === null && f.reps[1].wrong === 67, f.reps);
r = play(f, reps(66, [0]), r.t);
check("the next repetition starts clean", repsOf(r)[0].ok === true);

// Fix this progression: the approach note only has to be the right note; then the target
f = F.start({ kind: "progression", target: Fs4, from: E4, tol: 15 });
check("progression has two steps", f.kind === "progression" && f.steps[0] === E4 && f.steps[1] === Fs4);
r = play(f, [note(64, 40), note(66, 5), rest()]);
check("approach 40¢ off is fine; target +5: clean", r.ev[0].type === "approach" && repsOf(r)[0].ok, r.ev);
r = play(f, [note(64, 0), note(66, 22), rest()], r.t);
check("progression: target outside tolerance is a miss", repsOf(r)[0].ok === false);
r = play(f, [note(64, 0), note(65, 0, 400), note(66, 0), rest()], r.t);
check("progression: a wrong note between them is a miss", repsOf(r)[0].ok === false && repsOf(r)[0].wrong === 65, r.ev);
r = play(f, [note(69, 0, 400), rest(100), note(64, 0), note(66, 0), rest()], r.t);
check("progression: anything before the approach note is ignored", repsOf(r).length === 1 && repsOf(r)[0].ok, r.ev);
r = play(f, [note(66, 0), rest()], r.t);
check("progression: the target without the approach doesn't count", repsOf(r).length === 0);
check("no approach note given: a plain note fix", F.start({ kind: "progression", target: Fs4, from: null, tol: 15 }).kind === "note");

// ---------- The fix log ----------
const NOW = new Date(2026, 10, 21, 18, 0).getTime(), DAY = 86400000;
const name = (m) => ({ 64: "E4", 65: "F4", 66: "F#4", 67: "G4" })[m];
f = F.start({ kind: "progression", target: Fs4, from: E4, tol: 15, avg: 11.6 });
play(f, [note(64, 0), note(65, 0, 400), note(66, 0), rest(), ...[3, 1, 2, 0, 0, 0].flatMap((c) => [note(64, 0), note(66, c), rest()])]);
let rec = F.record(f, NOW, name);
check("record: every repetition's cents, the wrong note named", JSON.stringify(rec.reps.map((x) => x.c)) === "[0,3,1,2]" && rec.reps[0].wrong === "F4" && rec.reps[0].ok === false, rec.reps);
check("record: what, where and how it went", rec.t === NOW && rec.key === "F#4D" && rec.note === "F#4" && rec.from === "E4" && rec.kind === "progression" && rec.tol === 15 && rec.watchAvg === 12 && rec.clean === 3 && rec.misses === 1 && rec.done === false, rec);
check("record: nothing played, nothing logged", F.record(F.start({ kind: "note", target: Fs4, tol: 15 }), NOW) === null);

const done = { t: NOW - 3600000, key: "F#4D", done: true }, stopped = { t: NOW - 1800000, key: "F#4D", done: false };
let log = F.add([], done, NOW);
log = F.add(log, stopped, NOW);
log = F.add(log, { t: NOW - DAY, key: "F#4D", done: true }, NOW);
log = F.add(log, { t: NOW - 600000, key: "G4D", done: true }, NOW);
check("fixed today counts finished fixes of that note today", F.doneToday(log, "F#4D", NOW) === 1 && F.doneToday(log, "G4D", NOW) === 1 && F.doneToday(log, "E4D", NOW) === 0);
check("log newest first, no duplicates", log[0].key === "G4D" && F.add(log, done, NOW).length === 4);
check("log drops fixes older than 90 days", F.add(log, { t: NOW - 91 * DAY, key: "x", done: true }, NOW).length === 4);
let big = [];
for (let i = 0; i < 230; i++) big = F.add(big, { t: NOW - i * 60000, key: "x", done: true }, NOW);
check("log keeps at most 200", big.length === F.KEEP && big[0].t === NOW);

// ---------- Judged from the touchdown (landing.js), as the app does ----------
// Frames at 10 ms: a note touches down at c cents and, with `to`, slides there over 150 ms after 80 ms.
const Landing = require("../landing.js");
function playJudged(f, parts, t0 = 0) {
  let t = t0;
  const ev = [], frames = [];
  const judge = (target, prev, from) => { // index.html's fixJudge
    const fr = from === null ? frames : frames.filter((x) => x.t >= from);
    if (!fr.length) return null;
    const i = prev ? Landing.onsetIndex(fr, target.midi, fr[fr.length - 1].t, { prev: prev.midi }) : 0;
    return i < 0 ? null : Landing.placeTry(fr.slice(i), target.midi);
  };
  for (const p of parts) {
    const ms = p.rest !== undefined ? p.rest : p.ms || 600, settle = p.to !== undefined ? 230 : 0;
    for (let e = 0; e < ms; e += 10, t += 10) {
      const sounding = p.rest === undefined;
      const c = !sounding ? null : p.to === undefined || e < 80 ? p.c : e >= 230 ? p.to : p.c + (p.to - p.c) * (e - 80) / 150;
      frames.push({ t, m: sounding ? p.midi + c / 100 : null });
      const stable = sounding && e >= 220 + settle ? p.midi + c / 100 : null;
      const r = F.step(f, t, stable, sounding, judge);
      if (r && r.type !== "tick") ev.push({ ...r, t });
    }
  }
  return { ev, t };
}
f = F.start({ kind: "note", target: Fs4, tol: 15, avg: 12, t: 0 });
r = playJudged(f, [{ midi: 66, c: 22, to: 2, ms: 700 }, rest()]);
let rp = repsOf(r)[0];
check("judged: lands 22¢ off and slides in = a miss", rp && rp.ok === false && Math.round(rp.cents) === 22 && Math.round(rp.slide) === -20, rp);
check("judged: the slide is kept with the repetition", f.reps[0].s === -20 && F.record(f, 1).reps[0].s === -20, f.reps[0]);
r = playJudged(f, [{ midi: 66, c: 4, ms: 600 }, rest()], r.t);
rp = repsOf(r)[0];
check("judged: a clean placement is clean", rp && rp.ok === true && Math.round(rp.cents) === 4 && rp.slide === null, rp);
r = playJudged(f, [{ midi: 66, c: 20, ms: 600 }, rest()], r.t);
check("judged: placed 20¢ off and left there = a miss", repsOf(r)[0].ok === false && repsOf(r)[0].slide === null, repsOf(r)[0]);
r = playJudged(f, [{ midi: 66, c: 3, ms: 340 }, rest()], r.t);
check("judged: a short clean note is still judged after the bow stops", repsOf(r).length === 1 && repsOf(r)[0].ok, r.ev);
// Progression across a string crossing: judged from the target's own touchdown, after the approach note
const B4c = it("B4A", 71, { string: "A", finger: "2", pos: 1 });
f = F.start({ kind: "progression", target: B4c, from: it("E5E", 76, { string: "E", finger: "0", pos: null }), tol: 15, t: 0 });
r = playJudged(f, [{ midi: 76, c: 0, ms: 500 }, { midi: 71, c: -24, to: -1, ms: 700 }, rest(), { midi: 76, c: 0, ms: 500 }, { midi: 71, c: 2, ms: 600 }, rest()]);
check("judged progression: slid target is a miss, a clean one is clean", repsOf(r).length === 2 && !repsOf(r)[0].ok && repsOf(r)[0].slide !== null && repsOf(r)[1].ok, repsOf(r));
// Progression across a shift: a shift's own slide is expected, so the steady pitch is judged (landing.js)
f = F.start({ kind: "progression", target: C5, from: B4c, tol: 15, t: 0 });
r = playJudged(f, [{ midi: 71, c: 0, ms: 500 }, { midi: 72, c: -25, to: 3, ms: 700 }, rest()]);
check("judged progression across a shift: settles in tune = clean", repsOf(r).length === 1 && repsOf(r)[0].ok && Math.round(repsOf(r)[0].cents) === 3, repsOf(r));

console.log(fails ? `${fails} failed` : "fix: all passed");
process.exit(fails ? 1 : 0);
