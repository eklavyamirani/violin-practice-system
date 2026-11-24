// Run: node test/context.test.js — checks intonation by context: going up vs coming down, after shifts, after frame changes.
const C = require("../context.js");
const S = require("../scales.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };

const n = (midi, cents, extra = {}) => ({ midi, cents, string: "A", finger: "1", pos: 1, shift: null, ...extra });

// Direction: only notes heard both ways count
{
  const up = [69, 71, 73, 74, 76], seq = [...up, ...up.slice(0, -1).reverse()];
  const notes = seq.map((m, i) => n(m, i < up.length ? 2 : 16));
  const d = C.direction(notes);
  check("paired spots", d.spots === 3, d); // 71, 73, 74 both ways; 69 has no direction going up, 76 only up
  check("coming down sharper", d.diff >= 13 && d.up === 2 && d.down === 16, d);
  check("no pairs, no answer", C.direction([n(69, 0), n(71, 0), n(73, 0)]) === null);
  const gap = (t2) => [n(69, 0, { t: 0 }), n(71, 0, { t: 100 }), n(73, 0, { t: 200 }), n(71, 9, { t: t2 })];
  check("joined notes have a direction", C.direction(gap(300)).spots === 1);
  check("a long gap breaks the direction", C.direction(gap(5000)) === null);
}

// After a shift: landing, then the next notes in the new position
{
  const notes = [n(69, 0, { pos: null, finger: "0" }), n(71, 1), n(73, 2), n(74, 3, { pos: 3, shift: "up" }), n(76, -15, { pos: 3, finger: "2" }), n(78, -17, { pos: 3, finger: "3" }), n(79, -14, { pos: 3, finger: "4" }), n(81, -12, { pos: 3, finger: "4x" })];
  const s = C.afterShift(notes);
  check("landing", s.up.landing.n === 1 && s.up.landing.mean === 3, s.up);
  check("3 after", s.up.after.n === 3 && s.up.after.mean < -14, s.up);
  check("rest: stopped notes outside, not open strings", s.rest.n === 3 && s.rest.mean === -3, s.rest); // 71, 73 and the 4x (the 4th note after)
  check("no down shifts", s.down.landing === null && s.down.after === null);
  check("no shifts: null", C.afterShift([n(69, 0), n(71, 0)]) === null);
}

// Frame events
{
  const keyG = C.keyPcs([S.spell("G", S.SCALE_TYPES.major).acc]);
  const ev = C.frameEvents([n(76, 0, { string: "E", finger: "0", pos: null }), n(77, 0, { string: "E", finger: "1", letter: "F" }), n(79, 0, { string: "E", finger: "2" })], keyG);
  check("F natural in G major is an accidental, low", ev.length === 1 && ev[0].why[0] === "accidental" && ev[0].lowered === true, ev);
  const moved = C.frameEvents([n(73, 0, { finger: "2" }), n(74, 0, { finger: "3" }), n(72, 0, { finger: "2" }), n(73, 0, { finger: "2" })], null);
  check("a finger off its usual spot", moved.length === 1 && moved[0].i === 2 && moved[0].why[0] === "moved" && moved[0].lowered === true, moved);
  check("E♯ in F♯ major sits high", C.frameEvents([n(77, 0, { letter: "E" })], C.keyPcs([S.spell("F#", S.SCALE_TYPES.major).acc]))[0] === undefined);
  check("B♮ in F major sits high", C.frameEvents([n(71, 0, { letter: "B" })], C.keyPcs([S.spell("F", S.SCALE_TYPES.major).acc]))[0].lowered === false);
  check("unspelled: by neighbours", C.frameEvents([n(71, 0)], C.keyPcs([S.spell("F", S.SCALE_TYPES.major).acc]))[0].lowered === null);
  check("stretch", C.frameEvents([n(81, 0, { finger: "4x" })], null)[0].why[0] === "stretch");
  const mel = C.keyPcs([S.spell("A", S.SCALE_TYPES.melodic).acc, S.spell("A", S.SCALE_TYPES.natural).acc]);
  check("melodic minor: both 6ths and 7ths are in the key", [77, 78, 79, 80].every((m) => mel.has(m % 12)));
}

// After a frame change: compared with the same notes elsewhere
{
  const E = (midi, cents, finger, extra = {}) => n(midi, cents, { string: "E", finger, ...extra });
  const keyD = C.keyPcs([S.spell("D", S.SCALE_TYPES.major).acc]);
  // E F# G A, then E F(natural) G A: after the F natural, G and A sag
  const notes = [E(76, 0, "0", { pos: null }), E(78, 2, "1"), E(79, 1, "2"), E(81, 0, "3"), E(76, 0, "0", { pos: null }), E(77, -3, "1"), E(79, -18, "2"), E(81, -20, "3")];
  const af = C.afterFrame(notes, keyD);
  check("one event with deltas", af.length === 1 && af[0].why.includes("accidental") && af[0].deltas.length === 2, af);
  check("deltas against the same notes", af[0].deltas.every((d) => d.delta <= -19), af[0].deltas);
  // The stretch at the top of a scale is followed by notes only heard coming down: nothing to compare with
  const top = [n(76, 0, { finger: "1" }), n(78, 0, { finger: "2" }), n(80, 0, { finger: "3" }), n(81, 0, { finger: "4x" }), n(80, 12), n(78, 12, { finger: "2" })];
  check("no same-direction baseline: nothing claimed", C.afterFrame(top, null).length === 0, C.afterFrame(top, null));
}

console.log(fails ? `context: ${fails} failed` : "context: all passed");
process.exit(fails ? 1 : 0);
