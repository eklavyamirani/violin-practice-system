// Watch line and Fix mode. Before a run, the Watch line names the note in the selected drill that has been
// landing off on the same side lately. From it, "Fix this note" and "Fix this progression" run Molly Gebrian's
// microbreaks on that spot (Learn Faster, Perform Better, OUP 2024, Appendix A, ch. 4): three clean repetitions,
// a 10-second break, three more; a repetition with an error starts the set over.
// Fix repetitions are logged in their own list (DB.fixes), never in the note history, so the Watch line keeps
// judging the note from real drills.
// Pure logic. Works in the browser (window.Fix) and in Node (module.exports) for testing.
(function (root) {
  "use strict";

  // ---------- The Watch line ----------
  // A note's last landings (DB.notes[key].recent, up to 20) average this far off, with at least this share on that side
  const WATCH_CENTS = 6, WATCH_SIDE = 0.7, WATCH_MIN = 8;
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;

  /**
   * The note in a drill to watch: { it, avg, n, side } or null. seq: the drill's notes; notes: DB.notes.
   * Only stopped notes (open strings have nothing to place). The worst one when several qualify.
   */
  function watchOut(seq, notes) {
    let best = null;
    const items = new Map((seq || []).filter((x) => x.pos && x.finger !== "0").map((x) => [x.key, x]));
    for (const it of items.values()) {
      const r = ((notes || {})[it.key] || {}).recent || [];
      if (r.length < WATCH_MIN) continue;
      const avg = mean(r);
      if (Math.abs(avg) < WATCH_CENTS) continue;
      const side = r.filter((c) => Math.sign(c) === Math.sign(avg)).length / r.length;
      if (side >= WATCH_SIDE && (!best || Math.abs(avg) > Math.abs(best.avg))) best = { it, avg, n: r.length, side };
    }
    return best;
  }

  /** The note before the watched one in the drill, for Fix this progression: one across a shift or a string crossing first. */
  function approach(seq, it) {
    let best = null;
    for (let k = 1; k < (seq || []).length; k++) {
      const c = seq[k - 1];
      if (seq[k].key !== it.key || c.key === it.key) continue;
      const score = (c.pos && it.pos && c.pos !== it.pos ? 2 : 0) + (c.string !== it.string ? 1 : 0);
      if (!best || score > best.score) best = { c, score };
    }
    return best ? best.c : null;
  }

  // ---------- Fix mode ----------
  const SET = 3, SETS = 2, BREAK_MS = 10000, QUIET_MS = 300, MISS_BREAK = 3;
  const CAPTURE = 60; // a pitch within this many cents of a note is that note (the app's drills use the same)

  /**
   * A new fix. kind: "note" | "progression"; target: the watched note; from: the approach note (progression);
   * tol: the cents a clean landing must be within (the drill's medal tolerance); avg: the Watch line's average.
   */
  function start({ kind, target, from = null, tol, avg = 0 }) {
    const steps = kind === "progression" && from ? [from, target] : [target];
    return { kind: steps.length > 1 ? "progression" : "note", steps, target, tol, avg,
      phase: "play", step: 0, sets: 0, count: 0, missRun: 0, reps: [], wrong: null, quietSince: null,
      breakUntil: 0, breakWhy: null, last: null };
  }

  // One repetition is over: clean or a miss. cents: the target's first steady pitch (null: stopped after a wrong note).
  // quiet: the player has already been quiet for QUIET_MS (stopped after a wrong note), so listen again at once.
  function rep(f, t, cents, quiet = false) {
    const ok = cents !== null && f.wrong === null && Math.abs(cents) <= f.tol + 1e-6;
    f.reps.push({ c: cents === null ? null : Math.round(cents), ok, ...(f.wrong !== null ? { wrong: f.wrong } : {}) });
    f.last = { ok, cents, wrong: f.wrong };
    f.phase = quiet ? "play" : "quiet"; f.quietSince = null; f.step = 0; f.wrong = null;
    if (ok) {
      f.missRun = 0;
      if (++f.count >= SET) {
        f.sets++; f.count = 0;
        if (f.sets >= SETS) f.phase = "done";
        else { f.phase = "break"; f.breakUntil = t + BREAK_MS; f.breakWhy = "set"; }
      }
    } else {
      f.count = 0;
      if (++f.missRun >= MISS_BREAK) { f.missRun = 0; f.phase = "break"; f.breakUntil = t + BREAK_MS; f.breakWhy = "misses"; }
    }
    return { type: "rep", ok, cents, wrong: f.last.wrong };
  }

  /**
   * One frame. t: ms; stable: the first steady pitch as a MIDI number, or null; sounding: whether any pitch is
   * heard now. Returns what happened, or null: { type: "rep", ok, cents, wrong } | "approach" | "wrong" |
   * "listen" (quiet after a repetition: listening again) | "tick" (a break counting down) | "breakEnd".
   */
  function step(f, t, stable, sounding) {
    if (f.phase === "done") return null;
    if (f.phase === "break") { // nothing is scored during a break; afterwards it waits for quiet as after any repetition
      if (t < f.breakUntil) return { type: "tick" };
      f.phase = "quiet"; f.quietSince = null;
      return { type: "breakEnd" };
    }
    if (f.phase === "quiet") { // wait for the bow to stop, so one long note can't count twice
      if (sounding) { f.quietSince = null; return null; }
      if (f.quietSince === null) f.quietSince = t;
      if (t - f.quietSince < QUIET_MS) return null;
      f.phase = "play"; f.quietSince = null;
      return { type: "listen" };
    }
    // Playing. A wrong note and then stopping is a miss: no need to land the target to find out.
    if (f.wrong !== null) {
      if (sounding) f.quietSince = null;
      else if (f.quietSince === null) f.quietSince = t;
      else if (t - f.quietSince >= QUIET_MS) return rep(f, t, null, true);
    }
    if (stable === null) return null;
    const cur = f.steps[f.step], dev = (stable - cur.midi) * 100;
    if (Math.abs(dev) <= CAPTURE) {
      if (f.step < f.steps.length - 1) { f.step++; return { type: "approach" }; } // the approach note only has to be the right note
      return rep(f, t, dev);
    }
    const prev = f.steps[f.step - 1];
    if (prev && Math.abs(stable - prev.midi) * 100 <= CAPTURE) return null; // still on the approach note
    if (f.steps.length > 1 && f.step === 0) return null; // anything before the approach note isn't part of the repetition
    if (f.wrong === null) { f.wrong = Math.round(stable); return { type: "wrong", midi: f.wrong }; }
    return null;
  }

  const clean = (f) => f.reps.filter((r) => r.ok).length;
  const misses = (f) => f.reps.length - clean(f);
  const done = (f) => f.sets >= SETS;

  // ---------- The fix log (DB.fixes) ----------
  // Newest first, each with t (its id: sync merges the list record by record), kept 90 days, at most 200
  const KEEP = 200, KEEP_DAYS = 90, DAY_MS = 86400000;
  const prune = (list, now) => (list || []).filter((r) => r.t >= now - KEEP_DAYS * DAY_MS).sort((a, b) => b.t - a.t).slice(0, KEEP);

  /** A finished (or stopped) fix → a log record; null when no repetition was played. name: MIDI → note name. */
  function record(f, now, name = String) {
    if (!f.reps.length) return null;
    const tg = f.target, from = f.steps.length > 1 ? f.steps[0] : null;
    return { t: now, key: tg.key, note: name(tg.midi), string: tg.string, finger: tg.finger, pos: tg.pos || null, kind: f.kind,
      ...(from ? { from: name(from.midi), fromString: from.string } : {}),
      tol: f.tol, watchAvg: Math.round(f.avg), clean: clean(f), misses: misses(f), done: done(f),
      reps: f.reps.map((r) => ({ c: r.c, ok: r.ok, ...(r.wrong !== undefined ? { wrong: name(r.wrong) } : {}) })) };
  }
  const add = (list, rec, now) => (rec ? prune([rec, ...(list || []).filter((r) => r.t !== rec.t)], now) : prune(list, now));

  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
  /** Finished fixes of a note today, for the Watch line ("Fixed 2× today"). */
  const doneToday = (list, key, now) => (list || []).filter((r) => r.key === key && r.done && sameDay(r.t, now)).length;

  const api = { WATCH_CENTS, WATCH_SIDE, WATCH_MIN, SET, SETS, BREAK_MS, QUIET_MS, MISS_BREAK, CAPTURE, KEEP, KEEP_DAYS,
    watchOut, approach, start, step, clean, misses, done, record, add, prune, doneToday };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Fix = api;
})(this);
