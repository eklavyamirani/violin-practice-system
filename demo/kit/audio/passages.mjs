// Scripted playing of the app's own drills, for walkthroughs: the notes come from curriculum.js, so a
// passage always matches the drill on screen. `detune` says how far off each note lands, in cents.
import { createRequire } from "node:module";
import path from "node:path";
import { render, writeWav } from "./synth.mjs";

const require = createRequire(import.meta.url);
const C = require("../../../curriculum.js");

/** The drill's notes, e.g. drillNotes("pattern:1:23", "asc_desc") → [{ midi, label, oct, string, finger }] */
export function drillNotes(nodeId, dir = "asc_desc") {
  const node = C.BY_ID[nodeId];
  if (!node) throw new Error(`No Path skill "${nodeId}" in curriculum.js.`);
  return C.drill(node, dir).notes.map(({ midi, label, oct, string, finger }) => ({ midi, label, oct, string, finger }));
}
export const drillId = (nodeId, dir = "asc_desc") => `n:${nodeId}@${dir}`;

/**
 * Write a WAV of the drill played with `detune(note, i)` cents on each note.
 * In Flow mode each note is scored where it first lands, so 0.75 s a note is a calm, steady pace.
 */
export function playDrill(file, nodeId, { dir = "asc_desc", detune = () => 0, sec = 0.75, leadIn = 1.2 } = {}) {
  const notes = drillNotes(nodeId, dir);
  const r = render(notes.map((n, i) => ({ midi: n.midi, cents: detune(n, i), sec })), { leadIn });
  writeWav(file, r.samples);
  return { file, notes: r.notes, seconds: r.seconds, playing: notes.length * (sec + 0.08) };
}

// The two standard inputs: in tune, and a high 2nd finger (every sharp lands about a third of a semitone high)
export const inTune = () => 0;
export const highSecondFinger = (n) => (n.label.includes("♯") && n.finger === "2" ? 32 : 0);

export const outPath = (outDir, name) => path.join(outDir, `${name}.wav`);

/**
 * Fix mode (watch-out-notes round 2): repetitions of one note, or of a move into it, each followed by a rest so
 * the app hears the bow stop. `reps` is a list of cents for the target; `breakAfter` puts a long rest after
 * that many repetitions (the app's 10-second microbreak, while it ignores the microphone).
 */
export function playFix(file, target, { from = null, reps, breakAfter = 4, breakSec = 10.8, sec = 0.8, rest = 0.6, missRest = rest, leadIn = 1.2 } = {}) {
  const passage = [];
  reps.forEach((cents, i) => {
    if (from) passage.push({ midi: from.midi, cents: 0, sec: 0.7 });
    passage.push({ midi: target.midi, cents, sec });
    passage.push({ rest: i + 1 === breakAfter ? breakSec : Math.abs(cents) >= 20 ? missRest : rest });
  });
  const r = render(passage, { leadIn });
  writeWav(file, r.samples);
  return { file, notes: r.notes, seconds: r.seconds };
}
