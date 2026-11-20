// Text to speech for demo narration. Offline and free engines only; the first one available is used.
//
//   say       macOS built-in (default on a Mac). Voice: DEMO_VOICE, default "Samantha".
//   piper     Piper (MIT, offline neural TTS; Linux and macOS). Needs `piper` on PATH and PIPER_MODEL
//             set to a downloaded voice (.onnx). Not exercised on this machine yet.
//   espeak-ng last resort on Linux (robotic, GPL). Not exercised on this machine yet.
//
// DEMO_TTS=say|piper|espeak-ng forces one. See demo/README.md for why these and not a paid API.
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ffmpeg, probeDuration } from "./media.mjs";

const has = (cmd) => spawnSync("sh", ["-c", `command -v ${cmd}`]).status === 0;

export function engine() {
  const forced = process.env.DEMO_TTS;
  if (forced) return forced;
  if (process.platform === "darwin" && has("say")) return "say";
  if (has("piper") && process.env.PIPER_MODEL) return "piper";
  if (has("espeak-ng")) return "espeak-ng";
  throw new Error("No text-to-speech engine found. On macOS `say` is built in; on Linux install Piper or espeak-ng (demo/README.md, Setup).");
}

export function voiceName() {
  const e = engine();
  if (e === "say") return `say:${process.env.DEMO_VOICE || "Samantha"}`;
  if (e === "piper") return `piper:${path.basename(process.env.PIPER_MODEL || "")}`;
  return `${e}:${process.env.DEMO_VOICE || "en-us"}`;
}

/**
 * Speak `text` into a 48 kHz mono WAV at `out`, at `wpm` words a minute (roughly; engines differ).
 * Returns the duration in seconds.
 */
export function speak(text, out, { wpm = 175 } = {}) {
  const e = engine();
  const raw = out.replace(/\.wav$/, "") + `.raw.${e === "say" ? "aiff" : "wav"}`;
  if (e === "say") {
    execFileSync("say", ["-v", process.env.DEMO_VOICE || "Samantha", "-r", String(wpm), "-o", raw, text]);
  } else if (e === "piper") {
    // Piper's length_scale stretches speech; about 165 wpm at 1.0
    const scale = Math.max(0.6, Math.min(1.4, 165 / wpm)).toFixed(2);
    execFileSync("piper", ["--model", process.env.PIPER_MODEL, "--length_scale", scale, "--output_file", raw], { input: text });
  } else if (e === "espeak-ng") {
    execFileSync("espeak-ng", ["-v", process.env.DEMO_VOICE || "en-us", "-s", String(wpm), "-w", raw, text]);
  } else throw new Error(`Unknown DEMO_TTS engine "${e}".`);
  ffmpeg(["-i", raw, "-ar", "48000", "-ac", "1", out]);
  fs.rmSync(raw, { force: true });
  return probeDuration(out);
}

/**
 * Narrate the first of `candidates` (longest first) that fits in `maxSec` at up to `maxWpm`.
 * Returns { text, file, seconds, wpm, trimmed } where trimmed is true if a shorter candidate was used.
 */
export function speakToFit(candidates, out, maxSec, { wpm = 175, maxWpm = 210 } = {}) {
  const list = candidates.map((c) => (c || "").trim()).filter(Boolean);
  for (const [i, text] of list.entries()) {
    for (const rate of [wpm, Math.round((wpm + maxWpm) / 2), maxWpm]) {
      const seconds = speak(text, out, { wpm: rate });
      if (seconds <= maxSec) return { text, file: out, seconds, wpm: rate, trimmed: i > 0 };
    }
  }
  // Nothing fits: the shortest candidate at the fastest rate, cut to the slot by the assembler
  const text = list[list.length - 1] || "";
  const seconds = speak(text, out, { wpm: maxWpm });
  return { text, file: out, seconds, wpm: maxWpm, trimmed: true, overrun: seconds - maxSec };
}
