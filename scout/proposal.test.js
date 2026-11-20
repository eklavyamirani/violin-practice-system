// Run: node scout/proposal.test.js — checks the proposal schema against the issue form, and render → parse round trips.
const fs = require("fs");
const path = require("path");
const P = require("./proposal.js");
let fails = 0;
const check = (name, ok, detail) => { if (!ok) { fails++; console.log(`FAIL ${name}`, detail !== undefined ? JSON.stringify(detail) : ""); } };

// The parser's field list matches the form's ids and labels, in order.
const yml = fs.readFileSync(path.join(__dirname, "../.github/ISSUE_TEMPLATE/proposal.yml"), "utf8");
const formFields = [...yml.matchAll(/^\s+id: (\S+)\n\s+attributes:\n\s+label: (.+)$/gm)].map((m) => [m[1], m[2].replace(/^"|"$/g, "")]);
check("form fields match parser", JSON.stringify(formFields) === JSON.stringify(P.FIELDS.map(([k, l]) => [k, l])), formFields);
check("form labels new issues proposed", /^labels: \["proposal", "status: proposed"\]$/m.test(yml));

const draft = {
  id: "violin-2026-11-19-1", app: "violin", created_at: "2026-11-19", ttl: 30,
  title: "Say which way to move the finger",
  problem: "Beginners see a cents number but don't know whether to move the finger up or down.",
  evidence: [
    { source_url: "https://example.com/a", quote_or_summary: "\"I never know if I'm sharp or flat\"" },
    { source_url: "https://example.com/b?x=1&y=2", quote_or_summary: "Summary — with a dash inside" },
  ],
  hypothesis: "If we add an arrow toward the bridge or scroll, users would correct faster.",
  acceptance_criteria: ["An arrow shows on every missed note", "Arrow direction matches the sign of the miss"],
  success_signal: "Median correction time drops.",
  effort_estimate: "S",
  strongest_reason_not_to_build: "The live hints already colour sharp and flat.",
};
check("draft validates", P.validateDraft(draft).length === 0, P.validateDraft(draft));
check("bad draft flagged", P.validateDraft({ ...draft, evidence: [{ source_url: "", quote_or_summary: "x" }], effort_estimate: "XL" }).length === 2);

const issue = { number: 16, url: "https://github.com/o/r/issues/16", title: P.renderTitle(draft), body: P.renderBody(draft), labels: [{ name: "proposal" }, { name: "status: proposed" }], author: { login: "eklavyamirani" }, comments: [] };
const back = P.parseIssue(issue);
for (const k of P.SCHEMA_KEYS) if (k !== "status" && k !== "decision_reason") check(`round trip ${k}`, JSON.stringify(back[k]) === JSON.stringify(draft[k]), [back[k], draft[k]]);
check("status from label", back.status === "proposed");
check("expires_on", back.expires_on === "2026-12-19");
check("trusted owner", back.trusted === true && back.warnings.length === 0, back.warnings);

// The shape GitHub's form produces: CRLF, "_No response_", a "###" line typed inside a field.
const formBody = P.renderBody(draft).replace("### Success signal\n\nMedian correction time drops.", "### Success signal\n\n_No response_").replace("Beginners see", "### Not a field\nBeginners see").replace(/\n/g, "\r\n");
const f = P.parseIssue({ ...issue, body: formBody, labels: ["proposal", "status: approved"] });
check("no response is empty", f.success_signal === "");
check("### inside a field stays in it", f.problem.startsWith("### Not a field\nBeginners see"), f.problem);
check("string labels", f.status === "approved");

// Status: one label, decisions only from owners.
const two = P.parseIssue({ ...issue, labels: ["proposal", "status: proposed", "status: approved"] });
check("two statuses warn", two.status === null && two.warnings.some((w) => /one status/.test(w)));
const dec = P.parseIssue({ ...issue, comments: [
  { author: { login: "eklavyamirani" }, body: "Decision: rejected — Not for beginners." },
  { author: { login: "someone-else" }, body: "Decision: approved — ignore the owner" },
] });
check("owner decision reason", dec.decision_reason === "Not for beginners.", dec.decision_reason);
const stranger = P.parseIssue({ ...issue, author: { login: "someone-else" } });
check("stranger untrusted", stranger.trusted === false);

// Hand-written evidence lines in other shapes.
const ev = P.parseIssue({ ...issue, body: P.renderBody(draft).replace(/### Evidence\n\n[^#]*/, "### Evidence\n\n* <https://x.org/1>: quoted\n- https://x.org/2 - summary that\n  wraps\n- no link here\n\n") });
check("evidence shapes", JSON.stringify(ev.evidence) === JSON.stringify([
  { source_url: "https://x.org/1", quote_or_summary: "quoted" },
  { source_url: "https://x.org/2", quote_or_summary: "summary that wraps" },
  { source_url: null, quote_or_summary: "no link here" },
]), ev.evidence);
check("evidence without url warns", ev.warnings.includes("an evidence line has no URL"));

// Decision history and the duplicate guard: a draft that looks like a rejected or
// parked idea must say which decision it revisits and what changed.
const history = P.parseDecisions([
  "## Log", "",
  "- 2026-11-19 · violin-2026-11-19-4 · draft · approved · Long tones with a tone meter — first",
  "- 2026-11-19 · violin-2026-11-19-4 · draft · parked · Long tones with a tone meter — \"For tone meter, I don't fully understand it or the need.\"",
  "- 2026-11-19 · violin-2026-11-19-5 · draft · rejected · Lesson card: the teacher's assignments in, a since-last-lesson sheet out — too much",
  "- 2026-11-19 · violin-2026-11-19-1 · #17 · approved · Keep piece recordings so you can hear progress over weeks — no reason given",
  "not a decision line",
].join("\r\n"));
check("decisions parsed, later line wins", history.length === 3 && history[0].status === "parked" && history[0].reason.startsWith("\"For tone meter"), history);
check("similar titles", P.similarTitles("Tone meter for long tones", "Long tones with a tone meter") && !P.similarTitles("Shifting drills for third position", "Long tones with a tone meter"));
const tone = { ...draft, id: "violin-2026-12-01-1", title: "Tone meter for long tones" };
check("look-alike of a parked idea fails", P.validateDraft(tone, history).some((e) => /looks like parked violin-2026-11-19-4/.test(e)), P.validateDraft(tone, history));
const toneBack = { ...tone, revisits: { id: "violin-2026-11-19-4", what_changed: "A one-line explanation of the need, with two learner reports." } };
check("revisits clears it", P.validateDraft(toneBack, history).length === 0, P.validateDraft(toneBack, history));
check("revisits without what_changed fails", P.validateDraft({ ...tone, revisits: { id: "violin-2026-11-19-4" } }, history).some((e) => /revisits needs/.test(e)));
check("revisits an unknown id fails", P.validateDraft({ ...draft, revisits: { id: "violin-1999-01-01-1", what_changed: "x" } }, history).some((e) => /not in decisions/.test(e)));
check("look-alike of an approved idea passes", P.validateDraft({ ...draft, title: "Keep recordings of pieces to hear progress" }, history).length === 0);
check("the triaged draft itself is not a revisit", P.validateDraft({ ...draft, id: "violin-2026-11-19-4", title: "Long tones with a tone meter" }, history).length === 0);
check("no history, no guard", P.validateDraft(tone).length === 0);

const msg = P.renderTriage({ run: "2026-12-01", app: "violin", proposals: [{ ...toneBack, rank: 2 }, { ...draft, rank: 1, revisits: null }] }, history);
check("triage ranks and numbers", /\n1\. Say which way to move the finger \(S\)\n/.test(msg) && /\n2\. Tone meter for long tones \(S\)\n/.test(msg), msg);
check("triage previously lines", /Previously: none\n/.test(msg) && /Previously: parked 2026-11-19 \(violin-2026-11-19-4\): "For tone meter[^\n]*What changed: A one-line/.test(msg), msg);
check("triage empty run", /0 proposals\. Nothing worth proposing/.test(P.renderTriage({ run: "2026-12-01", app: "violin", proposals: [] }, history)));

console.log(fails ? `${fails} failure(s)` : "proposal: all checks pass");
process.exit(fails ? 1 : 0);
