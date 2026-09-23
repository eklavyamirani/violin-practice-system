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
      const same = back.length === drill.notes.length && back.every((b, i) => b.midi === drill.notes[i].midi && b.string === drill.notes[i].string && b.finger === drill.notes[i].finger && b.pos === drill.notes[i].pos && (b.guide || {}).midi === (drill.notes[i].guide || {}).midi);
      if (r.errors.length || r.warnings.length || !same) { fails++; if (fails < 6) console.log(`FAIL round trip ${tonic} ${type} ${strings} ${positions} ${drill.id}`, r.errors.concat(r.warnings).slice(0, 2)); }
      roundTrips++;
    }
  }
console.log(`round-tripped ${roundTrips} built-in drills`);
console.log(fails ? `${fails} failures` : "all pass");
process.exit(fails ? 1 : 0);
