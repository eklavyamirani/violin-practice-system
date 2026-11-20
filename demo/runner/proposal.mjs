// The proposal record, as the Product Scout spec defines it. The runner reads only these fields.
import fs from "node:fs";

export const FIELDS = ["id", "app", "created_at", "ttl", "title", "problem", "evidence", "hypothesis", "acceptance_criteria",
  "success_signal", "effort_estimate", "strongest_reason_not_to_build", "status", "decision_reason"];
const REQUIRED = ["id", "app", "title", "problem", "evidence", "hypothesis", "strongest_reason_not_to_build"];

export function validate(p) {
  const errors = [];
  if (!p || typeof p !== "object" || Array.isArray(p)) return ["proposal: expected a JSON object."];
  for (const k of REQUIRED) if (p[k] === undefined || p[k] === null || p[k] === "") errors.push(`${k}: required.`);
  for (const k of Object.keys(p)) if (!FIELDS.includes(k)) errors.push(`${k}: not a proposal field (the record has: ${FIELDS.join(", ")}).`);
  if (p.id !== undefined && !/^[a-z0-9][a-z0-9-]{0,63}$/.test(String(p.id))) errors.push("id: lowercase letters, digits and dashes (it names files and the upload folder).");
  if (p.evidence !== undefined) {
    if (!Array.isArray(p.evidence) || !p.evidence.length) errors.push("evidence: a non-empty list of { source_url, quote_or_summary }.");
    else p.evidence.forEach((e, i) => {
      if (!e || typeof e.source_url !== "string" || !/^https?:\/\//.test(e.source_url)) errors.push(`evidence[${i}].source_url: an http(s) URL.`);
      if (!e || typeof e.quote_or_summary !== "string" || !e.quote_or_summary.trim()) errors.push(`evidence[${i}].quote_or_summary: required.`);
    });
  }
  if (p.effort_estimate !== undefined && !["S", "M", "L"].includes(p.effort_estimate)) errors.push("effort_estimate: S, M or L.");
  return errors;
}

export function load(file) {
  const p = JSON.parse(fs.readFileSync(file, "utf8"));
  const errors = validate(p);
  if (errors.length) throw new Error(`${file} is not a valid proposal:\n  ${errors.join("\n  ")}`);
  return p;
}
