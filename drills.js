// Custom drill import/export: parse and validate drill JSON, turn it into practice items, and write it back out.
// Works in the browser (window.DrillIO) and in Node (module.exports) for testing.
(function (root) {
  const FORMAT = "fingerboard-coach/drill@1";
  const REPORT_FORMAT = "fingerboard-coach/report@1";
  const OPEN = { G: 55, D: 62, A: 69, E: 76 };
  const OPEN_DIATONIC = { G: 25, D: 29, A: 33, E: 37 }; // octave * 7 + letter index (C = 0)
  const LETTERS = "CDEFGAB";
  const NATURAL_PC = [0, 2, 4, 5, 7, 9, 11];
  const ACC_SIGN = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };
  const LIMITS = { notes: 64, expanded: 160, repeat: 10, title: 80, goal: 200, tips: 600 };

  // "C#6", "Bb4", "F##5", "E♭5", "Cx6" → { midi, label, oct, letter }
  function parseNote(text) {
    if (typeof text !== "string") return null;
    const m = text.trim().match(/^([A-Ga-g])(##|bb|#|b|x|♯|♭|𝄪|𝄫)?(-?\d)$/);
    if (!m) return null;
    const letter = LETTERS.indexOf(m[1].toUpperCase());
    const acc = { "#": 1, "♯": 1, "##": 2, x: 2, "𝄪": 2, b: -1, "♭": -1, bb: -2, "𝄫": -2 }[m[2]] || 0;
    const oct = +m[3];
    return { midi: (oct + 1) * 12 + NATURAL_PC[letter] + acc, label: LETTERS[letter] + ACC_SIGN[acc], oct, letter, acc };
  }
  const noteText = (it) => it.label.replace("𝄪", "##").replace("𝄫", "bb").replace("♯", "#").replace("♭", "b") + it.oct;
  const midiText = (m) => ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"][((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "drill";

  // LLM replies often wrap JSON in a ```json fence or add a sentence around it
  function extractJSON(text) {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const body = (fence ? fence[1] : text).trim();
    try { return { value: JSON.parse(body) }; } catch (e) {
      const a = body.indexOf("{"), b = body.lastIndexOf("}");
      if (a >= 0 && b > a) try { return { value: JSON.parse(body.slice(a, b + 1)) }; } catch (e2) {}
      return { error: `That isn't valid JSON (${e.message}).` };
    }
  }

  function validateDrill(d, where) {
    const errors = [], warnings = [];
    const err = (path, msg) => errors.push(`${where}${path}: ${msg}`);
    const warn = (path, msg) => warnings.push(`${where}${path}: ${msg}`);
    if (!d || typeof d !== "object" || Array.isArray(d)) return { errors: [`${where}: expected a drill object.`], warnings };
    if (d.format !== undefined && d.format !== FORMAT) warn(".format", `expected "${FORMAT}", got ${JSON.stringify(d.format)}. Reading it as version 1 anyway.`);
    if (typeof d.title !== "string" || !d.title.trim()) err(".title", "required, a short name for the drill.");
    else if (d.title.length > LIMITS.title) err(".title", `keep it under ${LIMITS.title} characters.`);
    for (const k of ["goal", "tips", "key"]) if (d[k] !== undefined && typeof d[k] !== "string") err(`.${k}`, "must be a string.");
    if (typeof d.goal === "string" && d.goal.length > LIMITS.goal) err(".goal", `keep it under ${LIMITS.goal} characters.`);
    if (typeof d.tips === "string" && d.tips.length > LIMITS.tips) err(".tips", `keep it under ${LIMITS.tips} characters.`);
    if (d.drone !== undefined && !parseNote(String(d.drone) + "4")) err(".drone", `a pitch class like "G", "Bb" or "F#"; got ${JSON.stringify(d.drone)}.`);
    const repeat = d.repeat === undefined ? 1 : d.repeat;
    if (!Number.isInteger(repeat) || repeat < 1 || repeat > LIMITS.repeat) err(".repeat", `a whole number from 1 to ${LIMITS.repeat}.`);
    if (d.upAndBack !== undefined && typeof d.upAndBack !== "boolean") err(".upAndBack", "must be true or false.");
    if (!Array.isArray(d.notes) || d.notes.length < 2) { err(".notes", "required, a list of at least 2 notes."); return { errors, warnings }; }
    if (d.notes.length > LIMITS.notes) err(".notes", `at most ${LIMITS.notes} notes; use "repeat" to loop a shorter pattern.`);

    const items = d.notes.map((n, i) => {
      const p = `.notes[${i}]`;
      if (!n || typeof n !== "object") { err(p, "each note must be an object like {\"note\": \"C6\", \"string\": \"E\", \"finger\": 1, \"position\": 5}."); return null; }
      const pn = parseNote(n.note);
      if (!pn) { err(`${p}.note`, `${JSON.stringify(n.note)} isn't a note name. Use scientific pitch with ASCII accidentals, e.g. "C#6", "Bb4".`); return null; }
      const s = typeof n.string === "string" ? n.string.toUpperCase() : n.string;
      if (!(s in OPEN)) { err(`${p}.string`, `must be "G", "D", "A" or "E"; got ${JSON.stringify(n.string)}.`); return null; }
      const finger = String(n.finger);
      if (!["0", "1", "2", "3", "4", "4x"].includes(finger)) { err(`${p}.finger`, `0 (open), 1–4, or "4x" (stretched 4th); got ${JSON.stringify(n.finger)}.`); return null; }
      if (pn.midi < OPEN[s]) { err(`${p}.note`, `${n.note} is below the open ${s} string, so it can't be played there.`); return null; }
      if (pn.midi > OPEN[s] + 26) { err(`${p}.note`, `${n.note} is too high to practise on the ${s} string.`); return null; }
      let pos = null;
      if (finger === "0") {
        if (pn.midi !== OPEN[s]) err(`${p}.finger`, `finger 0 means the open ${s} string, but the note is ${n.note}.`);
        if (n.position !== undefined && n.position !== null) warn(`${p}.position`, "ignored for an open string.");
      } else {
        if (!Number.isInteger(n.position) || n.position < 1 || n.position > 12) { err(`${p}.position`, `a whole number from 1 to 12; got ${JSON.stringify(n.position)}.`); return null; }
        pos = n.position;
        const steps = pn.oct * 7 + pn.letter - OPEN_DIATONIC[s];
        const expected = pos + (finger === "4x" ? 5 : +finger) - 1;
        if (Math.abs(steps - expected) > 1)
          warn(p, `${n.note} on the ${s} string is ${steps} letter-names above the open string, but finger ${finger} in position ${pos} is usually ${expected}. Check the finger or position.`);
      }
      const item = { midi: pn.midi, string: s, finger, pos, key: pn.midi + s, label: pn.label, oct: pn.oct };
      if (n.guide !== undefined) {
        const g = parseNote(n.guide);
        if (!g) err(`${p}.guide`, `${JSON.stringify(n.guide)} isn't a note name.`);
        else if (g.midi === pn.midi) err(`${p}.guide`, "the guide note can't be the target note itself.");
        else if (g.midi < OPEN[s] || g.midi > OPEN[s] + 26) err(`${p}.guide`, `${n.guide} isn't on the ${s} string.`);
        else item.guide = { midi: g.midi, label: g.label, oct: g.oct, string: s, pos };
      }
      return item;
    });
    if (errors.length) return { errors, warnings };

    let seq = items;
    if (d.upAndBack) seq = seq.concat(seq.slice(0, -1).reverse());
    const base = seq, once = base.length;
    for (let r = 1; r < repeat; r++) seq = seq.concat(base);
    if (seq.length > LIMITS.expanded) err("", `expands to ${seq.length} notes with upAndBack/repeat; keep it to ${LIMITS.expanded}.`);
    for (let i = 1; i < seq.length; i++) {
      if (seq[i].midi !== seq[i - 1].midi) continue;
      const a = (i - 1) % once, b = i % once;
      const at = i < once ? (d.upAndBack && i >= items.length ? "where upAndBack turns around" : `notes[${a}] and notes[${b}]`) : "where the repeat loops back to the start";
      err(".notes", `two notes in a row have the same pitch (${noteText(seq[i])}) ${at}. The app moves on when the pitch changes, so put a different note between them.`);
      break;
    }
    return { errors, warnings, seq };
  }

  // Parse pasted text or a file: one drill, a list, or {"drills": [...]}
  function parseImport(text) {
    const j = extractJSON(String(text || ""));
    if (j.error) return { drills: [], errors: [j.error], warnings: [] };
    const v = j.value;
    const list = Array.isArray(v) ? v : Array.isArray(v && v.drills) ? v.drills : v && v.format === REPORT_FORMAT && v.drill ? [v.drill] : [v];
    const drills = [], errors = [], warnings = [];
    list.forEach((d, i) => {
      const where = list.length > 1 ? `drills[${i}]` : "drill";
      const r = validateDrill(d, where);
      errors.push(...r.errors); warnings.push(...r.warnings);
      if (!r.errors.length) drills.push(normalize(d));
    });
    return { drills: errors.length ? [] : drills, errors, warnings };
  }

  // Keep only the fields we know, so stored drills stay clean
  function normalize(d) {
    const out = { format: FORMAT, title: d.title.trim() };
    for (const k of ["goal", "tips", "key"]) if (d[k]) out[k] = d[k].trim();
    if (d.drone) out.drone = String(d.drone);
    out.notes = d.notes.map((n) => {
      const o = { note: n.note.trim(), string: n.string.toUpperCase(), finger: String(n.finger) === "4x" ? "4x" : +n.finger };
      if (String(n.finger) !== "0") o.position = n.position;
      if (n.guide) o.guide = n.guide.trim();
      return o;
    });
    if (d.upAndBack) out.upAndBack = true;
    if (d.repeat && d.repeat > 1) out.repeat = d.repeat;
    return out;
  }

  // A stored drill → the exercise shape the app practises
  function toExercise(d) {
    const { seq } = validateDrill(d, "drill");
    const withFrom = seq.map((it, i) => (it.guide && i > 0 ? { ...it, from: seq[i - 1] } : it));
    const strings = ["G", "D", "A", "E"].filter((s) => seq.some((n) => n.string === s));
    const positions = [...new Set(seq.map((n) => n.pos).filter(Boolean))].sort((a, b) => a - b);
    const ordinal = (n) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
    return { id: "c-" + slug(d.title), custom: true, def: d, group: "My drills", name: d.title, notes: withFrom, key: d.key, drone: d.drone, goal: d.goal,
      frame: `${seq.length} notes · ${strings.join(" & ")} string${strings.length > 1 ? "s" : ""}${positions.length ? ` · ${positions.map(ordinal).join(" & ")} position` : ""}`,
      tip: [d.goal ? `Goal: ${d.goal}` : "", d.tips || ""].filter(Boolean).join(" ") || "Imported drill." };
  }

  // Any practised sequence (built-in or custom) → drill JSON that can be imported again
  function fromSequence(title, seq, extra = {}) {
    return { format: FORMAT, title, ...extra, notes: seq.map((it) => {
      const o = { note: noteText(it), string: it.string, finger: it.finger === "4x" ? "4x" : +it.finger };
      if (it.pos) o.position = it.pos;
      if (it.guide) o.guide = noteText(it.guide);
      return o;
    }) };
  }

  const FORMAT_DOC = `# Fingerboard Coach drill format (v1)

A drill is a JSON object. Paste it into the **My drills** tab (Import), or save it as a .json file and load it there.

## Drill fields
- format: "${FORMAT}" (recommended)
- title (required, ≤ ${LIMITS.title} chars): the drill's name in the list. Importing a drill with the same title replaces the old one.
- goal (optional, ≤ ${LIMITS.goal} chars): what the drill fixes, e.g. "Stop landing sharp on B5 after shifting down".
- tips (optional, ≤ ${LIMITS.tips} chars): coaching shown before the drill starts.
- key (optional): e.g. "G major". Used in wrong-note hints.
- drone (optional): pitch class for the drone, e.g. "G", "Bb", "F#".
- notes (required, 2–${LIMITS.notes} items), played in order. Each note has:
  - note (required): scientific pitch with ASCII accidentals, e.g. "C#6", "Bb4". Middle C = C4, A4 = the open A string.
  - string (required): "G", "D", "A" or "E".
  - finger (required): 0 (open string), 1, 2, 3, 4, or "4x" (4th finger stretched one note higher).
  - position (whole number 1–12, required unless finger is 0). In Nth position the 1st finger plays the note N letter-names above the open string, and the key decides its accidental. Example: A string, 3rd position, finger 1 = D5; E string, 5th position, finger 1 = C6.
  - guide (optional): a guide note for a shift, e.g. "A5". It is shown when this note is reached by a shift, and sounding it is not counted as a wrong note. It must be on the same string. Classic use when shifting down from finger 1 to finger 2: the guide is where finger 1 lands in the new position.
- upAndBack (optional, default false): after the last note, play the notes again in reverse without repeating the turning note.
- repeat (optional, 1–${LIMITS.repeat}, default 1): play the whole sequence this many times.

## Rules
- Two notes in a row must not have the same pitch, because the app moves on when the pitch changes. This also applies where a repeat loops back to the start and where upAndBack turns around.
- A note must be playable on its string: from the open string up to about two octaves above it.
- When the position changes between two notes, the app treats it as a shift (up or down) and gives shift-specific coaching.
- After upAndBack and repeat, a drill can have at most ${LIMITS.expanded} notes.
- To import several drills at once: {"format": "${FORMAT}", "drills": [ {...}, {...} ]}.
- A report (below) can also be imported; its drill is taken from it.

## Writing a good drill
- Isolate the problem. Alternate the hard move with its starting note and use "repeat", e.g. C6 → B5 → C6 → B5.
- Keep it to 8–24 notes, so one run takes under a minute.
- Add guide notes to shifts down onto a higher finger.
- Once the isolated move is reliable, put it back into a longer scale passage.

## Example
{
  "format": "${FORMAT}",
  "title": "E string: C6 → B5 down-shift",
  "goal": "Stop landing sharp on B5 after shifting from 5th to 3rd position",
  "tips": "Slide finger 1 back to A5 lightly, then drop finger 2 on B5. Let the thumb move with the hand.",
  "key": "G major",
  "drone": "G",
  "notes": [
    { "note": "C6", "string": "E", "finger": 1, "position": 5 },
    { "note": "B5", "string": "E", "finger": 2, "position": 3, "guide": "A5" },
    { "note": "D6", "string": "E", "finger": 2, "position": 5 },
    { "note": "B5", "string": "E", "finger": 2, "position": 3 }
  ],
  "repeat": 3
}

## Reports (export)
"Copy report" (in the results and in My drills) produces JSON with format "${REPORT_FORMAT}":
- drill: the drill in the format above (null for Note Hunt, whose notes are random; see the runs instead).
- context: key, a4 (the player's tuning in Hz), medal, number of runs.
- runs: the last 5 runs, newest first. Each run has:
  - date
  - mode: "lock" (the player holds each note in tune before moving on) or "flow" (they play straight through)
  - tolerance: ±cents counted as in tune
  - score: fraction of notes in tune
  - passed: true when score ≥ 0.85
  - landings: one entry per note, with note, string, finger, position, cents, inTune, wrongNoteFirst and shift
    - cents: the first steady landing, before any correction. Positive = sharp, negative = flat.
    - wrongNoteFirst: a different pitch the player played before finding the note, or null.
    - shift: "up", "down" or null.
  - coachNotes: the app's own feedback for that run.
- noteTrends: for each note in the drill, collected across all practice: avgCents over the last 20 landings, inTuneRate (share within ±15¢), landings and wrongNotes.

How to read landings:
- After a shift down, sharp = stopped short and flat = overshot.
- After a shift up, sharp = overshot and flat = fell short.
- A consistent sign on the same note is a habit; scattered signs point to an unstable hand frame.
- 10¢ is roughly 1–2 mm of finger movement in 3rd–5th position.
`;

  const api = { FORMAT, REPORT_FORMAT, FORMAT_DOC, parseNote, noteText, midiText, parseImport, validateDrill, toExercise, fromSequence, slug };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DrillIO = api;
})(this);
