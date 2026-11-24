# Demo kit contract

What an app provides so the generic demo runner (`demo/runner`) can record it. Written from the first
working kit, violin's (`demo/kit`), and widened for server-backed apps from the second, workout's
(eklavyamirani/workout-app#46); both conform to it. Everything here runs in the development session, against
the app running there, with no personal data and no real account or credential.

## 1. Where it lives

```
demo/
  kit/
    kit.mjs            required: the kit object below (default export)
    walkthroughs/      required: one <name>.mjs per demo, normally named after the proposal's id
    fixture/           the app's demo data and how it is made
    audio/             scripted inputs, if the app listens to anything
    serve.mjs          how the app is started with the demo data (also runnable by hand; a stop command if needed)
  proposals/           proposal records, one JSON file each
```

The runner finds the kit with `--kit <dir>` (default `demo/kit`) and the walkthrough with
`--walkthrough <name>` (default: the proposal's `id`).

## 2. The kit object (`kit.mjs`)

```js
export default {
  app: "violin",                         // must equal the proposal's "app"
  viewport: { width: 390, height: 693 }, // CSS px, 9:16; recorded at 2× into 720×1280
  start: async ({ browser }) => ({       // start the app with demo data; `browser` may be used to build it
    url,                                 //   the app's origin
    loadUrl: (query) => "...",           //   a URL that loads the demo data, then opens the app (+ query)
    close: async () => {},               //   stops everything `start` started
  }),
  ready: async (page) => {},             // resolves when the app has loaded the demo data
};
```

Rules:

- **Start from the session, isolated, and leave nothing behind.** `start` serves the app from the calling Node
  process where it can (violin: an in-process static server). A server-backed app may also start its
  database and API with the app's own local-development tooling (workout: Docker Compose with the app's
  migrations), as long as everything is isolated to that session (its own ports, project name and data,
  never the developer's usual ones) and bound to loopback only. `close()` must leave nothing running: no
  process, container, port or data. A kit that starts anything outside the calling process also has a stop
  command for leftovers after a crash (workout: `serve.mjs --stop`).
- **Load demo data through the app's own data path.** For a local-first app that is the browser's storage,
  written from a page the kit serves (violin: `/__demo/load` writes the fixture into `localStorage` and
  redirects to `index.html`). For a server-backed app it is the server's own seed, ideally the same fixture
  its previews use (workout: the API's `--seed fixture`). The URL the kit prints when run by hand loads the
  data, so a person gets the same thing the recorder does.
- **Sign-in, if the app needs one, is a stand-in inside the kit.** A kit may run a stand-in sign-in service
  that only that session's API trusts, with a key made per run, issuing tokens only for the fixture's
  users (workout: a stand-in OpenID provider). Never a real account or credential, and no sign-in bypass
  in the app.
- **Demo data is synthetic** and repeatable: the same day gives the same data. Make it with the app's own
  code where possible rather than writing its data model by hand (violin drives `finishRun()` in a headless
  copy of the app with a fake clock and seeded randomness), or reuse a seed that the app's own tests already
  cover. Dates relative to today are preferred, so streaks and due items look current; a preview fixture
  with fixed dates is fine when the walkthrough doesn't depend on recent dates.
- **Don't change the app for the demo** unless there is no other way. Neither violin nor workout needed a
  change to app code: everything is served, seeded or injected by the kit.

## 3. A walkthrough (`walkthroughs/<name>.mjs`)

```js
export default {
  query: "",                                   // added to the app URL, e.g. "?sim"
  audio: async ({ outDir }) => wavPath,        // optional: scripted microphone input (16-bit WAV)
  micMode: "inject",                           // optional: "inject" (default) or "fake-device"
  setup: async ({ page, demo }) => {},         // optional, not recorded: select things, scroll to the top
  run: async ({ page, demo }) => {},           // recorded: the 40 s walkthrough section
};
```

`demo` (from the recorder) gives:

| | |
|---|---|
| `demo.say(text)` | show a caption now; it is narrated from this moment until the next caption |
| `demo.tap(selector)` | scroll to it, show a tap ring, click |
| `demo.scrollTo(selector)` | smooth-scroll it into view |
| `demo.at(seconds)` / `demo.wait(ms)` | pace the script against the section clock |
| `demo.elapsed()` | seconds since the section started |
| `demo.proposal` | the proposal record |

Rules:

- **40 seconds.** The section is cut at 40 s; a shorter script is held on its last frame. Plan the beats with
  `demo.at()`.
- **Captions narrate.** Keep each one short enough to say before the next one (about 2.5 words a second);
  read numbers from the page so the narration matches the screen.
- **Fail loudly** in `setup` if the walkthrough needs a prototype that isn't checked out.

## 4. Scripted inputs

- Generate inputs from the app's own definitions (violin: the drill's notes from `curriculum.js`) so they
  always match what is on screen. No recordings of real people.
- Audio input: a WAV with a short silent lead-in and a long silent tail. The default `inject` mode starts it
  exactly when the page opens the microphone. Use `fake-device` (Chromium's fake media flags) only where the
  page must see a real capture device; it does not work headless on macOS.
- With scripted audio, the recorder runs the page's animation frames on a 16 ms timer
  (`steadyFrames` in `demo/runner/fake-mic.mjs`). While recording, headless Chromium otherwise runs them only as
  fast as it captures video, about 20 a second on a loaded Linux machine, and a page that listens on animation
  frames misses notes. The page's code is unchanged.
- Keep a repeatability check next to the inputs (violin: `demo/test/scripted-audio.mjs` runs the same input
  three times and compares what the app measured).

## 5. Checklist for a new app

1. `demo/kit/kit.mjs` with `app`, `viewport`, `start`, `ready`.
2. Demo data from the app's own code or a seed its tests cover, repeatable, no personal data, current dates
   where the walkthrough needs them.
3. One walkthrough, and a proposal file for it.
4. `node demo/runner/demo.mjs demo/proposals/<id>.json` produces a 60.0 s mp4, and
   `node demo/test/same-structure.mjs` agrees with another app's or proposal's report.
5. `close()` (and the stop command, if the kit needs one) leaves nothing running.
6. The kit's README lists what it needs on the machine (violin: Node and the runner's `npm --prefix demo
   ci`; workout: also Docker) and how long its first and later starts take (violin: about 10 seconds to make
   the fixture on the first start of a day, then it is cached; workout: about 12 minutes for the first API
   image build, then 7 to 13 seconds).
7. The kit's README says whether a demo can be recorded in a Linux cloud session, and what that needs beyond
   the runner (violin: yes, nothing beyond the steps in its README's "Recording in a cloud session"). The
   runner itself needs no browser download there: it uses the machine's installed Playwright when the
   pinned one has no browser (`demo/runner/browser.mjs`).
