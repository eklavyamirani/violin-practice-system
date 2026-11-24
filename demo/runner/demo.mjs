#!/usr/bin/env node
// One command: proposal file in, narrated 60-second demo mp4 out.
//
//   node demo/runner/demo.mjs <proposal.json> [--kit demo/kit] [--walkthrough <name>] [--out demo/out] [--headed]
//       [--preview <url>] [--proposal-link <url>] [--note <text>] [--no-upload]
//
// The walkthrough defaults to the one named like the proposal's id in the kit's walkthroughs/ folder.
// Output: <out>/<proposal-id>/<proposal-id>.mp4 and <proposal-id>.demo.json (timings, narration, checks).
// Then the video is uploaded to Downloads if there is an upload token (publish.mjs), and the link printed;
// --preview / --proposal-link / --note go into the links file next to it. --no-upload skips the upload.
// Exit code 1 if an upload was tried and refused (the video is still there).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { load } from "./proposal.mjs";
import { record } from "./record.mjs";
import { assemble } from "./assemble.mjs";
import { publish } from "./publish.mjs";
import { engine, engineNote } from "./tts.mjs";
import { ffmpegPath } from "./media.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const VALUED = ["--kit", "--walkthrough", "--out", "--preview", "--proposal-link", "--note"];
const file = args.find((a, i) => !a.startsWith("--") && !VALUED.includes(args[i - 1]));
if (!file) { console.error("usage: node demo/runner/demo.mjs <proposal.json> [--kit dir] [--walkthrough name] [--out dir] [--headed] [--preview url] [--proposal-link url] [--note text] [--no-upload]"); process.exit(2); }

const proposal = load(file);
const kitDir = path.resolve(opt("--kit", path.join(HERE, "../kit")));
const kit = (await import(pathToFileURL(path.join(kitDir, "kit.mjs")))).default;
if (kit.app && kit.app !== proposal.app) throw new Error(`This kit is for "${kit.app}", the proposal is for "${proposal.app}".`);
const walkName = opt("--walkthrough", proposal.id);
const walkFile = path.join(kitDir, "walkthroughs", `${walkName}.mjs`);
if (!fs.existsSync(walkFile)) throw new Error(`No walkthrough ${path.relative(process.cwd(), walkFile)}. Write one (demo/CONTRACT.md) or pass --walkthrough.`);
const walk = (await import(pathToFileURL(walkFile))).default;
const outDir = path.resolve(opt("--out", path.join(HERE, "../out")), proposal.id);
fs.mkdirSync(outDir, { recursive: true });

console.log(`[demo] ${proposal.id}: kit ${kit.app}, walkthrough ${walkName}, tts ${engine()}, ffmpeg ${ffmpegPath()}`);
if (engineNote()) console.log(`[demo] note: ${engineNote()}`);
const t = Date.now();
const rec = await record({ kit, walk, proposal, outDir, headless: !args.includes("--headed") });
console.log(`[demo] recorded ${rec.seconds.toFixed(1)} s walkthrough (${((Date.now() - t) / 1000).toFixed(0)} s)${rec.log.length ? "\n  " + rec.log.join("\n  ") : ""}`);
const mp4 = path.join(outDir, `${proposal.id}.mp4`);
const report = await assemble({ proposal, rec, outDir, outFile: mp4 });
const pub = await publish({ proposal, file: mp4, preview: opt("--preview"), proposalLink: opt("--proposal-link"),
  note: opt("--note"), skip: args.includes("--no-upload") });
report.publish = { uploaded: pub.uploaded, remote: pub.remote, link: pub.link,
  requests: pub.requests.map(({ name, at, status }) => ({ name, at, status })) };
fs.writeFileSync(path.join(outDir, `${proposal.id}.demo.json`), JSON.stringify(report, null, 2) + "\n");
console.log(`[demo] ${mp4}: ${report.duration} s, ${report.video.width}×${report.video.height} ${report.video.codec}/${report.audio.codec}`);
console.log(`[demo] sections: ${report.sections.map((s) => `${s.key} ${s.start}+${s.duration}`).join(", ")}`);
for (const [k, v] of Object.entries(report.narration)) if (!Array.isArray(v) && v.shortened) console.log(`[demo] ${k} narration shortened to fit: "${v.text}"`);
for (const q of pub.requests) console.log(`[demo] upload request ${q.at}: ${q.name} → ${q.status ? `HTTP ${q.status}` : q.error}`);
console.log(`[demo] ${pub.message}`);
// Exit explicitly once everything is written, so nothing left open (a browser's video encoder, a kit's
// handle) can keep the run alive after its result; Playwright kills the processes it started when node exits.
// stdout is flushed first, since writes to a pipe are asynchronous on macOS.
process.stdout.write("", () => process.exit(pub.requests.length && !pub.uploaded ? 1 : 0));
