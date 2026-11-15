// Ear training: hear a scale, find the note that's out of tune and say whether it's flat or sharp.
// Pure logic (stages, questions, grading, the adaptive cents ladder); the app does the sound and the UI.
// Works in the browser (window.Ear) and in Node (module.exports) for testing.
(function (root) {
  const Scales = root.Scales || (typeof require !== "undefined" ? require("./scales.js") : null);

  const ALL = ["G", "D", "A", "E"];
  // G major, built up the way the Path builds it: 1st position, then through 3rd, then three octaves through 5th.
  // `drill` picks the scale run Scales.buildDrills makes for that setup (up and back down).
  const STAGES = [
    { id: "g-1st-1", title: "1st position · one octave", sub: "G3–G4 on G & D", cfg: { tonic: "G", type: "major", strings: ["G", "D"], positions: [1] }, drill: "scale" },
    { id: "g-1st-2", title: "1st position · two octaves", sub: "G3–G5, open strings", cfg: { tonic: "G", type: "major", strings: ALL, positions: [1] }, drill: "scale" },
    { id: "g-3rd-2", title: "Two octaves through 3rd", sub: "G3–G5, shift to 3rd on D", cfg: { tonic: "G", type: "major", strings: ALL, positions: [1, 3] }, drill: "shift" },
    { id: "g-5th-3", title: "Three octaves through 5th", sub: "G3–G6, 1st → 3rd → 5th", cfg: { tonic: "G", type: "major", strings: ALL, positions: [1, 3, 5] }, drill: "shift" },
  ];

  // How far the wrong note is off, in cents, easiest first. 2 right in a row → one step finer, 1 wrong → one step coarser
  // (2-down/1-up staircase: it settles where you're right about 71% of the time; Levitt 1971).
  const LADDER = [50, 40, 30, 25, 20, 15, 12, 10, 8, 6, 5];
  // Same targets as the playing medals: 🥉 ±25¢, 🥈 ±15¢, 🥇 ±10¢
  const MEDALS = [{ icon: "🥉", cents: 25 }, { icon: "🥈", cents: 15 }, { icon: "🥇", cents: 10 }];
  const P_CLEAN = 0.25; // share of questions with every note in tune, so "something's off" isn't a given
  const KEEP_HIST = 300;
  const DEGREES = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th"];

  const cache = {};
  function notes(stage) {
    if (cache[stage.id]) return cache[stage.id];
    const d = Scales.buildDrills(stage.cfg).find((x) => x.id === stage.drill);
    const tonicPc = Scales.spell(stage.cfg.tonic, Scales.SCALE_TYPES[stage.cfg.type]).tonicPc;
    const steps = Scales.SCALE_TYPES[stage.cfg.type].steps;
    return (cache[stage.id] = d.notes.map((n) => ({
      midi: n.midi, label: n.label, oct: n.oct, string: n.string, finger: n.finger, pos: n.pos,
      deg: steps.indexOf((((n.midi - tonicPc) % 12) + 12) % 12),
    })));
  }
  const stageById = (id) => STAGES.find((s) => s.id === id) || STAGES[0];

  const fresh = () => ({ lvl: 0, streak: 0, move: null, revs: [], best: null, n: 0, ok: 0, deg: {} });
  const stateOf = (ear, id) => (ear.stages[id] = ear.stages[id] || fresh());

  // A question: which note (if any) is off, which way and by how much. Never the first note: it's the reference.
  function question(stage, st, rnd = Math.random) {
    const ns = notes(stage), cents = LADDER[st.lvl];
    if (rnd() < P_CLEAN) return { stage: stage.id, cents, off: null, dir: 0 };
    // Lean towards the scale degrees and directions you've missed
    const weight = (i, dir) => {
      const d = st.deg[ns[i].deg] || {};
      const s = d[dir > 0 ? "s" : "f"] || [0, 0];
      return 1 + 2 * (s[1] - s[0]);
    };
    const opts = [];
    for (let i = 1; i < ns.length; i++) for (const dir of [-1, 1]) opts.push({ i, dir, w: weight(i, dir) });
    let r = rnd() * opts.reduce((a, o) => a + o.w, 0);
    const pick = opts.find((o) => (r -= o.w) < 0) || opts[opts.length - 1];
    return { stage: stage.id, cents, off: pick.i, dir: pick.dir };
  }

  // Cents each note is played at (0 = in tune)
  const detune = (q, n) => Array.from({ length: n }, (_, i) => (i === q.off ? q.dir * q.cents : 0));

  // answer: { off: index | null, dir: -1 | 1 | 0 }
  function grade(q, a) {
    if (q.off === null) return { ok: a.off === null, kind: a.off === null ? "clean" : "false-alarm" };
    if (a.off === null) return { ok: false, kind: "missed" };
    if (a.off !== q.off) return { ok: false, kind: a.dir === q.dir ? "wrong-note" : "wrong-note-dir" };
    return a.dir === q.dir ? { ok: true, kind: "hit" } : { ok: false, kind: "wrong-dir" };
  }

  // Move along the ladder and keep the stats; returns what changed for the UI
  function record(ear, q, a, res, now = Date.now()) {
    const st = stateOf(ear, q.stage), stage = stageById(q.stage);
    const before = st.lvl;
    st.n++; if (res.ok) st.ok++;
    if (q.off !== null) {
      const deg = notes(stage)[q.off].deg, k = q.dir > 0 ? "s" : "f";
      const d = (st.deg[deg] = st.deg[deg] || {});
      d[k] = d[k] || [0, 0];
      d[k][1]++; if (res.ok) d[k][0]++;
    } else {
      const d = (st.deg.clean = st.deg.clean || [0, 0]);
      d[1]++; if (res.ok) d[0]++;
    }
    let medal = null;
    if (res.ok) {
      st.streak++;
      if (st.streak >= 2) {
        st.streak = 0;
        if (st.best === null || q.cents < st.best) {
          const had = medalOf(st.best);
          st.best = q.cents;
          const now2 = medalOf(st.best);
          if (now2 && now2 !== had) medal = now2;
        }
        if (st.move === "up") st.revs.push(q.cents);
        st.move = "down";
        st.lvl = Math.min(LADDER.length - 1, st.lvl + 1);
      }
    } else {
      st.streak = 0;
      if (st.move === "down") st.revs.push(q.cents);
      st.move = "up";
      st.lvl = Math.max(0, st.lvl - 1);
    }
    st.revs = st.revs.slice(-12);
    ear.hist.unshift({ t: now, st: q.stage, c: q.cents, off: q.off === null ? null : notes(stage)[q.off].deg, dir: q.dir, ok: res.ok, kind: res.kind });
    ear.hist = ear.hist.slice(0, KEEP_HIST);
    return { finer: st.lvl > before, coarser: st.lvl < before, medal };
  }

  const medalOf = (best) => (best === null ? null : [...MEDALS].reverse().find((m) => best <= m.cents) || null);
  // Where you can hear it: the mean of the last 6 turning points, once there are 4
  function threshold(st) {
    if (!st || st.revs.length < 4) return null;
    const r = st.revs.slice(-6);
    return Math.round(r.reduce((a, b) => a + b, 0) / r.length);
  }
  // The first stage without 🥈 is the one to work on
  const nextStage = (ear) => STAGES.find((s) => !(ear.stages[s.id] && ear.stages[s.id].best !== null && ear.stages[s.id].best <= 15)) || STAGES[STAGES.length - 1];

  // ---------- Which string: the same note on different strings, from recordings of your own violin ----------
  // Only the string can be heard: the same note on one string in two positions is the same length of string.
  const STRING_STAGES = [
    { id: "s-1st", title: "1st position · open or 4th finger", sub: "D4, A4, E5", positions: [1] },
    { id: "s-3rd", title: "Through 3rd position", sub: "9 notes, open to 3rd", positions: [1, 3] },
    { id: "s-5th", title: "Through 5th position", sub: "13 notes, open to 5th", positions: [1, 3, 5] },
  ];
  const spotId = (n) => `${n.midi}${n.string}`;
  // Every G major note on each string in these positions (open strings included), lowest position first
  function spots(positions) {
    const sp = Scales.spell("G", Scales.SCALE_TYPES.major), out = new Map();
    for (const s of Scales.STRING_ORDER) {
      const all = [Scales.openString(s, sp)];
      for (const p of positions) for (const f of ["1", "2", "3", "4"]) all.push(Scales.fingering(s, p, f, sp));
      for (const n of all) if (!out.has(spotId(n))) out.set(spotId(n), { id: spotId(n), midi: n.midi, string: n.string, finger: n.finger, pos: n.pos, label: n.label, oct: n.oct });
    }
    return [...out.values()];
  }
  // The notes that can be played on more than one string, each with its spots (lowest string first)
  const scache = {};
  function stringNotes(stage) {
    if (scache[stage.id]) return scache[stage.id];
    const by = new Map();
    for (const n of spots(stage.positions)) by.set(n.midi, (by.get(n.midi) || []).concat(n));
    return (scache[stage.id] = [...by.values()].filter((v) => v.length > 1).sort((a, b) => a[0].midi - b[0].midi)
      .map((v) => ({ midi: v[0].midi, label: v[0].label, oct: v[0].oct, spots: v.sort((a, b) => Scales.STRING_ORDER.indexOf(a.string) - Scales.STRING_ORDER.indexOf(b.string)) })));
  }
  // What to record for a stage, string by string, low to high, so you can play up each string
  const stringSpots = (stage) => stringNotes(stage).flatMap((n) => n.spots)
    .sort((a, b) => Scales.STRING_ORDER.indexOf(a.string) - Scales.STRING_ORDER.indexOf(b.string) || a.midi - b.midi);
  const stringStageById = (id) => STRING_STAGES.find((s) => s.id === id) || STRING_STAGES[0];

  const strFresh = () => ({ cmp: [], nm: [], n: 0, ok: 0, notes: {}, medal: 0 });
  const strState = (ear, id) => { ear.strings = ear.strings || {}; return (ear.strings[id] = ear.strings[id] || strFresh()); };
  // 🥉 tell two strings apart: 8 of the last 10 · 🥈 name the string: 14 of the last 20 · 🥇 18 of the last 20
  // (by guessing, 8/10 or 14/20 of two-way choices happens about 5% of the time)
  function strMedal(st) {
    const sum = (a) => a.reduce((x, y) => x + y, 0);
    let m = 0;
    if (st.cmp.length >= 10 && sum(st.cmp.slice(-10)) >= 8) m = 1;
    if (st.nm.length >= 20 && sum(st.nm.slice(-20)) >= 14) m = Math.max(m, 2);
    if (st.nm.length >= 20 && sum(st.nm.slice(-20)) >= 18) m = 3;
    return Math.max(st.medal || 0, m);
  }
  // Compare two strings until 🥉, then name the string
  const strMode = (st) => (strMedal(st) >= 1 ? "name" : "compare");

  // ready(id) says whether that spot has a recording. Notes with fewer than 2 recorded strings are left out.
  function strQuestion(stage, st, mode, ready, rnd = Math.random) {
    const notes = stringNotes(stage).map((n) => ({ ...n, spots: n.spots.filter((x) => ready(x.id)) })).filter((n) => n.spots.length > 1);
    if (!notes.length) return null;
    const w = notes.map((n) => { const s = st.notes[n.midi] || [0, 0]; return 1 + 2 * (s[1] - s[0]); });
    let r = rnd() * w.reduce((a, b) => a + b, 0);
    const note = notes[Math.max(0, w.findIndex((x) => (r -= x) < 0))] || notes[notes.length - 1];
    const pickOne = (l) => l[Math.min(l.length - 1, Math.floor(rnd() * l.length))];
    if (mode === "compare") {
      const a = pickOne(note.spots), b = pickOne(note.spots.filter((x) => x !== a));
      return { mode, stage: stage.id, midi: note.midi, label: note.label, oct: note.oct, play: [a, b], options: note.spots };
    }
    return { mode, stage: stage.id, midi: note.midi, label: note.label, oct: note.oct, play: [pickOne(note.spots)], options: note.spots };
  }
  const lower = (a, b) => Scales.STRING_ORDER.indexOf(a.string) < Scales.STRING_ORDER.indexOf(b.string);
  // compare: answer 0 or 1 (which one was on the lower string) · name: answer is the string
  const strAnswer = (q) => (q.mode === "compare" ? (lower(q.play[0], q.play[1]) ? 0 : 1) : q.play[0].string);
  const strGrade = (q, a) => a === strAnswer(q);
  function strRecord(ear, q, ok, now = Date.now()) {
    const st = strState(ear, q.stage), had = strMedal(st);
    st.n++; if (ok) st.ok++;
    const l = q.mode === "compare" ? st.cmp : st.nm;
    l.push(ok ? 1 : 0);
    if (l.length > 20) l.splice(0, l.length - 20);
    const s = (st.notes[q.midi] = st.notes[q.midi] || [0, 0]);
    s[1]++; if (ok) s[0]++;
    st.medal = strMedal(st);
    ear.hist.unshift({ t: now, k: "str", st: q.stage, mode: q.mode, midi: q.midi, ok });
    ear.hist = ear.hist.slice(0, KEEP_HIST);
    return { medal: st.medal > had ? MEDALS[st.medal - 1] : null };
  }

  const api = { STAGES, LADDER, MEDALS, P_CLEAN, DEGREES, notes, stageById, fresh, stateOf, question, detune, grade, record, medalOf, threshold, nextStage,
    STRING_STAGES, spotId, spots, stringNotes, stringSpots, stringStageById, strState, strMedal, strMode, strQuestion, strAnswer, strGrade, strRecord };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Ear = api;
})(typeof window !== "undefined" ? window : globalThis);
