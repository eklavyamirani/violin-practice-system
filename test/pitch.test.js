// Run: node test/pitch.test.js — synthesizes violin-like tones and checks detection accuracy.
const { detectPitch, freqToMidi, midiToFreq } = require("../pitch.js");
const sr = 48000, N = 2048;

// Sawtooth-ish tone with a strong 2nd harmonic (violins often have a louder 2nd than 1st)
function tone(freq, cents, noise = 0.02) {
  const f = freq * Math.pow(2, cents / 1200);
  const amps = [0.6, 1.0, 0.5, 0.35, 0.25, 0.15];
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let s = 0;
    amps.forEach((a, h) => (s += a * Math.sin(2 * Math.PI * f * (h + 1) * i / sr + h)));
    buf[i] = 0.2 * s + noise * (Math.random() * 2 - 1);
  }
  return buf;
}

let fails = 0, worst = 0;
// Every semitone from A3 (G string, 1st position) to B6 (E string, 7th position),
// with the detector range narrowed around each note the way the app does for a drill
for (let midi = 57; midi <= 95; midi++) {
  const hz = midiToFreq(midi), range = { minFreq: Math.min(500, hz * 0.8), maxFreq: Math.max(1800, hz * 1.25) };
  for (const cents of [-40, -15, 0, 12, 33]) {
    const { freq } = detectPitch(tone(hz, cents), sr, range);
    const got = freq ? (freqToMidi(freq) - midi) * 100 : NaN;
    const err = Math.abs(got - cents);
    worst = Math.max(worst, err || 999);
    if (!(err < 3)) { fails++; console.log(`FAIL midi ${midi} ${cents}c -> ${got.toFixed(1)}c`); }
  }
}
// Piece mode listens across all four strings at once (G3 to D7) with one wide range
for (const amps of [[0.6, 1.0, 0.5, 0.35, 0.25, 0.15], [0.25, 1.0, 0.7, 0.4, 0.3, 0.2]]) {
  for (let midi = 55; midi <= 98; midi++) for (const cents of [-30, 0, 20]) {
    const f = midiToFreq(midi) * Math.pow(2, cents / 1200), buf = new Float32Array(N);
    for (let i = 0; i < N; i++) { let s = 0; amps.forEach((a, h) => (s += a * Math.sin(2 * Math.PI * f * (h + 1) * i / sr + h))); buf[i] = 0.2 * s + 0.02 * (Math.random() * 2 - 1); }
    const { freq } = detectPitch(buf, sr, { minFreq: 180, maxFreq: 2700 });
    const got = freq ? (freqToMidi(freq) - midi) * 100 : NaN;
    if (!(Math.abs(got - cents) < 3)) { fails++; console.log(`FAIL wide range midi ${midi} ${cents}c -> ${got.toFixed(1)}c`); }
  }
}
const silent = detectPitch(new Float32Array(N).map(() => 0.002 * (Math.random() - 0.5)), sr);
if (silent.freq !== 0) { fails++; console.log("FAIL silence detected as pitch"); }
console.log(fails ? `${fails} failures` : `all pass, worst error ${worst.toFixed(2)} cents`);
process.exit(fails ? 1 : 0);
