#!/usr/bin/env node
// Prototype branches only: put the demo kit's synthetic progress into the prototype's preview build, so a
// feature that needs practice history shows something on the preview (app-platform docs/v2/product-scout.md).
//
//   node demo/kit/preview-seed.mjs [--end YYYY-MM-DD]
//
// It writes, in this checkout:
//   deploy/preview-seed/progress.json  the fixture (the app's own progress-file format), four weeks ending --end
//                                      (default: yesterday, so the streak is live and today is open)
//   deploy/preview-seed/load.html      the guarded loader (demo/kit/preview-seed/load.html)
//   deploy/Dockerfile                  one COPY line, so the preview serves both under /__demo/
// and prints the commit to make. On the preview, https://<app>-pr-<n>.<domain>/__demo/load.html loads it after
// one tap. The loader refuses on any address that is not a preview or local.
//
// It refuses on main: these files must never reach a release. A prototype is never merged, and a promoted
// idea is built fresh from main, so they never do.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { fixtureFor } from "./serve.mjs";
import { DAYS, defaultEnd } from "./fixture/generate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const args = process.argv.slice(2);
const i = args.indexOf("--end");
const end = i >= 0 ? args[i + 1] : defaultEnd();
if (!/^\d{4}-\d{2}-\d{2}$/.test(end || "")) { console.error("--end must be YYYY-MM-DD"); process.exit(2); }

const branch = execFileSync("git", ["-C", ROOT, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" }).trim();
if (branch === "main" || branch === "HEAD") {
  console.error(`On ${branch}: the preview seed belongs on a prototype branch only (claude/proto-…).`);
  process.exit(1);
}

const backup = await fixtureFor(end);
const [y, m, d] = end.split("-").map(Number);
const first = new Date(Date.UTC(y, m - 1, d - (DAYS - 1))).toISOString().slice(0, 10);
const out = path.join(ROOT, "deploy/preview-seed");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "progress.json"), JSON.stringify({ ...backup, demo: { first, end, note: "made-up practice from demo/kit; nothing personal" } }) + "\n");
fs.copyFileSync(path.join(HERE, "preview-seed/load.html"), path.join(out, "load.html"));

const dockerfile = path.join(ROOT, "deploy/Dockerfile");
const line = "COPY deploy/preview-seed/ /usr/share/nginx/html/__demo/";
const text = fs.readFileSync(dockerfile, "utf8");
if (!text.includes(line)) {
  const marker = /^EXPOSE /m;
  if (!marker.test(text)) throw new Error("deploy/Dockerfile has no EXPOSE line to put the COPY before");
  fs.writeFileSync(dockerfile, text.replace(marker, `# Prototype preview only (demo/kit/preview-seed.mjs): demo progress at /__demo/. Never on main.\n${line}\nEXPOSE `));
}
const days = Object.keys(backup.progress.days || {}).length;
console.log(`Preview seed: ${days} practice days, ${first} to ${end} (${branch}).`);
console.log(`Commit it on the prototype branch:\n  git add deploy/preview-seed deploy/Dockerfile && git commit -m "Prototype only: demo progress for the preview (/__demo/load.html)"`);
