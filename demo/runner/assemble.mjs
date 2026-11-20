// Assembler: builds the fixed template from the proposal and the recorded walkthrough.
// Problem card (5 s) → walkthrough (40 s) → evidence card (10 s) → strongest reason not to build (5 s),
// narrated by TTS, encoded as H.264 + AAC in an mp4 with the index up front (plays in a phone browser).
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { SECTIONS, TOTAL, WIDTH, HEIGHT, FPS, LEAD, TAIL, narration, cards, shrinkToFit } from "./template.mjs";
import { speakToFit, voiceName } from "./tts.mjs";
import { ffmpeg, probe, probeDuration } from "./media.mjs";

const sec = (k) => SECTIONS.find((s) => s.key === k).seconds;
const VIDEO_OUT = ["-c:v", "libx264", "-profile:v", "high", "-level", "4.0", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "22", "-r", String(FPS)];
const AUDIO_OUT = ["-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2"];

async function renderCards(p, dir) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH / 2, height: HEIGHT / 2 }, deviceScaleFactor: 2 });
    const out = {};
    for (const [key, html] of Object.entries(cards(p))) {
      await page.setContent(html);
      await page.evaluate(shrinkToFit);
      out[key] = path.join(dir, `card-${key}.png`);
      await page.screenshot({ path: out[key] });
    }
    return out;
  } finally { await browser.close(); }
}

// One card section: the still for exactly `seconds`, narration from LEAD, silence after
function cardSection(png, voice, seconds, out) {
  ffmpeg(["-loop", "1", "-framerate", String(FPS), "-t", String(seconds), "-i", png, "-i", voice,
    "-filter_complex", `[0:v]scale=${WIDTH}:${HEIGHT},format=yuv420p[v];[1:a]adelay=${LEAD * 1000}:all=1,apad,atrim=0:${seconds},asetpts=N/SR/TB[a]`,
    "-map", "[v]", "-map", "[a]", ...VIDEO_OUT, ...AUDIO_OUT, "-t", String(seconds), out]);
}

// The walkthrough: the recording from its start mark, held on its last frame if short; each caption's
// narration at its moment (cut at the next caption), and the scripted mic input underneath, quieter
function walkSection(rec, voices, out) {
  const seconds = sec("walkthrough");
  const inputs = ["-ss", rec.offset.toFixed(3), "-i", rec.video];
  const parts = [`[0:v]setpts=PTS-STARTPTS,fps=${FPS},scale=${WIDTH}:${HEIGHT},tpad=stop_mode=clone:stop_duration=${seconds},trim=0:${seconds},setpts=PTS-STARTPTS,format=yuv420p[v]`];
  const mix = [];
  voices.forEach((v, i) => {
    inputs.push("-i", v.file);
    const until = (voices[i + 1] ? voices[i + 1].t : seconds) - v.t - 0.05;
    parts.push(`[${i + 1}:a]atrim=0:${Math.max(0.1, until).toFixed(3)},adelay=${Math.round(v.t * 1000)}:all=1[n${i}]`);
    mix.push(`[n${i}]`);
  });
  if (rec.mic && rec.mic.t < seconds) {
    const k = voices.length + 1;
    inputs.push("-i", rec.mic.file);
    const t = Math.max(0, rec.mic.t);
    parts.push(`[${k}:a]atrim=${Math.max(0, -rec.mic.t).toFixed(3)},asetpts=N/SR/TB,volume=0.45,adelay=${Math.round(t * 1000)}:all=1[mic]`);
    mix.push("[mic]");
  }
  if (!mix.length) { inputs.push("-f", "lavfi", "-t", String(seconds), "-i", "anullsrc=r=48000:cl=mono"); mix.push(`[${inputs.filter((x) => x === "-i").length - 1}:a]`); }
  parts.push(`${mix.join("")}amix=inputs=${mix.length}:normalize=0:dropout_transition=0,apad,atrim=0:${seconds},asetpts=N/SR/TB[a]`);
  ffmpeg([...inputs, "-filter_complex", parts.join(";"), "-map", "[v]", "-map", "[a]", ...VIDEO_OUT, ...AUDIO_OUT, "-t", String(seconds), out]);
}

export async function assemble({ proposal: p, rec, outDir, outFile }) {
  const work = path.join(outDir, "work");
  fs.mkdirSync(work, { recursive: true });
  const png = await renderCards(p, work);
  const N = narration(p);
  const spoken = {};
  for (const key of ["problem", "evidence", "reason"]) {
    spoken[key] = speakToFit(N[key], path.join(work, `voice-${key}.wav`), sec(key) - LEAD - TAIL, { wpm: 185, maxWpm: 225 });
  }
  // Walkthrough captions: each must be spoken before the next one starts
  const voices = rec.captions.filter((c) => c.t < sec("walkthrough")).map((c, i, all) => {
    const next = all[i + 1] ? all[i + 1].t : sec("walkthrough");
    return { t: c.t, ...speakToFit([c.text], path.join(work, `voice-walk-${i}.wav`), next - c.t - 0.15, { wpm: 180, maxWpm: 220 }) };
  });

  const files = {};
  for (const s of SECTIONS) {
    files[s.key] = path.join(work, `section-${s.key}.mp4`);
    if (s.key === "walkthrough") walkSection(rec, voices, files[s.key]);
    else cardSection(png[s.key], spoken[s.key].file, s.seconds, files[s.key]);
  }
  // Join: re-encoded through the concat filter so section boundaries are exact
  const ins = SECTIONS.flatMap((s) => ["-i", files[s.key]]);
  const cat = SECTIONS.map((s, i) => `[${i}:v][${i}:a]`).join("") + `concat=n=${SECTIONS.length}:v=1:a=1[v][a]`;
  ffmpeg([...ins, "-filter_complex", cat, "-map", "[v]", "-map", "[a]", ...VIDEO_OUT, ...AUDIO_OUT, "-movflags", "+faststart", "-t", String(TOTAL), outFile]);

  const info = probe(outFile);
  const v = info.streams.find((x) => x.codec_type === "video"), a = info.streams.find((x) => x.codec_type === "audio");
  const report = {
    proposal: p.id, app: p.app, file: path.basename(outFile), voice: voiceName(),
    duration: +(+info.format.duration).toFixed(3),
    video: { codec: v.codec_name, profile: v.profile, width: v.width, height: v.height, fps: v.r_frame_rate, pix_fmt: v.pix_fmt },
    audio: { codec: a.codec_name, sample_rate: +a.sample_rate, channels: a.channels },
    sections: (() => { let t = 0; return SECTIONS.map((s) => { const d = +probeDuration(files[s.key]).toFixed(3); const r = { key: s.key, planned: s.seconds, start: +t.toFixed(3), duration: d }; t += d; return r; }); })(),
    narration: {
      problem: pick(spoken.problem), evidence: pick(spoken.evidence), reason: pick(spoken.reason),
      walkthrough: voices.map((x) => ({ t: +x.t.toFixed(2), ...pick(x) })),
    },
    recording: { offset: +rec.offset.toFixed(3), walkthrough_seconds: +rec.seconds.toFixed(2), mic: rec.mic ? { t: +rec.mic.t.toFixed(2), file: path.basename(rec.mic.file) } : null, log: rec.log },
  };
  return report;
}
const pick = (s) => ({ text: s.text, seconds: +s.seconds.toFixed(2), wpm: s.wpm, ...(s.trimmed ? { shortened: true } : {}), ...(s.overrun ? { overrun: +s.overrun.toFixed(2) } : {}) });
