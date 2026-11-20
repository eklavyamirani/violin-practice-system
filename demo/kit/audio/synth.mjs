// Scripted microphone input for violin demos: a passage of violin-like notes, each at a chosen number of
// cents off, written as a 16-bit mono WAV that Chromium plays as its fake microphone
// (--use-file-for-fake-audio-capture). No recordings of anyone's playing: every sample is made here.
//
// The tone is the same harmonic mix the app's own pitch tests use (a strong 2nd harmonic, as violins often
// have), with a short bow attack, a gentle release and a little noise, so the app's detector hears it as
// it hears a violin.
import fs from "node:fs";

export const SAMPLE_RATE = 48000;
const AMPS = [0.6, 1.0, 0.5, 0.35, 0.25, 0.15];
export const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

/**
 * passage: [{ midi, cents = 0, sec = 0.75 }] or { rest: sec }.
 * leadIn: silence before the first note (Chromium starts the file when the page opens the mic).
 * tail: silence after the last note, so the file doesn't loop back into the passage during a recording.
 */
export function render(passage, { leadIn = 1.5, tail = 30, gap = 0.08, level = 0.18, seed = 1 } = {}) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const segs = [];
  let total = leadIn;
  for (const n of passage) { const sec = n.rest ?? n.sec ?? 0.75; segs.push({ ...n, at: total, sec }); total += sec + (n.rest ? 0 : gap); }
  total += tail;
  const out = new Float32Array(Math.ceil(total * SAMPLE_RATE));
  for (const n of segs) {
    if (n.rest) continue;
    const f = midiFreq(n.midi + (n.cents || 0) / 100), start = Math.floor(n.at * SAMPLE_RATE), len = Math.floor(n.sec * SAMPLE_RATE);
    const atk = 0.04 * SAMPLE_RATE, rel = 0.06 * SAMPLE_RATE;
    for (let i = 0; i < len; i++) {
      const env = Math.min(1, i / atk, (len - i) / rel);
      let v = 0;
      for (let h = 0; h < AMPS.length; h++) v += AMPS[h] * Math.sin((2 * Math.PI * f * (h + 1) * i) / SAMPLE_RATE + h);
      out[start + i] += level * env * v + 0.004 * (rnd() * 2 - 1);
    }
  }
  return { samples: out, seconds: total, notes: segs.filter((n) => !n.rest).map(({ midi, cents = 0, at, sec }) => ({ midi, cents, at, sec })) };
}

export function writeWav(file, samples, rate = SAMPLE_RATE) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write("RIFF", 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write("WAVE", 8);
  buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write("data", 36); buf.writeUInt32LE(samples.length * 2, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  fs.writeFileSync(file, buf);
}
