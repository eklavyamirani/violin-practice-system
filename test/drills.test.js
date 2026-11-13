// Run: node test/drills.test.js — checks custom drill import/export.
const D = require("../drills.js");
const S = require("../scales.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };

// The documented example imports cleanly
const example = D.FORMAT_DOC.split("## Example")[1].split("## Reports")[0];
const ex = D.parseImport(example);
check("doc example imports", ex.errors.length === 0 && ex.warnings.length === 0 && ex.drills.length === 1, ex);
const e = D.toExercise(ex.drills[0]);
check("example expands with repeat", e.notes.length === 12, e.notes.length);
check("example guide on B5", e.notes[1].guide && e.notes[1].guide.midi === 81 && e.notes[1].from.midi === 84, e.notes[1]);

// LLM-style wrapping: prose + ```json fence
check("fenced JSON", D.parseImport("Here you go:\n```json\n" + example + "\n```\nEnjoy!").drills.length === 1);

// Several drills at once
const two = D.parseImport(JSON.stringify({ drills: [ex.drills[0], { ...ex.drills[0], title: "Second" }] }));
check("drills list", two.drills.length === 2, two.errors);

// Mistakes produce specific errors
const bad = (drill, needle) => {
  const r = D.parseImport(JSON.stringify(drill));
  check(`error mentions ${needle}`, r.errors.some((m) => m.includes(needle)), r.errors);
};
const n = (note, string, finger, position) => ({ note, string, finger, position });
bad({ notes: [n("C6", "E", 1, 5), n("B5", "E", 2, 3)] }, ".title");
bad({ title: "x", notes: [n("H5", "E", 1, 5), n("B5", "E", 2, 3)] }, "isn't a note name");
bad({ title: "x", notes: [n("C6", "Q", 1, 5), n("B5", "E", 2, 3)] }, ".string");
bad({ title: "x", notes: [n("C6", "E", 1), n("B5", "E", 2, 3)] }, ".position");
bad({ title: "x", notes: [n("C4", "E", 1, 1), n("B5", "E", 2, 3)] }, "below the open E string");
bad({ title: "x", notes: [n("C6", "E", 1, 5), n("C6", "E", 3, 3)] }, "same pitch");
bad({ title: "x", notes: [n("C6", "E", 1, 5), n("B5", "E", 2, 3), n("C6", "E", 1, 5)], repeat: 2 }, "repeat loops back");
bad({ title: "x", notes: [n("C6", "E", 1, 5), n("B5", "E", 2, 3)], upAndBack: true, repeat: 2 }, "repeat loops back");
bad({ title: "x", notes: [n("A4", "A", 0), n("B5", "E", 2, 3)].map((x, i) => (i ? x : { ...x, note: "B4" })) }, "open A string");
bad({ title: "x", notes: [n("C6", "E", 1, 5), n("B5", "E", 2, 3)], bpm: 400 }, ".bpm");
bad({ title: "x", notes: [n("C6", "E", 1, 5), n("B5", "E", 2, 3)], notesPerBeat: 8 }, ".notesPerBeat");
const tempoDrill = D.parseImport(JSON.stringify({ title: "Fast", notes: [n("C6", "E", 1, 5), n("B5", "E", 2, 3)], bpm: 72, notesPerBeat: 2 }));
check("bpm and notesPerBeat kept", tempoDrill.drills[0].bpm === 72 && tempoDrill.drills[0].notesPerBeat === 2, tempoDrill);
check("bad JSON", D.parseImport("{ not json").errors[0].startsWith("That isn't valid JSON"));

// Finger/position that don't fit the note warn but still import
const w = D.parseImport(JSON.stringify({ title: "x", notes: [n("C6", "E", 1, 2), n("B5", "E", 2, 3)] }));
check("finger/position mismatch warns", w.drills.length === 1 && w.warnings.some((m) => m.includes("usually")), w);

// Open strings: finger 0, no position
const open = D.parseImport(JSON.stringify({ title: "Open", notes: [{ note: "A4", string: "A", finger: 0 }, n("B4", "A", 1, 1)] }));
check("open string", open.errors.length === 0 && D.toExercise(open.drills[0]).notes[0].pos === null, open);

// Every built-in drill in every setup exports and re-imports with the same notes and no warnings
let roundTrips = 0;
for (const type of Object.keys(S.SCALE_TYPES)) for (const tonic of S.SCALE_TYPES[type].keys)
  for (const strings of [["G", "D"], ["D", "A"], ["A", "E"]]) for (const positions of [[1, 3], [3, 5], [2, 6]]) {
    for (const drill of S.buildDrills({ tonic, type, strings, positions }).filter((x) => !x.hunt)) {
      const json = D.fromSequence(drill.name, drill.notes, { key: `${tonic} ${type}` });
      const r = D.parseImport(JSON.stringify(json));
      const back = r.drills.length ? D.toExercise(r.drills[0]).notes : [];
      const same = back.length === drill.notes.length && back.every((b, i) => b.midi === drill.notes[i].midi && b.string === drill.notes[i].string && b.finger === drill.notes[i].finger && b.pos === drill.notes[i].pos && (b.guide || {}).midi === (drill.notes[i].guide || {}).midi && Math.abs((b.beats || 0) - (drill.notes[i].beats || 0)) < 1e-6);
      if (r.errors.length || r.warnings.length || !same) { fails++; if (fails < 6) console.log(`FAIL round trip ${tonic} ${type} ${strings} ${positions} ${drill.id}`, r.errors.concat(r.warnings).slice(0, 2)); }
      roundTrips++;
    }
  }

// Drill packs: nothing locked; a miss stays, a pass moves on to the next drill short of 🥇, each lap a medal higher
{
  const ids = ["a", "b", "c"], P = 0.85, nx = (best, sel, last) => D.packNext(ids, best, sel, last, P);
  const eq = (name, got, want) => check(name, JSON.stringify(got) === JSON.stringify(want), got);
  eq("pack: fresh starts at the selected drill", nx({}, "b", null), { id: "b", tier: 1 });
  eq("pack: miss stays", nx({}, "a", { id: "a", score: 0.5, tier: 1 }), { id: "a", tier: 1, again: true });
  eq("pack: pass moves on", nx({ a: 1 }, "a", { id: "a", score: 0.9, tier: 1 }), { id: "b", tier: 1 });
  eq("pack: lap two aims higher", nx({ a: 1, b: 1, c: 1 }, "c", { id: "c", score: 0.9, tier: 1 }), { id: "a", tier: 2 });
  eq("pack: skips gold drills", nx({ a: 3, b: 3, c: 2 }, "a", { id: "a", score: 0.9, tier: 3 }), { id: "c", tier: 3 });
  eq("pack: picked by hand carries on from there", nx({ a: 1 }, "c", { id: "a", score: 0.9, tier: 1 }), { id: "c", tier: 1 });
  eq("pack: all gold", nx({ a: 3, b: 3, c: 3 }, "b", { id: "b", score: 0.9, tier: 3 }), { id: "b", tier: 3, done: true });
}
console.log(`round-tripped ${roundTrips} built-in drills`);
console.log(fails ? `${fails} failures` : "all pass");
process.exit(fails ? 1 : 0);
