// Run: node test/scales.test.js — checks scale spelling and generated fingerings.
const S = require("../scales.js");
let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { fails++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};
const seq = (d) => d.notes.map((n) => `${n.label}${n.oct}:${n.string}${n.finger}@${n.pos}`);
const byId = (ds, id) => ds.find((d) => d.id === id);

// G major, A & E, 3rd & 5th must match the original hand-written drills
const g = S.buildDrills({ tonic: "G", type: "major", strings: ["A", "E"], positions: [3, 5] });
eq("G 3rd A", byId(g, "p3-A").notes.map((n) => n.midi), [74, 76, 78, 79, 78, 76, 74]);
eq("G 3rd E", byId(g, "p3-E").notes.map((n) => n.midi), [81, 83, 84, 86, 84, 83, 81]);
eq("G 5th A", byId(g, "p5-A").notes.map((n) => n.midi), [78, 79, 81, 83, 81, 79, 78]);
eq("G 5th E", byId(g, "p5-E").notes.map((n) => n.midi), [84, 86, 88, 90, 88, 86, 84]);
eq("G frames", ["p3-A", "p3-E", "p5-A", "p5-E"].map((id) => byId(g, id).frame), ["1 — 2 — 3‿4", "1 — 2‿3 — 4", "1‿2 — 3 — 4", "1 — 2 — 3 — 4"]);
eq("G shift", seq(byId(g, "shift")).slice(0, 8), ["G5:A4@3", "A5:E1@3", "B5:E2@3", "C6:E1@5", "D6:E2@5", "E6:E3@5", "F♯6:E4@5", "G6:E4x@5"]);
eq("G shift name", byId(g, "shift").name, "G5→G6 with a shift");

// Spelling: flats, sharps, harmonic minor's raised 7th
eq("Bb major 1st pos A", S.buildDrills({ tonic: "Bb", type: "major", strings: ["A", "E"], positions: [1, 3] })[0].notes.slice(0, 4).map((n) => n.label + n.oct), ["B♭4", "C5", "D5", "E♭5"]);
const dh = S.buildDrills({ tonic: "D", type: "harmonic", strings: ["A", "E"], positions: [1, 3] });
eq("D harmonic 1st E", byId(dh, "p1-E").notes.slice(0, 4).map((n) => n.label), ["F", "G", "A", "B♭"]);
eq("D harmonic 1st A", byId(dh, "p1-A").frame, "1 ⟷ 2‿3 — 4"); // B♭–C♯ augmented 2nd
eq("C# harmonic minor has B#", S.spell("C#", S.SCALE_TYPES.harmonic).acc[6], 1); // B♯ in C♯ harmonic minor

// Melodic minor: raised going up, natural coming down
const am = S.buildDrills({ tonic: "A", type: "melodic", strings: ["A", "E"], positions: [3, 5] });
eq("A melodic 3rd A up/down", byId(am, "p3-A").notes.map((n) => n.label), ["D", "E", "F♯", "G♯", "F", "E", "D"]);

// Every config yields sane drills: fingers step up, shifts found where possible
let noShift = [];
for (const type of Object.keys(S.SCALE_TYPES)) for (const tonic of S.SCALE_TYPES[type].keys)
  for (const strings of [["G", "D"], ["D", "A"], ["A", "E"]]) for (const positions of [[1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [1, 5]]) {
    const ds = S.buildDrills({ tonic, type, strings, positions });
    for (const d of ds.filter((x) => !x.hunt)) {
      const up = d.notes.slice(0, Math.ceil(d.notes.length / 2));
      if (up.some((n, i) => i && n.midi <= up[i - 1].midi)) { fails++; console.log(`FAIL non-ascending ${tonic} ${type} ${strings} ${positions} ${d.id}`); }
      if (up.some((n) => n.midi <= S.STRINGS[n.string].midi)) { fails++; console.log(`FAIL at/below open string ${tonic} ${type} ${d.id}`); }
    }
    if (!ds.some((d) => d.id === "shift")) noShift.push(`${tonic} ${type} ${strings.join("")} ${positions}`);
  }
console.log(`configs without a shift drill: ${noShift.length}`, noShift.slice(0, 8));
console.log(fails ? `${fails} failures` : "all pass");
process.exit(fails ? 1 : 0);
