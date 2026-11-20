# Demo kit contract

What an app provides so the generic demo runner (`demo/runner`) can record it. Written from the first
working kit, violin's (`demo/kit`); violin conforms to it. Everything here runs in the development session,
against the app running there, with no personal data and no sign-in to the platform.

## 1. Where it lives

```
demo/
  kit/
    kit.mjs            required: the kit object below (default export)
    walkthroughs/      required: one <name>.mjs per demo, normally named after the proposal's id
    fixture/           the app's demo data and how it is made
    audio/             scripted inputs, if the app listens to anything
    serve.mjs          how the app is started with the demo data (also runnable by hand)
  proposals/           proposal records, one JSON file each
```

The runner finds the kit with `--kit <dir>` (default `demo/kit`) and the walkthrough with
`--walkthrough <name>` (default: the proposal's `id`).

## 2. The kit object (`kit.mjs`)

```js
export default {
  app: "violin",                         // must equal the proposal's "app"
  viewport: { width: 390, height: 693 }, // CSS px, 9:16; recorded at 2× into 720×1280
  start: async ({ browser }) => ({       // serve the app with demo data; `browser` may be used to build it
    url,                                 //   the app's origin
    loadUrl: (query) => "...",           //   a URL that loads the demo data, then opens the app (+ query)
    close: async () => {},
  }),
  ready: async (page) => {},             // resolves when the app has loaded the demo data
};
```

Rules:

- **Start in-process.** `start` serves the app from the calling Node process (no background shell job, no
  container), on a port of its own (0 = any free port), so it never touches the progress a developer keeps
  on their usual port.
- **Load demo data through the app's own storage**, from a page the kit serves (violin: `/__demo/load` writes
  the fixture into `localStorage` and redirects to `index.html`). A person opening the kit's bare origin gets
  the same thing.
- **Demo data is synthetic** and repeatable: the same day gives the same data. Make it with the app's own
  code where possible rather than writing its data model by hand (violin drives `finishRun()` in a headless
  copy of the app with a fake clock and seeded randomness). Dates are relative to today, so streaks and due
  reviews look current.
- **Don't change the app for the demo** unless there is no other way. Violin needed no change: everything is
  served or injected by the kit.

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
- Keep a repeatability check next to the inputs (violin: `demo/test/scripted-audio.mjs` runs the same input
  three times and compares what the app measured).

## 5. Checklist for a new app

1. `demo/kit/kit.mjs` with `app`, `viewport`, `start`, `ready`.
2. A fixture made with the app's own code, repeatable, current dates, no personal data.
3. One walkthrough, and a proposal file for it.
4. `node demo/runner/demo.mjs demo/proposals/<id>.json` produces a 60.0 s mp4, and
   `node demo/test/same-structure.mjs` agrees with another app's or proposal's report.
