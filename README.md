# Fingerboard Coach

A practice app that listens through your microphone while you play the G major scale in 3rd and 5th position on the A and E strings. It tells you, note by note, whether you played it right.

## Run it

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765 and allow microphone access. Chrome and Safari both work. It needs no installs and no internet, and your progress stays in the browser.

- `?sim` in the URL replaces the mic with a synthetic tone generator (useful for trying it without a violin).
- `node test/pitch.test.js` checks the pitch detector against synthesized violin-like tones.

## Files

- `index.html`: the app (UI, drills, scoring, progress)
- `pitch.js`: McLeod pitch detector, limited to 500–1800 Hz so it doesn't jump octaves on these notes
