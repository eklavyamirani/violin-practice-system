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

### Upload to Downloads (eklavyamirani/app-platform#82)

With an upload token in the environment, the same command then uploads the video to the platform's Downloads
app and prints the link to send the owner (it opens after their normal sign-in):

```bash
DEMO_UPLOAD_TOKEN_FILE=<file holding the token> node demo/runner/demo.mjs demo/proposals/<id>.json \
  --preview <the prototype's preview URL> --proposal-link <the proposal issue URL>
```

- The token comes from `DEMO_UPLOAD_TOKEN`, or from the file named in `DEMO_UPLOAD_TOKEN_FILE`. The owner
  issues it. It goes to curl as a header on stdin, so it is never in a process argument, the URL, the
  output or `<id>.demo.json`. Never paste it into a commit, an issue or a message.
- The video goes to `demos/<app>/<proposal-id>/<UTC time>-<proposal-id>.mp4`, with `<UTC time>-links.txt`
  next to it holding `--preview`, `--proposal-link` and `--note`. Uploads never overwrite, so every run
  makes a new pair.
- Upload only the demo you mean to send the owner. For test runs, leave the token unset or pass
  `--no-upload`, which skips the upload even when a token is set. The runner sends each file once and never
  retries; it prints the UTC time and HTTP status of each request.
- No token: the video is still recorded, and the last line says `Not uploaded: no upload token …` with the
  video's path, for the session to send by hand. A refused upload (expired token, a name the route
  rejects, too many requests) says why, and the command exits with code 1.
- `DEMO_UPLOAD_HOST` changes the upload host (for a local cluster, with `DEMO_UPLOAD_CACERT` for its CA).

For a filed proposal, the proposal file comes from the issue: the platform's `scripts/prototype start violin <issue> .`
writes `demo/proposals/<id>.json` on the prototype branch (eklavyamirani/app-platform `docs/v2/product-scout.md`), and the
walkthrough is `demo/kit/walkthroughs/<id>.mjs`.

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

### The same data on a prototype's preview

A preview starts with an empty database, so a feature that needs practice history shows nothing there. On a prototype
branch (never on `main`; the script refuses there):

```bash
node demo/kit/preview-seed.mjs            # [--end YYYY-MM-DD], default yesterday
git add deploy/preview-seed deploy/Dockerfile && git commit -m "Prototype only: demo progress for the preview (/__demo/load.html)"
```

It writes the fixture as `deploy/preview-seed/progress.json`, copies the loader `demo/kit/preview-seed/load.html` next to
it and adds one `COPY` line to `deploy/Dockerfile`, so the prototype's image serves both under `/__demo/`. On the preview,
`/__demo/load.html` loads the made-up progress into that browser after one tap (this device's settings stay, like "Load
progress file"). It refuses on any address that is not a preview (`<app>-pr-<n>.`) or local, so it can't touch real
progress even if it were deployed elsewhere. Prototypes are never merged, so none of this reaches a release.

A run takes about 1.5 to 2 minutes: about 45 s of recording, the rest is the fixture (about 10 s, on the
first run of the day; later starts that day reuse it from `demo/.cache/`) and encoding. The kit needs
nothing on the machine beyond Node and `npm --prefix demo ci` (Setup below).

## Setup (eklavyamirani/app-platform#79)

`npm --prefix demo ci` installs everything the runner needs into `demo/node_modules`, pinned in
`demo/package-lock.json`:

- **Playwright 1.64.1** and its Chromium. If the browser isn't cached on the machine yet:
  `npx --prefix demo playwright install chromium`. A machine that already has a Playwright with its
  browsers, and shouldn't download others, is used as it is: when the pinned Playwright's Chromium can't
  launch (or can't record video), the runner takes the first installed Playwright that can (the global npm
  root, `NODE_PATH`, `/usr/local/lib/node_modules`, `/usr/lib/node_modules`), or exactly the one in
  `DEMO_PLAYWRIGHT=<its package directory>`. The first output line names the one used, and why any was
  skipped.
- **ffmpeg and ffprobe** as static builds (`ffmpeg-static` 5.2.0 = ffmpeg 6.0 with libx264, AAC and libass;
  `ffprobe-static` 3.1.0). No Homebrew or apt step. A system `ffmpeg`/`ffprobe` on the PATH is used instead if
  there is one, or set `DEMO_FFMPEG` / `DEMO_FFPROBE`. `ffmpeg-static` downloads its binary from GitHub when it
  installs; it is an optional dependency, so where that download is blocked `npm ci` still succeeds and the
  system ffmpeg is used.
- **Text to speech**: nothing to install on a Mac (see below). On Linux, `demo/runner/voice/setup-kokoro.sh`.

What this machine had before setup (2026-11-19, macOS on x86_64, Node 24.21): no ffmpeg on the PATH (only
Playwright's own stripped-down ffmpeg, which can encode VP8 webm only), no TTS other than macOS `say`,
Playwright 1.64.1's Chromium already cached.

### Text to speech: macOS `say` on a Mac, Kokoro on Linux

Words misheard: the same 6 narration lines (80 words) spoken by each voice and transcribed by Whisper (base.en), a stand-in for a listener; numbers written differently ("20" for "twenty") count as wrong. Linux figures from a container on a Mac (2 CPUs).

| Option | Quality | Licence | Offline | Install | Here |
|---|---|---|---|---|---|
| macOS `say` (Samantha) | clear, a bit flat | ships with macOS. My reading of Apple's licence: system voices may be used for your own personal, non-commercial content, which a private demo for the owner is. Not a lawyer's check. | yes | none on a Mac | **used on macOS** |
| Kokoro 82M (`kokoro-onnx`, voice `af_heart`) | neural; 0 of 80 words misheard by a Whisper check (`say`: 3, all number formatting) | weights Apache-2.0; `kokoro-onnx` MIT; it bundles espeak-ng (GPL) for phonemes, run as a library, which doesn't affect the audio | yes | pip (189 MB venv) + 338 MB of model files from GitHub releases; about 2 minutes in a Linux container | **used on Linux** (`setup-kokoro.sh`) |
| Piper (`piper-tts`, voice `en_US-kristin-medium`) | neural; 6 of 80 words misheard | engine GPL-3.0 (run as a program); voices vary, kristin is public domain, others are non-commercial | yes | pip (209 MB venv, 34 s) + a 61 MB voice from Hugging Face | supported (`DEMO_TTS=piper`, `PIPER_MODEL=…`) |
| Pico (`pico2wave`) | older, non-neural (SVOX Pico); 3 of 80 words misheard | Apache-2.0 | yes | apt `libttspico-utils` (Ubuntu multiverse, 7 MB) | not used: an older, non-neural voice; Kokoro is the neural option with no worse a score |
| espeak-ng | robotic; 13 of 80 words misheard | GPL-3.0 | yes | apt | last resort; the runner says so when it falls back to it |
| OpenAI TTS, ElevenLabs, Azure, Google | best | API terms | no | — | **not used**: anything paid or needing a key is the owner's decision |

The runner picks the first engine available: `say` on macOS, then Kokoro if `setup-kokoro.sh` has installed
it, then Piper (with `PIPER_MODEL`), then espeak-ng. `DEMO_TTS` forces one, `DEMO_VOICE` picks the voice
(a `say` voice, or a Kokoro voice such as `am_michael`). On a Mac, a free Enhanced or Premium voice from
System Settings → Accessibility → Spoken Content is noticeably better than Samantha (`DEMO_VOICE="Ava
(Premium)"`, for example). Kokoro works on a Mac too (`DEMO_TTS=kokoro`), if a demo should sound the same
wherever it was recorded.

`demo/runner/voice/setup-kokoro.sh` installs Kokoro into `demo/.cache/voice/kokoro` (or `DEMO_KOKORO_DIR`):
a Python venv with `kokoro-onnx` 0.6.1 from PyPI, and `kokoro-v1.0.onnx` and `voices-v1.0.bin` from the
`kokoro-onnx` project's GitHub release. It needs `python3` with venv (apt `python3-venv`) or `uv`. Re-running
it skips what is there. The two model files are pinned by sha256 in the script and checked after download and on
reuse; on a mismatch the file is deleted, the script fails, and narration falls back to espeak-ng. `tts.mjs`
only uses Kokoro once the script has written its `verified` stamp (an install from before the pins: run the
script again; it checks the files and downloads nothing).

## Recording in a cloud session

In a Claude cloud session (Linux, no upload token), after the prototype is built on its branch:

```bash
npm --prefix demo ci
demo/runner/voice/setup-kokoro.sh
node demo/runner/demo.mjs demo/proposals/<id>.json --no-upload
```

Then send the owner the mp4 whose path the last line prints. That is all the runner needs:

- **Browser.** Nothing to install. The machine's own Playwright and browsers are used when the pinned one
  has none (the `[demo] browser:` line says which). Don't run `playwright install` there.
- **ffmpeg.** The system `/usr/bin/ffmpeg`. `ffmpeg-static` is skipped if its download is blocked.
- **Voice.** `setup-kokoro.sh` needs these hosts: `pypi.org` and `files.pythonhosted.org` (the Python
  packages), and `github.com` and `release-assets.githubusercontent.com` (the model files). If they are
  blocked, the runner falls back to espeak-ng, says so, and still records.
- **Network for `npm ci`:** `registry.npmjs.org`.
- **Time** (measured in a Linux container with 2 CPUs): `npm ci` 38 s and `setup-kokoro.sh` about 2 minutes,
  once; then about 2.5 minutes for a recording with Kokoro (1.5 with espeak-ng). The setup downloads about
  530 MB, so a slower network adds to it.
- **No upload.** There is no token there, so `--no-upload` just makes that explicit; the last line gives
  the video's path.

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
    publish.mjs    uploads the mp4 and a links file to Downloads (curl, token on stdin)
    media.mjs      finds ffmpeg/ffprobe
  kit/           violin-specific (the demo kit; see CONTRACT.md)
    kit.mjs        what the runner imports
    serve.mjs      serves the app with the fixture loaded
    fixture/       synthetic progress, generated through the app's own code
    audio/         violin-like scripted playing of the app's own drills
    walkthroughs/  one script per proposal
  proposals/     proposal records
  test/          template and publish tests, the two-proposal structure check, the scripted-audio check
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
- **Publish (eklavyamirani/app-platform#82).** `publish.mjs` makes the same requests as the platform's
  `scripts/demo-upload` helper: a create-only POST of the video, then of the links file, each with the token
  in a header that curl reads from stdin. It returns the owner's link, which `demo.mjs` prints and stores in
  `<id>.demo.json` with each request's time and status (never the token).

## Checks

```bash
node demo/test/template.test.mjs          # timings, proposal schema, narration fallbacks (no browser)
node demo/test/publish.test.mjs           # upload: no token, refused, accepted, token kept out of args (local stand-in server)
node demo/test/browser.test.mjs           # which Playwright is used, and the fallback when the pinned one has no browser
node demo/test/scripted-audio.mjs 3       # the app hears the scripted audio the same way 3 times
node demo/test/same-structure.mjs demo/out/*/*.demo.json   # after two demos: same sections and timing
```
