// Run: node test/piece.test.js — segments a synthetic performance and checks intonation and timing analysis.
const P = require("../piece.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Render notes [{midi, cents, ms, gapMs, vibrato, slideFrom}] into 60 fps pitch frames starting at t0
function perform(notes, t0 = 1000) {
  const frames = [];
  let t = t0;
  const push = (m, rms) => { frames.push({ t, m, rms }); t += 1000 / 60; };
  for (const n of notes) {
    const start = t;
    if (n.slideFrom !== undefined) for (let k = 0; k < 3; k++) push(n.slideFrom + ((n.midi - n.slideFrom) * (k + 1)) / 4, 0.1); // a 50 ms slide
    while (t - start < n.ms) {
      const age = t - start;
      const vib = n.vibrato ? 0.25 * Math.sin((2 * Math.PI * 5.5 * age) / 1000) : 0;
      const glitch = rand() < 0.02 ? null : n.midi + n.cents / 100 + vib + (rand() - 0.5) * 0.04;
      push(glitch, age < 40 ? 0.05 + age / 400 : 0.15);
    }
    for (let k = 0; k < Math.round((n.gapMs || 0) / (1000 / 60)); k++) push(n.dipOnly ? n.midi + n.cents / 100 : null, 0.02); // bow change
  }
  return frames;
}

// A G major tune: F#5 is always 18¢ sharp, one F natural slips in, repeated D5s separated by bow changes
const tune = [];
const pattern = [[74, 0], [76, 3], [78, 18], [79, -2], [81, 4], [78, 18], [74, -3], [74, 2], [77, 5], [79, 0], [78, 18], [76, -4]];
for (let r = 0; r < 3; r++) pattern.forEach(([midi, cents], i) => tune.push({ midi, cents: cents + (rand() - 0.5) * 4, ms: 400, gapMs: midi === 74 && pattern[i + 1] && pattern[i + 1][0] === 74 ? 50 : 20, dipOnly: true, vibrato: i % 4 === 0, slideFrom: i === 4 ? 79 : undefined }));
const frames = perform(tune);
const notes = P.segment(frames);
check("finds every note, including repeated D5s", notes.length === tune.length, { got: notes.length, want: tune.length, midis: notes.map((n) => n.midi).join(" ") });
check("pitches in order", notes.map((n) => n.midi).join() === tune.map((n) => n.midi).join(), notes.map((n) => n.midi));
const errs = notes.map((n, i) => Math.abs(n.cents - tune[i].cents));
check("intonation within 3¢ (with vibrato)", Math.max(...errs) < 3, errs.map((e) => e.toFixed(1)));

const G = new Set([7, 9, 11, 0, 2, 4, 6]);
const a = P.analyze(frames, { tol: 15, keyPcs: G, keyName: "G major" });
check("F#5 tendency", a.tendencies[0] && a.tendencies[0].note === "F♯5" && a.tendencies[0].avgCents > 14 && a.tendencies[0].count === 9, a.tendencies);
check("F natural out of key, suggests F#", a.outOfKey[0] && a.outOfKey[0].note === "F5" && a.outOfKey[0].count === 3 && a.outOfKey[0].nearestInKey.join() === "F♯5", a.outOfKey);
check("coach names the F#5 habit", a.coachNotes.some((c) => c.startsWith("F♯5 runs sharp")), a.coachNotes);
check("coach says the F finger sits low", a.coachNotes.some((c) => c.includes("sitting low")), a.coachNotes);

// Metronome: 100 BPM eighths; the player rushes 30 ms early at first, then drifts to 70 ms early
const beatMs = 600, sub = 2, q = beatMs / sub, lat = 50, t0 = 5000;
const met = [];
for (let k = 0; k < 32; k++) met.push({ midi: [74, 76, 78, 79][k % 4], cents: 0, ms: q - 20, gapMs: 0, dev: k < 16 ? -30 : -70 });
let mf = [], tt = t0;
for (const [k, n] of met.entries()) { const f = perform([{ ...n, ms: q - 40 }], t0 + k * q + n.dev + lat); mf = mf.concat(f); }
const am = P.analyze(mf, { tol: 15, metronome: { t0, beatMs, sub, lat } });
check("metronome: all notes timed", am.timing.notes === 32, am.timing);
check("metronome: rushing measured", Math.abs(am.timing.firstHalfMs + 30) <= 12 && Math.abs(am.timing.secondHalfMs + 70) <= 12, am.timing);
check("metronome: coach says rush and drift ahead", am.coachNotes.some((c) => c.includes("rush")) && am.coachNotes.some((c) => c.includes("drift ahead")), am.coachNotes);
check("metronome: beats counted from the first click", am.notes[2].beat === 1, am.notes.slice(0, 3));

// No metronome: quarter notes and eighths at a 500 ms beat, with a stretch in the middle 12% faster
let ff = [], ft = 2000;
const rhythm = [];
for (let k = 0; k < 60; k++) rhythm.push(k % 3 === 2 ? 2 : 1); // ♪ ♪ ♩ pattern
rhythm.forEach((units, k) => {
  const fast = k >= 24 && k < 36 ? 1 / 1.12 : 1;
  const dur = units * 250 * fast;
  ff = ff.concat(perform([{ midi: [74, 76, 78, 79, 81][k % 5], cents: 0, ms: dur - 30, gapMs: 0 }], ft));
  ft += dur;
});
const af = P.analyze(ff, { tol: 15 });
check("free: pulse found (the eighth, ~240/min)", Math.abs(af.timing.pulsePerMin - 240) <= 12, af.timing.pulsePerMin);
check("free: faster stretch found", af.timing.spans.some((s) => s.kind === "faster" && s.start >= 2000 + 20 * 250 && s.start <= 2000 + 40 * 330), af.timing.spans);
check("free: size of the speed-up (~12%)", af.timing.spans.some((s) => s.peak >= 9 && s.peak <= 15), af.timing.spans);
// Same idea with the onset gaps measured in the browser (16 ms frames): a middle third ~11% faster
{
  const gaps = "304 304 290 304 304 288 304 304 304 304 288 304 272 272 256 272 272 256 272 272 272 256 272 272 304 288 304 304 304 288 304 304 304 288 304".split(" ").map(Number);
  const ns = [{ t: 0 }]; for (const g of gaps) ns.push({ t: ns[ns.length - 1].t + g });
  const ft = P.freeTiming(ns);
  check("free: baseline is the usual tempo, not the median", Math.abs(ft.pulseMs - 302) <= 6 && ft.spans.length === 1 && ft.spans[0].peak >= 9, { pulse: ft.pulseMs, spans: ft.spans });
}
check("free: coach mentions speeding up", af.coachNotes.some((c) => c.includes("sped up")), af.coachNotes);

// Report is self-describing and compact
const rep = P.buildReport(a, { t0: frames[0].t, date: Date.now(), title: "Minuet", keyName: "G major", a4: 440, tol: 15 });
check("report", rep.format === P.REPORT_FORMAT && rep.notes.length === tune.length && rep.notes[0].t === 0 && typeof rep.howToRead === "string" && !rep.timing.curve, Object.keys(rep));

// Silence
check("silence", P.analyze([{ t: 0, m: null, rms: 0 }, { t: 16, m: null, rms: 0 }], {}).coachNotes[0].startsWith("No notes"));

// After an out-of-key note: in D major, an F natural (low 1 on the E string) drags the next G and A flat;
// the same G and A elsewhere are in tune. And the same notes coming down run sharp.
{
  const Ctx = require("../context.js"), S = require("../scales.js");
  const D = Ctx.keyPcs([S.spell("D", S.SCALE_TYPES.major).acc]);
  const phrase = [[76, 0], [78, 2], [79, 0], [81, 1], [79, 14], [78, 15], [76, 0], [77, -2], [79, -19], [81, -21], [79, 13], [78, 14], [76, 0]];
  const t = [];
  for (let r = 0; r < 2; r++) phrase.forEach(([midi, cents]) => t.push({ midi, cents, ms: 350, gapMs: 20 }));
  const b = P.analyze(perform(t), { tol: 15, keyPcs: D, keyName: "D major", name: (m) => (m % 12 === 5 ? "F" : m % 12 === 6 ? "F♯" : "X") + (Math.floor(m / 12) - 1) });
  const f = b.context.afterOutOfKey[0];
  check("after F natural, the notes sag", f && f.note === "F5" && f.lowered === true && f.avgDeltaCents <= -12 && f.comparedNotes === 6, b.context.afterOutOfKey);
  check("coach names the hand going back", b.coachNotes.some((c) => c.startsWith("After F5") && c.includes("go back")), b.coachNotes);
  check("coming down sharper", b.context.direction && b.context.direction.diff > 10, b.context.direction);
  check("report carries context", P.buildReport(b, { t0: 1000, date: 0, a4: 440, tol: 15 }).context.afterOutOfKey[0].note === "F5");
}

// Tempo drift for the live view and the review timeline
{
  const q = 375; // 80 BPM, eighth notes
  const at = (f, n, jitter = 0) => Array.from({ length: n }, (_, k) => { const t = 10000 + (k * q) / f + (rand() - 0.5) * jitter; return { t, off: t - (10000 + Math.round((t - 10000) / q) * q) }; });
  const steady = P.clickDrift(at(1, 12, 30), q);
  check("steady with jitter: drift near 0", Math.abs(steady) < 2, steady);
  const fast = P.clickDrift(at(1.05, 12, 20), q);
  check("5% fast reads about +5", Math.abs(fast - 5) < 1.5, fast);
  const slow = P.clickDrift(at(0.9, 16), q);
  check("10% slow reads about -10, across a grid wrap", Math.abs(slow + 10) < 0.5, slow);
  check("too few onsets: null", P.clickDrift(at(1, 2), q) === null);
  const curve = P.clickDriftCurve([...at(1, 16, 10), ...at(1.08, 16, 10).map((p) => ({ ...p, t: p.t + 6000 }))].map((p) => ({ t: p.t, off: p.t - (10000 + Math.round((p.t - 10000) / q) * q) })), q, 6 * 750);
  check("curve: steady then rushing", curve.length > 20 && Math.abs(curve[2].pct) < 3 && curve[curve.length - 3].pct > 5, curve.map((c) => c.pct));

  const g = { t0: 10000, beatMs: 750, sub: 2, lat: 40 };
  const ns = at(0.94, 20, 10).map((p) => ({ t: p.t + g.lat }));
  const live = P.liveDrift(ns, { now: ns[ns.length - 1].t, metronome: g });
  check("live vs click: dragging 6%", live && live.ref === "click" && Math.abs(live.pct + 6) < 1.5, live);
  const free = []; let tt = 1000;
  for (let k = 0; k < 30; k++) { free.push({ t: tt }); tt += k < 18 ? 500 : 440; }
  const lf = P.liveDrift(free, { now: tt, metronome: null });
  check("live vs own pulse: speeding up reads positive", lf && lf.ref === "pulse" && lf.pct > 6, lf);
  check("live: nothing recent, null", P.liveDrift(free, { now: tt + 20000, metronome: null }) === null);
}

console.log(fails ? `${fails} failures` : "all pass");
process.exit(fails ? 1 : 0);
