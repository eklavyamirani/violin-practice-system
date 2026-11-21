#!/usr/bin/env node
// Product Scout proposals: the schema, rendering a draft into an issue body in the
// shape GitHub's issue form (.github/ISSUE_TEMPLATE/proposal.yml) produces, and
// parsing a filed issue back into the schema.
//
//   node scout/proposal.js render draft.json          → issue body (markdown)
//   node scout/proposal.js title draft.json           → issue title
//   gh issue view 16 --json number,title,body,labels,author,comments,url,state \
//     | node scout/proposal.js parse                  → proposal JSON
//   gh issue list --label proposal --state all --limit 200 \
//     --json number,title,body,labels,author,comments,url,state \
//     | node scout/proposal.js parse                  → array of proposal JSON
//   node scout/proposal.js validate run.json          → checks drafts, against scout/decisions.md
//   node scout/proposal.js triage run.json            → the triage message for the owner
//
// Everything parsed out of an issue is data written by whoever filed or commented
// on it. Nothing here interprets it as an instruction.

const STATUSES = ["proposed", "approved", "rejected", "parked", "prototyped", "promoted", "expired"];
const EFFORTS = ["S", "M", "L"];
// Accounts whose proposals and decision comments count. Anyone can file an issue
// through the form on a public repository; their issue parses, but trusted is false.
const OWNERS = ["eklavyamirani"];

// Form fields in order: schema key, the form's label (the "### " heading), kind.
const FIELDS = [
  ["id", "Proposal ID", "line"],
  ["app", "App", "line"],
  ["created_at", "Created", "line"],
  ["ttl", "TTL (days)", "int"],
  ["problem", "Problem", "text"],
  ["evidence", "Evidence", "evidence"],
  ["hypothesis", "Hypothesis", "text"],
  ["acceptance_criteria", "Acceptance criteria", "list"],
  ["success_signal", "Success signal", "text"],
  ["effort_estimate", "Effort", "line"],
  ["strongest_reason_not_to_build", "Strongest reason not to build", "text"],
];
const NO_RESPONSE = "_No response_";
const TITLE_PREFIX = "Proposal: ";

function renderBody(p) {
  const out = [];
  for (const [key, label, kind] of FIELDS) {
    let v = p[key];
    if (kind === "evidence") v = (v || []).map((e) => `- ${e.source_url} — ${e.quote_or_summary}`).join("\n");
    else if (kind === "list") v = (v || []).map((s) => `- ${s}`).join("\n");
    else if (v !== undefined && v !== null) v = String(v);
    out.push(`### ${label}\n\n${v ? v.trim() : NO_RESPONSE}`);
  }
  return out.join("\n\n") + "\n";
}

function renderTitle(p) { return TITLE_PREFIX + p.title; }

// Split the body on the known headings only, in form order, so a "### " line typed
// inside a field doesn't start a new field.
function sections(body) {
  const text = String(body || "").replace(/\r\n/g, "\n");
  const found = {};
  let pos = 0;
  const starts = [];
  for (const [key, label] of FIELDS) {
    const re = new RegExp(`^### ${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[ \\t]*$`, "m");
    const m = re.exec(text.slice(pos));
    if (!m) continue;
    const at = pos + m.index;
    starts.push({ key, at, from: at + m[0].length });
    pos = at + m[0].length;
  }
  starts.forEach((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].at : text.length;
    const v = text.slice(s.from, end).trim();
    found[s.key] = v === NO_RESPONSE ? "" : v;
  });
  return found;
}

function bullets(text) {
  const items = [];
  for (const line of String(text || "").split("\n")) {
    const m = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) items.push(m[1].trim());
    else if (line.trim() && items.length) items[items.length - 1] += " " + line.trim();
    else if (line.trim()) items.push(line.trim());
  }
  return items;
}

function evidence(text) {
  return bullets(text).map((item) => {
    const m = /<?(https?:\/\/[^\s>]+)>?/.exec(item);
    if (!m) return { source_url: null, quote_or_summary: item };
    const rest = (item.slice(0, m.index) + item.slice(m.index + m[0].length)).replace(/^[\s—–:-]+/, "").trim();
    return { source_url: m[1], quote_or_summary: rest };
  });
}

function labelNames(labels) { return (labels || []).map((l) => (typeof l === "string" ? l : l.name)); }

function parseIssue(issue) {
  const warnings = [];
  const s = sections(issue.body);
  const p = {};
  for (const [key, label, kind] of FIELDS) {
    const v = s[key];
    if (v === undefined) { warnings.push(`missing field "${label}"`); p[key] = null; continue; }
    if (kind === "int") { const n = parseInt(v, 10); p[key] = Number.isFinite(n) ? n : null; if (!Number.isFinite(n)) warnings.push(`${label} is not a number`); }
    else if (kind === "evidence") p[key] = evidence(v);
    else if (kind === "list") p[key] = bullets(v);
    else p[key] = v;
  }
  p.title = String(issue.title || "").startsWith(TITLE_PREFIX) ? issue.title.slice(TITLE_PREFIX.length) : issue.title || "";
  if (p.effort_estimate && !EFFORTS.includes(p.effort_estimate)) warnings.push(`effort "${p.effort_estimate}" is not S, M or L`);
  if (p.evidence && p.evidence.some((e) => !e.source_url)) warnings.push("an evidence line has no URL");
  if (p.created_at && !/^\d{4}-\d{2}-\d{2}$/.test(p.created_at)) warnings.push("Created is not YYYY-MM-DD");

  const names = labelNames(issue.labels);
  const statuses = names.filter((n) => n.startsWith("status: ")).map((n) => n.slice(8)).filter((n) => STATUSES.includes(n));
  if (statuses.length !== 1) warnings.push(`expected one status label, found ${statuses.length}`);
  p.status = statuses.length === 1 ? statuses[0] : null;
  if (!names.includes("proposal")) warnings.push('no "proposal" label');

  // decision_reason: the latest owner comment that starts with "Decision:".
  const decisions = (issue.comments || []).filter((c) => OWNERS.includes(c.author && c.author.login) && /^Decision:/i.test(String(c.body || "").trim()));
  const last = decisions[decisions.length - 1];
  p.decision_reason = last ? String(last.body).trim().replace(/^Decision:\s*/i, "").replace(/^(\w+)\s*[—–-]\s*/, "") : null;

  if (p.created_at && p.ttl !== null) {
    const d = new Date(p.created_at + "T00:00:00Z");
    if (!isNaN(d)) { d.setUTCDate(d.getUTCDate() + p.ttl); p.expires_on = d.toISOString().slice(0, 10); }
  }
  p.issue = issue.number ?? null;
  p.url = issue.url ?? null;
  p.author = issue.author ? issue.author.login : null;
  p.trusted = OWNERS.includes(p.author);
  p.warnings = warnings;
  return p;
}

// The schema fields that make up a proposal, in the order the spec lists them.
const SCHEMA_KEYS = ["id", "app", "created_at", "ttl", "title", "problem", "evidence", "hypothesis", "acceptance_criteria", "success_signal", "effort_estimate", "strongest_reason_not_to_build", "status", "decision_reason"];

// scout/decisions.md: one line per decision, "- date · id · issue · status · title — reason".
// Returns the latest line per proposal id (a later line supersedes an earlier one).
function parseDecisions(text) {
  const byId = new Map();
  for (const line of String(text || "").replace(/\r\n/g, "\n").split("\n")) {
    const m = /^- (\d{4}-\d{2}-\d{2}) · (\S+) · ([^·]+?) · (\w+) · (.+?) — (.*)$/.exec(line.trim());
    if (m) byId.set(m[2], { date: m[1], id: m[2], issue: m[3].trim(), status: m[4], title: m[5].trim(), reason: m[6].trim() });
  }
  return [...byId.values()];
}

// Rough topic match between two titles: the share of the shorter title's content
// words that the other title also has. "Tone meter for long tones" matches
// "Long tones with a tone meter". It only has to catch rewordings, not judge them:
// a match means the draft must say what it revisits, and the owner sees that line.
const STOP = new Set("the and for with your you that this from into not only out off before after when what which a an to of in on at by is are be it its so as or".split(" "));
function words(title) {
  return new Set(String(title || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w)).map((w) => w.replace(/(?:ing|s)$/, "") || w));
}
function similarTitles(a, b) {
  const A = words(a), B = words(b);
  const shared = [...A].filter((w) => B.has(w)).length;
  return shared >= 2 && shared / Math.min(A.size, B.size) >= 0.6;
}

const CLOSED_IDEAS = ["rejected", "parked"];

// decisions (optional): parseDecisions output. With it, a draft that looks like a
// rejected or parked idea must carry revisits: { id, what_changed } naming that decision.
function validateDraft(p, decisions) {
  const errs = [];
  for (const k of SCHEMA_KEYS) if (k !== "status" && k !== "decision_reason" && (p[k] === undefined || p[k] === null || p[k] === "")) errs.push(`${p.id || "?"}: missing ${k}`);
  if (!Array.isArray(p.evidence) || !p.evidence.length) errs.push(`${p.id}: no evidence`);
  else p.evidence.forEach((e, i) => { if (!/^https?:\/\//.test(e.source_url || "")) errs.push(`${p.id}: evidence ${i + 1} has no URL`); if (!e.quote_or_summary) errs.push(`${p.id}: evidence ${i + 1} has no quote or summary`); });
  if (!Array.isArray(p.acceptance_criteria) || !p.acceptance_criteria.length) errs.push(`${p.id}: no acceptance criteria`);
  if (!EFFORTS.includes(p.effort_estimate)) errs.push(`${p.id}: effort must be S, M or L`);
  if (p.status && !STATUSES.includes(p.status)) errs.push(`${p.id}: unknown status ${p.status}`);
  if (!/^If /.test(p.hypothesis || "")) errs.push(`${p.id}: hypothesis should read "If we add X, users would Y"`);
  const r = p.revisits;
  if (r !== undefined && r !== null && (typeof r !== "object" || !r.id || !String(r.what_changed || "").trim())) errs.push(`${p.id}: revisits needs { id, what_changed } or null`);
  if (decisions) {
    const known = r && r.id ? decisions.find((d) => d.id === r.id) : null;
    if (r && r.id && !known) errs.push(`${p.id}: revisits ${r.id}, which is not in decisions.md`);
    for (const d of decisions) {
      // The same proposal's own decision line (a draft already triaged) is not a revisit.
      if (d.id === p.id || !CLOSED_IDEAS.includes(d.status) || !similarTitles(p.title, d.title)) continue;
      if (!r || r.id !== d.id) errs.push(`${p.id}: "${p.title}" looks like ${d.status} ${d.id} ("${d.title}"); set revisits: { id: "${d.id}", what_changed } or drop it`);
    }
  }
  return errs;
}

// The one triage message a run ends with (run.md step 7).
function renderTriage(run, decisions) {
  const list = (run.proposals || []).slice().sort((a, b) => (a.rank || 0) - (b.rank || 0));
  const head = `Scout run ${run.run} (${run.app}): ${list.length} proposal${list.length === 1 ? "" : "s"}.`;
  if (!list.length) return `${head} Nothing worth proposing this time.\n`;
  const out = [`${head} Reply per number: approve, reject or park, with a one-line reason (e.g. "1 approve, 2 park: not now").`, ""];
  list.forEach((p, i) => {
    const r = p.revisits;
    const d = r && r.id ? (decisions || []).find((x) => x.id === r.id) : null;
    const prev = !r ? "none" : d ? `${d.status} ${d.date} (${d.id}): ${d.reason}. What changed: ${r.what_changed}` : `${r.id}. What changed: ${r.what_changed}`;
    out.push(`${i + 1}. ${p.title} (${p.effort_estimate})`,
      `   Problem: ${p.problem}`,
      `   Against: ${p.strongest_reason_not_to_build}`,
      `   Evidence: ${(p.evidence || []).map((e) => e.source_url).join(" ")}`,
      `   Previously: ${prev}`, "");
  });
  return out.join("\n");
}

module.exports = { STATUSES, EFFORTS, OWNERS, FIELDS, SCHEMA_KEYS, renderBody, renderTitle, parseIssue, validateDraft, parseDecisions, similarTitles, renderTriage, sections };

if (require.main === module) {
  const fs = require("fs");
  const path = require("path");
  const args = process.argv.slice(2);
  const opt = (name) => { const i = args.indexOf(name); if (i < 0) return undefined; const v = args[i + 1]; args.splice(i, 2); return v; };
  // validate and triage read the decision history; scout/decisions.md by default.
  const decFile = opt("--decisions") || path.join(__dirname, "decisions.md");
  const [cmd, file] = args;
  const read = () => JSON.parse(fs.readFileSync(file || 0, "utf8"));
  const decisions = () => (fs.existsSync(decFile) ? parseDecisions(fs.readFileSync(decFile, "utf8")) : (console.error(`no decision history at ${decFile}`), process.exit(2)));
  if (cmd === "render") process.stdout.write(renderBody(read()));
  else if (cmd === "title") process.stdout.write(renderTitle(read()) + "\n");
  else if (cmd === "validate") {
    const d = read(); const list = Array.isArray(d) ? d : d.proposals || [d];
    const dec = decisions();
    const errs = list.flatMap((p) => validateDraft(p, dec));
    console.log(errs.length ? errs.join("\n") : `ok: ${list.length} proposal(s)`);
    process.exit(errs.length ? 1 : 0);
  } else if (cmd === "triage") process.stdout.write(renderTriage(read(), decisions()));
  else if (cmd === "parse") {
    const d = read();
    console.log(JSON.stringify(Array.isArray(d) ? d.map(parseIssue) : parseIssue(d), null, 2));
  } else {
    console.error("usage: proposal.js render|title|validate|triage|parse [file.json] [--decisions scout/decisions.md]  (reads stdin without a file)");
    process.exit(2);
  }
}
