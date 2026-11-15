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

  const api = { STAGES, LADDER, MEDALS, P_CLEAN, DEGREES, notes, stageById, fresh, stateOf, question, detune, grade, record, medalOf, threshold, nextStage };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Ear = api;
})(typeof window !== "undefined" ? window : globalThis);
