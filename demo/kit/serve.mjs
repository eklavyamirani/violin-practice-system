// Violin demo kit: serve the app in this session with the synthetic progress loaded.
//
//   node demo/kit/serve.mjs [--port 8790] [--sim]
//
// Prints a URL. Opening it loads the fixture into that browser's storage for this origin and then opens the
// app, so a person (or the recorder) sees the lived-in app. It uses its own port so it never overwrites the
// progress of a copy of the app you use on another port.
//
// The fixture is generated for "today": four weeks of practice ending yesterday (see fixture/generate.mjs),
// cached per day under demo/.cache/.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serveStatic } from "../runner/static-server.mjs";
import { generate, defaultEnd } from "./fixture/generate.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const APP_ROOT = path.resolve(HERE, "../..");
const CACHE = path.resolve(HERE, "../.cache");
export const STORE_KEY = "fingerboard-coach.v1";
export const LOAD_PATH = "/__demo/load";

// Device settings for demos (the progress file never carries settings): Flow mode, so scripted audio is
// scored note by note without the hold-to-lock ring.
export const DEMO_SETTINGS = { view: "path", mode: "flow", handsFree: true, chime: true };

export async function fixtureFor(end = defaultEnd(), { browser } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const f = path.join(CACHE, `progress-${end}.json`);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  const { progress } = await generate({ end, browser });
  fs.writeFileSync(f, JSON.stringify(progress));
  return progress;
}

/**
 * Start the app with the fixture. Resolves to { url, loadUrl(query), close }.
 * loadUrl("?sim") is the page that loads the fixture and then opens index.html?sim.
 */
export async function start({ port = 0, end, browser, settings = {} } = {}) {
  const backup = await fixtureFor(end, { browser });
  const db = { ...backup.progress, settings: { ...DEMO_SETTINGS, ...settings } };
  const page = (query) => `<!doctype html><meta charset="utf-8"><title>Loading demo progress</title>
<script>
localStorage.setItem(${JSON.stringify(STORE_KEY)}, ${JSON.stringify(JSON.stringify(db)).replace(/</g, "\\u003c")});
location.replace("/index.html" + ${JSON.stringify(query)});
</script>`;
  const srv = await serveStatic(APP_ROOT, {
    port,
    routes: {
      [LOAD_PATH]: (req, res, u) => {
        const q = u.searchParams.get("q") || "";
        res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
        res.end(page(q.startsWith("?") || !q ? q : "?" + q));
      },
      "/__demo/progress.json": (req, res) => {
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify(backup));
      },
    },
  });
  return { ...srv, loadUrl: (query = "") => `${srv.url.replace(/\/$/, "")}${LOAD_PATH}${query ? "?q=" + encodeURIComponent(query) : ""}` };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--port");
  const srv = await start({ port: i > 0 ? +process.argv[i + 1] : 8790 });
  const q = process.argv.includes("--sim") ? "?sim" : "";
  console.log(`Violin demo app with synthetic progress: ${srv.loadUrl(q)}`);
  console.log(`(the progress file itself: ${srv.url}__demo/progress.json, for "Load progress file" elsewhere). Ctrl+C stops it.`);
}
