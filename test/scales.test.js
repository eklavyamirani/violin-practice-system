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
eq("G down pairs E", seq(byId(g, "down-E")).slice(0, 2).concat(byId(g, "down-E").frame), ["C6:E1@5", "A5:E1@3", "5th ⇣ 3rd: 1→1 2→2 1→2 3→3"]);
eq("G down pair guide", byId(g, "down-E").notes.filter((n) => n.guide).map((n) => `${n.label}${n.oct} via ${n.guide.label}${n.guide.oct}`), ["B5 via A5", "B5 via A5"]);
eq("G from the top", seq(byId(g, "down-run")).slice(0, 7), ["G6:E4x@5", "F♯6:E4@5", "E6:E3@5", "D6:E2@5", "C6:E1@5", "B5:E2@3", "A5:E1@3"]);
eq("G shift drill comes down with a guide", byId(g, "shift").notes.filter((n) => n.shift).map((n) => n.shift + (n.guide ? ":" + n.guide.label : "")), ["up", "down:A"]);

// Spelling: flats, sharps, harmonic minor's raised 7th
eq("Bb major 1st pos A", S.buildDrills({ tonic: "Bb", type: "major", strings: ["A", "E"], positions: [1, 3] })[0].notes.slice(0, 4).map((n) => n.label + n.oct), ["B♭4", "C5", "D5", "E♭5"]);
const dh = S.buildDrills({ tonic: "D", type: "harmonic", strings: ["A", "E"], positions: [1, 3] });
eq("D harmonic 1st E", byId(dh, "p1-E").notes.slice(0, 4).map((n) => n.label), ["F", "G", "A", "B♭"]);
eq("D harmonic 1st A", byId(dh, "p1-A").frame, "1 ⟷ 2‿3 — 4"); // B♭–C♯ augmented 2nd
eq("C# harmonic minor has B#", S.spell("C#", S.SCALE_TYPES.harmonic).acc[6], 1); // B♯ in C♯ harmonic minor

// Melodic minor: raised going up, natural coming down
const am = S.buildDrills({ tonic: "A", type: "melodic", strings: ["A", "E"], positions: [3, 5] });
eq("A melodic 3rd A up/down", byId(am, "p3-A").notes.map((n) => n.label), ["D", "E", "F♯", "G♯", "F", "E", "D"]);

// One position, open strings: the classic two-octave G major in 1st position
const g1 = S.buildDrills({ tonic: "G", type: "major", strings: ["G", "D", "A", "E"], positions: [1] });
eq("G 1st scale", byId(g1, "scale").name, "G3→G5 in 1st position");
eq("G 1st scale up", seq(byId(g1, "scale")).slice(0, 9), ["G3:G0@null", "A3:G1@1", "B3:G2@1", "C4:G3@1", "D4:D0@null", "E4:D1@1", "F♯4:D2@1", "G4:D3@1", "A4:A0@null"]);
eq("G 1st has no shifting", g1.filter((d) => d.group === "Shifting down" || (d.notes || []).some((n) => n.shift)).length, 0);
eq("G 1st all-strings drill", byId(g1, "p1-GDAE").name, "G + D + A + E strings");
// One position, no tonic octave fits: no duplicate of the string-crossing drill
eq("G 3rd A·E no scale", S.buildDrills({ tonic: "G", type: "major", strings: ["A", "E"], positions: [3] }).some((d) => d.id === "scale"), false);
eq("D 3rd A·E scale", seq(byId(S.buildDrills({ tonic: "D", type: "major", strings: ["A", "E"], positions: [3] }), "scale")).slice(0, 8),
  ["D5:A1@3", "E5:A2@3", "F♯5:A3@3", "G5:A4@3", "A5:E1@3", "B5:E2@3", "C♯6:E3@3", "D6:E4@3"]);
// Three positions: three octaves with two shifts, and down-shift pairs for each neighbouring pair
const g135 = S.buildDrills({ tonic: "G", type: "major", strings: ["G", "D", "A", "E"], positions: [1, 3, 5] });
eq("G 1-3-5 run", byId(g135, "shift").name, "G3→G6 with 2 shifts");
eq("G 1-3-5 shifts", byId(g135, "shift").notes.filter((n) => n.shift).map((n) => `${n.shift}${n.pos}`), ["up3", "up5", "down3", "down1"]);
eq("G 1-3-5 down pairs", g135.filter((d) => d.group === "Shifting down").map((d) => d.id), ["down-3-1-D", "down-5-3-E", "down-run"]);
// A shift never leaves from an open string (the hand has nothing to slide on)
eq("A 1-3 shift", byId(S.buildDrills({ tonic: "A", type: "major", strings: ["A", "E"], positions: [1, 3] }), "shift").frame, "1st: 0 1 2 ⇡ 3rd: 1 2 3 4 1");
// Fallback span: open G isn't in E major, so start from the 1st finger
eq("E major G·D 1-3 run", byId(S.buildDrills({ tonic: "E", type: "major", strings: ["G", "D"], positions: [1, 3] }), "shift").notes[0].label, "A");

// Config tidying and labels
eq("normalize", S.normalizeCfg({ tonic: "G", type: "major", strings: ["E", "D"], positions: [5, 1, 3, 3, 9] }), { tonic: "G", type: "major", strings: ["D", "A", "E"], positions: [1, 3, 5] });
eq("normalize empty positions", S.normalizeCfg({ tonic: "Q", type: "natural", strings: ["A"], positions: [] }), { tonic: "A", type: "natural", strings: ["A"], positions: [1] });
eq("label", S.cfgLabel({ tonic: "Bb", type: "major", strings: ["G", "D", "A", "E"], positions: [1, 3, 5] }), "B♭ major · 1st, 3rd & 5th position · G–E strings");
eq("label 2", S.cfgLabel({ tonic: "G", type: "major", strings: ["A", "E"], positions: [3, 5] }), "G major · 3rd & 5th position · A & E strings");
eq("label 1", S.cfgLabel({ tonic: "G", type: "major", strings: ["E"], positions: [3] }), "G major · 3rd position · E string");

// Every config yields sane drills: fingers step up, shifts found where possible
let noShift = [];
const STRING_SETS = [["G", "D"], ["D", "A"], ["A", "E"], ["E"], ["G", "D", "A"], ["D", "A", "E"], ["G", "D", "A", "E"]];
const POSITION_SETS = [[1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [1, 5], [1], [3], [5], [1, 3, 5], [2, 3, 5], [1, 2, 3, 4]];
for (const type of Object.keys(S.SCALE_TYPES)) for (const tonic of S.SCALE_TYPES[type].keys)
  for (const strings of STRING_SETS) for (const positions of POSITION_SETS) {
    const ds = S.buildDrills({ tonic, type, strings, positions });
    const where = `${tonic} ${type} ${strings.join("")} ${positions}`;
    for (const d of ds.filter((x) => !x.hunt)) {
      const up = d.notes.slice(0, Math.ceil(d.notes.length / 2));
      if (d.group !== "Shifting down" && up.some((n, i) => i && n.midi <= up[i - 1].midi)) { fails++; console.log(`FAIL non-ascending ${where} ${d.id}`); }
      if (up.some((n) => (n.finger === "0" ? n.midi !== S.STRINGS[n.string].midi || !positions.includes(1) : n.midi <= S.STRINGS[n.string].midi))) { fails++; console.log(`FAIL at/below open string ${where} ${d.id}`); }
      if (d.notes.some((n) => !strings.includes(n.string) || (n.pos && !positions.includes(n.pos)))) { fails++; console.log(`FAIL outside the setup ${where} ${d.id}`); }
      // the engine advances on a change of pitch, so a note may never repeat the one before it
      if (d.notes.some((n, i) => i && n.midi === d.notes[i - 1].midi)) { fails++; console.log(`FAIL repeated note ${where} ${d.id}`); }
      if (d.notes.some((n) => n.shift && !(n.from && n.from.pos))) { fails++; console.log(`FAIL shift from an open string ${where} ${d.id}`); }
      for (const n of d.notes.filter((x) => x.guide))
        if (!(n.shift === "down" && n.guide.midi < n.midi && n.guide.string === n.string && n.guide.pos === n.pos)) { fails++; console.log(`FAIL bad guide ${where} ${d.id}`); }
    }
    if (new Set(ds.map((d) => d.id)).size !== ds.length) { fails++; console.log(`FAIL duplicate drill ids ${where}`); }
    if (positions.length === 1) continue;
    const run = ds.find((d) => d.id === "shift");
    if (!run) { noShift.push(where); continue; }
    if (run.notes.filter((n) => n.shift === "up").length !== positions.length - 1) { fails++; console.log(`FAIL run doesn't visit every position ${where}`); }
    for (let i = 0; i + 1 < positions.length; i++)
      if (!ds.some((d) => d.group === "Shifting down" && d.id !== "down-run" && d.frame.startsWith(`${S.ordinal(positions[i + 1])} ⇣ ${S.ordinal(positions[i])}`) && d.notes.filter((n) => n.shift === "down").length >= 6)) { fails++; console.log(`FAIL no down-shift pairs ${where} ${positions[i + 1]}→${positions[i]}`); }
    if (positions.length === 2 && strings.length <= 2) for (const s of strings) if (!ds.some((d) => d.id === `down-${s}`)) { fails++; console.log(`FAIL no down-shift pairs ${where} ${s}`); }
    if (!ds.some((d) => d.id === "down-run")) { fails++; console.log(`FAIL no from-the-top run ${where}`); }
  }
console.log(`multi-position configs without a shift run: ${noShift.length}`, noShift.slice(0, 8));
console.log(fails ? `${fails} failures` : "all pass");
process.exit(fails ? 1 : 0);
