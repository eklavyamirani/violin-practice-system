// Rhythm drills: line a performance up with the written rhythm, then measure what a teacher listens for:
// when each note starts, how long it sounds, dotted pairs, long notes, and runs of repeated short notes.
// Works in the browser (window.Rhythm) and in Node (module.exports) for testing.
(function (root) {
  const EPS = 1e-6, LONG = 1.5; // notes of 1½ beats or more are also judged on how long they sound
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const median = (a) => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };

  const VALUES = [[0.25, "16th"], [1 / 3, "triplet 8th"], [0.5, "8th"], [0.75, "dotted 8th"], [1, "quarter"], [1.5, "dotted quarter"], [2, "half"], [3, "dotted half"], [4, "whole"]];
  const valueName = (b) => { const v = VALUES.find(([x]) => Math.abs(x - b) < 0.01); return v ? v[1] : `${fmtBeats(b)}-beat`; };
  const FRACTIONS = [[0, ""], [0.25, "¼"], [1 / 3, "⅓"], [0.5, "½"], [2 / 3, "⅔"], [0.75, "¾"]];
  // Written lengths as fractions (1½), measured ones to one decimal (1.6)
  function fmtBeats(b) {
    const w = Math.floor(b + EPS), f = FRACTIONS.find(([x]) => Math.abs(b - w - x) < 0.01);
    if (!f) return String(Math.round(b * 100) / 100);
    return (w || !f[1] ? String(w) : "") + f[1];
  }
  const fmt1 = (b) => b.toFixed(1);

  // Which heard notes (if any) played each written note: a minimum-cost, in-order alignment. A match costs how far
  // off the beat it started (in beats, capped at 2), plus 1 for a wrong pitch; leaving a written note unplayed costs
  // 1, and an extra heard note 0.6. A bow change in the middle of a long note splits it in two, so a heard note can
  // also join the one before it on the same written note (0.3, or 2.3 if it starts after that note should be over).
  // Returns, per written note, the heard pieces that played it, or null.
  function align(exp, det, beatOf) {
    const n = exp.length, m = det.length, SKIP_E = 1, SKIP_D = 0.6, WRONG = 1, JOIN = 0.3;
    const grid = (v) => Array.from({ length: n + 1 }, () => new Float64Array(m + 1).fill(v));
    const G = grid(0), M = grid(Infinity), gB = grid(0), mB = grid(0);
    for (let j = 1; j <= m; j++) { G[0][j] = j * SKIP_D; gB[0][j] = 2; }
    for (let i = 1; i <= n; i++) {
      G[i][0] = i * SKIP_E; gB[i][0] = 1;
      for (let j = 1; j <= m; j++) {
        const e = exp[i - 1], d = det[j - 1], p = det[j - 2];
        M[i][j] = G[i - 1][j - 1] + Math.min(2, Math.abs(beatOf(d) - e.at)) + (d.midi === e.midi ? 0 : WRONG);
        if (p && d.midi === e.midi && p.midi === e.midi && d.t - (p.t + p.dur) < 150) {
          const c = M[i][j - 1] + JOIN + (beatOf(d) > e.at + e.beats - 0.1 ? 2 : 0);
          if (c < M[i][j]) { M[i][j] = c; mB[i][j] = 1; }
        }
        const c1 = G[i - 1][j] + SKIP_E, c2 = G[i][j - 1] + SKIP_D;
        if (M[i][j] <= c1 && M[i][j] <= c2) G[i][j] = M[i][j]; else if (c1 <= c2) { G[i][j] = c1; gB[i][j] = 1; } else { G[i][j] = c2; gB[i][j] = 2; }
      }
    }
    const parts = exp.map(() => []);
    for (let i = n, j = m, inM = false; i > 0 || j > 0;) {
      if (inM) { parts[i - 1].unshift(det[j - 1]); if (mB[i][j]) j--; else { i--; j--; inM = false; } }
      else if (gB[i][j] === 1) i--;
      else if (gB[i][j] === 2) j--;
      else inM = true;
    }
    return parts.map((ps) => (ps.length ? ps : null));
  }

  // exp: the written notes [{ midi, at, beats, ... }] (at = start in beats from the first downbeat)
  // det: heard notes from PieceIO.segment [{ t, dur, midi, cents }] (ms, on the detector's clock)
  // o: t0 (time of the first downbeat as heard), beatMs, lat (click → detected delay), tol (¢), tolMs, holdFrac, total (beats)
  function score(exp, det, o) {
    const { t0, beatMs, lat = 0, tol = 25, tolMs = 100, holdFrac = 0.85 } = o;
    const total = o.total !== undefined ? o.total : Math.max(...exp.map((e) => e.at + e.beats));
    const beatOf = (d) => (d.t - lat - t0) / beatMs;
    const heard = det.filter((d) => beatOf(d) > -0.75 && beatOf(d) < total + 0.5);
    const match = align(exp, heard, beatOf);
    const notes = exp.map((e, k) => {
      const ps = match[k], last = ps && ps[ps.length - 1];
      const d = ps && { t: ps[0].t, dur: last.t + last.dur - ps[0].t, midi: ps[0].midi, cents: (ps.find((x) => x.cents !== null && x.cents !== undefined) || {}).cents };
      const base = { k, item: e, beats: e.beats, onBeat: null, timing: null, cents: null, wrong: null, heldBeats: null, lastedBeats: null };
      if (!d) return { ...base, inTune: false, onTime: false, held: false, ok: false, missed: true };
      const right = d.midi === e.midi, onBeat = beatOf(d), timing = (onBeat - e.at) * beatMs;
      const cents = right && d.cents !== null && d.cents !== undefined ? d.cents : null;
      const inTune = right && (cents === null || Math.abs(cents) <= tol); // too short to measure: not held against it
      const onTime = Math.abs(timing) <= tolMs, heldBeats = d.dur / beatMs;
      const held = e.beats < LONG - EPS || heldBeats >= holdFrac * e.beats;
      return { ...base, onBeat, timing, cents, wrong: right ? null : d.midi, heldBeats, inTune, onTime, held, ok: right && inTune && onTime && held, missed: false };
    });
    // How long each note lasted: from its start to the start of the note written straight after it
    notes.forEach((x, k) => {
      const nx = notes[k + 1];
      if (x.onBeat !== null && nx && nx.onBeat !== null && Math.abs(exp[k].at + exp[k].beats - exp[k + 1].at) < EPS) x.lastedBeats = nx.onBeat - x.onBeat;
    });
    return { notes, summary: summarize(notes) };
  }

  function summarize(notes) {
    const heard = notes.filter((x) => x.onBeat !== null);
    const group = (list, f) => { const g = new Map(); for (const x of list) { const k = f(x); if (!g.has(k)) g.set(k, []); g.get(k).push(x); } return [...g].sort((a, b) => a[0] - b[0]); };
    // Each written length: the median time it actually lasted
    const values = group(notes.filter((x) => x.lastedBeats !== null), (x) => x.beats).map(([beats, g]) => ({ beats, n: g.length, lasted: median(g.map((x) => x.lastedBeats)) }));
    // Dotted pairs: a note 3× as long as the one straight after it. 3 : 1 is exact; a triplet feel is 2 : 1
    const pairs = [];
    notes.forEach((a, k) => {
      const b = notes[k + 1];
      if (b && a.lastedBeats !== null && b.lastedBeats !== null && Math.abs(a.beats - 3 * b.beats) < EPS) pairs.push({ k, short: b.beats, ratio: a.lastedBeats / b.lastedBeats });
    });
    const dotted = pairs.length ? { n: pairs.length, short: median(pairs.map((p) => p.short)), ratio: median(pairs.map((p) => p.ratio)), pairs } : null;
    // Long notes, by length: how long they sounded, and how long until the next note came
    const long = group(heard.filter((x) => x.beats >= LONG - EPS), (x) => x.beats).map(([beats, g]) => {
      const lasted = g.filter((x) => x.lastedBeats !== null).map((x) => x.lastedBeats);
      return { beats, n: g.length, held: mean(g.map((x) => x.heldBeats)), lasted: lasted.length ? mean(lasted) : null, cutShort: g.filter((x) => !x.held).length };
    });
    // Runs of 3 or more equal short notes (8ths and shorter): do they rush, are they even?
    const runs = [];
    for (let k = 0; k < notes.length;) {
      let j = k;
      while (j + 1 < notes.length && Math.abs(notes[j + 1].beats - notes[k].beats) < EPS && notes[j].lastedBeats !== null) j++;
      if (notes[k].beats <= 0.5 + EPS && j - k + 1 >= 3) runs.push({ beats: notes[k].beats, iois: notes.slice(k, j).map((x) => x.lastedBeats) });
      k = j + 1;
    }
    const evenRuns = group(runs, (r) => r.beats).map(([beats, g]) => { const iois = g.flatMap((r) => r.iois); return { beats, n: iois.length, lasted: mean(iois), unevenPct: Math.round((sd(iois) / beats) * 100) }; });
    return { meanOnsetMs: heard.length ? mean(heard.map((x) => x.timing)) : null, values, dotted, long, evenRuns };
  }

  const cap = (t) => t[0].toUpperCase() + t.slice(1);
  const plural = (b) => `${valueName(b)} notes`;
  const pct = (x) => `${Math.round(x * 100)}%`;
  // Coaching from a summary, most important first. o: holdFrac, tolMs
  function tips(s, o = {}) {
    const out = [], holdFrac = o.holdFrac || 0.85, tolMs = o.tolMs || 100;
    const worst = s.long.filter((g) => g.beats >= 2).map((g) => ({ ...g, frac: Math.min(g.held / g.beats, g.lasted !== null ? g.lasted / g.beats : 1) })).sort((a, b) => a.frac - b.frac)[0];
    if (worst) {
      const name = `${plural(worst.beats)} (${fmtBeats(worst.beats)} beats)`;
      if (worst.lasted !== null && worst.lasted < worst.beats * 0.92)
        out.push(`<b>${cap(name)} are too short:</b> the next note came after ${fmt1(worst.lasted)} beats instead of ${fmtBeats(worst.beats)}. You're moving on early. Count every click inside the note and move on only on the click after its last beat.`);
      else if (worst.held < worst.beats * holdFrac)
        out.push(`<b>${cap(name)} fade out early:</b> they sounded for ${fmt1(worst.held)} of ${fmtBeats(worst.beats)} beats. The next note waited, but the sound stopped. Keep the bow moving to the very end: use a slower bow so it lasts, and change bow right on the click.`);
      else out.push(`✓ ${cap(name)} held for their full length (${fmt1(worst.held)} of ${fmtBeats(worst.beats)} beats).`);
    }
    // Long notes shrinking next to short ones: each length as a share of what it should be
    const v = s.values;
    if (v.length >= 2) {
      const lo = v[0], hi = v.filter((g) => g.beats >= 2).sort((a, b) => a.lasted / a.beats - b.lasted / b.beats)[0];
      const rLo = lo.lasted / lo.beats, rHi = hi ? hi.lasted / hi.beats : 1;
      if (hi && rHi < 0.95 && rHi < rLo - 0.1)
        out.push(`<b>Long notes shrink next to short ones.</b> Your ${plural(lo.beats)} lasted ${pct(rLo)} of their length, your ${plural(hi.beats)} only ${pct(rHi)}. Long notes need the most counting: keep hearing the clicks go by inside them.`);
    }
    if (s.dotted) {
      const r = s.dotted.ratio, count = s.dotted.short >= 0.5 - EPS ? `“1 (2) &” and play the short note on the “&”` : `“1 e & a” and play the short note on the “a”`;
      if (r < 2.5) out.push(`<b>Dotted rhythm too even:</b> long : short came out ${fmt1(r)} : 1 instead of 3 : 1, closer to a triplet, so the short note comes early. Count ${count}, as late as you dare: it leads into the next note.`);
      else if (r > 3.6) out.push(`<b>Over-dotted:</b> long : short came out ${fmt1(r)} : 1 instead of 3 : 1, so the short note is late and clipped. Give it its full ${valueName(s.dotted.short)}.`);
      else out.push(`✓ Dotted rhythm at ${fmt1(r)} : 1 (3 : 1 is exact).`);
    }
    for (const g of s.evenRuns) {
      if (g.lasted < g.beats * 0.9) out.push(`<b>Repeated ${plural(g.beats)} rush:</b> each lasted ${pct(g.lasted / g.beats)} of its length. Play them with the click, not ahead of it, and keep each bow the same length.`);
      else if (g.unevenPct > 15) out.push(`<b>Repeated ${plural(g.beats)} are uneven</b> (they vary by ${g.unevenPct}% of their length). Keep each bow stroke the same length and speed.`);
    }
    const m = s.meanOnsetMs;
    if (m !== null && Math.abs(m) > tolMs * 0.5) out.push(`Overall you're <b>${m > 0 ? "dragging" : "rushing"}</b>: notes start ${Math.abs(m).toFixed(0)} ms ${m > 0 ? "after" : "before"} the click on average.`);
    return out;
  }

  // The summary for reports, rounded
  const r2 = (x) => (x === null ? null : Math.round(x * 100) / 100);
  const report = (s, clicks) => ({
    clicksPerBeat: clicks, meanOnsetMs: s.meanOnsetMs === null ? null : Math.round(s.meanOnsetMs),
    dotted: s.dotted && { pairs: s.dotted.n, ratio: r2(s.dotted.ratio) },
    longNotes: s.long.map((g) => ({ beats: r2(g.beats), count: g.n, heldBeats: r2(g.held), lastedBeats: r2(g.lasted), cutShort: g.cutShort })),
    values: s.values.map((g) => ({ beats: r2(g.beats), count: g.n, lastedBeats: r2(g.lasted) })),
    evenRuns: s.evenRuns.map((g) => ({ beats: r2(g.beats), count: g.n, lastedBeats: r2(g.lasted), unevenPct: g.unevenPct })),
  });

  // Written rhythm (top lane) and, after a run, what was played (bottom lane: from where the note started, for as
  // long as it sounded), one row per few bars, with the count underneath.
  // o: total, bar, clicks (2 = show the “&”s), results (score().notes), cur (index to outline), label(item)
  function lanes(exp, o) {
    const W = 660, L = 8, RH = o.results ? 70 : 52, bars = Math.max(1, Math.ceil(o.total / o.bar - EPS));
    const perRow = o.bar * Math.min(4, bars), rows = Math.ceil(o.total / perRow - EPS), pw = (W - 2 * L) / perRow;
    const at = (b) => { const r = Math.min(rows - 1, Math.floor(b / perRow + EPS)); return { r, x: L + (b - r * perRow) * pw }; };
    // A span of beats, split where it runs over the end of a row
    const spans = (b0, b1) => {
      const out = [];
      for (let b = b0; b < b1 - EPS;) { const r = Math.floor(b / perRow + EPS), end = Math.min(b1, (r + 1) * perRow); out.push({ r, x: L + (b - r * perRow) * pw, w: (end - b) * pw }); b = end; }
      return out;
    };
    let h = "";
    for (let r = 0; r < rows; r++) {
      const y = r * RH, n = Math.min(perRow, o.total - r * perRow);
      for (let b = 0; b <= n + EPS; b += o.clicks === 2 ? 0.5 : 1) {
        const x = L + b * pw, whole = Math.abs(b - Math.round(b)) < EPS, down = whole && Math.round(b) % o.bar === 0;
        h += `<line x1="${x}" x2="${x}" y1="${y + 2}" y2="${y + RH - 16}" stroke="var(--${down ? "muted" : "line"})" stroke-width="${down ? 1.2 : whole ? 0.8 : 0.5}"${whole ? "" : ' stroke-dasharray="2 3"'}/>`;
        if (b < n - EPS) h += `<text x="${x + 3}" y="${y + RH - 5}" font-size="${whole ? 10 : 9}" fill="var(--muted)">${whole ? (Math.round(b) % o.bar) + 1 : "&"}</text>`;
      }
    }
    exp.forEach((e, k) => {
      const res = o.results && o.results[k];
      const stroke = k === o.cur ? "var(--accent)" : res && res.missed ? "var(--bad)" : "var(--line)";
      for (const s of spans(e.at, e.at + e.beats)) {
        const y = s.r * RH + 4;
        h += `<rect x="${s.x + 1}" y="${y}" width="${Math.max(2, s.w - 2)}" height="20" rx="4" fill="var(--panel-2)" stroke="${stroke}" stroke-width="${k === o.cur ? 2 : 1}"${res && res.missed ? ' stroke-dasharray="4 3"' : ""}><title>${o.label(e)} · ${valueName(e.beats)}</title></rect>`;
        if (s.w >= 26) h += `<text x="${s.x + 5}" y="${y + 14}" font-size="10.5" font-weight="700" fill="var(--ink)">${o.label(e)}</text>`;
      }
      if (!res || res.onBeat === null) return;
      const color = res.ok ? "var(--good)" : res.onTime && res.wrong === null && res.held ? "var(--near)" : "var(--bad)";
      const title = `${o.label(e)}: started ${res.timing > 0 ? "+" : ""}${res.timing.toFixed(0)} ms, sounded ${fmt1(res.heldBeats)} of ${fmtBeats(e.beats)} beats${res.wrong !== null ? " (wrong note)" : ""}`;
      const start = Math.max(0, res.onBeat), end = Math.min(o.total, res.onBeat + res.heldBeats);
      for (const s of spans(start, end)) h += `<rect x="${s.x}" y="${s.r * RH + 30}" width="${Math.max(2, s.w)}" height="14" rx="3" fill="${color}" opacity=".85"><title>${title}</title></rect>`;
      const p = at(start);
      h += `<line x1="${p.x}" x2="${p.x}" y1="${p.r * RH + 27}" y2="${p.r * RH + 47}" stroke="${color}" stroke-width="2"/>`;
    });
    h += `<line id="rhHead" x1="0" x2="0" y1="0" y2="0" stroke="var(--accent)" stroke-width="2.5" opacity="0"/>`;
    const head = (b) => { const p = at(Math.max(0, Math.min(o.total, b))); return { x: p.x, y1: p.r * RH, y2: p.r * RH + RH - 16 }; };
    return { svg: `<svg class="rhythmChart" viewBox="0 0 ${W} ${rows * RH}" aria-label="Written rhythm${o.results ? " and what you played" : ""}">${h}</svg>`, head };
  }

  const api = { score, summarize, tips, report, lanes, align, valueName, fmtBeats, LONG };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Rhythm = api;
})(this);
