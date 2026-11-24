// Violin-like notes whose pitch can move, for checks of how a finger lands (demo/test/landing.mjs, fix-mode.mjs).
// passage: [{ midi, cents, sec, path: [[ms, cents], ...] }] or { rest: sec }. path gives the pitch over time
// (straight lines between points); without it the note stays at `cents`. Returns the samples.
import { SAMPLE_RATE, midiFreq } from "./synth.mjs";

const AMPS = [0.6, 1.0, 0.5, 0.35, 0.25, 0.15];
export function renderGlides(passage, { leadIn = 1.5, tail = 20, gap = 0.08, level = 0.18 } = {}) {
  let total = leadIn;
  const segs = passage.map((n) => { const s = { ...n, at: total }; total += (n.rest ?? n.sec) + (n.rest ? 0 : gap); return s; });
  total += tail;
  const out = new Float32Array(Math.ceil(total * SAMPLE_RATE));
  let seed = 1;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (const n of segs) {
    if (n.rest) continue;
    const pts = n.path || [[0, n.cents || 0]], start = Math.floor(n.at * SAMPLE_RATE), len = Math.floor(n.sec * SAMPLE_RATE);
    const centsAt = (ms) => { let i = 0; while (i + 1 < pts.length && pts[i + 1][0] <= ms) i++; const [t0, c0] = pts[i], nx = pts[i + 1]; return nx ? c0 + ((nx[1] - c0) * (ms - t0)) / (nx[0] - t0) : c0; };
    const ph = new Array(AMPS.length).fill(0), atk = 0.04 * SAMPLE_RATE, rel = 0.06 * SAMPLE_RATE;
    for (let i = 0; i < len; i++) {
      const f = midiFreq(n.midi + centsAt((i / SAMPLE_RATE) * 1000) / 100), env = Math.min(1, i / atk, (len - i) / rel);
      let v = 0;
      for (let h = 0; h < AMPS.length; h++) { ph[h] += (2 * Math.PI * f * (h + 1)) / SAMPLE_RATE; v += AMPS[h] * Math.sin(ph[h] + h); }
      out[start + i] += level * env * v + 0.004 * (rnd() * 2 - 1);
    }
  }
  return out;
}
