// Piece analysis: split a recorded pitch track into notes, then score intonation and timing.
// Works without the score: intonation is measured against the nearest equal-tempered note, and timing
// against a metronome grid when one was playing, or else against the player's own pulse.
// Works in the browser (window.PieceIO) and in Node (module.exports) for testing.
(function (root) {
  const REPORT_FORMAT = "fingerboard-coach/piece-report@1";
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const median = (a) => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const SHARP_NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
  const defaultName = (m) => SHARP_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const clock = (ms) => { const s = Math.max(0, Math.round(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

  // frames: [{ t (ms), m (fractional MIDI or null when unpitched), rms }]
  function segment(frames, opts = {}) {
    const minMs = opts.minNoteMs ?? 90, maxGap = opts.maxGapFrames ?? 3;
    const groups = [];
    let cur = null, gap = 0;
    const close = () => { if (cur) groups.push(cur); cur = null; };
    for (let i = 0; i < frames.length; i++) {
      const f = frames[i];
      if (f.m === null) { if (cur && ++gap > maxGap) close(); continue; }
      gap = 0;
      const n = Math.round(f.m);
      if (!cur) { cur = { n, fr: [f] }; continue; }
      if (n === cur.n) { cur.fr.push(f); continue; }
      // A new note once the new pitch holds for 3 of the next 4 voiced frames; shorter blips are slides or noise
      const next = frames.slice(i, i + 6).filter((x) => x.m !== null).slice(0, 4);
      if (next.length >= 3 && next.filter((x) => Math.round(x.m) === n).length >= 3) { close(); cur = { n, fr: [f] }; }
      else cur.fr.push(f);
    }
    close();
    // Repeated notes on one pitch (a new bow) show up as a dip in loudness
    const split = [];
    for (const g of groups) split.push(...splitOnDips(g, minMs));
    return split.map((g) => finalize(g, minMs)).filter(Boolean);
  }

  function splitOnDips(g, minMs) {
    const fr = g.fr;
    if (fr.length < 8 || fr[0].rms === undefined) return [g];
    let peak = 0;
    for (let i = 1; i < fr.length - 2; i++) {
      peak = Math.max(peak, fr[i - 1].rms);
      if (fr[i].rms > peak * 0.45) continue;
      // lowest point of the dip, then a rise back to 80% of the earlier level within 200 ms
      let lo = i;
      while (lo + 1 < fr.length && fr[lo + 1].rms <= fr[lo].rms) lo++;
      const rise = fr.findIndex((f, k) => k > lo && f.t - fr[lo].t < 200 && f.rms >= peak * 0.8);
      if (rise < 0) continue;
      const a = { n: g.n, fr: fr.slice(0, lo) }, b = { n: g.n, fr: fr.slice(lo) };
      if (a.fr.length && b.fr.length && a.fr[a.fr.length - 1].t - a.fr[0].t >= minMs && b.fr[b.fr.length - 1].t - b.fr[0].t >= minMs)
        return [a, ...splitOnDips(b, minMs)];
    }
    return [g];
  }

  function finalize(g, minMs) {
    const fr = g.fr, t = fr[0].t, end = fr[fr.length - 1].t, dur = end - t;
    if (dur < minMs) return null;
    // Intonation from the steady middle: skip the attack and the release, keep frames near this note
    const from = t + Math.min(80, dur * 0.25), to = end - dur * 0.15;
    const core = fr.filter((f) => f.t >= from && f.t <= to && f.m !== null && Math.abs(f.m - g.n) <= 0.5).map((f) => ({ t: f.t, c: (f.m - g.n) * 100 }));
    const ok = core.length >= 3 && dur >= 120;
    const cs = core.map((x) => x.c);
    const wobble = ok && core.length > 4 ? Math.sqrt(mean(cs.map((c) => (c - mean(cs)) ** 2))) : null;
    return { t, dur: Math.round(dur), midi: g.n, cents: ok ? centre(core, wobble) : null, wobble };
  }

  // With vibrato, the ear hears the middle of the swing. Short notes hold only a cycle or so, where a plain
  // average is biased, so fit a constant plus a 4–8 Hz sine and take the constant.
  function centre(core, wobble) {
    const cs = core.map((x) => x.c);
    if (wobble === null || wobble < 6 || core.length < 9) return mean(cs);
    let best = null;
    for (let hz = 4; hz <= 8; hz += 0.25) {
      const w = (2 * Math.PI * hz) / 1000, rows = core.map((x) => [1, Math.sin(w * x.t), Math.cos(w * x.t)]);
      const A = [0, 1, 2].map((i) => [0, 1, 2].map((j) => rows.reduce((s, r) => s + r[i] * r[j], 0)));
      const y = [0, 1, 2].map((i) => rows.reduce((s, r, k) => s + r[i] * cs[k], 0));
      const x = solve3(A, y);
      if (!x) continue;
      const err = rows.reduce((s, r, k) => s + (r[0] * x[0] + r[1] * x[1] + r[2] * x[2] - cs[k]) ** 2, 0);
      if (!best || err < best.err) best = { err, a: x[0] };
    }
    return best ? best.a : mean(cs);
  }
  function solve3(A, y) {
    const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
    const d = det(A);
    if (Math.abs(d) < 1e-9) return null;
    return [0, 1, 2].map((c) => det(A.map((row, i) => row.map((v, j) => (j === c ? y[i] : v)))) / d); // Cramer's rule
  }

  // Timing against the metronome: each onset vs the nearest line of the chosen subdivision
  function metronomeTiming(notes, g) {
    const q = g.beatMs / g.sub, tolMs = Math.round(Math.max(30, Math.min(100, 0.2 * q)));
    const timed = [];
    for (const n of notes) {
      const on = n.t - g.lat;
      if (on < g.t0 - q / 2) continue; // played during the count-in
      const k = Math.round((on - g.t0) / q);
      n.timing = on - (g.t0 + k * q);
      n.beat = Math.round((k / g.sub) * 100) / 100;
      timed.push(n);
    }
    if (timed.length < 4) return { kind: "metronome", tolMs, notes: timed.length };
    const devs = timed.map((n) => n.timing), half = timed.length >> 1;
    return { kind: "metronome", tolMs, notes: timed.length, onTimePct: Math.round((100 * devs.filter((d) => Math.abs(d) <= tolMs).length) / devs.length),
      meanMs: Math.round(mean(devs)), firstHalfMs: Math.round(mean(devs.slice(0, half))), secondHalfMs: Math.round(mean(devs.slice(half))) };
  }

  // Timing without a metronome: find the shortest regular pulse in the gaps between notes, then follow it
  function freeTiming(notes) {
    const iois = [];
    for (let i = 1; i < notes.length; i++) { const d = notes[i].t - notes[i - 1].t; if (d < 2500) iois.push({ i, d }); }
    if (iois.length < 8) return { kind: "free", notes: iois.length };
    const fit = (q) => iois.reduce((s, { d }) => { const r = d / q, k = Math.round(r); return k >= 1 && k <= 8 ? s + Math.max(0, 1 - 4 * Math.abs(r - k)) : s; }, 0);
    const cands = [];
    for (let q = 100; q <= 1500; q *= 1.015) cands.push({ q, s: fit(q) });
    const best = Math.max(...cands.map((c) => c.s));
    const q = Math.max(...cands.filter((c) => c.s >= best * 0.92).map((c) => c.q)); // the longest pulse that still fits
    // Local pulse from each gap that sits close to a whole number of pulses
    const local = iois.map(({ i, d }) => { const k = Math.round(d / q); return k >= 1 && k <= 8 && Math.abs(d / q - k) < 0.2 ? { i, u: d / k } : null; }).filter(Boolean);
    if (local.length < 6) return { kind: "free", notes: iois.length, pulseMs: Math.round(q) };
    // "Your usual tempo": the most common local pulse (within 3%). A plain median drifts toward a long fast or slow stretch.
    const us = local.map((l) => l.u);
    const support = us.map((u) => us.filter((v) => Math.abs(v - u) <= u * 0.03));
    const most = Math.max(...support.map((g) => g.length));
    const med = median(support.find((g) => g.length === most));
    // Rolling tempo (8 gaps) as % of the overall pulse: > 0 means faster than usual
    const curve = local.map((l, j) => { const w = local.slice(Math.max(0, j - 4), j + 4).map((x) => x.u); return { i: l.i, t: notes[l.i].t, pct: Math.round((med / median(w) - 1) * 1000) / 10 }; });
    const spans = [];
    let open = null;
    for (const c of curve) {
      const kind = c.pct >= 6 ? "faster" : c.pct <= -6 ? "slower" : null;
      if (kind && open && open.kind === kind) { open.end = c.t; open.n++; open.peak = kind === "faster" ? Math.max(open.peak, c.pct) : Math.min(open.peak, c.pct); }
      else { if (open && open.n >= 5) spans.push(open); open = kind ? { kind, start: c.t, end: c.t, n: 1, peak: c.pct } : null; }
    }
    if (open && open.n >= 5) spans.push(open);
    const mad = median(local.map((l) => Math.abs(l.u - med)));
    for (const { i, d } of iois) { const r = d / q, k = Math.round(r); if (k >= 1 && k <= 8) notes[i].uneven = Math.abs(r - k) >= 0.25; }
    const fifth = Math.max(2, Math.floor(local.length / 5));
    return { kind: "free", notes: iois.length, pulseMs: Math.round(med), pulsePerMin: Math.round(60000 / med), steadinessPct: Math.round(Math.max(0, 100 - (100 * 1.4826 * mad) / med)),
      startPulsePerMin: Math.round(60000 / median(local.slice(0, fifth).map((l) => l.u))), endPulsePerMin: Math.round(60000 / median(local.slice(-fifth).map((l) => l.u))),
      spans, curve, uneven: notes.filter((n) => n.uneven).length };
  }

  // Everything the report needs. opts: { tol, name(midi), keyPcs (Set) | null, keyName, metronome: { t0, beatMs, sub, lat } | null, t0 }
  function analyze(frames, opts) {
    const name = opts.name || defaultName, tol = opts.tol ?? 15;
    const notes = segment(frames);
    const start = opts.t0 ?? (frames.length ? frames[0].t : 0);
    const ev = notes.filter((n) => n.cents !== null);
    const summary = { notes: notes.length, evaluated: ev.length, durationSec: frames.length ? Math.round((frames[frames.length - 1].t - start) / 100) / 10 : 0 };
    if (ev.length) Object.assign(summary, { inTunePct: Math.round((100 * ev.filter((n) => Math.abs(n.cents) <= tol).length) / ev.length),
      avgMissCents: Math.round(mean(ev.map((n) => Math.abs(n.cents))) * 10) / 10, meanCents: Math.round(mean(ev.map((n) => n.cents)) * 10) / 10 });

    const byNote = new Map();
    for (const n of ev) (byNote.get(n.midi) || byNote.set(n.midi, []).get(n.midi)).push(n.cents);
    const tendencies = [...byNote].filter(([, c]) => c.length >= 3).map(([m, c]) => ({ midi: m, note: name(m), count: c.length, avgCents: Math.round(mean(c) * 10) / 10 }))
      .filter((x) => Math.abs(x.avgCents) >= tol * 0.6).sort((a, b) => Math.abs(b.avgCents) * Math.sqrt(b.count) - Math.abs(a.avgCents) * Math.sqrt(a.count));

    let outOfKey = [];
    if (opts.keyPcs) {
      const c = new Map();
      for (const n of notes) if (!opts.keyPcs.has(((n.midi % 12) + 12) % 12)) c.set(n.midi, (c.get(n.midi) || 0) + 1);
      outOfKey = [...c].map(([m, count]) => {
        // The likely intended note is the key's version of the same letter (F natural in G major → F♯)
        const inKey = [m - 1, m + 1].filter((x) => opts.keyPcs.has(((x % 12) + 12) % 12)).map(name);
        const same = inKey.filter((x) => x[0] === name(m)[0]);
        const near = same.length ? same : inKey;
        return { midi: m, note: name(m), count, nearestInKey: near };
      }).sort((a, b) => b.count - a.count);
    }

    const timing = opts.metronome ? metronomeTiming(notes, opts.metronome) : freeTiming(notes);

    // Moments worth listening back to
    const moments = [];
    for (const n of notes) {
      if (n.cents !== null && Math.abs(n.cents) > Math.max(2 * tol, 25) && n.dur >= 200) moments.push({ t: n.t, midi: n.midi, kind: "pitch", sev: Math.abs(n.cents) / tol, text: `${name(n.midi)} ${n.cents > 0 ? "+" : "−"}${Math.abs(n.cents).toFixed(0)}¢ ${n.cents > 0 ? "sharp" : "flat"}` });
      if (timing.kind === "metronome" && n.timing !== undefined && Math.abs(n.timing) > 2 * timing.tolMs) moments.push({ t: n.t, midi: n.midi, kind: "timing", sev: Math.abs(n.timing) / timing.tolMs, text: `${name(n.midi)} ${Math.abs(n.timing).toFixed(0)} ms ${n.timing > 0 ? "late" : "early"}` });
      if (n.uneven) moments.push({ t: n.t, midi: n.midi, kind: "rhythm", sev: 1.5, text: `${name(n.midi)} came unevenly` });
    }
    if (timing.spans) for (const s of timing.spans) moments.push({ t: s.start, kind: "tempo", sev: Math.abs(s.peak) / 4, text: `${s.kind === "faster" ? "sped up" : "slowed down"} ~${Math.abs(s.peak).toFixed(0)}% until ${clock(s.end - start)}` });
    moments.sort((a, b) => b.sev - a.sev);
    const top = moments.slice(0, 8).sort((a, b) => a.t - b.t).map((m) => ({ ...m, at: clock(m.t - start) }));

    return { notes, summary, tendencies, outOfKey, timing, moments: top, coachNotes: coach(summary, tendencies, outOfKey, timing, ev, tol, name, opts.keyName, start) };
  }

  function coach(sum, tendencies, outOfKey, timing, ev, tol, name, keyName, start) {
    const tips = [];
    if (!sum.notes) return ["No notes were detected. Check the microphone level and play a little louder."];
    if (ev.length) tips.push(`${sum.inTunePct}% of ${ev.length} notes were in tune (within ±${tol}¢); the average miss was ${sum.avgMissCents}¢.`);
    for (const x of tendencies.slice(0, 3))
      tips.push(`${x.note} runs ${x.avgCents > 0 ? "sharp" : "flat"}: ${x.avgCents > 0 ? "+" : "−"}${Math.abs(x.avgCents).toFixed(0)}¢ on average across ${x.count} notes. A habit on one note usually means one finger in one spot. Check where you play it.`);
    if (ev.length >= 10 && Math.abs(sum.meanCents) >= 6) tips.push(`Overall you ran ${sum.meanCents > 0 ? "sharp" : "flat"} (${sum.meanCents > 0 ? "+" : ""}${sum.meanCents}¢). ${sum.meanCents > 0 ? "Check your tuning, then whether the hand creeps toward the bridge." : "Check your tuning, then whether the hand fully reaches each position."}`);
    const high = ev.filter((n) => n.midi >= 84).map((n) => n.cents), low = ev.filter((n) => n.midi < 84).map((n) => n.cents);
    if (high.length >= 5 && low.length >= 5 && mean(high) - mean(low) > 8) tips.push(`High notes (C6 and up) average ${mean(high) > 0 ? "+" : ""}${mean(high).toFixed(0)}¢ against ${mean(low) > 0 ? "+" : ""}${mean(low).toFixed(0)}¢ lower down. In high positions the fingers need to sit closer together than you'd expect.`);
    for (const o of outOfKey.slice(0, 2)) tips.push(`${o.note} (${o.count}×) isn't in ${keyName}. If your music has ${o.nearestInKey.join(" or ") || "a different note"} there, that finger is sitting ${o.nearestInKey.length === 1 ? (name(o.midi + 1) === o.nearestInKey[0] ? "low" : "high") : "off"}.`);
    if (timing.kind === "metronome" && timing.onTimePct !== undefined) {
      tips.push(`${timing.onTimePct}% of notes started within ±${timing.tolMs} ms of the click grid.`);
      if (Math.abs(timing.meanMs) > timing.tolMs * 0.4) tips.push(`You tend to ${timing.meanMs < 0 ? "rush" : "drag"}: notes land ${Math.abs(timing.meanMs)} ms ${timing.meanMs < 0 ? "ahead of" : "behind"} the click on average.`);
      if (Math.abs(timing.secondHalfMs - timing.firstHalfMs) > timing.tolMs * 0.6) tips.push(`You drift ${timing.secondHalfMs < timing.firstHalfMs ? "ahead of" : "behind"} the click as you go: ${timing.firstHalfMs} ms in the first half, ${timing.secondHalfMs} ms in the second.`);
    }
    if (timing.kind === "free" && timing.pulsePerMin) {
      tips.push(`Your pulse was about ${timing.pulsePerMin} per minute, and ${timing.steadinessPct}% steady.`);
      const drift = (timing.endPulsePerMin - timing.startPulsePerMin) / timing.startPulsePerMin;
      if (Math.abs(drift) >= 0.05) tips.push(`You ${drift > 0 ? "sped up" : "slowed down"} over the piece: from about ${timing.startPulsePerMin} to ${timing.endPulsePerMin} pulses per minute. Try a run with the metronome to hold it steady.`);
      for (const s of timing.spans.slice(0, 2)) tips.push(`From ${clock(s.start - start)} to ${clock(s.end - start)} you ${s.kind === "faster" ? "sped up" : "slowed down"} by about ${Math.abs(s.peak).toFixed(0)}%. ${s.kind === "faster" ? "Rushing often happens in passages that feel easy or exciting." : "Slowing down often marks a tricky passage: practise that spot on its own."}`);
      if (timing.uneven >= 3) tips.push(`${timing.uneven} notes came unevenly against the pulse. The moments list below points to them.`);
    }
    return tips;
  }

  // The JSON a player copies to Claude. Self-describing, so it can be read without the app.
  function buildReport(a, meta) {
    const start = meta.t0;
    return {
      format: REPORT_FORMAT,
      howToRead: "A recording of the player performing a piece, analysed without the score. notes[].cents: intonation against the nearest equal-tempered note (+ sharp, − flat), measured on the steady middle of the note; null when the note was too short to judge. With a metronome, notes[].timingMs: onset against the nearest line of the click grid (+ late, − early) and beat: the beat number from the first click after the count-in. Without a metronome, timing.pulsePerMin is the player's own pulse and timing.spans lists stretches that sped up or slowed down. tendencies: notes that were consistently sharp or flat (a likely finger-placement habit). outOfKey: pitches outside the chosen key, which may be real accidentals or a finger in the wrong place. Wrong notes can't be detected without the score.",
      title: meta.title || null, date: new Date(meta.date).toISOString(), key: meta.keyName || null, a4: meta.a4, toleranceCents: meta.tol,
      metronome: meta.metronome ? { bpm: meta.metronome.bpm, beatsPerBar: meta.metronome.beatsPerBar, subdivision: meta.metronome.sub, latencyMs: meta.metronome.lat } : null,
      summary: a.summary,
      timing: { ...a.timing, curve: undefined, spans: a.timing.spans && a.timing.spans.map((s) => ({ kind: s.kind, from: clock(s.start - start), to: clock(s.end - start), peakPct: s.peak })),
        tempoCurve: a.timing.curve && a.timing.curve.filter((_, i, c) => i % Math.ceil(c.length / 120) === 0).map((c) => ({ t: Math.round(c.t - start) / 1000, pct: c.pct })) },
      tendencies: a.tendencies.map(({ midi, ...x }) => x),
      outOfKey: a.outOfKey.map(({ midi, ...x }) => x),
      moments: a.moments.map((m) => ({ at: m.at, t: Math.round(m.t - start) / 1000, what: m.text })),
      coachNotes: a.coachNotes,
      previous: meta.previous || [],
      notes: a.notes.slice(0, 600).map((n) => ({ t: Math.round(n.t - start) / 1000, note: (meta.name || defaultName)(n.midi), durMs: n.dur, cents: n.cents === null ? null : Math.round(n.cents * 10) / 10,
        ...(n.timing !== undefined ? { timingMs: Math.round(n.timing), beat: n.beat } : {}), ...(n.uneven ? { uneven: true } : {}) })),
    };
  }

  const api = { clock, REPORT_FORMAT, segment, metronomeTiming, freeTiming, analyze, buildReport };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PieceIO = api;
})(this);
