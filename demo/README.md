# Demo runner (Product Scout)

Turns a proposal record into a narrated demo video of exactly 60 seconds, recorded in the development
session against the app running there. The template is the same for every idea:

| Section | Length | Shows | Narration |
|---|---|---|---|
| Problem | 5 s | title card with the problem | the title, plus the problem if it fits |
| Walkthrough | 40 s | the app, driven by a walkthrough script | the walkthrough's captions |
| Evidence | 10 s | up to 4 evidence items with their sources | the evidence, shortened to fit |
| Why not | 5 s | the strongest reason not to build, and Promote / Iterate / Discard | the reason, shortened to fit |

Output: an H.264 (High) + AAC mp4, 720×1280 portrait, 30 fps, with the index at the front (`+faststart`),
so it plays in a phone browser. Next to it there is a `<id>.demo.json` with the measured section timings,
the narration text each section actually used, the voice and the recording log.

## One command

```bash
npm --prefix demo ci
node demo/runner/demo.mjs demo/proposals/watch-out-notes.json
```

The video lands in `demo/out/<proposal-id>/<proposal-id>.mp4`. The walkthrough is
`demo/kit/walkthroughs/<proposal-id>.mjs` unless you pass `--walkthrough <name>`. `--headed` shows the browser.

`watch-out-notes` needs its prototype: run it on the branch `claude/proto-watch-out-notes`. On `main`, try
the template check instead:

```bash
node demo/runner/demo.mjs demo/test/proposals/out-of-tune-check.json --walkthrough out-of-tune-check
```

To just look at the lived-in app (eklavyamirani/app-platform#75): `node demo/kit/serve.mjs` and open the URL
it prints (in the desktop app, a local `.claude/launch.json` entry running `node demo/kit/serve.mjs --port
${PORT:-8790}` works too; `.claude/` is not in the repository). It shows about four weeks of made-up
practice ending yesterday: a streak, Path skills mastered and due for review, a practice plan with its days
ticked off, and a practice log. `/__demo/progress.json` on that server is the same data as a progress file,
for "Load progress file" in another copy of the app.

A run takes about 1.5 to 2 minutes: about 45 s of recording, the rest is the fixture (first run of the day)
and encoding.

## Setup (eklavyamirani/app-platform#79)

`npm --prefix demo ci` installs everything the runner needs into `demo/node_modules`, pinned in
`demo/package-lock.json`:

- **Playwright 1.64.1** and its Chromium. If the browser isn't cached on the machine yet:
  `npx --prefix demo playwright install chromium`.
- **ffmpeg and ffprobe** as static builds (`ffmpeg-static` 5.2.0 = ffmpeg 6.0 with libx264, AAC and libass;
  `ffprobe-static` 3.1.0). No Homebrew or apt step. A system `ffmpeg`/`ffprobe` on the PATH is used instead if
  there is one, or set `DEMO_FFMPEG` / `DEMO_FFPROBE`.
- **Text to speech**: nothing to install on a Mac (see below).

What this machine had before setup (2026-11-19, macOS on x86_64, Node 24.21): no ffmpeg on the PATH (only
Playwright's own stripped-down ffmpeg, which can encode VP8 webm only), no TTS other than macOS `say`,
Playwright 1.64.1's Chromium already cached.

### Text to speech: macOS `say`, voice Samantha

| Option | Quality | Licence | Offline | Cost | Here |
|---|---|---|---|---|---|
| macOS `say` (Samantha) | clear, a bit flat | ships with macOS. My reading of Apple's licence: system voices may be used for your own personal, non-commercial content, which a private demo for the owner is. Not a lawyer's check. | yes | free | **used** |
| Piper (e.g. an `en_US` medium voice) | natural, better than `say` | engine MIT; each voice has its own licence on its model card, so check before choosing one | yes | free | supported (`DEMO_TTS=piper`, `PIPER_MODEL=…`), **not tried here** |
| espeak-ng | robotic | GPL | yes | free | supported as a last resort on Linux, **not tried here** |
| OpenAI TTS, ElevenLabs, Azure, Google | best | API terms | no | paid, needs a key | **not used**: anything paid or needing a key is the owner's decision |

`say` won because it is already on the machine where demos are recorded, costs nothing, needs no key or
download, and is good enough to follow on a phone speaker. The runner picks the first engine available
(`say` on macOS, then Piper, then espeak-ng) and you can force one with `DEMO_TTS`. `DEMO_VOICE` picks another
`say` voice; if you download an Enhanced or Premium voice in System Settings → Accessibility → Spoken Content,
it is free and noticeably better (`DEMO_VOICE="Ava (Premium)"`, for example).

On Linux (a cloud session) the same commands should work with `apt-get install espeak-ng` or Piper for the
voice; ffmpeg-static ships a Linux build. This has not been tried in a cloud session.

## How it works

```
demo/
  runner/        app-agnostic: lift this into a shared place when a second app needs it
    demo.mjs       the one command: proposal → record → assemble → publish
    proposal.mjs   the proposal record (spec fields only) and its validation
    record.mjs     Playwright: starts the kit, runs the walkthrough, captures the 40 s at 720×1280
    fake-mic.mjs   scripted microphone input (see below)
    template.mjs   the fixed sections, their narration candidates and the cards
    tts.mjs        say / piper / espeak-ng, and fitting speech into a section
    assemble.mjs   ffmpeg: cards + walkthrough + narration → mp4, and the timing report
    publish.mjs    stub: where the Downloads upload goes
    media.mjs      finds ffmpeg/ffprobe
  kit/           violin-specific (the demo kit; see CONTRACT.md)
    kit.mjs        what the runner imports
    serve.mjs      serves the app with the fixture loaded
    fixture/       synthetic progress, generated through the app's own code
    audio/         violin-like scripted playing of the app's own drills
    walkthroughs/  one script per proposal
  proposals/     proposal records
  test/          template tests, the two-proposal structure check, the scripted-audio check
```

- **Recording.** Playwright records the page's screencast. Headless Chromium screencasts at CSS-pixel size,
  so the recorder launches it with `--force-device-scale-factor=2`: the 390×693 phone viewport is captured at
  780×1386 and fills the 720×1280 frame sharply. Captions and tap rings are drawn into the page by an init
  script, so they are part of the picture. The walkthrough section is cut from the moment the script starts,
  and held on its last frame if the script is shorter than 40 s.
- **Narration.** Each card has candidate texts from the proposal, longest first; the first one that fits the
  section at up to 225 words a minute is used (`shortened: true` in the report when it wasn't the full text).
  Walkthrough captions are spoken from the moment they appear and cut when the next one appears.
- **Scripted microphone.** Chromium's fake media flags (`--use-fake-device-for-media-stream
  --use-file-for-fake-audio-capture=…`) are supported (`micMode: "fake-device"` in a walkthrough), but on
  this Mac, headless, audio `getUserMedia` never resolves with them (video does). So the default is
  `inject`: an init script answers the page's `getUserMedia({ audio })` with a stream that plays the scripted
  WAV from its first sample through Web Audio. The app gets a MediaStream as from a real mic and its code is
  unchanged. The same WAV is mixed quietly under the walkthrough's narration, so you hear what the app heard.
- **Publish (eklavyamirani/app-platform#82, stub).** `publish.mjs` computes the upload path `demos/<app>/<proposal-id>/<file>` and
  returns a message. The `upload()` function is the seam for the Downloads upload helper; until it exists the
  file stays in the session and the session sends it to the owner.

## Checks

```bash
node demo/test/template.test.mjs          # timings, proposal schema, narration fallbacks (no browser)
node demo/test/scripted-audio.mjs 3       # the app hears the scripted audio the same way 3 times
node demo/test/same-structure.mjs demo/out/*/*.demo.json   # after two demos: same sections and timing
```
