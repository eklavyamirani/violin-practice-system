// Run: node demo/test/browser.test.mjs. Checks which Playwright the runner picks (demo/runner/browser.mjs):
// the pinned one first, DEMO_PLAYWRIGHT alone when set, and a clear error naming every one tried when none
// can launch. Each case runs in a child process, because the choice is kept for the rest of a run.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const RUNNER = pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), "../runner/browser.mjs")).href;
const run = (code, env = {}) => spawnSync(process.execPath, ["--input-type=module", "-e", `import * as b from ${JSON.stringify(RUNNER)};\n${code}`],
  { encoding: "utf8", env: { ...process.env, DEMO_PLAYWRIGHT: "", ...env }, timeout: 120000 });

let n = 0;
const t = (name, f) => { f(); n++; console.log("ok", name); };

t("the pinned Playwright is the first candidate", () => {
  const r = run("console.log(JSON.stringify(b.candidates()))");
  assert.equal(r.status, 0, r.stderr);
  const c = JSON.parse(r.stdout);
  assert.equal(c[0].how, "pinned");
  assert.match(c[0].dir, /demo[\\/]node_modules[\\/]playwright$/);
});

t("DEMO_PLAYWRIGHT is the only candidate when set", () => {
  const r = run("console.log(JSON.stringify(b.candidates()))", { DEMO_PLAYWRIGHT: "/somewhere/playwright" });
  assert.deepEqual(JSON.parse(r.stdout), [{ dir: "/somewhere/playwright", how: "DEMO_PLAYWRIGHT" }]);
});

t("a DEMO_PLAYWRIGHT that isn't there fails with its name and the way out", () => {
  const r = run("await b.launch()", { DEMO_PLAYWRIGHT: "/nonexistent/playwright" });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /No Playwright here could launch Chromium/);
  assert.match(r.stderr, /\/nonexistent\/playwright/);
  assert.match(r.stderr, /DEMO_PLAYWRIGHT/);
});

t("a launch prints which Playwright and Chromium it used", () => {
  const r = run("const br = await b.launch(); await br.close(); console.log(JSON.stringify(b.inUse()))");
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^\[demo\] browser: Playwright \d+\.\d+\.\d+ \(.+\), Chromium \d+/m);
});

t("with no browser for the pinned Playwright, it is skipped with the reason", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "demo-no-browsers-"));
  const r = run("const br = await b.launch({}, { video: true }); await br.close()", { PLAYWRIGHT_BROWSERS_PATH: empty });
  fs.rmSync(empty, { recursive: true, force: true });
  const out = r.stdout + r.stderr;
  // Either another installed Playwright took over (and says it skipped the pinned one), or none could
  assert.match(out, /Playwright [\d.]+ \(pinned\)(: | \()browserType\.launch: Executable doesn't exist/);
});

console.log(`${n} passed`);
