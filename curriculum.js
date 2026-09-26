// Path mode: a skill graph that orders keys by the positions each one needs (1st → 3rd → 5th), makes
// descending its own scored direction, and only raises tempo or declares mastery after consistent runs
// on separate days. Pure logic: drills, metrics, pass criteria, node state, and what to practise next.
// Works in the browser (window.Curriculum) and in Node (module.exports) for testing.
(function (root) {
  const S = typeof module !== "undefined" && module.exports ? require("./scales.js") : root.Scales;
  const T = S.SCALE_TYPES, ALL = ["G", "D", "A", "E"], ord = S.ordinal;
  const DIRS = ["asc_desc", "desc_asc"];
  const DIR_TEXT = { asc_desc: "⇡⇣ up first", desc_asc: "⇣⇡ from the top" };

  // Pass criteria for one run. These are starting defaults, not published norms: calibrate them against
  // real recordings. "ring" is the window for G, D, A and E, which can be checked against the open strings.
  const LEVELS = {
    learning: { median: 15, window: 20, ring: 20, pct: 0.85, evenness: 12, octave: 15, ioiCV: 0.12, shift: 0.8, onsetMs: 80 },
    mastery: { median: 10, window: 15, ring: 8, pct: 0.92, evenness: 8, octave: 10, ioiCV: 0.08, shift: 0.95, onsetMs: 50 },
  };
  const LEADING_TONE_SLACK = 8; // ¢ a rising leading tone may sit high before it counts against you
  const TEMPO = { up: 1.06, down: 0.92, start: 0.75, regress: 0.85, retry: 0.85, target: 60 };
  const INTERVALS = [1, 2, 4, 7, 14, 30]; // days until the next review, by Leitner box
  const REVIEW_CAP = 4, FOCUS_TRIES = 3, LOG_CAP = 24, SESSION_GAP_MS = 45 * 60 * 1000;

  const STAGES = [
    null,
    { name: "1st position · one octave", blurb: "Finger patterns, then one-octave scales from the open strings." },
    { name: "1st position · the scale family", blurb: "Arpeggios, broken thirds and minor scales in the keys you know." },
    { name: "1st position · two octaves", blurb: "G, A and B♭ fit in two octaves without shifting." },
    { name: "3rd position frame", blurb: "One-octave scales in 3rd position, no shifting." },
    { name: "Shifting 1st ↔ 3rd", blurb: "Shift pairs up and down on one string, then single-string scales." },
    { name: "Two octaves through 3rd", blurb: "C and D need 3rd position on the E string to reach two octaves." },
    { name: "5th position frame", blurb: "One-octave scales in 5th position, no shifting." },
    { name: "Shifting 3rd ↔ 5th and 1st ↔ 5th", blurb: "Shift pairs, then 1st → 3rd → 5th on one string." },
    { name: "Two octaves through 5th", blurb: "E and F need 5th position to reach two octaves." },
  ];

  // ---------- The graph ----------
  const NODES = [], BY_ID = {};
  const keyId = (tonic, type) => `${tonic}-${type}`;
  const add = (n) => { n.prereq = n.prereq || []; n.nps = n.nps || 2; n.order = NODES.length; NODES.push(n); BY_ID[n.id] = n; return n; };
  const pattern = (stage, pos, hs, tonic, string, prereq) => add({ id: `pattern:${pos}:${hs}`, stage, kind: "pattern", hs, tonic, type: "major", strings: [string], positions: [pos], prereq });
  const scale = (stage, kind, tonic, type, strings, positions, octaves, extra = {}) =>
    add({ id: `${kind}:${keyId(tonic, type)}:${positions.join("")}:${octaves}${kind === "string" ? ":" + strings[0] : ""}`, stage, kind, tonic, type, strings, positions, octaves, ...extra });
  const shift = (stage, string, p1, p2, tonic, prereq) => add({ id: `shift:${string}:${p1}-${p2}`, stage, kind: "shift", tonic, type: "major", strings: [string], positions: [p1, p2], prereq });
  const sc = (kind, tonic, type, positions, octaves) => `${kind}:${keyId(tonic, type)}:${positions.join("")}:${octaves}`;

  // Stage 1: patterns in the order the keys need them (Suzuki's A, D, G first), each scale from its open string
  pattern(1, 1, "23", "D", "D");
  scale(1, "scale", "A", "major", ["A", "E"], [1], 1);
  scale(1, "scale", "D", "major", ["D", "A"], [1], 1);
  scale(1, "scale", "G", "major", ["G", "D"], [1], 1);
  pattern(1, 1, "12", "G", "A", ["pattern:1:23"]);
  scale(1, "scale", "C", "major", ["G", "D", "A"], [1], 1);
  pattern(1, 1, "34", "E", "A", ["pattern:1:12"]);
  scale(1, "scale", "E", "major", ["D", "A", "E"], [1], 1, { prereq: ["pattern:1:34"] }); // its 3‿4 half step crosses to the open E
  pattern(1, 1, "01", "F", "A", ["pattern:1:34"]);
  scale(1, "scale", "F", "major", ["D", "A", "E"], [1], 1);
  scale(1, "scale", "Bb", "major", ["G", "D", "A"], [1], 1);
  // Stage 2: the scale family in 1st position
  for (const [k, ss] of [["A", ["A", "E"]], ["D", ["D", "A"]], ["G", ["G", "D"]], ["C", ["G", "D", "A"]]])
    scale(2, "arpeggio", k, "major", ss, [1], 1, { prereq: [sc("scale", k, "major", [1], 1)] });
  for (const [k, ss] of [["A", ["A", "E"]], ["D", ["D", "A"]], ["G", ["G", "D"]]])
    scale(2, "thirds", k, "major", ss, [1], 1, { prereq: [sc("scale", k, "major", [1], 1)] });
  const MINOR1 = { A: ["A", "E"], D: ["D", "A"], G: ["G", "D"], E: ["D", "A", "E"] };
  for (const k of ["A", "D", "G", "E"]) scale(2, "scale", k, "harmonic", MINOR1[k], [1], 1, { prereq: [sc("scale", k, "major", [1], 1)] });
  for (const k of ["A", "D", "G"]) scale(2, "scale", k, "melodic", MINOR1[k], [1], 1, { prereq: [sc("scale", k, "harmonic", [1], 1)] });
  // Stage 3: two octaves without shifting
  scale(3, "scale", "G", "major", ALL, [1], 2, { prereq: [sc("scale", "G", "major", [1], 1)], boss: true });
  scale(3, "scale", "A", "major", ALL, [1], 2, { prereq: [sc("scale", "A", "major", [1], 1)] });
  scale(3, "scale", "Bb", "major", ALL, [1], 2, { prereq: [sc("scale", "Bb", "major", [1], 1)] });
  for (const k of ["G", "A", "Bb"]) scale(3, "arpeggio", k, "major", ALL, [1], 2, { prereq: [sc("scale", k, "major", [1], 2)] });
  scale(3, "thirds", "G", "major", ALL, [1], 2, { prereq: [sc("scale", "G", "major", [1], 2), sc("thirds", "G", "major", [1], 1)] });
  for (const k of ["G", "A"]) {
    scale(3, "scale", k, "harmonic", ALL, [1], 2, { prereq: [sc("scale", k, "harmonic", [1], 1), sc("scale", k, "major", [1], 2)] });
    scale(3, "scale", k, "melodic", ALL, [1], 2, { prereq: [sc("scale", k, "melodic", [1], 1), sc("scale", k, "harmonic", [1], 2)] });
  }
  for (const n of NODES) if (n.stage === 3 && n.octaves === 2) n.nps = 4;
  // Stage 4: the 3rd-position frame (Whistler's key order)
  const S3_GATE = sc("scale", "G", "major", [1], 2);
  pattern(4, 3, "23", "C", "A", [S3_GATE]);
  pattern(4, 3, "34", "G", "A", ["pattern:3:23"]);
  pattern(4, 3, "12", "F", "E", ["pattern:3:34"]);
  for (const k of ["C", "G", "D", "F", "Bb", "A"]) scale(4, "scale", k, "major", ALL, [3], 1, { prereq: [S3_GATE] });
  // Stage 5: 1st ↔ 3rd shifts on the strings the two-octave scales shift on, then single-string scales
  shift(5, "D", 1, 3, "G", [sc("scale", "G", "major", [3], 1)]);
  shift(5, "A", 1, 3, "D", [sc("scale", "D", "major", [3], 1)]);
  shift(5, "E", 1, 3, "C", [sc("scale", "C", "major", [3], 1)]);
  scale(5, "string", "A", "major", ["A"], [1, 3], 1);
  scale(5, "string", "D", "major", ["D"], [1, 3], 1);
  // Stage 6: two octaves through 3rd position
  scale(6, "scale", "C", "major", ALL, [1, 3], 2, { prereq: [sc("scale", "C", "major", [1], 1), sc("scale", "C", "major", [3], 1)] });
  scale(6, "scale", "D", "major", ALL, [1, 3], 2, { prereq: [sc("scale", "D", "major", [1], 1), sc("scale", "D", "major", [3], 1)], boss: true });
  scale(6, "scale", "D", "harmonic", ALL, [1, 3], 2, { prereq: [sc("scale", "D", "harmonic", [1], 1), sc("scale", "D", "major", [1, 3], 2)] });
  scale(6, "scale", "D", "melodic", ALL, [1, 3], 2, { prereq: [sc("scale", "D", "melodic", [1], 1), sc("scale", "D", "harmonic", [1, 3], 2)] });
  for (const k of ["G", "A"]) scale(6, "scale", k, "major", ALL, [1, 3], 2, { prereq: [sc("scale", k, "major", [1], 2)] });
  for (const k of ["C", "D"]) scale(6, "arpeggio", k, "major", ALL, [1, 3], 2, { prereq: [sc("scale", k, "major", [1, 3], 2)] });
  for (const n of NODES) if (n.stage === 6) n.nps = 4;
  // Stage 7: the 5th-position frame
  const S6_GATE = sc("scale", "D", "major", [1, 3], 2);
  pattern(7, 5, "12", "D", "A", [S6_GATE]);
  pattern(7, 5, "23", "A", "A", ["pattern:5:12"]);
  pattern(7, 5, "34", "C", "E", ["pattern:5:23"]);
  for (const k of ["C", "F", "Bb", "G", "D", "A"]) scale(7, "scale", k, "major", ALL, [5], 1, { prereq: [S6_GATE] });
  // Stage 8: 3rd ↔ 5th and 1st ↔ 5th shifts, then 1st → 3rd → 5th on one string
  shift(8, "A", 3, 5, "G", [sc("scale", "G", "major", [5], 1), "shift:A:1-3"]);
  shift(8, "E", 3, 5, "G", [sc("scale", "G", "major", [5], 1), "shift:E:1-3"]);
  shift(8, "A", 1, 5, "A", [sc("scale", "A", "major", [5], 1), "shift:A:3-5"]);
  shift(8, "E", 1, 5, "E", ["shift:E:3-5"]);
  scale(8, "string", "A", "major", ["A"], [1, 3, 5], 1, { prereq: [sc("string", "A", "major", [1, 3], 1) + ":A"] });
  scale(8, "string", "E", "major", ["E"], [1, 3, 5], 1);
  // Stage 9: two octaves through 5th position
  scale(9, "scale", "E", "major", ALL, [1, 3, 5], 2, { prereq: [sc("scale", "E", "major", [1], 1)], boss: true });
  scale(9, "scale", "F", "major", ALL, [1, 3, 5], 2, { prereq: [sc("scale", "F", "major", [1], 1)] });
  scale(9, "scale", "E", "harmonic", ALL, [1, 3, 5], 2, { prereq: [sc("scale", "E", "harmonic", [1], 1), sc("scale", "E", "major", [1, 3, 5], 2)] });
  scale(9, "scale", "E", "melodic", ALL, [1, 3, 5], 2, { prereq: [sc("scale", "E", "harmonic", [1, 3, 5], 2)] });
  for (const n of NODES) if (n.stage === 9) n.nps = 4;

  // ---------- Notes for each node ----------
  const spells = (node) => {
    const type = T[node.type], up = S.spell(node.tonic, type);
    return { type, up, down: type.down ? S.spell(node.tonic, T[type.down]) : up };
  };
  const brokenThirds = (line) => line.slice(0, -2).flatMap((n, i) => [n, line[i + 2]]);
  const memoLines = new Map();
  // An ascending line and a descending line that meet at the top; null if the node can't be fingered
  function lines(node) {
    if (memoLines.has(node.id)) return memoLines.get(node.id);
    const sp = spells(node);
    let out = null;
    if (node.kind === "pattern") {
      const f = (s) => (node.positions[0] === 1 ? [S.openString(node.strings[0], s)] : []).concat(S.fingers4(node.strings[0], node.positions[0], s));
      out = { up: f(sp.up), down: f(sp.down).reverse(), sp: sp.down, run: null };
    } else if (node.kind !== "shift") {
      const r = S.findRun(node.tonic, sp.type, node.strings, node.positions, { octaves: node.octaves });
      if (r) {
        let up = r.up, down = [...r.down].reverse();
        if (node.kind === "arpeggio") {
          const triad = new Set([0, sp.type.steps[2], 7]), keep = (n) => triad.has((((n.midi - sp.up.tonicPc) % 12) + 12) % 12);
          up = up.filter(keep); down = down.filter(keep);
        }
        if (node.kind === "thirds") { up = brokenThirds(up); down = brokenThirds(down); }
        out = { up, down, sp: sp.down, run: r };
      }
    }
    memoLines.set(node.id, out);
    return out;
  }

  // Shift pairs come up first (asc_desc) or down first (desc_asc); everything else runs up and back, or down and back
  function sequence(node, dir) {
    if (node.kind === "shift") {
      const [p1, p2] = node.positions, r = S.shiftPairs(node.strings[0], p1, p2, spells(node).down, dir === "asc_desc" ? "up" : "down");
      return { notes: r.seq, frame: `${ord(dir === "asc_desc" ? p1 : p2)} ${dir === "asc_desc" ? "⇡" : "⇣"} ${ord(dir === "asc_desc" ? p2 : p1)}: ${r.pairs.map(([a, b]) => `${a.finger}→${b.finger}`).join(" ")}` };
    }
    const L = lines(node);
    return { notes: S.annotateShifts(dir === "asc_desc" ? L.up.concat(L.down.slice(1)) : L.down.concat(L.up.slice(1)), L.sp),
      frame: node.kind === "pattern" ? S.framePattern(L.up) : S.segFrame(L.up).trim() };
  }

  const keyText = (node) => `${S.prettyTonic(node.tonic)} ${T[node.type].name}`;
  const posText = (ps) => (ps.length === 1 ? `${ord(ps[0])} position` : ps.map(ord).join("–"));
  function nodeName(node) {
    const oct = `${node.octaves} octave${node.octaves > 1 ? "s" : ""}`;
    switch (node.kind) {
      case "pattern": return `Pattern ${S.framePattern(lines(node).up).replace(/ — /g, " ")} · ${node.strings[0]} string`;
      case "scale": return `${keyText(node)} · ${oct} · ${posText(node.positions)}`;
      case "arpeggio": return `${keyText(node)} arpeggio · ${oct}${node.positions.length > 1 ? ` · ${posText(node.positions)}` : ""}`;
      case "thirds": return `${keyText(node)} in broken thirds · ${oct}`;
      case "shift": return `Shift pairs ${ord(node.positions[0])} ↔ ${ord(node.positions[1])} · ${node.strings[0]} string`;
      case "string": return `${keyText(node)} on the ${node.strings[0]} string · ${posText(node.positions)}`;
    }
  }
  const TIPS = {
    pattern: (n) => `${S.frameTip(lines(n).up)} Keep the fingers you've placed down on the way up; coming down, have the lower finger ready before you lift the one above.`,
    scale: (n) => (n.positions.length > 1 ? "Shift on the old finger, lightly, and let the thumb travel with the hand." : "The hand stays put; only the fingers and the bow change strings.") + " Check each G, D, A and E against the open strings: they should ring.",
    arpeggio: () => "Hear the chord before you play it. Tonic and fifth should ring with the open strings.",
    thirds: () => "Keep the fingers down across each third: both notes sit in the same hand frame.",
    shift: (n) => `Slide on the finger you're leaving, lightly and with the same bow speed, then land. Going down, most players stop short and land sharp; let the thumb lead the hand back to ${ord(n.positions[0])} position.`,
    string: () => "One string, so every new note in a new position is a shift. Name the guide note in your head before each slide.",
  };

  const memoDrill = new Map();
  // The drill a node plays in one direction, in the app's exercise shape
  function drill(node, dir) {
    const k = node.id + "@" + dir;
    if (memoDrill.has(k)) return memoDrill.get(k);
    const { notes, frame } = sequence(node, dir);
    const d = { id: `n:${k}`, path: true, nodeId: node.id, dir, group: `Stage ${node.stage}`, name: `${nodeName(node)} · ${DIR_TEXT[dir]}`, notes, frame,
      tip: `${dir === "desc_asc" ? "Start at the top: coming down gets its own practice. " : ""}${TIPS[node.kind](node)}`,
      keyCfg: { tonic: node.tonic, type: node.type }, per: node.nps, targetBpm: TEMPO.target, startBpm: Math.round(TEMPO.target * TEMPO.start) };
    memoDrill.set(k, d);
    return d;
  }

  // Prerequisites the notes imply: the finger patterns the run uses, and the shift pairs it shifts on
  function impliedPrereqs(node) {
    const out = new Set();
    if (node.kind === "pattern") return out;
    if (node.kind === "shift") {
      const sp = spells(node).up;
      for (const p of node.positions) for (const hs of S.handPattern(node.strings[0], p, sp).split("+")) out.add(`pattern:${p}:${hs}`);
    } else {
      const L = lines(node), up = L.run ? L.run.up : L.up, hand = (n) => (n.finger === "0" ? 1 : n.pos);
      up.forEach((b, i) => {
        const a = up[i - 1];
        if (!a) return;
        if (a.string === b.string && hand(a) === hand(b) && b.midi - a.midi === 1 && +b.finger === +a.finger + 1) out.add(`pattern:${hand(b)}:${a.finger}${b.finger}`);
        if (a.pos && b.pos && a.pos !== b.pos) out.add(`shift:${b.string}:${Math.min(a.pos, b.pos)}-${Math.max(a.pos, b.pos)}`);
      });
    }
    return out;
  }
  for (const n of NODES) for (const id of impliedPrereqs(n)) if (BY_ID[id] && id !== n.id && !n.prereq.includes(id)) n.prereq.push(id);

  // ---------- Measuring a run ----------
  const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
  const median = (a) => { const s = [...a].sort((x, y) => x - y), h = s.length >> 1; return s.length % 2 ? s[h] : (s[h - 1] + s[h]) / 2; };
  const RING_PC = new Set([7, 2, 9, 4]); // G D A E
  const r1 = (x) => (x === null ? null : Math.round(x * 10) / 10);

  // results: one per note, as the app scores them ({ cents, wrong, missed, timing }); seq: the notes played.
  // tonicPc gives the leading tone its slack; slotMs is set for Tempo-mode runs.
  function measure(results, seq, { tonicPc, slotMs = null }) {
    const notes = results.map((r, i) => {
      const it = seq[i], prev = seq[i - 1], motion = prev ? (it.midi > prev.midi ? "up" : "down") : null;
      const shifted = !!(prev && prev.pos && it.pos && prev.pos !== it.pos);
      const c = r.cents === null || r.cents === undefined || r.missed ? null : r.cents;
      const leading = (((it.midi - tonicPc) % 12) + 12) % 12 === 11;
      const adj = c !== null && leading && motion === "up" && c > 0 ? Math.max(0, c - LEADING_TONE_SLACK) : c;
      return { midi: it.midi, c, adj, motion, shifted, ring: RING_PC.has(((it.midi % 12) + 12) % 12), wrong: r.wrong !== null && r.wrong !== undefined, timing: r.timing === undefined ? null : r.timing };
    });
    const landed = notes.filter((n) => n.adj !== null);
    const side = (m) => { const xs = landed.filter((n) => n.motion === m).map((n) => n.c); return xs.length ? mean(xs) : null; };
    // Fischer's evenness: every whole step the same size
    const steps = [];
    notes.forEach((n, i) => { const p = notes[i - 1]; if (p && p.c !== null && n.c !== null && Math.abs(n.midi - p.midi) === 2) steps.push(Math.sign(n.midi - p.midi) * (n.c - p.c)); });
    // ...and the same pitch class in tune the same way in every octave
    const byPc = {};
    for (const n of landed) ((byPc[n.midi % 12] ||= {})[Math.floor(n.midi / 12)] ||= []).push(n.c);
    const spreads = Object.values(byPc).map((o) => Object.values(o).map(mean)).filter((ms) => ms.length > 1).map((ms) => Math.max(...ms) - Math.min(...ms));
    let ioiCV = null;
    if (slotMs) {
      const iois = [];
      notes.forEach((n, i) => { const p = notes[i - 1]; if (p && p.timing !== null && n.timing !== null) iois.push(slotMs + n.timing - p.timing); });
      if (iois.length >= 4) ioiCV = sd(iois) / mean(iois);
    }
    return {
      notes, tempo: !!slotMs, landed: landed.length, total: notes.length,
      medianAbsCents: landed.length ? r1(median(landed.map((n) => Math.abs(n.adj)))) : null,
      meanSignedCents: landed.length ? r1(mean(landed.map((n) => n.c))) : null,
      ascCents: r1(side("up")), descCents: r1(side("down")),
      intervalEvennessCents: steps.length >= 3 ? r1(sd(steps)) : null,
      octaveConsistencyCents: spreads.length ? r1(Math.max(...spreads)) : null,
      ioiCV: ioiCV === null ? null : Math.round(ioiCV * 1000) / 1000,
    };
  }

  // A note is clean when it lands in its window with no wrong note first (and, with a metronome, on time)
  function judge(m, level) {
    const L = LEVELS[level];
    const clean = (n) => n.adj !== null && !n.wrong && Math.abs(n.adj) <= (n.ring ? L.ring : L.window) && (!m.tempo || (n.timing !== null && Math.abs(n.timing) <= L.onsetMs));
    const pct = m.notes.filter(clean).length / m.notes.length;
    const shifts = m.notes.filter((n) => n.shifted);
    const shiftRate = shifts.length ? shifts.filter(clean).length / shifts.length : null;
    const checks = [
      { key: "median", label: "Median miss", value: m.medianAbsCents, limit: L.median, unit: "¢", ok: m.medianAbsCents !== null && m.medianAbsCents <= L.median },
      { key: "pct", label: `Clean notes (±${L.window}¢${L.ring !== L.window ? `, ±${L.ring}¢ on G D A E` : ""}${m.tempo ? `, ±${L.onsetMs} ms` : ""})`, value: Math.round(pct * 100), limit: Math.round(L.pct * 100), unit: "%", min: true, ok: pct >= L.pct },
    ];
    if (shiftRate !== null) checks.push({ key: "shift", label: "Clean shifts", value: Math.round(shiftRate * 100), limit: Math.round(L.shift * 100), unit: "%", min: true, ok: shiftRate >= L.shift });
    if (m.intervalEvennessCents !== null) checks.push({ key: "evenness", label: "Whole-step evenness (SD)", value: m.intervalEvennessCents, limit: L.evenness, unit: "¢", ok: m.intervalEvennessCents <= L.evenness });
    if (m.octaveConsistencyCents !== null) checks.push({ key: "octave", label: "Same note across octaves", value: m.octaveConsistencyCents, limit: L.octave, unit: "¢", ok: m.octaveConsistencyCents <= L.octave });
    if (m.ioiCV !== null) checks.push({ key: "ioi", label: "Rhythm evenness (IOI CV)", value: m.ioiCV, limit: L.ioiCV, unit: "", ok: m.ioiCV <= L.ioiCV });
    return { pass: checks.every((c) => c.ok), pct, checks };
  }

  // Direction-specific coaching from one run
  function tips(m) {
    const out = [];
    if (m.ascCents !== null && m.descCents !== null && m.descCents - m.ascCents >= 8 && m.descCents > 4)
      out.push(`Coming down you ran <b>${m.descCents > 0 ? "+" : ""}${m.descCents}¢</b> against ${m.ascCents > 0 ? "+" : ""}${m.ascCents}¢ going up. Descending whole steps come out narrow (string players are measurably sharper descending). Place each lower finger a touch early and a touch lower.`);
    else if (m.ascCents !== null && m.descCents !== null && m.ascCents - m.descCents >= 8)
      out.push(`Going up you ran ${m.ascCents > 0 ? "+" : ""}${m.ascCents}¢, coming down ${m.descCents > 0 ? "+" : ""}${m.descCents}¢. The hand is creeping toward the bridge as it climbs; keep the lower fingers down as anchors.`);
    if (m.intervalEvennessCents !== null && m.intervalEvennessCents > LEVELS.learning.evenness)
      out.push(`Your whole steps vary by ${m.intervalEvennessCents}¢ (SD). Each whole step should be the same size: check them against a drone.`);
    if (m.octaveConsistencyCents !== null && m.octaveConsistencyCents > LEVELS.learning.octave)
      out.push(`The same note differs by up to ${m.octaveConsistencyCents}¢ between octaves. Tune the upper octave to the lower one.`);
    if (m.ioiCV !== null && m.ioiCV > LEVELS.learning.ioiCV)
      out.push(`The rhythm is uneven (IOI CV ${m.ioiCV}). Hold this tempo and play it in dotted rhythms (long–short, then short–long) before trying straight notes again.`);
    return out;
  }

  // ---------- Node state ----------
  const dayNum = (day) => { const [y, mo, d] = day.split("-").map(Number); return Math.round(Date.UTC(y, mo - 1, d) / 864e5); };
  const addDays = (day, n) => new Date((dayNum(day) + n) * 864e5).toISOString().slice(0, 10);
  const fresh = (node) => ({ status: "learning", tempo: drill(node, DIRS[0]).startBpm, box: 0, due: null, log: [], coldDays: [], coldFails: 0, mastered: false });
  const everMastered = (st) => !!(st && st.mastered);
  const unlocked = (node, states) => !!states[node.id] || node.prereq.every((id) => everMastered(states[id]));
  const status = (node, states) => (states[node.id] ? states[node.id].status : unlocked(node, states) ? "new" : "locked");
  const lastOf = (st, dir, n, f = () => true) => st.log.filter((a) => a.dir === dir && f(a)).slice(-n);
  const score = (xs) => (xs.length ? mean(xs.map((a) => a.pct)) : null);
  // desc score minus asc score over the last 4 counted runs of each: negative = coming down is weaker
  function asymmetry(st) {
    if (!st) return 0;
    const a = score(lastOf(st, "asc_desc", 4)), d = score(lastOf(st, "desc_asc", 4));
    return a === null || d === null ? 0 : Math.round((d - a) * 100) / 100;
  }

  // Record one run. attempt: { t, day, sid, dir, mode, bpm, metrics }. Lock-in runs are guided, so they don't count.
  // Returns the new state (the input is not modified), whether the run passed at the node's level, and events.
  function recordAttempt(states, node, attempt) {
    const prev = states[node.id], st = prev ? JSON.parse(JSON.stringify(prev)) : fresh(node), events = [];
    const D = drill(node, DIRS[0]), target = D.targetBpm;
    if (attempt.mode !== "flow" && attempt.mode !== "tempo") return { state: prev || null, counted: false, passed: null, level: null, events };
    const level = st.status === "learning" ? "learning" : "mastery";
    const L = judge(attempt.metrics, "learning"), M = judge(attempt.metrics, "mastery");
    const a = { t: attempt.t, day: attempt.day, sid: attempt.sid, dir: attempt.dir, mode: attempt.mode, bpm: attempt.mode === "tempo" ? attempt.bpm : null,
      cold: !st.log.some((x) => x.sid === attempt.sid), pL: L.pass, pM: M.pass, pct: Math.round((level === "learning" ? L.pct : M.pct) * 100) / 100 };
    a.passed = level === "learning" ? a.pL : a.pM;
    st.log.push(a);
    st.log = st.log.slice(-LOG_CAP);
    if (a.cold && a.pM && !st.coldDays.includes(a.day)) st.coldDays = st.coldDays.concat(a.day).slice(-10);

    // Tempo: up 6% after three passes in a row at the current tempo (both directions, one of them a first
    // try of the session); down 8% after two misses in a row there
    if (a.mode === "tempo") {
      const atTempo = st.log.filter((x) => x.mode === "tempo").slice(-3);
      if (atTempo.length === 3 && atTempo.every((x) => x.passed && x.bpm >= st.tempo) && atTempo.some((x) => x.cold) && new Set(atTempo.map((x) => x.dir)).size === 2 && st.tempo < target) {
        const was = st.tempo;
        st.tempo = Math.min(target, Math.max(st.tempo + 1, Math.round(st.tempo * TEMPO.up)));
        events.push({ type: "tempoUp", from: was, to: st.tempo });
      }
      const last2 = st.log.filter((x) => x.mode === "tempo").slice(-2);
      if (last2.length === 2 && last2.every((x) => !x.passed && x.bpm >= st.tempo)) {
        const was = st.tempo;
        st.tempo = Math.max(30, Math.round(st.tempo * TEMPO.down));
        if (st.tempo < was) events.push({ type: "tempoDown", from: was, to: st.tempo });
      }
    }

    const passes = (dir, key, f) => lastOf(st, dir, 4, f).filter((x) => x[key]).length;
    if (st.status === "learning" && DIRS.every((d) => passes(d, "pL") >= 2)) {
      st.status = "consolidating";
      events.push({ type: "consolidating" });
    } else if (st.status === "consolidating") {
      const atTarget = (x) => x.mode === "tempo" && x.bpm >= target;
      const bossOk = !node.boss || st.log.some((x) => x.cold && x.pM && x.dir === "desc_asc" && atTarget(x));
      if (st.tempo >= target && DIRS.every((d) => passes(d, "pM", atTarget) >= 3) && st.coldDays.length >= 2 && bossOk) {
        const before = new Set(NODES.filter((n) => unlocked(n, states)).map((n) => n.id));
        st.status = "mastered"; st.mastered = true; st.box = 1; st.due = addDays(a.day, INTERVALS[0]); st.coldFails = 0;
        const after = { ...states, [node.id]: st };
        events.push({ type: "mastered", unlocked: NODES.filter((n) => !before.has(n.id) && unlocked(n, after)).map((n) => n.id) });
      }
    } else if ((st.status === "mastered" || st.status === "review") && a.cold) {
      // Retention probe: the first run of the session
      if (a.pM) {
        st.box = Math.min(INTERVALS.length - 1, st.box + 1); st.due = addDays(a.day, INTERVALS[st.box]); st.status = "mastered"; st.coldFails = 0;
        events.push({ type: "reviewPassed", nextDays: INTERVALS[st.box] });
      } else {
        st.box = Math.max(1, st.box - 2); st.coldFails++; st.status = "review"; st.due = addDays(a.day, 1);
        events.push({ type: "reviewFailed" });
        if (st.coldFails >= 2) {
          st.status = "consolidating"; st.tempo = Math.round(target * TEMPO.regress); st.coldFails = 0; st.due = null;
          events.push({ type: "regressed", tempo: st.tempo, reopen: node.prereq.filter((id) => ["pattern", "shift"].includes(BY_ID[id].kind)) });
        }
      }
    }
    if (!a.passed && attempt.metrics.medianAbsCents !== null && attempt.metrics.medianAbsCents > 25)
      events.push({ type: "retry", bpm: a.mode === "tempo" ? Math.max(30, Math.round(attempt.bpm * TEMPO.retry)) : null });
    return { state: st, counted: true, passed: a.passed, level, judged: level === "learning" ? L : M, events };
  }

  // Bring a regressed node's pattern and shift prerequisites back for review now
  function reopen(states, ids, day) {
    for (const id of ids) if (states[id] && states[id].mastered) states[id] = { ...states[id], due: day };
  }

  // ---------- What to practise next ----------
  // Reviews due (cold probes, up to 4 a session) → the focus node (lowest stage, most lopsided) in blocks of up
  // to 3 runs per direction, stopping early on a pass → its weakest pattern or shift prerequisite → the next
  // focus node → a random mastered node for variety. weakness(node) scores how badly its notes have landed.
  function nextUp(states, { sid, day, weakness = () => 0, random = Math.random }) {
    const inSession = (id) => (states[id] ? states[id].log.filter((a) => a.sid === sid) : []);
    const reviewsDone = NODES.filter((n) => states[n.id] && states[n.id].mastered && inSession(n.id).length).length;
    const lastDir = (st) => (st && st.log.length ? st.log[st.log.length - 1].dir : "desc_asc");
    const other = (d) => (d === "asc_desc" ? "desc_asc" : "asc_desc");
    if (reviewsDone < REVIEW_CAP) {
      // Oldest due first; ties in random order, so reviews come interleaved
      const due = NODES.filter((n) => { const st = states[n.id]; return st && (st.status === "mastered" || st.status === "review") && st.due && st.due <= day && !inSession(n.id).length; })
        .map((n) => ({ n, due: states[n.id].due, k: random() })).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.k - b.k));
      if (due.length) {
        const n = due[0].n, st = states[n.id];
        return { nodeId: n.id, dir: asymmetry(st) < -0.1 ? "desc_asc" : other(lastDir(st)), role: "review", why: `Review: first try today counts. Last passed ${st.box > 1 ? `${INTERVALS[st.box - 1]}+ days ago` : "recently"}.` };
      }
    }
    const focus = NODES.filter((n) => unlocked(n, states) && !(states[n.id] && states[n.id].mastered && states[n.id].status !== "consolidating"))
      .sort((a, b) => a.stage - b.stage || Math.abs(asymmetry(states[b.id])) - Math.abs(asymmetry(states[a.id])) || a.order - b.order);
    const block = (n) => {
      const st = states[n.id], mine = inSession(n.id), asym = asymmetry(st);
      const open = DIRS.filter((d) => { const xs = mine.filter((a) => a.dir === d); return xs.length < FOCUS_TRIES && !xs.some((a) => a.passed); });
      if (!open.length) return null;
      return open.length === 1 ? open[0] : asym < -0.1 ? "desc_asc" : asym > 0.1 ? "asc_desc" : other(lastDir(st));
    };
    const focusWhy = (n) => {
      const st = states[n.id];
      if (!st) return "New skill. Get the notes in tune first (Flow), then add the metronome (Tempo).";
      if (asymmetry(st) < -0.1) return `Coming down is weaker (${Math.round(asymmetry(st) * 100)} points), so start at the top.`;
      return st.status === "consolidating" ? `Consolidating: needs ${st.tempo < drill(n, DIRS[0]).targetBpm ? `♩=${drill(n, DIRS[0]).targetBpm} (now ${st.tempo}) and ` : ""}clean runs both ways on 2 days.` : "Learning: 2 clean runs each way to move on.";
    };
    for (const [i, n] of focus.slice(0, 2).entries()) {
      const dir = block(n);
      if (dir) return { nodeId: n.id, dir, role: "focus", why: focusWhy(n) };
      if (i === 0) {
        const support = n.prereq.map((id) => BY_ID[id]).filter((p) => ["pattern", "shift"].includes(p.kind) && everMastered(states[p.id]) && !inSession(p.id).length)
          .sort((a, b) => weakness(b) - weakness(a))[0];
        if (support) return { nodeId: support.id, dir: other(lastDir(states[support.id])), role: "support", why: `Groundwork for ${nodeName(n)}: its weakest ${support.kind === "shift" ? "shift" : "finger pattern"}.` };
      }
    }
    const bonus = NODES.filter((n) => everMastered(states[n.id]) && !inSession(n.id).length);
    if (bonus.length) { const n = bonus[Math.floor(random() * bonus.length)]; return { nodeId: n.id, dir: random() < 0.5 ? "asc_desc" : "desc_asc", role: "bonus", why: "Done for today. A random skill you've mastered, for variety." }; }
    return focus.length ? { nodeId: focus[0].id, dir: other(lastDir(states[focus[0].id])), role: "extra", why: "Today's block is done. Carry on if you like; tomorrow's first try is the one that counts." } : null;
  }

  // Attempts more than 45 minutes apart, or on different days, belong to different sessions
  const sessionId = (prev, now, day) => (prev && prev.day === day && now - prev.last < SESSION_GAP_MS ? prev.id : now);

  const api = { STAGES, NODES, BY_ID, DIRS, DIR_TEXT, LEVELS, TEMPO, INTERVALS, nodeName, lines, drill, measure, judge, tips, recordAttempt, reopen, nextUp,
    unlocked, status, asymmetry, sessionId, addDays, impliedPrereqs };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Curriculum = api;
})(this);
