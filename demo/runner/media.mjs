// ffmpeg and ffprobe: a system install if there is one (DEMO_FFMPEG / DEMO_FFPROBE override), otherwise the
// static builds that `npm ci` puts in demo/node_modules (ffmpeg-static, ffprobe-static), so a fresh session
// needs no Homebrew or apt step.
import { execFileSync, spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const onPath = (cmd) => { const r = spawnSync("sh", ["-c", `command -v ${cmd}`], { encoding: "utf8" }); return r.status === 0 ? r.stdout.trim() : null; };

let _ff, _fp;
export function ffmpegPath() {
  if (_ff) return _ff;
  _ff = process.env.DEMO_FFMPEG || onPath("ffmpeg");
  if (!_ff) try { _ff = require("ffmpeg-static"); } catch (e) {}
  if (!_ff) throw new Error("ffmpeg not found: run `npm --prefix demo ci` (installs a static ffmpeg) or install ffmpeg.");
  return _ff;
}
export function ffprobePath() {
  if (_fp) return _fp;
  _fp = process.env.DEMO_FFPROBE || onPath("ffprobe");
  if (!_fp) try { _fp = require("ffprobe-static").path; } catch (e) {}
  if (!_fp) throw new Error("ffprobe not found: run `npm --prefix demo ci` or install ffmpeg.");
  return _fp;
}

export function ffmpeg(args) {
  return execFileSync(ffmpegPath(), ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
}

export function probe(file) {
  const out = execFileSync(ffprobePath(), ["-v", "error", "-show_format", "-show_streams", "-of", "json", file], { encoding: "utf8" });
  return JSON.parse(out);
}
export const probeDuration = (file) => +probe(file).format.duration;
