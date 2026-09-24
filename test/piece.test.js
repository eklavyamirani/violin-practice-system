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

console.log(fails ? `${fails} failures` : "all pass");
process.exit(fails ? 1 : 0);
