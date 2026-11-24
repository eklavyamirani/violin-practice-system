// Where intonation goes off, by context:
// - direction: the same notes going up against coming down,
// - after a shift: the note the shift lands on, then the next notes in the new position,
// - after a frame change: the notes after an accidental, a finger moved off its usual spot, or a stretch.
//   These are compared with the same notes (same spot, same direction) played elsewhere, so a note that is
//   always a little sharp doesn't look like a frame problem.
// Pure logic. Works in the browser (window.Context) and in Node (module.exports) for testing.
(function (root) {
  "use strict";

  // AFTER: how many notes after an event count as "after it". MAX_GAP_MS: a longer gap (a rest, a new phrase) ends it.
  const AFTER = 3, MAX_GAP_MS = 1500;

  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const r1 = (x) => (x === null ? null : Math.round(x * 10) / 10);
  const agg = (xs) => (xs.length ? { n: xs.length, mean: r1(mean(xs)), abs: r1(mean(xs.map(Math.abs))) } : null);
  const heard = (x) => x.cents !== null && x.cents !== undefined;
  const stopped = (x) => !!x.pos; // open strings aren't placed by the hand
  const spot = (x) => `${x.midi}|${x.string || ""}`;
  const pc = (m) => ((m % 12) + 12) % 12;
  const contiguous = (a, b) => a.t === undefined || b.t === undefined || b.t - a.t <= MAX_GAP_MS;

  // Direction of each note from the one before: "up", "down" or null
  const dirs = (notes) => notes.map((x, i) => (i && notes[i - 1].midi !== x.midi && contiguous(notes[i - 1], x) ? (x.midi > notes[i - 1].midi ? "up" : "down") : null));

  // notes: [{ midi, cents (null = not heard), string?, finger?, pos?, shift? ("up" | "down" | null), t?, letter? ("F") }] in the order played
  // → { spots, up, down, diff }: the mean over spots heard both ways (down − up), or null.
  // skip: indices to leave out (the notes after a frame change, so that problem isn't counted as a direction one).
  function direction(notes, skip = null) {
    const d = dirs(notes), by = new Map();
    notes.forEach((x, i) => { if (d[i] && heard(x) && !(skip && skip.has(i))) { const k = spot(x); if (!by.has(k)) by.set(k, { up: [], down: [] }); by.get(k)[d[i]].push(x.cents); } });
    const paired = [...by.values()].filter((s) => s.up.length && s.down.length);
    if (!paired.length) return null;
    const up = mean(paired.map((s) => mean(s.up))), down = mean(paired.map((s) => mean(s.down)));
    return { spots: paired.length, up: r1(up), down: r1(down), diff: r1(down - up) };
  }

  // The note each shift lands on, and the next AFTER stopped notes in that position (before another shift)
  // → { up: { landing, after }, down: { landing, after }, rest } (each an agg of cents, or null), or null with no shifts
  function afterShift(notes) {
    const role = notes.map(() => null);
    notes.forEach((x, i) => {
      if (!x.shift || !stopped(x)) return;
      role[i] = { kind: "landing", dir: x.shift };
      for (let j = i + 1, k = 0; j < notes.length && k < AFTER; j++) {
        const y = notes[j];
        if (y.shift || !contiguous(notes[j - 1], y)) break;
        if (!stopped(y)) continue;
        if (y.pos !== x.pos) break;
        if (!role[j]) role[j] = { kind: "after", dir: x.shift };
        k++;
      }
    });
    if (!role.some(Boolean)) return null;
    const pick = (kind, dir) => notes.filter((x, i) => role[i] && role[i].kind === kind && role[i].dir === dir && heard(x)).map((x) => x.cents);
    const out = { rest: agg(notes.filter((x, i) => !role[i] && stopped(x) && heard(x)).map((x) => x.cents)) };
    for (const dir of ["up", "down"]) out[dir] = { landing: agg(pick("landing", dir)), after: agg(pick("after", dir)) };
    return out;
  }

  // Notes that change the hand frame. keyPcs: Set of the key's pitch classes, or null when unknown.
  // why: "accidental" (outside the key), "moved" (this finger plays a different pitch here than it usually does on this
  // string and position), "stretch" (4x). lowered: true when the finger sits lower than usual / than the key's note.
  function frameEvents(notes, keyPcs) {
    const usual = new Map();
    for (const x of notes) if (stopped(x) && x.finger !== undefined && String(x.finger) !== "0") {
      const k = `${x.string}|${x.pos}|${x.finger}`;
      if (!usual.has(k)) usual.set(k, new Map());
      usual.get(k).set(x.midi, (usual.get(k).get(x.midi) || 0) + 1);
    }
    const out = [];
    notes.forEach((x, i) => {
      const why = [];
      let lowered = null;
      if (keyPcs && !keyPcs.has(pc(x.midi))) {
        why.push("accidental");
        // F♮ in G major: the key's F is F♯, so the finger sits low. Without the spelling, go by which neighbour is in the key.
        const own = x.letter && keyPcs.letters && keyPcs.letters[x.letter];
        if (own && own.length) { const k = own.map((p) => ((p - pc(x.midi) + 18) % 12) - 6).sort((a, b) => Math.abs(a) - Math.abs(b))[0]; lowered = k > 0; }
        else { const up = keyPcs.has(pc(x.midi + 1)), down = keyPcs.has(pc(x.midi - 1)); if (up !== down) lowered = up; }
      }
      if (String(x.finger) === "4x") { why.push("stretch"); lowered = false; }
      const u = stopped(x) && usual.get(`${x.string}|${x.pos}|${x.finger}`);
      if (u && u.size > 1) {
        const top = [...u].sort((a, b) => b[1] - a[1]);
        if (top[0][1] > top[1][1] && top[0][0] !== x.midi) { why.push("moved"); if (lowered === null) lowered = x.midi < top[0][0]; }
      }
      if (why.length) out.push({ i, why, lowered });
    });
    return out;
  }

  // The notes after each frame change, against the same notes (spot and direction) where no frame change came before.
  // → [{ i, why, lowered, deltas: [{ j, cents, delta }] }] for events with at least one comparable note after them
  function follows(notes, ev) {
    const isEv = new Set(ev.map((e) => e.i)), after = new Set();
    const follow = ev.map((e) => {
      const js = [];
      for (let j = e.i + 1; j < notes.length && js.length < AFTER; j++) {
        const y = notes[j];
        if (isEv.has(j) || y.shift || !contiguous(notes[j - 1], y)) break;
        if (notes[e.i].pos && y.pos && y.pos !== notes[e.i].pos) break;
        if (notes[e.i].pos && !stopped(y)) continue;
        js.push(j); after.add(j);
      }
      return js;
    });
    return { isEv, after, follow };
  }
  // Indices of frame changes and the notes after them
  function frameIndices(notes, keyPcs) {
    const { isEv, after } = follows(notes, frameEvents(notes, keyPcs));
    return new Set([...isEv, ...after]);
  }
  function afterFrame(notes, keyPcs) {
    const ev = frameEvents(notes, keyPcs), d = dirs(notes), { isEv, after, follow } = follows(notes, ev);
    const base = new Map();
    notes.forEach((x, j) => { if (!isEv.has(j) && !after.has(j) && heard(x) && d[j]) { const k = `${spot(x)}|${d[j]}`; if (!base.has(k)) base.set(k, []); base.get(k).push(x.cents); } });
    return ev.map((e, n) => ({ ...e, deltas: follow[n].filter((j) => heard(notes[j]) && d[j] && base.has(`${spot(notes[j])}|${d[j]}`))
      .map((j) => ({ j, cents: notes[j].cents, delta: r1(notes[j].cents - mean(base.get(`${spot(notes[j])}|${d[j]}`))) })) })).filter((e) => e.deltas.length);
  }

  // A key's pitch classes from Scales.spell(...).acc (melodic minor also takes its natural form, which it uses coming down).
  // .letters: each letter's pitch classes in the key, so a note can say which way it is off the key's note.
  function keyPcs(accs) {
    const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11], s = new Set();
    s.letters = {};
    for (const acc of accs) acc.forEach((a, l) => { const p = pc(NATURAL_PC[l] + a), L = "CDEFGAB"[l]; s.add(p); (s.letters[L] ||= []).includes(p) || s.letters[L].push(p); });
    return s;
  }

  const api = { AFTER, MAX_GAP_MS, direction, afterShift, frameEvents, afterFrame, frameIndices, keyPcs, agg };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Context = api;
})(this);
