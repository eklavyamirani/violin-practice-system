// Run: node test/staff.test.js — checks the treble staff: note placement, key signatures, accidentals and ledger lines.
const St = require("../staff.js"), S = require("../scales.js");
let fails = 0;
const eq = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { fails++; console.log(`FAIL ${name}\n  got  ${g}\n  want ${w}`); }
};
const sig = (tonic, type) => S.spell(tonic, S.SCALE_TYPES[type === "major" ? "major" : "natural"]).acc;
const sigText = (acc) => St.signature(acc).map((a) => "CDEFGAB"[a.letter] + (a.acc > 0 ? "♯" : "♭") + "@" + a.step);
const N = (txt) => { const m = txt.match(/^([A-G])(♯|♭|𝄪|𝄫)?(\d)$/); return { label: m[1] + (m[2] || ""), oct: +m[3] }; };

eq("E4 is the bottom line, F5 the top", [St.parse(N("E4")).step, St.parse(N("F5")).step], [30, 38]);
eq("B♭4 sits on the middle line", St.parse(N("B♭4")), { letter: 6, acc: -1, step: 34 });
// B♯ and C♭ are written in the octave of their letter, the way scales.js spells them
eq("B♯ written octave", St.parse({ label: "B♯", oct: 4 }).step, 34);

eq("G major: F♯ on the top line", sigText(sig("G", "major")), ["F♯@38"]);
eq("D major", sigText(sig("D", "major")), ["F♯@38", "C♯@35"]);
eq("E♭ major", sigText(sig("Eb", "major")), ["B♭@34", "E♭@37", "A♭@33"]);
eq("C♯ minor uses the natural-minor signature (E major's)", sigText(sig("C#", "harmonic")), ["F♯@38", "C♯@35", "G♯@39", "D♯@36"]);
eq("A minor has none", sigText(sig("A", "natural")), []);
eq("F♯ major: six sharps", sigText(sig("F#", "major")).length, 6);

// Every built drill: notes that match the key signature carry no accidental
for (const [tonic, type] of [["G", "major"], ["Bb", "major"], ["E", "natural"]]) {
  const ds = S.buildDrills({ tonic, type, strings: ["G", "D", "A", "E"], positions: [1, 3, 5] });
  const shift = ds.find((d) => d.id === "shift");
  eq(`${tonic} ${type}: no accidentals in the scale`, St.accidentals(shift.notes, sig(tonic, type)).filter((a) => a !== null), []);
}

// A melodic minor: G♯ and F♯ going up, courtesy naturals coming down
const am = S.buildDrills({ tonic: "A", type: "melodic", strings: ["A", "E"], positions: [1] }).find((d) => d.id === "p1-AE");
const shown = (notes, acc) => notes.map((n, i) => (acc[i] === null ? "" : `${n.label}${n.oct}:${acc[i]}`)).filter(Boolean);
eq("A melodic minor", shown(am.notes, St.accidentals(am.notes, sig("A", "melodic"))), ["F♯5:1", "G♯5:1", "G5:0", "F5:0"]);

// D harmonic minor: C♯ against the B♭ signature, shown every time (no barlines to carry it)
const dh = ["D5", "E5", "F5", "G5", "A5", "B♭5", "C♯6", "D6", "C♯6", "B♭5"].map(N);
eq("D harmonic minor", shown(dh, St.accidentals(dh, sig("D", "harmonic"))), ["C♯6:1", "C♯6:1"]);
const back = ["C♯5", "C5", "C♯5", "C♯4"].map(N);
eq("courtesy back to the signature, per line", St.accidentals(back, sig("D", "natural")), [1, 0, 1, 1]);
eq("no key: naturals plain, accidentals shown", St.accidentals(["F5", "F♯5", "F5", "B♭4"].map(N), null), [null, 1, 0, -1]);

// Ledger lines: G3 has two below (C4, A3), A5 one above, B6 five above; the staff makes room
const ll = (txt) => (St.render([N(txt)]).body.match(/class="ll"/g) || []).length;
eq("ledger lines", ["G3", "C4", "D4", "F5", "A5", "C6", "B6"].map(ll), [2, 1, 0, 0, 1, 2, 5]);
const tall = St.render(["G3", "B6"].map(N)), short = St.render(["G4"].map(N));
eq("staff grows to fit", tall.height > short.height, true);
eq("note centres step evenly", [tall.x(1) - tall.x(0) > 0, tall.width > tall.x(1)], [true, true]);
eq("key signature drawn in the head", (St.render([N("G4")], { sigAcc: sig("D", "major") }).head.match(/<path/g) || []).length, 3);

if (fails) { console.log(`${fails} failed`); process.exit(1); }
console.log("staff: all passed");
