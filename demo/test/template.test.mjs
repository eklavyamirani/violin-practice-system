// Run: node demo/test/template.test.mjs (no browser, no ffmpeg). Checks the template's fixed timings, the
// proposal schema and that narration always has a short fallback.
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECTIONS, TOTAL, narration } from "../runner/template.mjs";
import { validate, FIELDS } from "../runner/proposal.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
let n = 0;
const t = (name, f) => { f(); n++; console.log("ok", name); };

t("template is 5 + 40 + 10 + 5 = 60 s", () => {
  assert.deepEqual(SECTIONS.map((s) => [s.key, s.seconds]), [["problem", 5], ["walkthrough", 40], ["evidence", 10], ["reason", 5]]);
  assert.equal(TOTAL, 60);
});

const files = [path.join(HERE, "../proposals"), path.join(HERE, "proposals")].flatMap((d) => fs.readdirSync(d).filter((f) => f.endsWith(".json")).map((f) => path.join(d, f)));
t("every proposal in the repo is valid and uses only the spec's fields", () => {
  assert.ok(files.length >= 2);
  for (const f of files) assert.deepEqual(validate(JSON.parse(fs.readFileSync(f, "utf8"))), [], f);
});

t("validation catches missing and unknown fields", () => {
  const p = JSON.parse(fs.readFileSync(files[0], "utf8"));
  assert.ok(validate({ ...p, title: "" }).some((e) => e.startsWith("title")));
  assert.ok(validate({ ...p, extra: 1 }).some((e) => e.startsWith("extra")));
  assert.ok(validate({ ...p, evidence: [{ source_url: "nope", quote_or_summary: "x" }] }).some((e) => e.includes("source_url")));
  assert.ok(validate({ ...p, effort_estimate: "XL" }).some((e) => e.startsWith("effort")));
  assert.equal(FIELDS.length, 14);
});

t("narration candidates go from longest to a short fallback", () => {
  for (const f of files) {
    const N = narration(JSON.parse(fs.readFileSync(f, "utf8")));
    for (const k of ["problem", "evidence", "reason"]) {
      assert.ok(N[k].length >= 2, k);
      assert.ok(N[k].at(-1).split(/\s+/).length <= 14, `${k} fallback is short enough for its slot: ${N[k].at(-1)}`);
    }
  }
});
console.log(`${n} passed`);
