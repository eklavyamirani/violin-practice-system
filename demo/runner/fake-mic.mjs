// Scripted microphone input for a recorded walkthrough. Two ways, chosen per walkthrough:
//
// "inject" (default): an init script answers the page's getUserMedia({ audio }) with a MediaStream that
//   plays the scripted WAV from its first sample, through Web Audio. It starts exactly when the app opens
//   the mic, works headless, and needs no browser flags. The app's own code is unchanged: it gets a
//   MediaStream as it would from a real microphone.
// "fake-device": Chromium's fake media flags (--use-file-for-fake-audio-capture). Closer to a real device,
//   but on macOS headless Chromium (Playwright 1.64, Chromium 156) audio getUserMedia never resolves, so it
//   is only useful headed or on Linux. Kept as an option; see demo/README.md.
import fs from "node:fs";

export const MIC_URL_PATH = "/__demo/mic.wav";

export function chromiumArgs(mode, wavPath) {
  const base = ["--autoplay-policy=no-user-gesture-required"];
  if (mode !== "fake-device") return base;
  return [...base, "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${wavPath}`];
}

/**
 * While a page is recorded, headless Chromium runs its animation frames only as fast as the screencast captures
 * them: about 20 a second in a loaded Linux container (node:24-bookworm, 2026-11-24), against 60 without video.
 * A page that analyses its microphone on animation frames then hears the scripted audio in coarse steps and
 * misses notes (the violin app needs 5 frames in 220 ms to call a pitch steady). This runs animation-frame
 * callbacks on a 16 ms timer instead, so the page keeps its usual pace while it is recorded. The page's code is
 * unchanged. The recorder adds it when a walkthrough has scripted audio.
 */
export function steadyFrames(context) {
  return context.addInitScript(() => {
    window.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 16);
    window.cancelAnimationFrame = (id) => clearTimeout(id);
  });
}

/** Wire the scripted WAV into a Playwright context. */
export async function attach(context, mode, wavPath) {
  if (mode === "fake-device") { await context.grantPermissions(["microphone"]); return; }
  const body = fs.readFileSync(wavPath);
  await context.route(`**${MIC_URL_PATH}`, (route) => route.fulfill({ status: 200, contentType: "audio/wav", body }));
  await context.addInitScript(({ url }) => {
    const md = navigator.mediaDevices;
    if (!md) return;
    const real = md.getUserMedia.bind(md);
    md.getUserMedia = async (constraints) => {
      if (!constraints || !constraints.audio || constraints.video) return real(constraints);
      const ac = new AudioContext();
      const data = await (await fetch(url)).arrayBuffer();
      const buf = await ac.decodeAudioData(data);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const dest = ac.createMediaStreamDestination();
      src.connect(dest);
      await ac.resume();
      src.start();
      window.__demoMic = { startedAt: performance.now(), seconds: buf.duration };
      return dest.stream;
    };
  }, { url: MIC_URL_PATH });
}
