// Run: node test/landing.test.js — checks where a note touched down, slides into it, corrections while it was held, and Place mode tries.
const L = require("../landing.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };

const DT = 1000 / 60; // the app analyses once per animation frame
// Frames from segments: [ms, cents or null (silence), endCents?] — endCents makes a straight glide; jitter ±2¢
function frames(target, segs, t0 = 0) {
  const out = [];
  let t = t0, k = 0;
  for (const [ms, c, c2] of segs) {
    const start = t;
    for (; t < start + ms; t += DT, k++) {
      if (c === null) { out.push({ t, m: null }); continue; }
      const p = c2 === undefined ? c : c + ((c2 - c) * (t - start)) / ms;
      out.push({ t, m: target + (p + (k % 3) - 1) / 100 });
    }
  }
  return out;
}
const A4 = 69, B4 = 71;

// Touchdown finds the note's first 80 ms
{
  const f = frames(A4, [[200, null], [100, -30], [100, -30, 0], [400, 0]]);
  const td = L.touchdown(f, A4, f[f.length - 1].t);
  check("touchdown at the onset", td && Math.abs(td.t - 200) < DT + 1, td);
  check("touchdown is where the finger landed", td && Math.abs(td.cents + 30) <= 3, td);
}
// The previous note ringing on isn't part of this one
{
  const f = [...frames(B4 - 2, [[300, 0]]), ...frames(B4, [[300, 12]], 300)];
  const td = L.touchdown(f, B4, 590, { prev: A4 });
  check("onset after the previous note", td && td.t >= 300 && Math.abs(td.cents - 12) <= 3, td);
}
// A short dropout (bow noise) doesn't restart the note; a lift does
{
  const f = frames(A4, [[100, -20], [30, null], [300, -20]]);
  check("2 silent frames keep the onset", Math.abs(L.touchdown(f, A4, f[f.length - 1].t).t) < 1);
  const g = frames(A4, [[100, -20], [120, null], [300, 5]]);
  const td = L.touchdown(g, A4, g[g.length - 1].t);
  check("a lift starts a new onset", td.t > 200 && Math.abs(td.cents - 5) <= 3, td);
}
check("too little sound: no touchdown", L.touchdown(frames(A4, [[30, 0]]), A4, 40) === null);

// Held: the end of the note
{
  const f = frames(A4, [[250, -25], [100, -25, 0], [300, 0]]);
  check("held is where it ended", Math.abs(L.held(f, A4, 0, 650)) <= 3, L.held(f, A4, 0, 650));
  check("held needs frames", L.held(f, A4, 640, 650) === null);
}

// Judge
{
  const slidIn = L.judge({ steady: -2, touch: -28, end: -1, shifted: false });
  check("slid in: scored where it landed", slidIn.cents === -28 && slidIn.fix !== null && slidIn.fix > 20, slidIn);
  const clean = L.judge({ steady: 4, touch: 6, end: 3, shifted: false });
  check("clean landing: no fix", clean.cents === 4 && clean.fix === null, clean);
  const shift = L.judge({ steady: 2, touch: -40, end: 2, shifted: true });
  check("a shift's slide isn't a correction", shift.cents === 2 && shift.fix === null, shift);
  const after = L.judge({ steady: -22, touch: -23, end: -3, shifted: false });
  check("corrected while held", after.cents === -22 && Math.round(after.fix) === 19, after);
  const shiftFix = L.judge({ steady: 25, touch: 25, end: 4, shifted: true });
  check("corrected after a shift", shiftFix.cents === 25 && shiftFix.fix === -21, shiftFix);
  const drift = L.judge({ steady: 2, touch: 2, end: 20, shifted: false });
  check("drifting away isn't a correction", drift.fix === null, drift);
  check("no touchdown: steady is scored", L.judge({ steady: 7, touch: null, end: null, shifted: false }).cents === 7);
}

// Place tries
{
  check("not judged before 320 ms", L.placeTry(frames(A4, [[100, null], [200, 0]]), A4) === null);
  const clean = L.placeTry(frames(A4, [[100, null], [400, 5]]), A4);
  check("clean try", clean && Math.abs(clean.cents - 5) <= 3 && clean.slide === null && clean.wrong === null, clean);
  const slid = L.placeTry(frames(A4, [[100, null], [90, -30], [120, -30, 0], [200, 0]]), A4);
  check("slid try", slid && Math.abs(slid.cents + 30) <= 4 && slid.slide > 20, slid);
  const wrong = L.placeTry(frames(A4, [[100, null], [400, 100]]), A4);
  check("wrong note", wrong && wrong.wrong === 70 && wrong.cents === null, wrong);
  const off = L.placeTry(frames(A4, [[400, -24]]), A4);
  check("off but steady: no slide", off && Math.abs(off.cents + 24) <= 3 && off.slide === null, off);
}

// The app's steady window (stableMedian in index.html: 220 ms, 80% within ±20¢ of the median) only settles once
// the slide is over, so it hears a quick fix as the corrected pitch. Touchdown keeps the landing.
{
  const steady = (f) => {
    for (const x of f) {
      const w = f.filter((y) => y.t > x.t - 220 && y.t <= x.t), v = w.filter((y) => y.m !== null).map((y) => y.m).sort((a, b) => a - b);
      if (x.t < 220 || w.length < 5 || v.length < w.length * 0.8) continue;
      const med = v[v.length >> 1];
      if (v.filter((m) => Math.abs(m - med) <= 0.2).length >= w.length * 0.8) return { t: x.t, cents: (med - A4) * 100 };
    }
    return null;
  };
  const f = frames(A4, [[120, -40], [60, -40, 0], [400, 0]]);
  const s = steady(f), td = L.touchdown(f, A4, s.t);
  check("steady window hears the corrected pitch", Math.abs(s.cents) < 15, s);
  check("touchdown keeps the landing", Math.abs(td.cents + 40) <= 3, td);
  const j = L.judge({ steady: s.cents, touch: td.cents, end: L.held(f, A4, s.t, f[f.length - 1].t), shifted: false });
  check("judged as landed −40¢, then fixed", Math.abs(j.cents + 40) <= 3 && j.fix > 30, j);
}

console.log(fails ? `landing: ${fails} failed` : "landing: all passed");
process.exit(fails ? 1 : 0);
