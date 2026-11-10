// Run: node test/practicelog.test.js — checks the practice log: storage, ranges, sessions, patterns and Claude-drill impact.
const L = require("../practicelog.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };

const H = 3600000, D = 24 * H;
const NOW = new Date(2026, 10, 8, 20, 0).getTime(); // 8 Nov, 8 pm local
const landing = (note, string, cents, extra = {}) => ({ note, string, finger: 2, position: 3, cents, inTune: cents !== null && Math.abs(cents) <= 15, wrongNoteFirst: null, shift: null, ...extra });
const run = (t, landings, extra = {}) => ({ date: new Date(t).toISOString(), mode: "flow", tolerance: 15, score: landings.filter((l) => l.inTune).length / landings.length, passed: false, landings, coachNotes: [], ...extra });

// Tuples round-trip, including tempo fields
const tempo = landing("C#5", "A", -8, { shift: "up", timingMs: 42, onTime: true, missed: false, wrongNoteFirst: "C5" });
const rec = L.record("k", "Drill", run(NOW, [tempo, landing("D5", "A", null)], { bpm: 72, notesPerBeat: 2 }));
const out = L.build([rec], "all", { now: NOW, customs: [], pieces: [], detail: true });
check("landing round-trips", JSON.stringify(out.sessions[0].list[0].landings[0]) === JSON.stringify(tempo), out.sessions[0].list[0].landings[0]);
check("bpm kept", out.sessions[0].list[0].bpm === 72 && out.sessions[0].list[0].notesPerBeat === 2);
check("path pass overrides score pass", L.record("k", "x", run(NOW, [tempo], { passed: false, path: { passed: true } })).passed === true);

// Pruning: newest first, nothing past 90 days, at most 1000 runs, no duplicate ids
let log = [];
for (let i = 0; i < 1100; i++) log = L.add(log, L.record("k", "x", run(NOW - i * 60000, [landing("A4", "D", 0)])), NOW);
check("capped at 1000", log.length === 1000, log.length);
check("newest first", log[0].t === NOW && log[1].t < log[0].t);
check("old runs dropped", L.prune([L.record("k", "x", run(NOW - 91 * D, [landing("A4", "D", 0)]))], NOW).length === 0);
check("same run added twice kept once", L.add(log, log[0], NOW).length === 1000);

// Backfill from the per-drill reports
const bf = L.backfill({ "a|x": { label: "X", runs: [run(NOW - H, [landing("A4", "D", 3)]), run(NOW - 2 * H, [landing("A4", "D", 3)])] }, "a|y": { label: "Y", runs: [run(NOW - 3 * H, [landing("B4", "D", 3)])] } }, NOW);
check("backfill takes every kept run", bf.length === 3 && bf[0].label === "X" && bf[2].label === "Y", bf.map((r) => r.label));

// A few days of practice: F#5 on A after shifting down keeps landing sharp, then gets better
log = [];
const day = (n, h) => NOW - n * D + (h - 20) * H;
const pattern = [[4, 25], [3, 22], [1, 6], [0, 4]]; // days ago, cents on F#5
for (const [n, c] of pattern) {
  for (const k of [0, 1]) {
    const ls = [landing("D5", "A", 2), landing("F#5", "A", c, { shift: "down" }), landing("Gb5", "A", c + 1, { shift: "down" }), landing("E5", "A", -3, { finger: 4, position: 1, wrongNoteFirst: n > 2 ? "Eb5" : null })];
    log = L.add(log, L.record(k ? "cfg|b" : "cfg|a", k ? "Scale B" : "Scale A", run(day(n, 18) + k * 10 * 60000, ls)), NOW);
  }
}
log = L.add(log, L.record("custom|c-fsharp", "My drill · F# shift", run(day(1, 18.5), [landing("F#5", "A", 5, { shift: "down" })])), NOW);
log = L.add(log, L.record("custom|c-fsharp", "My drill · F# shift", run(day(0, 18.5), [landing("F#5", "A", 2, { shift: "down" })])), NOW);
const customs = [{ key: "custom|c-fsharp", title: "F# shift", goal: "Land F#5 after shifting down", source: "imported", added: day(2, 12), spots: [{ note: "F#5", string: "A" }] }];

// Ranges and sessions
check("session = latest session only", L.select(log, "session", NOW).recs.length === 3, L.select(log, "session", NOW).recs.length);
check("today", L.select(log, "today", NOW).recs.length === 3);
check("last 3 days", L.select(log, "3", NOW).recs.length === 6, L.select(log, "3", NOW).recs.length);
check("last 7 days = all", L.select(log, "7", NOW).recs.length === log.length);
check("sessions split on 45 minute gaps", L.sessions(log).length === 4, L.sessions(log).length);
check("oldest first", L.select(log, "all", NOW).recs[0].t < L.select(log, "all", NOW).recs[1].t);

const rep = L.build(log, "7", { now: NOW, a4: 442, customs, pieces: [{ t: day(1, 20), title: "Minuet", key: "G major", summary: { notes: 80 } }, { t: NOW - 30 * D, title: "Old", summary: {} }] });
check("format", rep.format === "fingerboard-coach/practice-log@1" && rep.a4 === 442);
check("overview counts", rep.overview.runs === 10 && rep.overview.daysPractised === 4 && rep.overview.sessions === 4, rep.overview);
check("earlier/later by day", rep.overview.splitBy === "day" && rep.overview.earlier.runs === 4 && rep.overview.later.runs === 6, rep.overview);
const fs = rep.patterns.spots[0];
check("worst spot first, spellings merged", fs.note === "F#5" && fs.string === "A" && fs.landings === 18, fs);
check("spot trend better", fs.trend === "better" && fs.earlier.avgCents > 20 && fs.later.avgCents < 10, fs);
check("spot after-shift breakdown", fs.afterShift.down.landings === 18, fs.afterShift);
check("shift pattern", rep.patterns.afterShift.down.avgCents > 5 && rep.patterns.afterShift.none.landings === 16, rep.patterns.afterShift);
check("finger pattern", rep.patterns.byFinger["4"].avgCents === -3 && rep.patterns.byPosition["1"].landings === 8, rep.patterns.byFinger);
check("wrong-note swaps", rep.patterns.wrongNotes[0].targetToPlayed === "E5 (A) → Eb5" && rep.patterns.wrongNotes[0].times === 4, rep.patterns.wrongNotes);
check("no timing without tempo runs", rep.patterns.timing === undefined);
const a = rep.drills.find((d) => d.key === "cfg|a");
check("drill progress", a.runs === 4 && a.scores.length === 4 && a.first.date < a.last.date, a);
check("summaries only by default over days", rep.sessions.every((s) => s.list.every((r) => !r.landings)) && rep.range.everyNote === false);
check("pieces in range only", rep.pieces.length === 1 && rep.pieces[0].title === "Minuet" && rep.pieces[0].notes === 80, rep.pieces);

// Claude drills: target spots across ALL drills before vs after it was added
const cd = rep.claudeDrills[0];
check("claude drill listed", rep.claudeDrills.length === 1 && cd.sinceIs === "added" && cd.runs === 2, cd);
check("claude drill before/after", cd.beforeOnTargets.avgCents > 20 && cd.afterOnTargets.avgCents < 10 && cd.trend === "better", cd);
check("claude drill scores", cd.firstScore === 1 && cd.lastScore === 1);
const noAdd = L.build(log, "all", { now: NOW, customs: [{ ...customs[0], added: null }] }).claudeDrills[0];
check("without an add date, since = first practised", noAdd.sinceIs === "first practised" && noAdd.since.startsWith(new Date(day(1, 18.5)).toISOString().slice(0, 4)), noAdd);
check("claude drill not in range is left out", L.build(log, "today", { now: NOW, customs: [{ ...customs[0], key: "custom|other", added: day(5, 12) }] }).claudeDrills.length === 0);

// A session in detail, with timing
const t0 = NOW - 10 * 60000;
const tl = [L.record("t", "Tempo", run(t0, [landing("A4", "D", 0, { timingMs: 30, onTime: true, missed: false }), landing("B4", "D", null, { shift: "up", timingMs: null, onTime: false, missed: true })], { mode: "tempo", bpm: 80 }))];
const sr = L.build(tl, "session", { now: NOW });
check("session detail on by default", sr.range.everyNote && sr.sessions[0].list[0].landings.length === 2);
check("timing summary", sr.patterns.timing.missedRate === 0.5 && sr.patterns.timing.avgTimingMs === 30 && sr.patterns.timing.afterShift.up.onTimeRate === 0, sr.patterns.timing);
check("single run: no earlier/later", sr.overview.splitBy === undefined);

// Empty log
const empty = L.build([], "7", { now: NOW });
check("empty log", empty.overview.runs === 0 && empty.range.from === null && empty.sessions.length === 0);

// Output: valid JSON, leaf objects on one line
const text = L.stringify(rep);
check("stringify is JSON", JSON.stringify(JSON.parse(text)) === JSON.stringify(rep));
check("landings stay on one line", L.stringify(sr).split("\n").some((ln) => ln.trim().startsWith('{"note":"A4"')));
check("midiOf spellings", L.midiOf("F#5") === L.midiOf("Gb5") && L.midiOf("A4") === 69 && L.midiOf("B#3") === 60 && L.midiOf("x") === null);

console.log(fails ? `${fails} failing` : "practicelog: all passed");
process.exit(fails ? 1 : 0);
