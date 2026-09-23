// Scale spelling and violin fingering generation.
// Positions are letter-based, the way violinists count them: in Nth position the 1st finger
// plays the note N letter-names above the open string, and the key signature decides its accidental.
// Works in the browser (window.Scales) and in Node (module.exports) for testing.
(function (root) {
  const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
  const ACC = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };

  const SCALE_TYPES = {
    major: { name: "major", steps: [0, 2, 4, 5, 7, 9, 11], keys: ["C", "G", "D", "A", "E", "B", "F#", "Db", "Ab", "Eb", "Bb", "F"] },
    natural: { name: "natural minor", steps: [0, 2, 3, 5, 7, 8, 10], keys: ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"] },
    harmonic: { name: "harmonic minor", steps: [0, 2, 3, 5, 7, 8, 11], keys: ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"] },
    melodic: { name: "melodic minor", steps: [0, 2, 3, 5, 7, 9, 11], down: "natural", keys: ["A", "E", "B", "F#", "C#", "G#", "D", "G", "C", "F", "Bb", "Eb"] },
  };

  const STRINGS = { G: { midi: 55, letter: 4 }, D: { midi: 62, letter: 1 }, A: { midi: 69, letter: 5 }, E: { midi: 76, letter: 2 } };
  const STRING_ORDER = ["G", "D", "A", "E"];

  const ordinal = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
  const prettyTonic = (t) => t[0] + ACC[t.length > 1 ? (t[1] === "#" ? 1 : -1) : 0];

  // Accidental (in semitones) that the scale applies to each letter, indexed by letter 0..6 (C..B)
  function spell(tonic, type) {
    const tl = LETTERS.indexOf(tonic[0]);
    const tpc = (NATURAL_PC[tl] + (tonic[1] === "#" ? 1 : tonic[1] === "b" ? -1 : 0) + 12) % 12;
    const acc = new Array(7);
    type.steps.forEach((st, deg) => {
      const l = (tl + deg) % 7;
      let a = (tpc + st - NATURAL_PC[l]) % 12;
      if (a > 6) a -= 12;
      if (a < -6) a += 12;
      acc[l] = a;
    });
    return { acc, tonicPc: tpc };
  }

  // Semitones from a natural letter up `steps` letter-names
  const naturalOffset = (l0, steps) => NATURAL_PC[(l0 + steps) % 7] - NATURAL_PC[l0] + 12 * Math.floor((l0 + steps) / 7);

  function fingering(string, pos, finger, sp) {
    const s = STRINGS[string];
    const steps = pos + (finger === "4x" ? 5 : +finger) - 1; // 4x = 4th finger stretched one note higher
    const letter = (s.letter + steps) % 7;
    const natural = s.midi + naturalOffset(s.letter, steps);
    const midi = natural + sp.acc[letter];
    const label = LETTERS[letter] + ACC[sp.acc[letter]];
    return { midi, string, finger, pos, key: midi + string, label, oct: Math.floor(natural / 12) - 1 };
  }

  const fingers4 = (string, pos, sp) => ["1", "2", "3", "4"].map((f) => fingering(string, pos, f, sp));

  // "1 — 2‿3 — 4": ‿ = half step (fingers touch), — = whole step, ⟷ = augmented 2nd (stretch)
  function framePattern(notes) {
    return notes.map((n, i) => (i === 0 ? n.finger : ({ 1: "‿", 2: " — ", 3: " ⟷ " }[n.midi - notes[i - 1].midi] || " ? ") + n.finger)).join("");
  }
  function frameTip(notes) {
    const parts = [];
    notes.forEach((n, i) => {
      if (!i) return;
      const p = notes[i - 1], d = n.midi - p.midi;
      if (d === 1) parts.push(`${p.finger} and ${n.finger} touch (${p.label}–${n.label} is a half step)`);
      if (d === 3) parts.push(`${p.finger} and ${n.finger} stretch wide (${p.label}–${n.label} is an augmented 2nd)`);
    });
    return parts.length ? parts.join("; ") + "." : "All whole steps. Open the hand evenly.";
  }

  // Up-and-back sequence; melodic minor comes down with its natural-minor form
  const upDown = (up, down) => up.concat(down.slice(0, -1).reverse());

  // Find a one-octave tonic-to-tonic run that starts in position p1 and shifts once into p2
  function findShiftRun(tonic, type, lo, hi, p1, p2) {
    const spUp = spell(tonic, type), spDown = type.down ? spell(tonic, SCALE_TYPES[type.down]) : spUp;
    const avail = (sp) => {
      const out = [];
      for (const p of [p1, p2]) for (const s of [lo, hi]) out.push(...fingers4(s, p, sp));
      out.push(fingering(hi, p2, "4x", sp));
      return out;
    };
    const scaleMidis = (sp, from) => {
      const pcs = new Set([0, 1, 2, 3, 4, 5, 6].map((l) => (NATURAL_PC[l] + sp.acc[l] + 12) % 12));
      const out = [];
      for (let m = from; m <= from + 12; m++) if (pcs.has(m % 12)) out.push(m);
      return out;
    };
    const route = (sp, midis) => {
      const av = avail(sp);
      let best = null;
      for (let k = 2; k <= midis.length - 2; k++) {
        const seq = midis.map((m, i) => {
          const inPos = i < k ? p1 : p2;
          const opts = av.filter((o) => o.midi === m && o.pos === inPos && (o.finger !== "4x" || i === midis.length - 1));
          return opts.sort((a, b) => (a.finger === "4x") - (b.finger === "4x"))[0];
        });
        if (seq.some((x) => !x)) continue;
        if (seq.some((x, i) => i && STRING_ORDER.indexOf(x.string) < STRING_ORDER.indexOf(seq[i - 1].string))) continue;
        const a = seq[k - 1], b = seq[k];
        const score = (b.finger === "1" ? 4 : 0) + (b.midi - a.midi === 1 ? 2 : 0) + (+b.finger <= +a.finger ? 1 : 0) - seq.filter((x) => x.finger === "4x").length;
        if (!best || score > best.score) best = { seq, score };
      }
      return best && best.seq;
    };
    const starts = avail(spUp).filter((o) => o.pos === p1 && (o.midi - spUp.tonicPc) % 12 === 0).map((o) => o.midi).sort((a, b) => a - b);
    for (const t of [...new Set(starts)]) {
      const up = route(spUp, scaleMidis(spUp, t));
      const down = route(spDown, scaleMidis(spDown, t));
      if (up && down) return { up, down, octave: true };
    }
    // No tonic octave fits: run from the lower position's 1st finger to the upper position's 4th finger
    const from = fingering(lo, p1, "1", spUp).midi, to = fingering(hi, p2, "4", spUp).midi;
    const segment = (sp) => scaleMidis(sp, from).concat(scaleMidis(sp, from + 12).slice(1)).filter((m) => m <= to);
    const up = route(spUp, segment(spUp)), down = route(spDown, segment(spDown));
    return up && down ? { up, down, octave: false } : null;
  }

  // Tag each note reached by a shift with its direction. A down-shift onto a higher finger gets a guide
  // note: the old finger slides to its spot in the new position, then the new finger drops.
  function annotateShifts(seq, sp) {
    return seq.map((b, i) => {
      const a = seq[i - 1];
      if (!a || a.pos === b.pos) return b;
      const out = { ...b, shift: b.pos < a.pos ? "down" : "up", from: a };
      if (out.shift === "down" && a.string === b.string && a.finger !== "4x" && +a.finger < +b.finger) out.guide = fingering(b.string, b.pos, a.finger, sp);
      return out;
    });
  }

  // Isolated down-shifts on one string, each pair played twice: same-finger slides, then the scale step
  // that crosses the shift (1st finger in the high position down to the note below, in the low position)
  function downShiftPairs(string, p1, p2, sp) {
    const gap = p2 - p1, pairs = [];
    for (const f of ["1", "2", "3"]) pairs.push([fingering(string, p2, f, sp), fingering(string, p1, f, sp)]);
    if (gap >= 2 && gap <= 4) pairs.push([fingering(string, p2, "1", sp), fingering(string, p1, String(gap), sp)]);
    // The pitch detector needs each note to differ from the last, so no pair may start where the previous one ended
    const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r])));
    const order = perms(pairs).find((o) => o.every((pr, i) => !i || pr[0].midi !== o[i - 1][1].midi)) || pairs;
    return { pairs: order, seq: annotateShifts(order.flatMap(([a, b]) => [a, b, a, b]), sp) };
  }

  // Build all drills for a configuration
  function buildDrills(cfg) {
    const type = SCALE_TYPES[cfg.type];
    const spUp = spell(cfg.tonic, type), spDown = type.down ? spell(cfg.tonic, SCALE_TYPES[type.down]) : spUp;
    const [lo, hi] = cfg.strings, [p1, p2] = cfg.positions;
    const drills = [];
    for (const p of [p1, p2]) {
      const group = `${ordinal(p)} position`;
      const u = { lo: fingers4(lo, p, spUp), hi: fingers4(hi, p, spUp) };
      const d = { lo: fingers4(lo, p, spDown), hi: fingers4(hi, p, spDown) };
      drills.push({ id: `p${p}-${lo}`, group, name: `${lo} string`, notes: upDown(u.lo, d.lo), frame: framePattern(u.lo), tip: frameTip(u.lo) });
      drills.push({ id: `p${p}-${hi}`, group, name: `${hi} string`, notes: upDown(u.hi, d.hi), frame: framePattern(u.hi), tip: frameTip(u.hi) });
      drills.push({ id: `p${p}-${lo}${hi}`, group, name: `${lo} + ${hi} strings`, notes: upDown([...u.lo, ...u.hi], [...d.lo, ...d.hi]),
        frame: `${framePattern(u.lo)} | ${framePattern(u.hi)}`, tip: `Keep the hand still when you cross from ${lo} to ${hi}. Only the finger pattern changes.` });
    }
    const run = findShiftRun(cfg.tonic, type, lo, hi, p1, p2);
    if (run) {
      const first = run.up[0], last = run.up[run.up.length - 1];
      const k = run.up.findIndex((x) => x.pos === p2);
      const a = run.up[k - 1], b = run.up[k];
      const frame = `${ordinal(p1)}: ${run.up.slice(0, k).map((x) => x.finger).join(" ")} ⇡ ${ordinal(p2)}: ${run.up.slice(k).map((x) => x.finger).join(" ")}`;
      drills.push({ id: "shift", group: "Put it together", name: `${first.label}${first.oct}→${last.label}${last.oct} with a shift`, notes: annotateShifts(upDown(run.up, run.down), spDown), frame,
        tip: `Shift on ${a.label} → ${b.label}: slide lightly on ${a.finger}, then land ${b.finger} in ${ordinal(p2)} position.${last.finger === "4x" ? ` Stretch 4 up for the top ${last.label}.` : ""}` });
    }
    const pool = new Map();
    for (const sp of [spUp, spDown]) for (const p of [p1, p2]) for (const s of [lo, hi]) for (const it of fingers4(s, p, sp)) pool.set(it.key + it.finger + it.pos, it);
    drills.push({ id: "hunt", group: "Put it together", name: "Note Hunt (adaptive)", hunt: true, pool: [...pool.values()], frame: "12 random notes",
      tip: "No pattern to lean on: remember the spot, then land it. Your weakest notes come up most." });

    // Shifting down: isolate the move on each string, then put it back into a scale that starts at the top
    const downTip = "Let the thumb and the whole hand travel back together, lightly. Coming down, most players stop short and land sharp. On guide-note shifts, slide the old finger to the guide note, then drop the new finger.";
    for (const s of [lo, hi]) {
      const { pairs, seq } = downShiftPairs(s, p1, p2, spDown);
      drills.push({ id: `down-${s}`, group: "Shifting down", name: `${s} string: shift pairs`, notes: seq,
        frame: `${ordinal(p2)} ⇣ ${ordinal(p1)}: ${pairs.map(([a, b]) => `${a.finger}→${b.finger}`).join(" ")}`, tip: downTip });
    }
    if (run) {
      const top = run.down[run.down.length - 1], bottom = run.down[0];
      const notes = annotateShifts([...run.down].reverse().concat(run.up.slice(1)), spDown);
      const k = notes.findIndex((x) => x.shift === "down");
      drills.push({ id: "down-run", group: "Shifting down", name: `From the top: ${top.label}${top.oct}→${bottom.label}${bottom.oct}`, notes,
        frame: `${ordinal(p2)}: ${notes.slice(0, k).map((x) => x.finger).join(" ")} ⇣ ${ordinal(p1)}: ${notes.slice(k, run.down.length).map((x) => x.finger).join(" ")}`,
        tip: `Start high and shift down while you're fresh, then climb back up. ${notes[k].guide ? `On ${notes[k - 1].label} → ${notes[k].label}, slide ${notes[k - 1].finger} to ${notes[k].guide.label}, then drop ${notes[k].finger}.` : `Shift down on ${notes[k - 1].label} → ${notes[k].label}.`}` });
    }
    return drills;
  }

  const cfgKey = (c) => `${c.tonic}-${c.type}-${c.strings.join("")}-${c.positions.join("-")}`;
  const cfgLabel = (c) => `${prettyTonic(c.tonic)} ${SCALE_TYPES[c.type].name} · ${ordinal(c.positions[0])} & ${ordinal(c.positions[1])} position · ${c.strings.join(" & ")} strings`;

  // Name any MIDI note, preferring the scale's own spelling, else sharps/flats to match the key
  function nameIn(midi, cfg) {
    const type = SCALE_TYPES[cfg.type], sp = spell(cfg.tonic, type);
    const pc = ((midi % 12) + 12) % 12;
    for (let l = 0; l < 7; l++) if ((NATURAL_PC[l] + sp.acc[l] + 12) % 12 === pc) return LETTERS[l] + ACC[sp.acc[l]];
    const flats = sp.acc.some((a) => a < 0);
    return flats ? ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"][pc] : ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][pc];
  }

  const api = { SCALE_TYPES, STRINGS, STRING_ORDER, ordinal, prettyTonic, spell, fingering, buildDrills, findShiftRun, cfgKey, cfgLabel, nameIn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Scales = api;
})(this);
