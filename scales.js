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

  // Open string, spelled the way the scale spells that pitch (G♯ harmonic minor's F𝄪 is the open G)
  function openString(string, sp) {
    const midi = STRINGS[string].midi, pc = midi % 12;
    let l = STRINGS[string].letter;
    for (let x = 0; x < 7; x++) if ((NATURAL_PC[x] + sp.acc[x] + 12) % 12 === pc) l = x;
    const a = (pc - NATURAL_PC[l] + 18) % 12 - 6;
    return { midi, string, finger: "0", pos: null, key: midi + string, label: LETTERS[l] + ACC[a], oct: Math.floor((midi - a) / 12) - 1 };
  }

  // Scale notes from `from` up to `to`, inclusive
  function scaleMidis(sp, from, to) {
    const pcs = new Set([0, 1, 2, 3, 4, 5, 6].map((l) => (NATURAL_PC[l] + sp.acc[l] + 12) % 12));
    const out = [];
    for (let m = from; m <= to; m++) if (pcs.has(m % 12)) out.push(m);
    return out;
  }

  // Find the longest tonic-to-tonic run (up to 3 octaves) that climbs through the positions in order,
  // shifting once between each neighbouring pair. Open strings count as 1st position.
  // opts.octaves asks for exactly that many octaves (lowest tonic first) and never falls back to a partial span.
  function findRun(tonic, type, strings, positions, opts = {}) {
    const spUp = spell(tonic, type), spDown = type.down ? spell(tonic, SCALE_TYPES[type.down]) : spUp;
    const top = strings[strings.length - 1], last = positions[positions.length - 1], open = positions[0] === 1;
    const avail = (sp) => {
      const out = [];
      for (const p of positions) for (const s of strings) out.push(...fingers4(s, p, sp));
      out.push(fingering(top, last, "4x", sp));
      if (open) for (const s of strings) out.push(openString(s, sp));
      return out;
    };
    // Rank: open strings, then fingers, then the stretched 4th
    const rank = (o) => (o.finger === "0" ? 0 : o.finger === "4x" ? 2 : 1);
    const shiftScore = (a, b) => (b.finger === "1" ? 4 : 0) + (b.midi - a.midi === 1 ? 2 : 0) + (+b.finger <= +a.finger ? 1 : 0);
    const route = (sp, midis) => {
      const av = avail(sp), n = midis.length, m = positions.length, memo = new Map();
      const cands = (i, j) => av.filter((o) => o.midi === midis[i] && (o.finger === "0" ? j === 0 : o.pos === positions[j]) && (o.finger !== "4x" || i === n - 1))
        .sort((a, b) => rank(a) - rank(b));
      // Best way to play notes i.. when the previous note `a` was in positions[j], `len` notes into that position.
      // Each position gets at least 2 notes, and a shift always leaves from a stopped (not open) note.
      const go = (i, j, a, len) => {
        if (i === n) return j === m - 1 && len >= 2 ? { score: 0, seq: [] } : null;
        const key = `${i}|${j}|${a ? a.key + a.finger : ""}|${Math.min(len, 2)}`;
        if (memo.has(key)) return memo.get(key);
        let best = null;
        const steps = a && j + 1 < m && len >= 2 && a.finger !== "0" ? [j + 1, j] : [j]; // shift first: on a tie the earlier shift wins
        for (const jj of steps) for (const b of cands(i, jj)) {
          if (a && STRING_ORDER.indexOf(b.string) < STRING_ORDER.indexOf(a.string)) continue;
          const rest = go(i + 1, jj, b, jj === j ? len + 1 : 1);
          if (!rest) continue;
          const score = rest.score + (jj !== j ? shiftScore(a, b) : 0) - (b.finger === "4x" ? 1 : 0) + (b.finger === "0" ? 0.01 : 0);
          if (!best || score > best.score) best = { score, seq: [b, ...rest.seq] };
        }
        memo.set(key, best);
        return best;
      };
      const r = go(0, 0, null, 0);
      return r && r.seq;
    };
    // Up and down share their end notes (melodic minor's two forms can differ at the edges of a span)
    const both = (from, to) => {
      const inDown = new Set(scaleMidis(spDown, from, to)), ends = scaleMidis(spUp, from, to).filter((m) => inDown.has(m));
      if (ends.length < 2) return null;
      [from, to] = [ends[0], ends[ends.length - 1]];
      const up = route(spUp, scaleMidis(spUp, from, to)), down = up && route(spDown, scaleMidis(spDown, from, to));
      return up && down ? { up, down } : null;
    };
    const midis = avail(spUp).map((o) => o.midi), lo = Math.min(...midis), hi = Math.max(...midis);
    for (let octs = opts.octaves || 3; octs >= (opts.octaves || 1); octs--)
      for (let t = lo; t + 12 * octs <= hi; t++) {
        if ((t - spUp.tonicPc) % 12) continue;
        const r = both(t, t + 12 * octs);
        if (r) return { ...r, octave: true };
      }
    if (opts.octaves) return null;
    // No tonic octave fits: run from the bottom of the lowest position to the top position's 4th finger
    // (from the open string if that's in the key and the next note up is reachable, else from the 1st finger)
    const to = fingering(top, last, "4", spUp).midi;
    const r = (open && both(STRINGS[strings[0]].midi, to)) || both(fingering(strings[0], positions[0], "1", spUp).midi, to);
    return r && { ...r, octave: false };
  }

  // Tag each note reached by a shift with its direction. Open strings leave the hand where it was.
  // A down-shift onto a higher finger gets a guide note: the old finger slides to its spot in the new
  // position, then the new finger drops.
  function annotateShifts(seq, sp) {
    let hand = null;
    return seq.map((b, i) => {
      const a = seq[i - 1], was = hand;
      if (b.pos) hand = b.pos;
      if (!a || !b.pos || !was || was === b.pos) return b;
      const out = { ...b, shift: b.pos < was ? "down" : "up", from: a };
      if (out.shift === "down" && a.string === b.string && a.pos && a.finger !== "4x" && +a.finger < +b.finger) out.guide = fingering(b.string, b.pos, a.finger, sp);
      return out;
    });
  }

  // "1st: 0 1 2 3 ⇡ 3rd: 1 2 3 4": fingers grouped by hand position, with the shifts between them
  function segFrame(notes) {
    let out = "", hand = null;
    for (const n of notes) {
      const p = n.pos || hand || 1;
      if (p !== hand) out += `${hand === null ? "" : p > hand ? " ⇡ " : " ⇣ "}${ordinal(p)}:`;
      hand = p;
      out += " " + n.finger;
    }
    return out;
  }

  // Isolated shifts on one string, each pair played twice: same-finger slides, then the scale step
  // that crosses the shift (1st finger in the high position and the note below it, in the low position).
  // "down" starts each pair in the high position; "up" starts it in the low one.
  function shiftPairs(string, p1, p2, sp, dir = "down") {
    const gap = p2 - p1, pairs = [];
    for (const f of ["1", "2", "3"]) pairs.push([fingering(string, p2, f, sp), fingering(string, p1, f, sp)]);
    if (gap >= 2 && gap <= 4) pairs.push([fingering(string, p2, "1", sp), fingering(string, p1, String(gap), sp)]);
    if (dir === "up") pairs.forEach((pr) => pr.reverse());
    // The pitch detector needs each note to differ from the last, so no pair may start where the previous one ended
    const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r])));
    const order = perms(pairs).find((o) => o.every((pr, i) => !i || pr[0].midi !== o[i - 1][1].midi)) || pairs;
    return { pairs: order, seq: annotateShifts(order.flatMap(([a, b]) => [a, b, a, b]), sp) };
  }
  const downShiftPairs = (string, p1, p2, sp) => shiftPairs(string, p1, p2, sp, "down");

  // Where the half step falls in a hand frame: "01" (low 1), "12", "23", "34", "whole" (no half step)
  // or "aug" (an augmented 2nd). In 1st position the open string counts as finger 0.
  function handPattern(string, pos, sp) {
    const notes = fingers4(string, pos, sp);
    if (pos === 1) notes.unshift(openString(string, sp));
    const f0 = pos === 1 ? 0 : 1, steps = notes.slice(1).map((n, i) => n.midi - notes[i].midi);
    if (steps.some((d) => d >= 3)) return "aug";
    const halves = steps.map((d, i) => (d === 1 ? `${f0 + i}${f0 + i + 1}` : null)).filter(Boolean);
    return halves.length ? halves.join("+") : "whole";
  }

  const andList = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} & ${xs[xs.length - 1]}`);
  const stringsText = (ss) => (ss.length === 1 ? `${ss[0]} string` : `${ss.join(ss.length === 2 ? " & " : "–").replace(/–.*–/, "–")} strings`);

  // Build all drills for a configuration: strings is 1–4 neighbouring strings (low to high),
  // positions is 1–4 positions (low to high)
  function buildDrills(cfg) {
    const type = SCALE_TYPES[cfg.type];
    const spUp = spell(cfg.tonic, type), spDown = type.down ? spell(cfg.tonic, SCALE_TYPES[type.down]) : spUp;
    const { strings, positions } = cfg, multiPos = positions.length > 1;
    const drills = [];
    for (const p of positions) {
      const group = `${ordinal(p)} position`;
      const u = strings.map((s) => fingers4(s, p, spUp)), d = strings.map((s) => fingers4(s, p, spDown));
      strings.forEach((s, i) => drills.push({ id: `p${p}-${s}`, group, name: `${s} string`, notes: upDown(u[i], d[i]), frame: framePattern(u[i]), tip: frameTip(u[i]) }));
      if (strings.length > 1)
        drills.push({ id: `p${p}-${strings.join("")}`, group, name: `${strings.join(" + ")} strings`, notes: upDown(u.flat(), d.flat()), frame: u.map(framePattern).join(" | "),
          tip: `Keep the hand still when you cross from ${strings[0]} to ${strings[strings.length - 1]}. Only the finger pattern changes.` });
    }
    // A one-position run is only worth adding when it's a real tonic-to-tonic scale, not the string-crossing drill again
    const found = findRun(cfg.tonic, type, strings, positions);
    const run = found && (multiPos || found.octave) ? found : null;
    if (run) {
      const first = run.up[0], last = run.up[run.up.length - 1];
      const shifts = run.up.map((b, i) => [run.up[i - 1], b]).filter(([a, b]) => a && b.pos && a.pos && a.pos !== b.pos);
      const stretch = last.finger === "4x" ? ` Stretch 4 up for the top ${last.label}.` : "";
      const tip = multiPos
        ? shifts.map(([a, b]) => `Shift on ${a.label} → ${b.label}: slide lightly on ${a.finger}, then land ${b.finger} in ${ordinal(b.pos)} position.`).join(" ") + stretch
        : `One position all the way: the hand stays put while the fingers cross strings.${run.up.some((x) => x.finger === "0") ? " Use the open strings." : ""}${stretch}`;
      drills.push({ id: multiPos ? "shift" : "scale", group: "Put it together",
        name: `${first.label}${first.oct}→${last.label}${last.oct} ${multiPos ? `with ${shifts.length === 1 ? "a shift" : `${shifts.length} shifts`}` : `in ${ordinal(positions[0])} position`}`,
        notes: annotateShifts(upDown(run.up, run.down), spDown), frame: segFrame(run.up).trim(), tip });
    }
    const pool = new Map();
    for (const sp of [spUp, spDown]) for (const p of positions) for (const s of strings) for (const it of fingers4(s, p, sp)) pool.set(it.key + it.finger + it.pos, it);
    drills.push({ id: "hunt", group: "Put it together", name: "Note Hunt (adaptive)", hunt: true, pool: [...pool.values()], frame: "12 random notes",
      tip: `No pattern to lean on: remember the spot, then land it.${multiPos ? "" : ` It's all ${ordinal(positions[0])} position, but on any string.`} Your weakest notes come up most.` });
    if (!multiPos) return drills;

    // Shifting down: isolate the move on each string, then put it back into a scale that starts at the top.
    // With more than two strings, drill the strings the scale actually shifts on.
    const downTip = "Let the thumb and the whole hand travel back together, lightly. Coming down, most players stop short and land sharp. On guide-note shifts, slide the old finger to the guide note, then drop the new finger.";
    for (let i = 0; i + 1 < positions.length; i++) {
      const [p1, p2] = [positions[i], positions[i + 1]];
      let ss = strings;
      if (strings.length > 2) {
        const used = new Set();
        if (run) run.down.forEach((b, k) => { const a = run.down[k - 1]; if (a && a.pos === p1 && b.pos === p2) { used.add(a.string); used.add(b.string); } });
        ss = strings.filter((s) => used.has(s));
        if (!ss.length) ss = [strings[strings.length - 1]];
      }
      for (const s of ss) {
        const { pairs, seq } = downShiftPairs(s, p1, p2, spDown);
        drills.push({ id: positions.length === 2 ? `down-${s}` : `down-${p2}-${p1}-${s}`, group: "Shifting down",
          name: `${s} string: ${positions.length === 2 ? "shift pairs" : `${ordinal(p2)} ⇣ ${ordinal(p1)} pairs`}`, notes: seq,
          frame: `${ordinal(p2)} ⇣ ${ordinal(p1)}: ${pairs.map(([a, b]) => `${a.finger}→${b.finger}`).join(" ")}`, tip: downTip });
      }
    }
    if (run) {
      const top = run.down[run.down.length - 1], bottom = run.down[0];
      const notes = annotateShifts([...run.down].reverse().concat(run.up.slice(1)), spDown);
      const k = notes.findIndex((x) => x.shift === "down");
      drills.push({ id: "down-run", group: "Shifting down", name: `From the top: ${top.label}${top.oct}→${bottom.label}${bottom.oct}`, notes,
        frame: segFrame(notes.slice(0, run.down.length)).trim(),
        tip: `Start high and shift down while you're fresh, then climb back up. ${notes[k].guide ? `On ${notes[k - 1].label} → ${notes[k].label}, slide ${notes[k - 1].finger} to ${notes[k].guide.label}, then drop ${notes[k].finger}.` : `Shift down on ${notes[k - 1].label} → ${notes[k].label}.`}` });
    }
    return drills;
  }

  const cfgKey = (c) => `${c.tonic}-${c.type}-${c.strings.join("")}-${c.positions.join("-")}`;
  const cfgLabel = (c) => `${prettyTonic(c.tonic)} ${SCALE_TYPES[c.type].name} · ${andList(c.positions.map(ordinal))} position · ${stringsText(c.strings)}`;

  // Tidy a configuration: neighbouring strings spanning the ones chosen, 1–4 distinct positions (1st–7th), low to high
  function normalizeCfg(c) {
    const type = SCALE_TYPES[c.type] ? c.type : "major";
    const tonic = SCALE_TYPES[type].keys.includes(c.tonic) ? c.tonic : SCALE_TYPES[type].keys[0];
    const idx = (c.strings || []).map((s) => STRING_ORDER.indexOf(s)).filter((i) => i >= 0);
    const strings = idx.length ? STRING_ORDER.slice(Math.min(...idx), Math.max(...idx) + 1) : ["A", "E"];
    let positions = [...new Set((c.positions || []).map(Number).filter((p) => Number.isInteger(p) && p >= 1 && p <= 7))].sort((a, b) => a - b).slice(0, 4);
    if (!positions.length) positions = [1];
    return { tonic, type, strings, positions };
  }

  // Name any MIDI note, preferring the scale's own spelling, else sharps/flats to match the key
  function nameIn(midi, cfg) {
    const type = SCALE_TYPES[cfg.type], sp = spell(cfg.tonic, type);
    const pc = ((midi % 12) + 12) % 12;
    for (let l = 0; l < 7; l++) if ((NATURAL_PC[l] + sp.acc[l] + 12) % 12 === pc) return LETTERS[l] + ACC[sp.acc[l]];
    const flats = sp.acc.some((a) => a < 0);
    return flats ? ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"][pc] : ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][pc];
  }

  const api = { SCALE_TYPES, STRINGS, STRING_ORDER, ordinal, prettyTonic, spell, fingering, fingers4, openString, framePattern, frameTip, upDown, segFrame,
    annotateShifts, shiftPairs, handPattern, buildDrills, findRun, normalizeCfg, cfgKey, cfgLabel, nameIn };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Scales = api;
})(this);
