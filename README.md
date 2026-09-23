# Fingerboard Coach

A practice app that listens through your microphone while you play scales in any two positions on a pair of strings. It tells you, note by note, whether you played it right.

Use the **Scale** card to pick a key (12 per scale type), a scale type (major, natural minor, harmonic minor, melodic minor), a string pair (G·D, D·A, A·E) and two positions (1st–7th). It generates the drills for that setup: each string on its own in each position, both strings together, a run with one shift between the two positions, an adaptive Note Hunt, and *Shifting down* drills (repeated down-shift pairs on each string with guide notes, plus a run that starts at the top so you shift down first). Medals and history are kept separately for each setup. Where each note tends to land is tracked per physical spot on the string, so it's shared across scales.

## Run it

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 and allow microphone access. Chrome and Safari both work. It needs no installs and no internet, and your progress stays in the browser.

- `?sim` in the URL replaces the mic with a synthetic tone generator (useful for trying it without a violin).
- `node test/pitch.test.js` checks the pitch detector against synthesized violin-like tones (A3–B6).
- `node test/scales.test.js` checks scale spelling and generated fingerings for every key, scale type, string pair and position pair.

## Files

- `index.html`: the app (UI, drills, scoring, progress)
- `scales.js`: scale spelling, position fingerings, finger patterns and shift routing
- `pitch.js`: McLeod pitch detector; the app narrows its frequency range to the current drill's notes so it doesn't jump octaves
