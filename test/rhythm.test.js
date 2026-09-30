// Run: node test/rhythm.test.js — rhythm drills: format, lining a performance up with the written rhythm, and coaching.
const D = require("../drills.js");
const P = require("../piece.js");
const R = require("../rhythm.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };
let seed = 11;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// ---------- Format ----------
// Every pack in packs/ is listed in packs/index.json and imports cleanly, as the app's Import box would take it
const fs = require("fs"), path = require("path");
const PACK_DIR = path.join(__dirname, "..", "packs");
const listed = JSON.parse(fs.readFileSync(path.join(PACK_DIR, "index.json"), "utf8"));
const onDisk = fs.readdirSync(PACK_DIR).filter((f) => f.endsWith(".json") && f !== "index.json");
check("every pack file is listed in packs/index.json", onDisk.sort().join() === [...listed].sort().join(), { listed, onDisk });
const packs = listed.map((f) => JSON.parse(fs.readFileSync(path.join(PACK_DIR, f), "utf8")));
check("pack ids unique", new Set(packs.map((p) => p.id)).size === packs.length);
for (const p of packs) {
  const r = D.parseImport(JSON.stringify(p));
  check(`pack ${p.id} imports cleanly`, p.title && p.blurb && r.errors.length === 0 && r.warnings.length === 0 && r.drills.length === p.drills.length, { e: r.errors, w: r.warnings });
}
const pack = packs.find((p) => p.id === "grenadiers-10-21");
const imp = D.parseImport(JSON.stringify(pack));
const exs = imp.drills.map(D.toExercise);
for (const ex of exs) {
  const bars = ex.rhythm.total / 4;
  check(`${ex.name}: whole bars`, Number.isInteger(bars), ex.rhythm.total);
  check(`${ex.name}: notes laid out in time`, ex.notes.every((n, i) => i === 0 || Math.abs(n.at - (ex.notes[i - 1].at + ex.notes[i - 1].beats)) < 1e-9), ex.notes.map((n) => n.at));
}
check("bars 10–21 is 12 bars", exs[7].rhythm.total === 48 && exs[7].frame.includes("12 bars"), exs[7].frame);
check("repeat expands the rhythm", exs[0].notes.length === 12 && exs[0].rhythm.total === 12 && exs[0].notes[11].at === 11.5, exs[0].notes.map((n) => n.at));

const n = (note, string, finger, beats, position) => ({ note, string, finger, beats, ...(position ? { position } : {}) });
const rest = D.toExercise(D.parseImport(JSON.stringify({ title: "pickup", notes: [{ rest: 3 }, n("A4", "A", 0, 1), n("D5", "A", 3, 2, 1), { rest: 0.5 }, n("D5", "A", 3, 0.333, 1)] })).drills[0]);
check("rests move time on", rest.notes.map((x) => x.at).join() === "3,4,6.5" && Math.abs(rest.rhythm.total - (6.5 + 1 / 3)) < 1e-9, { at: rest.notes.map((x) => x.at), total: rest.rhythm.total });
check("0.333 snaps to a triplet", Math.abs(rest.notes[2].beats - 1 / 3) < 1e-12, rest.notes[2].beats);
const norm = D.parseImport(JSON.stringify({ title: "pickup", beatsPerBar: 3, notes: [{ rest: 1 }, n("A4", "A", 0, 1), n("A4", "A", 0, 1)] })).drills[0];
check("normalize keeps beats, rests, beatsPerBar", norm.notes[0].rest === 1 && norm.notes[1].beats === 1 && norm.beatsPerBar === 3, norm);
check("repeated pitches allowed in rhythm drills", D.parseImport(JSON.stringify(norm)).errors.length === 0);
const bad = (drill, needle) => { const r = D.parseImport(JSON.stringify(drill)); check(`error mentions ${needle}`, r.errors.some((m) => m.includes(needle)), r.errors); };
bad({ title: "x", notes: [n("A4", "A", 0, 1), { note: "D5", string: "A", finger: 3, position: 1 }] }, "every note needs beats");
bad({ title: "x", notes: [n("A4", "A", 0, 0.2), n("D5", "A", 3, 1, 1)] }, ".beats");
bad({ title: "x", upAndBack: true, notes: [n("A4", "A", 0, 1), n("D5", "A", 3, 1, 1)] }, ".upAndBack");
bad({ title: "x", notes: [{ rest: 1 }, n("A4", "A", 0, 1)] }, "at least 2 notes besides the rests");
bad({ title: "x", notes: [{ rest: 9 }, n("A4", "A", 0, 1), n("A4", "A", 0, 1)] }, ".rest");
check("plain drills still reject repeated pitches", D.parseImport(JSON.stringify({ title: "x", notes: [{ note: "A4", string: "A", finger: 0 }, { note: "A4", string: "A", finger: 0 }] })).errors.length === 1);
check("doc rhythm example imports", D.parseImport(D.FORMAT_DOC.split("Rhythm example")[1].split("## Example")[0]).errors.length === 0);

// ---------- Scoring ----------
// Render a performance into 60 fps pitch frames: [{ midi, start, sound }] in beats. Each note fades over its last
// 40 ms (the bow slowing to change) and swells over its first 30 ms, so a repeated pitch shows as a dip in loudness.
const BEAT = 1000, T0 = 3000;
function perform(events, total) {
  const frames = [];
  for (let t = T0 - 2000; t < T0 + (total + 1) * BEAT; t += 1000 / 60) {
    const b = (t - T0) / BEAT, e = events.find((x) => b >= x.start && b < x.start + x.sound);
    if (!e) { frames.push({ t, m: null, rms: 0.004 }); continue; }
    const age = (b - e.start) * BEAT, left = (e.start + e.sound - b) * BEAT;
    const rms = e.abrupt ? 0.15 : left < 40 ? 0.03 : age < 30 ? 0.05 + (age / 30) * 0.1 : 0.15;
    frames.push({ t, m: rand() < 0.02 ? null : e.midi + (e.cents || 0) / 100 + (rand() - 0.5) * 0.04, rms });
  }
  return frames;
}
const exact = (ex, f = () => ({})) => ex.notes.map((x, i) => ({ midi: x.midi, start: x.at, sound: x.beats, ...f(x, i) }));
const run = (ex, events, o = {}) => R.score(ex.notes, P.segment(perform(events, ex.rhythm.total), { minNoteMs: 70 }), { t0: T0, beatMs: BEAT, tol: 15, tolMs: 90, holdFrac: 0.85, total: ex.rhythm.total, ...o });

// Bars 16–18: eight D5s in a row, held apart only by bow changes
const b16 = exs[5];
const clean = run(b16, exact(b16));
check("clean: every note found and ok", clean.notes.every((x) => x.ok), clean.notes.map((x) => [x.item.label, x.missed, x.timing && Math.round(x.timing), x.heldBeats && x.heldBeats.toFixed(2)]));
check("clean: dotted ratio ≈ 3", clean.summary.dotted && Math.abs(clean.summary.dotted.ratio - 3) < 0.15 && clean.summary.dotted.n === 2, clean.summary.dotted);
check("clean: no complaints", R.tips(clean.summary).every((t) => t.startsWith("✓")), R.tips(clean.summary));

// Dotted pairs played with a triplet feel: the 8th comes a third of a beat early
const trip = run(b16, exact(b16, (x, i) => {
  const prev = b16.notes[i - 1];
  if (x.beats === 0.5 && prev && prev.beats === 1.5) return { start: x.at - 1 / 6, sound: x.beats + 1 / 6 };
  if (x.beats === 1.5) return { sound: 1.5 - 1 / 6 };
  return {};
}));
check("triplet feel: ratio ≈ 2", trip.summary.dotted && Math.abs(trip.summary.dotted.ratio - 2.1) < 0.25, trip.summary.dotted);
check("triplet feel: no false alarm about long notes", !R.tips(trip.summary).some((t) => t.includes("too short") || t.includes("shrink")), R.tips(trip.summary));
check("triplet feel: coached as too even", R.tips(trip.summary).some((t) => t.includes("Dotted rhythm too even") && t.includes("“1 (2) &”")), R.tips(trip.summary));
check("triplet feel: early 8ths flagged late/early", trip.notes.filter((x) => x.beats === 0.5 && !x.onTime).length >= 2, trip.notes.map((x) => x.timing && Math.round(x.timing)));

// Half notes that fade after 1.4 beats while the next note still comes on time
const b10 = exs[2];
const fade = run(b10, exact(b10, (x) => (x.beats >= 2 ? { sound: 1.4 } : {})));
const halves = fade.summary.long.find((g) => g.beats === 2);
check("fade: half notes sounded ~1.4 beats", halves && Math.abs(halves.held - 1.4) < 0.1 && halves.cutShort === 1, fade.summary.long);
check("fade: the half note fails, its neighbours don't", fade.notes.filter((x) => !x.ok).map((x) => x.beats).join() === "2,3" || fade.notes.filter((x) => !x.ok).map((x) => x.beats).join() === "2", fade.notes.map((x) => [x.beats, x.ok, x.heldBeats.toFixed(2)]));
check("fade: coached as fading", R.tips(fade.summary).some((t) => t.includes("fade out early")), R.tips(fade.summary));

// Rushing off long notes: every half and dotted half ends 0.4 beats early, and everything after it moves up
const rushEvents = [];
let shift = 0;
for (const x of b10.notes) { const cut = x.beats >= 2 ? 0.4 : 0; rushEvents.push({ midi: x.midi, start: x.at - shift, sound: x.beats - cut }); shift += cut; }
const rush = run(b10, rushEvents, { tolMs: 500 });
const rt = R.tips(rush.summary);
check("rush: half notes lasted 1.6", rush.summary.long.find((g) => g.beats === 2).lasted.toFixed(1) === "1.6", rush.summary.long);
check("rush: coached as moving on early", rt.some((t) => t.includes("are too short") && t.includes("1.6 beats instead of 2")), rt);
check("rush: long notes shrink next to short ones", rt.some((t) => t.includes("Long notes shrink")), rt);
check("rush: the early repeat after a long note is still its own note", rush.notes.every((x) => !x.missed), rush.notes.map((x) => [x.item.label, x.beats, x.missed]));

// A bow change in the middle of a half note doesn't split it into two notes
const split = run(b10, exact(b10).flatMap((e) => (e.sound === 2 ? [{ ...e, sound: 1 }, { ...e, start: e.start + 1, sound: 1 }] : [e])));
check("mid-note bow change merged", split.notes.every((x) => x.ok), split.notes.map((x) => [x.beats, x.missed, x.heldBeats && x.heldBeats.toFixed(2)]));

// Two repeated D5s slurred together with no stop: one of them isn't heard
const slurEv = exact(b16);
const k = b16.notes.findIndex((x, i) => i > 0 && x.midi === b16.notes[i - 1].midi && x.beats === 0.5 && b16.notes[i - 1].beats === 1);
slurEv[k - 1].sound += slurEv[k].sound; slurEv.splice(k, 1);
const slur = run(b16, slurEv);
check("merged repeat: exactly one note missed", slur.notes.filter((x) => x.missed).length === 1 && slur.notes.filter((x) => !x.ok).length <= 2, slur.notes.map((x) => [x.item.label, x.beats, x.missed]));

// A short stop between repeated notes (hooked bowing): the sound cuts off, ~40 ms where no pitch is heard at all
const stopEv = exact(b16, (x) => ({ sound: x.beats - 0.04, abrupt: true }));
const stop = run(b16, stopEv);
check("40 ms stops between repeats are heard as new notes", stop.notes.every((x) => !x.missed), stop.notes.map((x) => [x.item.label, x.beats, x.missed]));

// A wrong note on time is a wrong note, not a missed one, and doesn't throw the rest off
const wrongEv = exact(b10, (x, i) => (i === 4 ? { midi: x.midi - 1 } : {}));
const wrong = run(b10, wrongEv);
check("wrong note matched as wrong", wrong.notes[4].wrong === b10.notes[4].midi - 1 && !wrong.notes[4].missed && wrong.notes.filter((x) => !x.ok).length === 1, wrong.notes.map((x) => [x.item.label, x.wrong, x.missed]));

// Latency: detection 80 ms behind the click is taken off
const late = R.score(b16.notes, P.segment(perform(exact(b16), b16.rhythm.total).map((f) => ({ ...f, t: f.t + 80 })), { minNoteMs: 70 }), { t0: T0, beatMs: BEAT, lat: 80, tol: 15, tolMs: 90, total: b16.rhythm.total });
check("latency removed", late.notes.every((x) => x.ok) && Math.abs(late.summary.meanOnsetMs) < 30, late.summary.meanOnsetMs);

// The chart draws a row per 4 bars and a played bar per heard note
const ch = R.lanes(exs[7].notes, { total: 48, bar: 4, clicks: 2, label: (e) => e.label + e.oct });
check("lanes: 3 rows for 12 bars", /viewBox="0 0 660 156"/.test(ch.svg), ch.svg.slice(0, 80));
const ch2 = R.lanes(b16.notes, { total: 12, bar: 4, clicks: 1, results: clean.notes, label: (e) => e.label + e.oct });
check("lanes: played bars drawn", (ch2.svg.match(/opacity=".85"/g) || []).length === b16.notes.length);
check("head position", ch.head(20).x > 8 && ch.head(20).y1 === 52, ch.head(20));
check("report rounds", JSON.stringify(R.report(clean.summary, 2)).length < 800 && R.report(clean.summary, 2).dotted.ratio > 2.8, R.report(clean.summary, 2));
check("value names", R.valueName(1.5) === "dotted quarter" && R.fmtBeats(1.5) === "1½" && R.fmtBeats(0.5) === "½" && R.fmtBeats(2) === "2", [R.fmtBeats(1.5), R.fmtBeats(0.5)]);

console.log(fails ? `${fails} failed` : "all pass");
process.exit(fails ? 1 : 0);
