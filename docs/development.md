# Development

How to run Fingerboard Coach locally, the tests, and what each file does. Feature behaviour is in the [guide](guide.md).

## Run it

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 and allow microphone access. Chrome and Safari both work. It needs no installs and no internet, and your progress stays in the browser.

- **iPad:** turn on **iPad mic mode** in Settings. The iPad's raw mic (which gives the most accurate pitch on Mac and iPhone) comes through about 40 dB too quiet to use, so this switches to Safari's voice-processed mic.
- `mic-check.html` runs a few microphone setups side by side and produces a report. Use it when the app can't hear the mic on a particular device.
- `?sim` in the URL replaces the mic with a synthetic tone generator (useful for trying it without a violin).
- `node test/pitch.test.js` checks the pitch detector against synthesized violin-like tones (A3–B6).
- `node test/piece.test.js` checks note splitting, intonation (including vibrato) and timing analysis on synthetic performances.
- `node test/drills.test.js` checks drill import/export, including that every built-in drill exports and re-imports unchanged.
- `node test/practicelog.test.js` checks the practice log: storage limits, backfill, ranges and sessions, patterns, and before/after for imported drills.
- `node test/plan.test.js` checks practice plan import (keys, strings, parts, errors), the session rotation, the calendar and the streak.
- `node test/sync.test.js` checks the sync merge (both devices' progress kept, settings per device).
- `node test/fix.test.js` checks the Watch line rule and Fix mode: sets, breaks, misses, the quiet gap, the progression, tolerance per medal level and the fix log. `node demo/test/fix-mode.mjs` runs it end to end with scripted audio.
- `node test/scales.test.js` checks scale spelling and generated fingerings for every key and scale type across a range of string and position choices.
- `node test/ear.test.js` checks the Ear tab: the stages' notes, questions (never the reference note, about a quarter in tune, weighted towards misses), grading, the cents ladder and medals; which notes go on which strings, which-string questions from partial recordings, and their medals.
- `node test/curriculum.test.js` checks the Path graph (every skill can be fingered, prerequisites come first, keys need the positions claimed), its drills in both directions, the run metrics, and how skills progress.

## Files

- `index.html`: the app (UI, drills, scoring, progress)
- `piece.js`: Piece tab analysis (note splitting, intonation, metronome and free timing, reports)
- `practicelog.js`: the 90-day practice log and its export for Claude (patterns, progress, before/after for imported drills)
- `fix.js`: the Watch line (which note in a drill keeps landing off) and Fix this note / Fix this progression (sets, breaks, the fix log)
- `plan.js`: practice plan format (documentation, validation), session rotation, calendar, streak and report days
- `drills.js`: custom drill format (documentation, validation, import/export)
- `curriculum.js`: Path mode (skill graph, drills per skill and direction, run metrics and pass criteria, tempo, mastery and review, what to practise next)
- `ear.js`: Ear tab (stages, questions, grading, the adaptive cents ladder, medals; which-string notes, questions and medals)
- `ear-tap.js`: AudioWorklet that passes the mic's samples to the Ear tab's recorder
- `scales.js`: scale spelling, position fingerings (including open strings), finger patterns and scale-run routing through the chosen positions
- `pitch.js`: McLeod pitch detector; the app narrows its frequency range to the current drill's notes so it doesn't jump octaves
