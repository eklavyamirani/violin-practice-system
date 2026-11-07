// Practice plans: a schedule (practice days, minutes) and rotating sessions of timed steps, written by Claude
// and imported like drills. Parses and validates plans, works out which session falls on which day, and
// what has been done. Works in the browser (window.PlanIO) and in Node (module.exports) for testing.
(function (root) {
  const Scales = typeof module !== "undefined" && module.exports ? require("./scales.js") : root.Scales;
  const DrillIO = typeof module !== "undefined" && module.exports ? require("./drills.js") : root.DrillIO;
  const FORMAT = "fingerboard-coach/plan@1";
  const REPORT_FORMAT = "fingerboard-coach/plan-report@1";
  const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const LIMITS = { title: 80, goal: 200, tips: 600, name: 60, note: 200, sessions: 7, steps: 12, minutes: [5, 120], stepMinutes: [1, 60] };
  // A step's part of a scale setup: which of the setup's drills it uses
  const PARTS = {
    auto: { name: "adaptive", has: () => true },
    run: { name: "full scale", has: (d) => d.id === "shift" || d.id === "scale" },
    top: { name: "from the top", has: (d) => d.id === "down-run" },
    rhythms: { name: "rhythms", has: (d) => d.id.startsWith("rh-") },
    shifts: { name: "shift pairs", has: (d) => d.id.startsWith("down-") && d.id !== "down-run" },
    build: { name: "build-up drills", has: (d) => d.role === "build" },
    hunt: { name: "Note Hunt", has: (d) => d.id === "hunt" },
  };
  const TYPE_WORDS = { major: "major", "natural minor": "natural", "harmonic minor": "harmonic", "melodic minor": "melodic" };
  const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(toDate(s));

  // ---------- Days ("YYYY-MM-DD", local) ----------
  function toDate(day) { const [y, m, d] = day.split("-").map(Number); return new Date(y, m - 1, d); }
  const dayOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function addDays(day, n) { const d = toDate(day); d.setDate(d.getDate() + n); return dayOf(d); }
  const weekday = (day) => WEEKDAYS[toDate(day).getDay()];

  // ---------- Parsing ----------
  // "D major", "Bb melodic minor", "F♯ harmonic minor" → { tonic, type }
  function parseKey(text) {
    const m = typeof text === "string" && text.trim().match(/^([A-Ga-g])\s*(#|b|♯|♭)?\s+(major|natural minor|harmonic minor|melodic minor|minor)$/i);
    if (!m) return { error: `"${text}" isn't a key. Write it like "D major" or "D melodic minor".` };
    const words = m[3].toLowerCase();
    if (words === "minor") return { error: `"${text}": say which minor: natural, harmonic or melodic.` };
    const tonic = m[1].toUpperCase() + ({ "#": "#", "♯": "#", b: "b", "♭": "b" }[m[2]] || "");
    const type = TYPE_WORDS[words];
    if (!Scales.SCALE_TYPES[type].keys.includes(tonic)) return { error: `"${text}": the app has ${Scales.SCALE_TYPES[type].keys.map(Scales.prettyTonic).join(", ")} ${words}.` };
    return { tonic, type };
  }
  // "D-E", "D–E", "D to E", "A", ["D", "E"] → the strings from the lowest to the highest named
  function parseStrings(v) {
    const list = Array.isArray(v) ? v : typeof v === "string" ? v.split(/\s*(?:-|–|—|to|,|\+)\s*/i) : null;
    const order = ["G", "D", "A", "E"];
    const idx = (list || []).map((s) => order.indexOf(String(s).trim().toUpperCase()));
    if (!idx.length || idx.some((i) => i < 0)) return { error: `strings: "${v}" should name strings G, D, A or E, like "D-E" or ["A", "E"].` };
    return { strings: order.slice(Math.min(...idx), Math.max(...idx) + 1) };
  }
  // A step's scale setup → the app's free-practice configuration
  function parseScale(s) {
    if (!isObj(s)) return { error: `scale: expected { "key": "D major", "strings": "D-E", "positions": [3, 5] }.` };
    const k = parseKey(s.key);
    if (k.error) return { error: `scale.key: ${k.error}` };
    const st = parseStrings(s.strings);
    if (st.error) return { error: `scale.${st.error}` };
    const ps = s.positions;
    if (!Array.isArray(ps) || !ps.length || ps.length > 4 || ps.some((p) => !Number.isInteger(p) || p < 1 || p > 7) || new Set(ps).size !== ps.length)
      return { error: `scale.positions: 1 to 4 different positions from 1 to 7, like [3, 5].` };
    return { cfg: Scales.normalizeCfg({ tonic: k.tonic, type: k.type, strings: st.strings, positions: ps }) };
  }
  function parseDays(v) {
    if (v === "daily") return { days: [...WEEKDAYS] };
    if (!Array.isArray(v) || !v.length) return { error: `schedule.days: a list of weekdays like ["Mon", "Wed", "Fri"], or "daily".` };
    const out = [];
    for (const d of v) {
      const i = WEEKDAYS.findIndex((w) => typeof d === "string" && d.trim().toLowerCase().startsWith(w.toLowerCase()));
      if (i < 0) return { error: `schedule.days: "${d}" isn't a weekday (Sun, Mon, Tue, Wed, Thu, Fri, Sat).` };
      if (!out.includes(WEEKDAYS[i])) out.push(WEEKDAYS[i]);
    }
    return { days: WEEKDAYS.filter((w) => out.includes(w)) };
  }
  const minutesOk = (m, [lo, hi]) => typeof m === "number" && m >= lo && m <= hi;

  // A plan object → { plan (normalized), drills (to add to My drills), errors, warnings }.
  // knownDrills: titles already in My drills, which steps may also use.
  function validatePlan(p, { knownDrills = [] } = {}) {
    const errors = [], warnings = [];
    const err = (path, msg) => errors.push(`${path}: ${msg}`);
    const warn = (path, msg) => warnings.push(`${path}: ${msg}`);
    if (!isObj(p)) return { errors: ["plan: expected a plan object."], warnings, drills: [] };
    if (p.format !== undefined && p.format !== FORMAT) warn("format", `expected "${FORMAT}".`);
    const out = { format: FORMAT };
    if (typeof p.title !== "string" || !p.title.trim()) err("title", "required.");
    else if (p.title.length > LIMITS.title) err("title", `at most ${LIMITS.title} characters.`);
    else out.title = p.title.trim();
    for (const k of ["goal", "tips"]) {
      if (p[k] === undefined) continue;
      if (typeof p[k] !== "string" || p[k].length > LIMITS[k]) err(k, `text of at most ${LIMITS[k]} characters.`);
      else if (p[k].trim()) out[k] = p[k].trim();
    }
    for (const k of ["start", "end"]) {
      if (p[k] === undefined) continue;
      if (!isDay(p[k])) err(k, `a date like "2026-11-09".`); else out[k] = p[k];
    }
    if (out.start && out.end && out.end < out.start) err("end", "comes before start.");

    // Drills written for the plan, in the drill format
    const drills = [];
    if (p.drills !== undefined && !Array.isArray(p.drills)) err("drills", "a list of drills in the drill format.");
    const planDrills = Array.isArray(p.drills) ? p.drills : [];
    planDrills.forEach((d, i) => {
      const r = DrillIO.validateDrill(d, `drills[${i}]`);
      errors.push(...r.errors); warnings.push(...r.warnings);
      if (!r.errors.length) drills.push(DrillIO.parseImport(JSON.stringify(d)).drills[0]);
    });
    // Titles from the raw list, so a broken drill doesn't also report its step as missing
    const titles = new Set([...planDrills.map((d) => isObj(d) && typeof d.title === "string" && d.title.trim()).filter(Boolean), ...knownDrills]);

    const sc = p.schedule;
    if (!isObj(sc)) err("schedule", `required, like { "days": ["Mon", "Wed", "Fri"], "minutes": 20 }.`);
    else {
      const d = parseDays(sc.days);
      if (d.error) errors.push(d.error);
      if (!minutesOk(sc.minutes, LIMITS.minutes)) err("schedule.minutes", `minutes per session, ${LIMITS.minutes[0]} to ${LIMITS.minutes[1]}.`);
      if (!d.error && minutesOk(sc.minutes, LIMITS.minutes)) out.schedule = { days: d.days, minutes: sc.minutes };
    }

    if (!Array.isArray(p.sessions) || !p.sessions.length || p.sessions.length > LIMITS.sessions) err("sessions", `1 to ${LIMITS.sessions} sessions; they take turns on the practice days.`);
    else out.sessions = p.sessions.map((s, si) => {
      const where = `sessions[${si}]`;
      const o = {};
      if (!isObj(s)) { err(where, "expected a session object."); return o; }
      if (typeof s.name !== "string" || !s.name.trim() || s.name.length > LIMITS.name) err(`${where}.name`, `required, at most ${LIMITS.name} characters.`);
      else o.name = s.name.trim();
      if (!Array.isArray(s.steps) || !s.steps.length || s.steps.length > LIMITS.steps) { err(`${where}.steps`, `1 to ${LIMITS.steps} steps.`); return o; }
      o.steps = s.steps.map((st, i) => validateStep(st, `${where}.steps[${i}]`, titles, err));
      const total = o.steps.reduce((a, x) => a + (x.minutes || 0), 0);
      if (out.schedule && total && Math.abs(total - out.schedule.minutes) > out.schedule.minutes * 0.25)
        warn(`${where}`, `its steps add up to ${total} minutes, but schedule.minutes is ${out.schedule.minutes}.`);
      return o;
    });
    return { plan: errors.length ? null : out, drills: errors.length ? [] : drills, errors, warnings };
  }

  function validateStep(st, where, titles, err) {
    const o = {};
    if (!isObj(st)) { err(where, "expected a step object."); return o; }
    if (!minutesOk(st.minutes, LIMITS.stepMinutes)) err(`${where}.minutes`, `required, ${LIMITS.stepMinutes[0]} to ${LIMITS.stepMinutes[1]}.`);
    else o.minutes = st.minutes;
    if (st.note !== undefined) {
      if (typeof st.note !== "string" || st.note.length > LIMITS.note) err(`${where}.note`, `text of at most ${LIMITS.note} characters.`);
      else if (st.note.trim()) o.note = st.note.trim();
    }
    const kinds = ["tune", "scale", "drill", "path", "piece"].filter((k) => st[k] !== undefined);
    if (kinds.length !== 1) { err(where, `needs exactly one of "tune", "scale", "drill", "path" or "piece"${kinds.length ? ` (it has ${kinds.join(" and ")})` : ""}.`); return o; }
    const kind = kinds[0];
    if (kind === "tune" || kind === "piece") {
      if (st[kind] !== true) err(`${where}.${kind}`, "should be true.");
      else o[kind] = true;
    } else if (kind === "path") {
      if (st.path !== "reviews" && st.path !== "next") err(`${where}.path`, `"reviews" (Path skills due for review) or "next" (whatever Path's Next up says).`);
      else o.path = st.path;
    } else if (kind === "drill") {
      if (typeof st.drill !== "string" || !titles.has(st.drill.trim())) err(`${where}.drill`, `"${st.drill}" isn't in this plan's "drills" or in My drills. Use a drill's exact title.`);
      else o.drill = st.drill.trim();
    } else {
      const r = parseScale(st.scale);
      if (r.error) { err(where, r.error); return o; }
      const part = st.part === undefined ? "auto" : st.part;
      if (!PARTS[part]) { err(`${where}.part`, `one of ${Object.keys(PARTS).map((k) => `"${k}"`).join(", ")}.`); return o; }
      const have = Scales.buildDrills(r.cfg).filter(PARTS[part].has);
      if (!have.length) { err(`${where}.part`, `${Scales.cfgLabel(r.cfg)} has no ${PARTS[part].name}${part === "top" || part === "shifts" ? " (they need 2 or more positions)" : ""}.`); return o; }
      o.scale = r.cfg; o.part = part;
    }
    return o;
  }

  // Pasted text → { plan, drills, errors, warnings }. Code fences and text around the JSON are fine.
  function parseImport(text, opts) {
    const j = DrillIO.extractJSON(String(text || ""));
    if (j.error) return { plan: null, drills: [], errors: [j.error], warnings: [] };
    const v = j.value;
    if (isObj(v) && v.format === REPORT_FORMAT && isObj(v.plan)) return validatePlan(v.plan, opts);
    if (isObj(v) && v.format === DrillIO.FORMAT) return { plan: null, drills: [], errors: ["That's a drill, not a plan. Import it on the My drills tab."], warnings: [] };
    return validatePlan(v, opts);
  }

  // ---------- Steps ----------
  function stepLabel(st) {
    if (st.tune) return "Tune";
    if (st.piece) return "Piece";
    if (st.drill) return st.drill;
    if (st.path) return st.path === "reviews" ? "Path reviews" : "Path: Next up";
    if (st.scale) return `${Scales.cfgLabel(st.scale)} · ${PARTS[st.part].name}`;
    return "Step";
  }
  // The setup's drill ids that a scale step uses
  const partIds = (st) => Scales.buildDrills(st.scale).filter(PARTS[st.part].has).map((d) => d.id);

  // ---------- Schedule ----------
  // log: { "YYYY-MM-DD": { plan: <plan id>, session: <index>, secs: { <step>: seconds }, done: { <step>: true } } }
  const entryFor = (plan, log, day) => { const e = log && log[day]; return e && e.plan === plan.id ? e : null; };
  const practised = (e) => !!e && (Object.values(e.secs || {}).some((s) => s > 0) || Object.values(e.done || {}).some(Boolean));
  const inRange = (plan, day) => (!plan.start || day >= plan.start) && (!plan.end || day <= plan.end);
  const isPracticeDay = (plan, day) => inRange(plan, day) && plan.schedule.days.includes(weekday(day));

  // The session a day follows: the one it started, else the one after the last day practised
  function sessionIndex(plan, log, day) {
    const e = entryFor(plan, log, day);
    if (e && typeof e.session === "number" && plan.sessions[e.session]) return e.session;
    let last = null;
    for (const d of Object.keys(log || {})) if (d < day && practised(entryFor(plan, log, d)) && (!last || d > last)) last = d;
    return last === null ? 0 : (log[last].session + 1) % plan.sessions.length;
  }
  const stepDone = (st, e, i) => !!e && (!!(e.done && e.done[i]) || ((e.secs && e.secs[i]) || 0) >= st.minutes * 60);
  // Share of the session's planned minutes done (a step marked done counts in full)
  function progress(plan, e, si) {
    const steps = plan.sessions[si].steps, total = steps.reduce((a, s) => a + s.minutes, 0);
    if (!e) return 0;
    return steps.reduce((a, s, i) => a + (stepDone(s, e, i) ? s.minutes : Math.min(s.minutes, ((e.secs && e.secs[i]) || 0) / 60)), 0) / total;
  }
  const DONE_AT = 0.8;
  const dayDone = (plan, log, day) => { const e = entryFor(plan, log, day); return !!e && progress(plan, e, sessionIndex(plan, log, day)) >= DONE_AT; };

  // Days around today: practice days with their session, what happened on past days, rest days.
  // state: done | partial | missed | rest | extra (practised on a rest day) | today | planned | off (outside the plan's dates)
  function calendar(plan, log, today, back = 7, ahead = 7) {
    const out = [];
    let next = sessionIndex(plan, log, today);
    for (let i = -back; i <= ahead; i++) {
      const day = addDays(today, i), e = entryFor(plan, log, day), practice = isPracticeDay(plan, day);
      const row = { day, weekday: weekday(day), practice };
      if (!inRange(plan, day)) row.state = "off";
      else if (day < today) {
        if (practised(e)) { row.session = e.session; row.state = practice ? (dayDone(plan, log, day) ? "done" : "partial") : "extra"; }
        else row.state = practice ? "missed" : "rest";
      } else if (day === today) {
        row.session = next;
        row.state = dayDone(plan, log, day) ? "done" : practice || e ? "today" : "rest"; // e: chose to practise on a rest day
        if (row.state !== "rest") next = (next + 1) % plan.sessions.length;
      } else if (practice) { row.session = next; row.state = "planned"; next = (next + 1) % plan.sessions.length; }
      else row.state = "rest";
      if (row.session === undefined) delete row.session;
      out.push(row);
    }
    return out;
  }

  // Practice days in a row with the session done. Rest days don't break it, and nor does today until it's over.
  function streak(plan, log, today) {
    const first = plan.start || addDays(today, -366);
    let n = 0;
    for (let day = plan.end && plan.end < today ? plan.end : today; day >= first; day = addDays(day, -1)) {
      if (dayDone(plan, log, day)) n++;
      else if (day !== today && isPracticeDay(plan, day)) break;
    }
    return n;
  }

  // The plan's days so far, for the report: what was planned and how much of each step was done
  function reportDays(plan, log, today, days = 28) {
    const out = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = addDays(today, -i);
      if (!inRange(plan, day)) continue;
      const e = entryFor(plan, log, day), practice = isPracticeDay(plan, day);
      if (!practice && !practised(e)) continue;
      const si = sessionIndex(plan, log, day), s = plan.sessions[si];
      out.push({ day, weekday: weekday(day), scheduled: practice, session: s.name,
        ...(practised(e) ? { steps: s.steps.map((st, j) => ({ step: stepLabel(st), plannedMin: st.minutes, practisedMin: Math.round(((e.secs && e.secs[j]) || 0) / 6) / 10, done: stepDone(st, e, j) })) }
          : { practised: false }) });
    }
    return out;
  }

  const FORMAT_DOC = `# Fingerboard Coach practice plan format (v1)

A plan is a practice schedule plus what to practise in each session. Paste it into the **Plan** tab (Import), or save it as a .json file and load it there. Importing a plan replaces the current one; what was practised is kept.

## Plan fields
- format: "${FORMAT}" (recommended)
- title (required, ≤ ${LIMITS.title} chars), goal (optional, ≤ ${LIMITS.goal}): what the plan works toward, tips (optional, ≤ ${LIMITS.tips}): coaching shown with the plan.
- start, end (optional): dates like "2026-11-09". Without start the plan starts when it's imported.
- schedule (required): { "days": ["Mon", "Tue", "Thu", "Sat"] (or "daily"), "minutes": ${LIMITS.minutes[0]}–${LIMITS.minutes[1]} per session }
- sessions (required, 1–${LIMITS.sessions}): they take turns, one per practice day. The next practice day gets the session after the last one practised, so a missed day doesn't skip a session.
  - name (required, ≤ ${LIMITS.name} chars), steps (required, 1–${LIMITS.steps}), done in order. Their minutes should add up to about schedule.minutes.
- drills (optional): drills written for this plan, in the drill format (see the My drills tab). They are added to My drills on import.

## Steps
Every step has minutes (${LIMITS.stepMinutes[0]}–${LIMITS.stepMinutes[1]}) and an optional note (≤ ${LIMITS.note} chars) shown with it, plus exactly one of:
- "tune": true — tune from the open A.
- "scale": { "key", "strings", "positions" } with a "part" — practise a scale setup, as on the Scale card in Free practice. It doesn't need to be unlocked on the Path.
  - key: "D major", "Bb natural minor", "F# harmonic minor", "D melodic minor" (melodic minor goes up melodic and comes down natural).
  - strings: the lowest and highest string, "D-E" (D, A and E) or "A" (one string).
  - positions: 1–4 positions from 1 to 7, e.g. [3, 5].
  - part (default "auto"):
    - "run": the full scale, up and back. Misses that cluster in one spot send the player to that spot's build-up drill, then back.
    - "top": the run starting from the top (needs 2+ positions).
    - "rhythms": the run in dotted, snapped and triplet rhythms.
    - "shifts": the shift pairs for shifting down (needs 2+ positions).
    - "build": each string and position on its own.
    - "hunt": Note Hunt, random notes from the setup, weakest notes more often.
    - "auto": the app's own order for the setup.
  Medals and tempo carry on from what the player has done on that setup before.
- "drill": "<title>" — a drill from this plan's drills, or one already in My drills (exact title).
- "path": "reviews" (Path skills due for review; done at once if none are due) or "next" (Path's Next up).
- "piece": true — record a piece on the Piece tab; say which piece and what to listen for in the note.

A step counts as done once its minutes are practised: time counts while drills are being played (and a minute or two between runs). The player can also tick a step done. A session counts as done at ${Math.round(DONE_AT * 100)}% of its minutes. The streak counts practice days in a row with the session done; rest days don't break it.

## Writing a good plan
- Put the hardest new work early, after tuning, while the player is fresh.
- Interleave: two keys or two parts in one session beat one long block.
- 4–10 minutes per step. Short steps for drills that isolate one move.
- Use several sessions to rotate focus (e.g. major one day, minor the next).
- Write a drill for a specific problem the reports show, and give it a step.

## Example
{
  "format": "${FORMAT}",
  "title": "D major & D melodic minor · 3rd & 5th · D–E strings",
  "goal": "Both scales clean through the 3rd-to-5th shift at ♩=60, 2 notes per beat",
  "schedule": { "days": ["Mon", "Tue", "Thu", "Sat"], "minutes": 20 },
  "sessions": [
    { "name": "Major focus", "steps": [
      { "tune": true, "minutes": 1 },
      { "scale": { "key": "D major", "strings": "D-E", "positions": [3, 5] }, "part": "run", "minutes": 7 },
      { "drill": "A string: 3rd ⇄ 5th around F#5", "minutes": 4, "note": "Light thumb on the way up; land on finger 1." },
      { "scale": { "key": "D major", "strings": "D-E", "positions": [3, 5] }, "part": "top", "minutes": 4 },
      { "scale": { "key": "D melodic minor", "strings": "D-E", "positions": [3, 5] }, "part": "run", "minutes": 4 }
    ] },
    { "name": "Minor focus", "steps": [
      { "tune": true, "minutes": 1 },
      { "scale": { "key": "D melodic minor", "strings": "D-E", "positions": [3, 5] }, "part": "run", "minutes": 7, "note": "B and C# going up, C and Bb coming down." },
      { "scale": { "key": "D melodic minor", "strings": "D-E", "positions": [3, 5] }, "part": "shifts", "minutes": 4 },
      { "scale": { "key": "D melodic minor", "strings": "D-E", "positions": [3, 5] }, "part": "top", "minutes": 4 },
      { "scale": { "key": "D major", "strings": "D-E", "positions": [3, 5] }, "part": "hunt", "minutes": 4 }
    ] }
  ],
  "drills": [
    { "title": "A string: 3rd ⇄ 5th around F#5", "key": "D major", "drone": "D",
      "notes": [
        { "note": "D5", "string": "A", "finger": 1, "position": 3 },
        { "note": "E5", "string": "A", "finger": 2, "position": 3 },
        { "note": "F#5", "string": "A", "finger": 1, "position": 5 },
        { "note": "G5", "string": "A", "finger": 2, "position": 5 },
        { "note": "F#5", "string": "A", "finger": 1, "position": 5 },
        { "note": "E5", "string": "A", "finger": 2, "position": 3, "guide": "D5" }
      ],
      "repeat": 3 }
  ]
}

## Reports (export)
"Copy plan report" on the Plan tab produces JSON with format "${REPORT_FORMAT}":
- plan: the plan as imported.
- days: the last 4 weeks of practice days (and extra days practised): the session, each step's planned and practised minutes, and whether it was done; or practised: false.
- scales: for each scale setup in the plan, each drill's medal, tempo, runs and recent results (score, average miss in cents, the notes missed).
- drills: the plan's drills, each with its last runs (the drill report format).
- path: Path reviews due and the current focus, when the plan has Path steps.
Write the next plan from it: keep what's working, give steps to the drills and spots that keep missing, and move on when a part is done.
A plan report can also be imported; its plan is taken from it.`;

  const api = { FORMAT, REPORT_FORMAT, FORMAT_DOC, WEEKDAYS, PARTS, DONE_AT, parseKey, parseStrings, parseScale, validatePlan, parseImport, stepLabel, partIds,
    addDays, weekday, isPracticeDay, sessionIndex, stepDone, progress, dayDone, calendar, streak, reportDays, practised };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PlanIO = api;
})(this);
