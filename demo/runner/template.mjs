// The fixed demo template. Every proposal gets the same four sections with the same lengths, so ideas are
// compared on substance, not on polish. Only the words (from the proposal) and the walkthrough change.
export const WIDTH = 720, HEIGHT = 1280, FPS = 30;
export const SECTIONS = [
  { key: "problem", seconds: 5, label: "Problem" },
  { key: "walkthrough", seconds: 40, label: "Walkthrough" },
  { key: "evidence", seconds: 10, label: "Evidence" },
  { key: "reason", seconds: 5, label: "Why not" },
];
export const TOTAL = SECTIONS.reduce((a, s) => a + s.seconds, 0);
// Narration starts this far into a section and must end this long before it ends
export const LEAD = 0.2, TAIL = 0.2;

const firstSentence = (t) => { const m = String(t).trim().match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : String(t).trim(); };
const strip = (t) => String(t).replace(/\s+/g, " ").trim();
// The sentence's first clause, as a sentence: "It adds words, and it ..." → "It adds words."
const firstClause = (t) => firstSentence(t).split(/,\s|;\s|\s[—–-]\s|:\s/)[0].replace(/[.!?]$/, "") + ".";

// What each card section says, longest first: the TTS uses the first one that fits the section
export function narration(p) {
  const ev = p.evidence.map((e) => strip(e.quote_or_summary));
  return {
    problem: [`${p.title}. ${strip(p.problem)}`, `${p.title}. ${firstSentence(p.problem)}`, `${p.title}.`],
    evidence: [`Evidence. ${ev.join(" ")}`, `Evidence. ${ev.map(firstSentence).join(" ")}`, `Evidence. ${firstSentence(ev[0])}`, `${ev.length} sources, on screen.`],
    reason: [`The strongest reason not to build it: ${strip(p.strongest_reason_not_to_build)}`, `Why not? ${firstSentence(p.strongest_reason_not_to_build)}`,
      `Why not? ${firstClause(p.strongest_reason_not_to_build)}`, "Why not: on screen."],
  };
}

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
// Where a source is, short enough to read on a phone: host, path (commit hashes cut to 7) and #anchor
const host = (u) => { try { const x = new URL(u); return x.host + x.pathname.replace(/\/$/, "").replace(/\b([0-9a-f]{7})[0-9a-f]{33}\b/g, "$1") + x.hash; } catch (e) { return u; } };

const BASE = `
*{box-sizing:border-box;margin:0}
html,body{width:360px;height:640px;overflow:hidden}
body{font:16px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;background:#1d1a17;color:#f6efe6;padding:34px 26px 26px;display:flex;flex-direction:column}
.top{display:flex;justify-content:space-between;align-items:center;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#c9b8a6}
.steps{display:flex;gap:4px;margin:12px 0 26px}.steps i{flex:1;height:3px;border-radius:2px;background:#4a423a}.steps i.on{background:#e07b39}
h1{font-size:28px;line-height:1.15;font-weight:750;margin-bottom:18px}
h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#e07b39;margin-bottom:10px}
p.big{font-size:19px;line-height:1.42;color:#efe4d7}
.chip{display:inline-block;border:1px solid #6b5f53;border-radius:999px;padding:3px 10px;font-size:12px;color:#c9b8a6;margin-right:6px}
.foot{margin-top:auto;font-size:12px;color:#a8998a}
.ev{border-left:3px solid #e07b39;padding:2px 0 2px 12px;margin-bottom:16px}
.ev q{display:block;font-size:15px;line-height:1.38;color:#efe4d7;quotes:"\\201C" "\\201D"}
.ev small{display:block;margin-top:5px;font-size:11px;color:#a8998a;word-break:break-all}
.choices{display:flex;gap:8px;margin-top:22px}.choices span{flex:1;text-align:center;border-radius:10px;padding:9px 0;font-weight:650;font-size:14px;background:#2c2723;border:1px solid #4a423a}
`;
const frame = (p, idx, body, foot = "") => `<!doctype html><meta charset="utf-8"><style>${BASE}</style>
<div class="top"><span>${esc(p.app)} · proposal</span><span>${esc(SECTIONS[idx].label)}</span></div>
<div class="steps">${SECTIONS.map((s, i) => `<i class="${i <= idx ? "on" : ""}"></i>`).join("")}</div>
${body}<div class="foot">${foot}</div>`;

// Card pages (360×640 CSS px, captured at 2× = 720×1280). Long text shrinks to fit rather than overflow.
export function cards(p) {
  return {
    problem: frame(p, 0, `<h1>${esc(p.title)}</h1><p class="big fit">${esc(p.problem)}</p>`,
      `${p.effort_estimate ? `<span class="chip">Effort ${esc(p.effort_estimate)}</span>` : ""}<span class="chip">${esc(p.id)}</span>`),
    evidence: frame(p, 2, `<h2>Evidence</h2><div class="fit">${p.evidence.slice(0, 4).map((e) => `<div class="ev"><q>${esc(e.quote_or_summary)}</q><small>${esc(host(e.source_url))}</small></div>`).join("")}</div>`,
      p.evidence.length > 4 ? `+${p.evidence.length - 4} more in the proposal` : ""),
    reason: frame(p, 3, `<h2>Strongest reason not to build</h2><p class="big fit">${esc(p.strongest_reason_not_to_build)}</p>
      <div class="choices"><span>Promote</span><span>Iterate</span><span>Discard</span></div>`, p.success_signal ? `Success signal: ${esc(p.success_signal)}` : ""),
  };
}
// Run in the card page: shrink .fit text until the page no longer overflows
export function shrinkToFit() {
  const els = [...document.querySelectorAll(".fit, .fit *")];
  const orig = els.map((e) => parseFloat(getComputedStyle(e).fontSize));
  for (let f = 1; document.body.scrollHeight > document.body.clientHeight + 1 && f > 0.55; f -= 0.03)
    els.forEach((e, i) => (e.style.fontSize = orig[i] * f + "px"));
}
