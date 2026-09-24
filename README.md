# Fingerboard Coach

A practice app that listens through your microphone while you play scales in any two positions on a pair of strings, or while you play a whole piece. It tells you, note by note, whether you played it right.

Use the **Scale** card to pick a key (12 per scale type), a scale type (major, natural minor, harmonic minor, melodic minor), a string pair (G·D, D·A, A·E) and two positions (1st–7th). It generates the drills for that setup: each string on its own in each position, both strings together, a run with one shift between the two positions, an adaptive Note Hunt, and *Shifting down* drills (repeated down-shift pairs on each string with guide notes, plus a run that starts at the top so you shift down first). Medals and history are kept separately for each setup. Where each note tends to land is tracked per physical spot on the string, so it's shared across scales.

## Tempo mode

Choose **⏱ Tempo** under Mode to practise with a metronome. After a four-click count-in, the drill moves on with the beat. A note counts only if it's in tune *and* on time; the on-time window gets tighter at each medal level.

- Set the BPM and notes per beat (1–4). With **Tempo ladder** on, a passed run adds 4 BPM next time and a rough run takes 4 off.
- Press **Calibrate timing** once: after the count-in, play 8 notes on the click, alternating two open strings. This measures the delay your speakers and mic add, so early and late are judged against the click you hear.
- Results show a timing chart next to the pitch chart, and the coach flags rushing, dragging, and shifts that make you late.

## Piece tab

Record yourself playing a whole piece; you don't need to enter the music. The app splits the recording into notes and reports:

- **Intonation:** each note against the nearest equal-tempered pitch, measured on the steady middle of the note (vibrato is measured at its centre). It also lists notes that are consistently sharp or flat, and notes outside the key if you pick one.
- **Timing:** with the metronome on, each note against the click grid (beat, half, triplet or quarter beat) and any drift ahead of or behind the click. With it off, your own pulse, how steady it was, and the stretches where you sped up or slowed down.
- **Moments to check**, each with a ▶ button that plays that spot of the recording. The analysis is kept (the last 10 performances), but the audio only lasts until you leave the page.
- **📋 Copy report for Claude**, to talk through the performance and get drills for the weak spots.

Calibrate timing once in the metronome panel of this tab. It listens across all four strings, so it has its own calibration, separate from Tempo mode's.

## Custom drills with Claude

The **My drills** tab lets you import drills written for you, for example by Claude after you describe a specific problem. It also exports reports so Claude can see how you did.

1. Press **Copy format for Claude** on that tab and paste it into your conversation with Claude. The format is also in `drills.js` (`FORMAT_DOC`).
2. Describe the problem. Paste Claude's drill JSON into **Import**; code fences and surrounding text are fine. If something's wrong, you get per-note error messages you can paste back.
3. Practise it like any other drill. Afterwards, press **📋 Copy report for Claude** (in the results, or on My drills). The report holds the drill, your last 5 runs note by note (cents, wrong notes, shift direction), the coach's notes and per-note trends.
4. Paste the report back. Claude can spot the pattern and write the next drill.

Built-in drills keep reports too, and any report can be imported as a drill.

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
- `node test/scales.test.js` checks scale spelling and generated fingerings for every key, scale type, string pair and position pair.

## Files

- `index.html`: the app (UI, drills, scoring, progress)
- `piece.js`: Piece tab analysis (note splitting, intonation, metronome and free timing, reports)
- `drills.js`: custom drill format (documentation, validation, import/export)
- `scales.js`: scale spelling, position fingerings, finger patterns and shift routing
- `pitch.js`: McLeod pitch detector; the app narrows its frequency range to the current drill's notes so it doesn't jump octaves
