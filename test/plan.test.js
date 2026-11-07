// Run: node test/plan.test.js — checks practice plan import, rotation, calendar and streak.
const P = require("../plan.js");
const D = require("../drills.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };

// The documented example imports cleanly, with its drill
const example = P.FORMAT_DOC.split("## Example")[1].split("## Reports")[0];
const ex = P.parseImport(example);
check("doc example imports", ex.errors.length === 0 && ex.warnings.length === 0 && ex.plan && ex.drills.length === 1, ex.errors.concat(ex.warnings));
check("doc example sessions", ex.plan.sessions.length === 2 && ex.plan.sessions[0].steps.length === 5);
check("fenced plan", P.parseImport("Here's your plan:\n```json\n" + example + "\n```").plan !== null);

// Keys, strings and setups
check("key D melodic minor", JSON.stringify(P.parseKey("D melodic minor")) === JSON.stringify({ tonic: "D", type: "melodic" }));
check("key Bb with ♭", P.parseKey("B♭ major").tonic === "Bb");
check("key F# harmonic", P.parseKey("f# harmonic minor").tonic === "F#");
check("bare minor is ambiguous", /natural, harmonic or melodic/.test(P.parseKey("D minor").error));
check("unknown spelling", /the app has/.test(P.parseKey("A# major").error));
check("strings D-E", P.parseStrings("D-E").strings.join("") === "DAE");
check("strings en dash", P.parseStrings("G–A").strings.join("") === "GDA");
check("strings list", P.parseStrings(["E", "A"]).strings.join("") === "AE");
check("one string", P.parseStrings("A").strings.join("") === "A");
check("bad string", !!P.parseStrings("C-E").error);
const s = P.parseScale({ key: "D melodic minor", strings: "D-E", positions: [5, 3] });
check("scale cfg", JSON.stringify(s.cfg) === JSON.stringify({ tonic: "D", type: "melodic", strings: ["D", "A", "E"], positions: [3, 5] }), s);

// Mistakes produce specific errors
const base = JSON.parse(example);
const bad = (mutate, needle) => {
  const p = JSON.parse(example); mutate(p);
  const r = P.parseImport(JSON.stringify(p));
  check(`error mentions ${needle}`, r.errors.some((m) => m.includes(needle)) && r.plan === null, r.errors);
};
bad((p) => delete p.title, "title");
bad((p) => (p.schedule.days = ["Funday"]), "Funday");
bad((p) => (p.schedule.minutes = 2), "schedule.minutes");
bad((p) => (p.sessions = []), "sessions");
bad((p) => (p.sessions[0].steps[1].scale.key = "D minor"), "natural, harmonic or melodic");
bad((p) => (p.sessions[0].steps[1].scale.positions = [3, 3]), "positions");
bad((p) => (p.sessions[0].steps[1].part = "arpeggio"), "part");
bad((p) => { p.sessions[0].steps[1].scale.positions = [3]; p.sessions[0].steps[1].part = "shifts"; }, "need 2 or more positions");
bad((p) => (p.sessions[0].steps[2].drill = "No such drill"), "No such drill");
bad((p) => (p.sessions[0].steps[0].scale = base.sessions[0].steps[1].scale), "exactly one");
bad((p) => (p.sessions[0].steps[0].minutes = 0), "minutes");
bad((p) => (p.drills[0].notes[1].note = "E9"), "drills[0]");
bad((p) => (p.start = "next Monday"), "start");

// A drill named in a step may already be in My drills
const p2 = JSON.parse(example); delete p2.drills;
check("missing drill without My drills", P.parseImport(JSON.stringify(p2)).errors.length === 1);
check("drill already in My drills", P.parseImport(JSON.stringify(p2), { knownDrills: ["A string: 3rd ⇄ 5th around F#5"] }).errors.length === 0);
// Steps that don't add up to the schedule warn but import
const p3 = JSON.parse(example); p3.schedule.minutes = 45;
const r3 = P.parseImport(JSON.stringify(p3));
check("minutes mismatch warns", r3.plan && r3.warnings.some((m) => m.includes("add up to 20")), r3.warnings);
// A drill pasted here is pointed to My drills; a plan report re-imports its plan
check("drill is not a plan", /My drills/.test(P.parseImport(JSON.stringify({ format: D.FORMAT, title: "x", notes: [] })).errors[0]));
check("report re-imports", P.parseImport(JSON.stringify({ format: P.REPORT_FORMAT, plan: base, days: [] })).plan !== null);
check("daily", P.validatePlan({ ...base, schedule: { days: "daily", minutes: 20 } }).plan.schedule.days.length === 7);

// Parts map to the setup's drills
const run = ex.plan.sessions[0].steps[1];
check("run ids", P.partIds(run).join() === "shift", P.partIds(run));
check("shift pairs ids", P.partIds(ex.plan.sessions[1].steps[2]).join() === "down-A", P.partIds(ex.plan.sessions[1].steps[2]));
check("labels", P.stepLabel(run) === "D major · 3rd & 5th position · D–E strings · full scale", P.stepLabel(run));

// ---------- Schedule ----------
// Mon, Tue, Thu, Sat from Monday 9 Nov 2026
const plan = { ...ex.plan, id: 1, start: "2026-11-09" };
const full = (session) => ({ plan: 1, session, secs: Object.fromEntries(plan.sessions[session].steps.map((st, i) => [i, st.minutes * 60])) });
check("weekday", P.weekday("2026-11-09") === "Mon");
check("practice days", ["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-14"].every((d) => P.isPracticeDay(plan, d)) && !P.isPracticeDay(plan, "2026-11-11") && !P.isPracticeDay(plan, "2026-11-02"));

let log = {};
check("first session", P.sessionIndex(plan, log, "2026-11-09") === 0);
log["2026-11-09"] = full(0);
check("rotates", P.sessionIndex(plan, log, "2026-11-10") === 1);
// Missing Tuesday doesn't skip the minor session
check("missed day keeps the session", P.sessionIndex(plan, log, "2026-11-12") === 1);
log["2026-11-12"] = full(1);
check("wraps around", P.sessionIndex(plan, log, "2026-11-14") === 0);
check("a started day keeps its session", P.sessionIndex(plan, log, "2026-11-12") === 1);
// Another plan's log doesn't count
check("other plan ignored", P.sessionIndex(plan, { "2026-11-09": { ...full(0), plan: 2 } }, "2026-11-10") === 0);

// Progress and done
const half = { plan: 1, session: 0, secs: { 0: 60, 1: 7 * 60, 2: 120 } }; // 1 + 7 + 2 of 20 min
check("progress partial", Math.abs(P.progress(plan, half, 0) - 0.5) < 1e-9, P.progress(plan, half, 0));
check("ticked step counts in full", Math.abs(P.progress(plan, { ...half, done: { 2: true, 3: true, 4: true } }, 0) - 1) < 1e-9);
check("step done by time", P.stepDone(plan.sessions[0].steps[1], half, 1) && !P.stepDone(plan.sessions[0].steps[2], half, 2));
check("done at 80%", P.dayDone(plan, { "2026-11-09": { ...half, secs: { ...half.secs, 3: 240, 4: 120 } } }, "2026-11-09"));

// Calendar around Thursday 12 Nov: Mon done, Tue missed, Wed rest, Thu today, then Sat planned
log = { "2026-11-09": full(0) };
const cal = P.calendar(plan, log, "2026-11-12", 4, 6);
const st = Object.fromEntries(cal.map((c) => [c.day.slice(8), c.state + (c.session !== undefined ? c.session : "")]));
check("calendar", JSON.stringify(st) === JSON.stringify({ "08": "off", "09": "done0", "10": "missed", "11": "rest", "12": "today1", "13": "rest", "14": "planned0", "15": "rest", "16": "planned1", "17": "planned0", "18": "rest" }), st);
check("practising on a rest day shows today", P.calendar(plan, { ...log, "2026-11-11": { plan: 1, session: 1, secs: {}, done: {} } }, "2026-11-11", 0, 1).map((c) => c.state + c.session).join() === "today1,planned0");
check("extra day", P.calendar(plan, { ...log, "2026-11-11": full(1) }, "2026-11-12", 1, 0)[0].state === "extra");

// Streak: rest days and an unfinished today don't break it; a missed practice day does
log = { "2026-11-09": full(0), "2026-11-10": full(1), "2026-11-12": full(0) };
check("streak 3 across a rest day", P.streak(plan, log, "2026-11-13") === 3, P.streak(plan, log, "2026-11-13"));
check("today unfinished keeps it", P.streak(plan, log, "2026-11-14") === 3);
check("missed day breaks it", P.streak(plan, log, "2026-11-15") === 0, P.streak(plan, log, "2026-11-15"));
check("before start", P.streak({ ...plan, start: "2026-11-20" }, log, "2026-11-13") === 0);

// Report days: practice days and extra days, not plain rest days
const days = P.reportDays(plan, { ...log, "2026-11-11": { plan: 1, session: 1, secs: { 1: 300 } } }, "2026-11-13", 7);
check("report days", days.map((d) => d.day.slice(8) + (d.steps ? "+" : "-")).join() === "09+,10+,11+,12+", days.map((d) => d.day));
check("report step minutes", days[3].steps[1].practisedMin === 7 && days[3].steps[1].done === true, days[3].steps[1]);
const missed = P.reportDays(plan, {}, "2026-11-10", 7);
check("missed day reported", missed.length === 2 && missed[0].practised === false, missed);

console.log(fails ? `${fails} failed` : "plan: all passed");
process.exit(fails ? 1 : 0);
