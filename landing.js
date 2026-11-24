// How a finger arrived on a note: where it first touched down, and whether it then slid or was adjusted.
// "Score the first landing" means the pitch the finger made when it went down, not the pitch it was moved to.
// A steady-window median alone can't tell: a finger that lands 30¢ flat and slides up within ~0.2 s is
// mostly heard at the corrected pitch. This looks at the first ~80 ms of the note instead, and at where
// the note ended up while it was held.
// Pure logic. Works in the browser (window.Landing) and in Node (module.exports) for testing.
(function (root) {
  "use strict";

  // SLIDE: movement (¢) that counts as moving the finger. Bow changes and a steady finger stay well inside it;
  // it is the 🥈 window, so a slide this size can turn a miss into a pass. Starting default, not a published norm.
  const SLIDE = 15, TOUCH_MS = 80, HELD_MS = 150, CAPTURE = 60, GAP_FRAMES = 2;

  const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  // A frame belongs to the target: pitched, within capture, and nearer the target than the previous note
  const near = (f, target, prev, capture) => f.m !== null && Math.abs(f.m - target) * 100 <= capture && !(prev !== null && prev !== undefined && Math.abs(f.m - prev) < Math.abs(f.m - target));

  // Index of the first frame of the unbroken stretch on the target that is sounding at time `at`.
  // A few unpitched frames (bow noise) don't break it; more than GAP_FRAMES in a row do (the finger or bow came off).
  function onsetIndex(frames, target, at, opts = {}) {
    const capture = opts.capture ?? CAPTURE, prev = opts.prev ?? null;
    let i = frames.length - 1;
    while (i >= 0 && frames[i].t > at) i--;
    while (i >= 0 && !near(frames[i], target, prev, capture)) i--;
    if (i < 0) return -1;
    let first = i, gap = 0;
    for (let j = i - 1; j >= 0; j--) {
      const f = frames[j];
      if (opts.notBefore !== undefined && f.t < opts.notBefore) break;
      if (near(f, target, prev, capture)) { first = j; gap = 0; }
      else if (f.m === null && ++gap <= GAP_FRAMES) continue;
      else break;
    }
    return first;
  }

  // Where the finger touched down: the median of the first TOUCH_MS of the note (skipping the very first frame,
  // which straddles the attack). → { t, cents } or null when there are too few frames to tell.
  function touchdown(frames, target, at, opts = {}) {
    const i = onsetIndex(frames, target, at, opts);
    if (i < 0) return null;
    const capture = opts.capture ?? CAPTURE, prev = opts.prev ?? null, t0 = frames[i].t;
    const w = frames.filter((f) => f.t >= t0 && f.t < t0 + TOUCH_MS && f.t <= at && near(f, target, prev, capture)).map((f) => f.m);
    if (w.length < 3) return null;
    return { t: t0, cents: (median(w.length >= 4 ? w.slice(1) : w) - target) * 100 };
  }

  // Where the note ended up: the median of its last HELD_MS before `to`, counting only frames after `from`.
  function held(frames, target, from, to, opts = {}) {
    const capture = opts.capture ?? CAPTURE;
    const w = frames.filter((f) => f.t >= Math.max(from, to - HELD_MS) && f.t < to && f.m !== null && Math.abs(f.m - target) * 100 <= capture).map((f) => f.m);
    return w.length >= 3 ? (median(w) - target) * 100 : null;
  }

  // The landing to score and the correction, if any.
  // o: { steady (¢, the steady-window median the app found), touch (¢ | null), end (¢ held at the end | null), shifted }
  // A shift's own slide is expected, so after a shift only a correction while the note is held counts.
  // → { cents, fix }: fix = how far the finger moved afterwards (end − landing, ¢), only when it moved toward in tune.
  function judge(o) {
    const slidIn = !o.shifted && o.touch !== null && o.touch !== undefined && Math.abs(o.steady - o.touch) >= SLIDE;
    const cents = slidIn ? o.touch : o.steady;
    const end = o.end !== null && o.end !== undefined ? o.end : o.steady;
    const moved = end - cents;
    const fix = Math.abs(moved) >= SLIDE && Math.abs(end) < Math.abs(cents) ? moved : null;
    return { cents, fix };
  }

  // Place mode: one try at a note, from its onset. → { cents, slide, wrong } once there's enough to judge, else null.
  // frames: the frames since the try started (after the quiet). It is judged JUDGE_MS after the onset.
  const JUDGE_MS = 320;
  function placeTry(frames, target, opts = {}) {
    const capture = opts.capture ?? CAPTURE;
    const on = frames.findIndex((f) => f.m !== null);
    if (on < 0) return null;
    const t0 = frames[on].t, end = frames[frames.length - 1].t;
    if (end - t0 < JUDGE_MS) return null;
    const w = frames.filter((f) => f.t >= t0 && f.t < t0 + JUDGE_MS && f.m !== null);
    const onTarget = w.filter((f) => Math.abs(f.m - target) * 100 <= capture);
    if (onTarget.length < w.length * 0.6) return { cents: null, slide: null, wrong: Math.round(median(w.map((f) => f.m))) };
    const first = onTarget.filter((f) => f.t < t0 + TOUCH_MS).map((f) => f.m);
    const last = onTarget.filter((f) => f.t >= t0 + JUDGE_MS - HELD_MS).map((f) => f.m);
    if (first.length < 3 || last.length < 3) return { cents: (median(onTarget.map((f) => f.m)) - target) * 100, slide: null, wrong: null };
    const cents = (median(first.length >= 4 ? first.slice(1) : first) - target) * 100, after = (median(last) - target) * 100;
    return { cents, slide: Math.abs(after - cents) >= SLIDE ? after - cents : null, wrong: null };
  }

  const api = { SLIDE, TOUCH_MS, HELD_MS, JUDGE_MS, onsetIndex, touchdown, held, judge, placeTry };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Landing = api;
})(this);
