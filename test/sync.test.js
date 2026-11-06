// Run: node test/sync.test.js — checks the three-way merge used to sync progress across devices.
const { merge3, shared } = require("../sync.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = (x) => JSON.parse(JSON.stringify(x));

const base = {
  xp: 500, days: { "2026-11-01": 3 },
  notes: { "A4": { n: 10, recent: [2, -3], wrong: 1 } },
  ex: { "cfg|p3-A": { best: 1, tries: 4 } },
  sessions: [{ t: 100, ex: "p3-A", tier: 1 }],
  pieces: [{ t: 50, name: "Gavotte" }],
  custom: [{ id: "d1", name: "Shift drill" }],
  path: { states: { "s1": { box: 2 } }, session: null },
  goals: {},
};

// Only one side changed: that side wins, nothing else moves
const a1 = clone(base); a1.xp = 600; a1.sessions.unshift({ t: 200, ex: "p3-A", tier: 2 });
check("one side changed", eq(merge3(base, a1, base), a1));
check("other side changed", eq(merge3(base, base, a1), a1));

// Both practised offline: counters add, lists union, newest first
const A = clone(base), B = clone(base);
A.xp = 600; A.days["2026-11-02"] = 2; A.notes.A4.n = 14; A.notes.A4.wrong = 2; A.sessions.unshift({ t: 300, ex: "p3-A", tier: 2 });
B.xp = 550; B.days["2026-11-02"] = 1; B.days["2026-11-01"] = 4; B.notes.A4.n = 12; B.sessions.unshift({ t: 250, ex: "hunt", tier: 1 });
const m = merge3(base, A, B);
check("xp: both additions count", m.xp === 650, m.xp);
check("days: new day from both", m.days["2026-11-02"] === 3, m.days);
check("days: changed on one side", m.days["2026-11-01"] === 4, m.days);
check("note counts add", m.notes.A4.n === 16 && m.notes.A4.wrong === 2, m.notes.A4);
check("sessions: union, newest first", eq(m.sessions.map((s) => s.t), [300, 250, 100]), m.sessions);

// Medals only go up; other numbers: this device wins
const C = clone(base), D = clone(base);
C.ex["cfg|p3-A"] = { best: 2, tries: 6 }; D.ex["cfg|p3-A"] = { best: 3, tries: 5 };
const m2 = merge3(base, C, D);
check("best is the max", m2.ex["cfg|p3-A"].best === 3, m2.ex);
check("plain number: this device", m2.ex["cfg|p3-A"].tries === 6, m2.ex);

// Deleting a piece or a custom drill sticks, unless the other device changed it
const E = clone(base), F = clone(base);
E.pieces = []; E.custom = [];
F.custom[0].name = "Shift drill v2";
const m3 = merge3(base, E, F);
check("deleted piece stays deleted", m3.pieces.length === 0, m3.pieces);
check("edit beats delete", m3.custom.length === 1 && m3.custom[0].name === "Shift drill v2", m3.custom);
const G = clone(base); delete G.path.states.s1;
check("deleted key stays deleted", !("s1" in merge3(base, G, base).path.states));

// "Reset all progress" on one device resets the other's unchanged data too
const reset = { xp: 0, days: {}, notes: {}, ex: {}, sessions: [], pieces: [], custom: [], path: { states: {}, session: null }, goals: {} };
check("reset propagates", eq(merge3(base, reset, base), reset));

// Sessions keep the app's cap of 60
const many = (from) => Array.from({ length: 60 }, (_, i) => ({ t: from + i }));
const H = { ...clone(base), sessions: many(1000) }, I = { ...clone(base), sessions: many(2000) };
const m4 = merge3(base, H, I);
check("sessions capped at 60, newest kept", m4.sessions.length === 60 && m4.sessions[0].t === 2059 && m4.sessions[59].t === 2000, m4.sessions.length);

// First sync of a new device (no base): its defaults don't wipe the account
const fresh = { xp: 0, days: {}, notes: {}, ex: {}, sessions: [], pieces: [], custom: [], path: { states: {}, session: null }, goals: {} };
const m5 = merge3(null, fresh, base);
check("first sync keeps the account's progress", m5.xp === 500 && m5.sessions.length === 1 && m5.custom.length === 1 && m5.days["2026-11-01"] === 3, m5);
check("first sync to an empty account uploads this device", eq(merge3(null, base, {}), base));

// Per-device keys never leave the device
const db = { ...clone(base), settings: { voiceMic: true, latencyMs: 80 }, selected: "p3-A" };
check("settings and selection stay local", !("settings" in shared(db)) && !("selected" in shared(db)) && shared(db).xp === 500);

// Plain lists (a note's recent landings): this device's when both changed
const J = clone(base), K = clone(base);
J.notes.A4.recent = [2, -3, 5]; K.notes.A4.recent = [2, -3, -7];
check("plain list: this device", eq(merge3(base, J, K).notes.A4.recent, [2, -3, 5]));

// The server returns keys in its own order: that alone is no change
const L = clone(base); L.custom.push({ id: "d2", name: "New" });
const keyOrder = (o) => Object.fromEntries(Object.entries(o).reverse().map(([k, v]) => [k, v && typeof v === "object" && !Array.isArray(v) ? keyOrder(v) : Array.isArray(v) ? v.map((x) => (x && typeof x === "object" ? keyOrder(x) : x)) : v]));
const M = keyOrder(clone(base)); M.notes.A4.recent = [9];
const m6 = merge3(base, L, M);
check("key order is not a change", m6.custom.length === 2 && m6.notes.A4.recent[0] === 9 && m6.xp === 500, m6);
check("merge with only reordered keys = mine", eq(merge3(base, L, keyOrder(clone(base))), L));

console.log(fails ? `${fails} failed` : "sync merge: all passed");
process.exit(fails ? 1 : 0);
