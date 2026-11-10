// Practice log: every finished run, note by note, kept for 90 days (up to 1000 runs), and the
// "practice log for Claude" export over one session or the last few days. Per-drill reports keep
// only a drill's last 5 runs; this keeps everything, so patterns across drills and days show up,
// and the notes a Claude drill targets can be compared before and after it was added.
// Pure logic. Works in the browser (window.PracticeLog) and in Node (module.exports) for testing.
(function (root) {
  "use strict";

  const FORMAT = "fingerboard-coach/practice-log@1";
  const KEEP_DAYS = 90, KEEP_RUNS = 1000, SESSION_GAP_MS = 45 * 60 * 1000, DAY_MS = 86400000;

  // ---------- Storage ----------
  // A landing is stored as a tuple to keep localStorage (and sync) small:
  // [note, string, finger, position, cents, inTune, wrongNoteFirst, shift] + [timingMs, onTime, missed] in tempo runs
  const toTuple = (l) => [l.note, l.string, l.finger, l.position === undefined ? null : l.position, l.cents, l.inTune ? 1 : 0, l.wrongNoteFirst || null, l.shift || null,
    ...("timingMs" in l ? [l.timingMs, l.onTime ? 1 : 0, l.missed ? 1 : 0] : [])];
  const fromTuple = (a) => {
    const l = { note: a[0], string: a[1], finger: a[2], position: a[3], cents: a[4], inTune: !!a[5], wrongNoteFirst: a[6], shift: a[7] };
    if (a.length > 8) Object.assign(l, { timingMs: a[8], onTime: !!a[9], missed: !!a[10] });
    return l;
  };

  // One finished run (the shape the per-drill report keeps) → a log record. t is its id (sync merges by it).
  function record(key, label, run) {
    return {
      t: Date.parse(run.date), key, label, mode: run.mode, tol: run.tolerance, score: run.score,
      passed: run.path ? !!run.path.passed : !!run.passed,
      ...(run.bpm ? { bpm: run.bpm } : {}), ...(run.notesPerBeat ? { per: run.notesPerBeat } : {}),
      notes: run.landings.map(toTuple),
      ...(run.coachNotes && run.coachNotes.length ? { coach: run.coachNotes } : {}),
    };
  }

  // Newest first, like the app's other lists; drop what's past 90 days or over 1000 runs
  function prune(log, now) {
    return log.filter((r) => r.t >= now - KEEP_DAYS * DAY_MS).sort((a, b) => b.t - a.t).slice(0, KEEP_RUNS);
  }
  const add = (log, rec, now) => prune([rec, ...log.filter((r) => r.t !== rec.t)], now);

  // Before this log existed, each drill kept its last 5 runs; start the log from those
  function backfill(runs, now) {
    const out = [];
    for (const [key, e] of Object.entries(runs || {})) for (const r of e.runs || []) if (r.date && r.landings) out.push(record(key, e.label, r));
    const seen = new Set();
    return prune(out.filter((r) => !Number.isNaN(r.t) && !seen.has(r.t) && seen.add(r.t)), now);
  }

  // ---------- Helpers ----------
  const r1 = (x) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 10) / 10);
  const r2 = (x) => (x === null || x === undefined || Number.isNaN(x) ? null : Math.round(x * 100) / 100);
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const stamp = (t) => { const d = new Date(t); return `${dayKey(t)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const midnight = (t, back = 0) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - back); return d.getTime(); };
  const groupBy = (xs, f) => { const m = new Map(); for (const x of xs) { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };

  // The same spot can be spelled F#5 in one key and Gb5 in another; group spots by pitch and string
  const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midiOf(note) {
    const m = /^([A-G])(##|bb|#|b)?(-?\d)$/.exec(String(note));
    if (!m) return null;
    const acc = { "#": 1, "##": 2, b: -1, bb: -2 }[m[2]] || 0;
    return (+m[3] + 1) * 12 + PC[m[1]] + acc;
  }
  const spotKey = (l) => `${midiOf(l.note)}${l.string}`;

  // Landings → how they went. Missed notes (tempo runs) count as not in tune but have no cents.
  function agg(ls) {
    if (!ls.length) return null;
    const heard = ls.filter((l) => l.cents !== null && l.cents !== undefined);
    return {
      landings: ls.length,
      avgCents: r1(mean(heard.map((l) => l.cents))),
      avgAbsCents: r1(mean(heard.map((l) => Math.abs(l.cents)))),
      inTuneRate: r2(ls.filter((l) => l.inTune).length / ls.length),
      wrongNoteRate: r2(ls.filter((l) => l.wrongNoteFirst).length / ls.length),
    };
  }
  // Same weighting the app uses to pick weak spots
  const badness = (a) => (a.avgAbsCents === null ? 40 : a.avgAbsCents) + (1 - a.inTuneRate) * 20;
  function trend(a, b) {
    if (!a || !b || a.landings < 3 || b.landings < 3) return null;
    const dIn = b.inTuneRate - a.inTuneRate, dAbs = (b.avgAbsCents ?? 40) - (a.avgAbsCents ?? 40);
    if (dIn >= 0.1 || dAbs <= -3) return dIn <= -0.1 || dAbs >= 3 ? "mixed" : "better";
    if (dIn <= -0.1 || dAbs >= 3) return "worse";
    return "steady";
  }
  const byField = (ls, f) => Object.fromEntries([...groupBy(ls, f)].sort(([a], [b]) => String(a).localeCompare(String(b), undefined, { numeric: true })).map(([k, v]) => [k, agg(v)]));

  // Runs into sessions: a gap of more than 45 minutes starts a new one (as Path does). Oldest first.
  function sessions(recs) {
    const asc = [...recs].sort((a, b) => a.t - b.t), out = [];
    for (const r of asc) {
      const cur = out[out.length - 1];
      if (cur && r.t - cur[cur.length - 1].t <= SESSION_GAP_MS) cur.push(r); else out.push([r]);
    }
    return out;
  }

  // ---------- Ranges ----------
  const RANGES = [
    { id: "session", label: "This session", detail: true },
    { id: "today", label: "Today", detail: true },
    { id: "3", label: "Last 3 days", days: 3 },
    { id: "7", label: "Last 7 days", days: 7 },
    { id: "14", label: "Last 14 days", days: 14 },
    { id: "30", label: "Last 30 days", days: 30 },
    { id: "all", label: `Everything kept (up to ${KEEP_DAYS} days)` },
  ];
  // The runs in a range, oldest first. "This session" is the latest session, even if it was yesterday.
  function select(log, rangeId, now) {
    const range = RANGES.find((x) => x.id === rangeId) || RANGES[0];
    let recs;
    if (range.id === "session") { const s = sessions(log); recs = s.length ? s[s.length - 1] : []; }
    else if (range.id === "today") recs = log.filter((r) => r.t >= midnight(now));
    else if (range.days) recs = log.filter((r) => r.t >= midnight(now, range.days - 1));
    else recs = [...log];
    return { range, recs: recs.sort((a, b) => a.t - b.t) };
  }

  // Earlier vs later half of the range: by practice day when there are two or more days, else by run
  function halves(recs) {
    const days = [...new Set(recs.map((r) => dayKey(r.t)))];
    if (days.length >= 2) {
      const early = new Set(days.slice(0, days.length >> 1));
      return { by: "day", earlier: recs.filter((r) => early.has(dayKey(r.t))), later: recs.filter((r) => !early.has(dayKey(r.t))) };
    }
    if (recs.length < 2) return null;
    return { by: "run", earlier: recs.slice(0, recs.length >> 1), later: recs.slice(recs.length >> 1) };
  }
  const landingsOf = (recs) => recs.flatMap((r) => r.notes.map(fromTuple));
  const half = (recs) => { const a = agg(landingsOf(recs)); return a && { runs: recs.length, avgScore: r2(mean(recs.map((r) => r.score))), ...a }; };

  // ---------- The export ----------
  const HOW_TO_READ = [
    "A log of the player's violin practice over the range below, across every drill, from the Fingerboard Coach app. Use it to find consistent patterns, write drills for them (drill format: the app's My drills tab), and, in later logs, measure whether they improved.",
    "cents = the first steady landing of a note, before any correction (+ sharp, − flat). inTuneRate = share of landings within the run's tolerance. wrongNoteRate = share where a different pitch sounded first.",
    "After a shift down, sharp = stopped short and flat = overshot. After a shift up, sharp = overshot and flat = fell short. A consistent sign on the same spot is a habit; scattered signs point to an unstable hand frame.",
    "A spot is a pitch on a string, combining every drill, key and spelling that uses it. finger and position are as written in the drill; position null = open string.",
    "earlier/later split the range in half (by practice day, or by run within a single day); trend compares them. timingMs (tempo runs) = + late, − early against the click as heard.",
    "claudeDrills: drills the player imported. targetSpots are the spots the drill uses; before/after compare those spots across ALL drills in everything the app has kept, around the date the drill was added (or first practised, if the add date isn't known).",
  ].join(" ");

  // opts: { now, a4, customs: [{ key, title, goal, source, added, spots: [{ note, string }] }], pieces: [{ t, title, key, summary }], detail }
  function build(log, rangeId, opts) {
    const now = opts.now, { range, recs } = select(log, rangeId, now);
    const detail = opts.detail === undefined ? !!range.detail : !!opts.detail;
    const ls = landingsOf(recs), H = halves(recs), sess = sessions(recs);
    const from = recs.length ? recs[0].t : null, to = recs.length ? recs[recs.length - 1].t : null;
    const days = groupBy(recs, (r) => dayKey(r.t));

    // Spots across every drill, worst first
    const lsE = H ? landingsOf(H.earlier) : [], lsL = H ? landingsOf(H.later) : [];
    const spotGroups = groupBy(ls, spotKey), eG = groupBy(lsE, spotKey), lG = groupBy(lsL, spotKey);
    const spots = [...spotGroups].filter(([, v]) => v.length >= 3).map(([k, v]) => {
      const a = agg(v), e = agg(eG.get(k) || []), l = agg(lG.get(k) || []);
      const shifts = byField(v.filter((x) => x.shift), (x) => x.shift);
      const wrong = [...groupBy(v.filter((x) => x.wrongNoteFirst), (x) => x.wrongNoteFirst)].sort((x, y) => y[1].length - x[1].length).map(([n, xs]) => `${n} ×${xs.length}`);
      return { note: v[0].note, string: v[0].string, fingerings: [...new Set(v.map((x) => `${x.finger}@${x.position ?? "open"}`))], ...a,
        ...(Object.keys(shifts).length ? { afterShift: shifts } : {}), ...(wrong.length ? { playedInstead: wrong.slice(0, 3) } : {}),
        ...(H ? { earlier: e, later: l, trend: trend(e, l) } : {}), _bad: badness(a) };
    }).sort((x, y) => y._bad - x._bad).map(({ _bad, ...x }) => x);

    const wrongPairs = [...groupBy(ls.filter((l) => l.wrongNoteFirst), (l) => `${l.note} (${l.string}) → ${l.wrongNoteFirst}`)]
      .sort((a, b) => b[1].length - a[1].length).slice(0, 10).map(([k, v]) => ({ targetToPlayed: k, times: v.length }));
    const timed = ls.filter((l) => "timingMs" in l);
    const timing = timed.length ? (() => {
      const t = timed.filter((l) => l.timingMs !== null);
      const sub = (xs) => ({ notes: xs.length, avgTimingMs: r1(mean(xs.filter((l) => l.timingMs !== null).map((l) => l.timingMs))), onTimeRate: r2(xs.filter((l) => l.onTime).length / xs.length) });
      return { ...sub(timed), avgAbsTimingMs: r1(mean(t.map((l) => Math.abs(l.timingMs)))), missedRate: r2(timed.filter((l) => l.missed).length / timed.length),
        afterShift: Object.fromEntries([...groupBy(timed, (l) => l.shift || "none")].map(([k, v]) => [k, sub(v)])) };
    })() : null;

    // Each drill: how its runs went over the range
    const drills = [...groupBy(recs, (r) => r.key)].map(([key, rs]) => {
      const first = rs[0], last = rs[rs.length - 1], bpms = rs.filter((r) => r.bpm).map((r) => r.bpm);
      return { drill: last.label, key, runs: rs.length, modes: [...new Set(rs.map((r) => r.mode))], passRate: r2(rs.filter((r) => r.passed).length / rs.length),
        first: { date: stamp(first.t), score: first.score, ...(first.bpm ? { bpm: first.bpm } : {}) }, last: { date: stamp(last.t), score: last.score, ...(last.bpm ? { bpm: last.bpm } : {}) },
        bestScore: Math.max(...rs.map((r) => r.score)), scores: rs.slice(-40).map((r) => r2(r.score)), ...(bpms.length ? { bpms: bpms.slice(-40) } : {}), ...agg(landingsOf(rs)) };
    }).sort((a, b) => b.runs - a.runs);

    // Claude's drills: did the notes they target get better, across all practice?
    const all = [...log].sort((a, b) => a.t - b.t);
    const claudeDrills = (opts.customs || []).map((c) => {
      const own = all.filter((r) => r.key === c.key), inRange = recs.filter((r) => r.key === c.key);
      const since = c.added || (own.length ? own[0].t : null);
      const addedInRange = c.added && from !== null && c.added >= from && c.added <= now;
      if (!inRange.length && !addedInRange && range.id !== "all") return null;
      if (!own.length && !c.added) return null;
      const targets = new Set(c.spots.map((s) => `${midiOf(s.note)}${s.string}`));
      const onTargets = (rs) => landingsOf(rs).filter((l) => targets.has(spotKey(l)));
      const before = since === null ? null : agg(onTargets(all.filter((r) => r.t < since)));
      const after = since === null ? null : agg(onTargets(all.filter((r) => r.t >= since)));
      return { title: c.title, ...(c.goal ? { goal: c.goal } : {}), source: c.source,
        since: since === null ? null : stamp(since), sinceIs: c.added ? "added" : own.length ? "first practised" : null,
        runs: own.length, runsInRange: inRange.length, ...(own.length ? { firstScore: own[0].score, lastScore: own[own.length - 1].score, bestScore: Math.max(...own.map((r) => r.score)) } : {}),
        targetSpots: c.spots.map((s) => `${s.note}/${s.string}`), beforeOnTargets: before, afterOnTargets: after, trend: trend(before, after) };
    }).filter(Boolean);

    const pieces = (opts.pieces || []).filter((p) => from !== null && p.t >= midnight(from) && p.t <= now).map((p) => ({ date: stamp(p.t), title: p.title, key: p.key, ...p.summary }));

    return {
      format: FORMAT, exported: new Date(now).toISOString(), howToRead: HOW_TO_READ,
      range: { label: range.label, from: from && stamp(from), to: to && stamp(to), everyNote: detail },
      a4: opts.a4,
      overview: {
        runs: recs.length, sessions: sess.length, daysPractised: days.size,
        runsPerDay: Object.fromEntries([...days].map(([d, rs]) => [d, rs.length])),
        passRate: recs.length ? r2(recs.filter((r) => r.passed).length / recs.length) : null,
        avgScore: r2(mean(recs.map((r) => r.score))), ...agg(ls),
        ...(H ? { splitBy: H.by, earlier: half(H.earlier), later: half(H.later), trend: trend(agg(lsE), agg(lsL)) } : {}),
      },
      patterns: {
        afterShift: byField(ls, (l) => l.shift || "none"),
        byFinger: byField(ls, (l) => String(l.finger)),
        byPosition: byField(ls, (l) => (l.position ? String(l.position) : "open")),
        byString: byField(ls, (l) => l.string),
        spots: spots.slice(0, 30),
        wrongNotes: wrongPairs,
        ...(timing ? { timing } : {}),
      },
      drills,
      claudeDrills,
      ...(pieces.length ? { pieces } : {}),
      sessions: sess.map((s) => ({
        start: stamp(s[0].t), end: stamp(s[s.length - 1].t), runs: s.length,
        list: s.map((r) => ({ time: stamp(r.t), drill: r.label, mode: r.mode, ...(r.bpm ? { bpm: r.bpm } : {}), ...(r.per ? { notesPerBeat: r.per } : {}),
          tolerance: r.tol, score: r.score, passed: r.passed, ...(detail ? { ...(r.coach ? { coachNotes: r.coach } : {}), landings: r.notes.map(fromTuple) } : {}) })),
      })),
    };
  }

  // Indented JSON, but small leaf objects and arrays (a landing, a list of scores) stay on one line
  function stringify(v) {
    const leaf = (x) => x === null || typeof x !== "object" || Object.values(x).every((y) => y === null || typeof y !== "object");
    const go = (x, ind) => {
      if (leaf(x)) return JSON.stringify(x);
      const p = ind + "  ";
      if (Array.isArray(x)) return `[\n${x.map((y) => p + go(y, p)).join(",\n")}\n${ind}]`;
      return `{\n${Object.entries(x).filter(([, y]) => y !== undefined).map(([k, y]) => `${p}${JSON.stringify(k)}: ${go(y, p)}`).join(",\n")}\n${ind}}`;
    };
    return go(v, "");
  }

  const api = { FORMAT, KEEP_DAYS, KEEP_RUNS, RANGES, record, add, prune, backfill, select, sessions, build, stringify, midiOf };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PracticeLog = api;
})(this);
