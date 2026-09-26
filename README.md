# Fingerboard Coach

A practice app that listens through your microphone while you play scales in the positions and strings you're learning, or while you play a whole piece. It tells you, note by note, whether you played it right.

## Path

**Path** (the default view) is a skill graph that takes a first-year player from one-octave scales in 1st position to two-octave scales through 3rd and 5th position. There are 77 skills in 9 stages:

1. 1st position, one octave: finger patterns (0 1 2‿3 4, then 1‿2, 3‿4, 0‿1), then A, D, G, C, E, F and B♭ major from the open strings
2. arpeggios, broken thirds, harmonic and melodic minor in those keys
3. two octaves in 1st position: G, A and B♭ (the keys that fit without shifting), their arpeggios and minors
4. the 3rd-position frame: patterns, then one-octave scales in 3rd position without shifting
5. shift pairs 1st ↔ 3rd on the strings the two-octave scales shift on, then single-string scales
6. two octaves through 3rd: C and D (which need 3rd position on the E string), d minor, G and A re-fingered through 3rd
7. the 5th-position frame
8. shift pairs 3rd ↔ 5th and 1st ↔ 5th, then 1st → 3rd → 5th on one string
9. two octaves through 5th: E and F major, e minor

A skill unlocks when its groundwork is mastered: the finger patterns its fingering uses and the shift pairs it shifts on are worked out from the notes. Every skill is played two ways, up first (⇡⇣) and from the top (⇣⇡), and both are scored.

- **Learning → consolidating:** 2 clean runs each way, out of the last 4. A run is clean at the learning level with a median miss ≤ 15¢, ≥ 85% of notes within ±20¢ (and ±80 ms in Tempo mode), ≥ 80% of shifts clean, even whole steps (SD ≤ 12¢) and the same note in tune across octaves (≤ 15¢).
- **Consolidating → mastered:** the target tempo (♩=60 at 2 or 4 notes per beat), 3 clean runs each way at it out of the last 4, at the mastery level (≤ 10¢ median, ≥ 92% within ±15¢, G, D, A and E within ±8¢, ±50 ms, ≥ 95% of shifts), and a clean first try of the session on 2 different days. Stage exams (👑) also need a clean first try from the top at the target tempo.
- **Tempo** starts at ♩=45 and goes up 6% after 3 clean runs in a row that include both directions and a first try of the session. Two misses in a row take it down 8%. After a run with a median miss over 25¢ the next run is offered at 85% speed.
- **Reviews:** a mastered skill comes back after 1, 2, 4, 7, 14 and 30 days. Only the first try of a session counts. Miss it and it drops back two boxes; miss twice in a row and it goes back to consolidating, and its pattern and shift groundwork comes up for review.
- **Next up** plans the session: due reviews first (up to 4, in mixed order), then the lowest-stage skill you're working on, up to 3 tries each way, starting from the top when coming down is weaker, then its weakest groundwork, then the next skill.
- Lock-in runs are for learning the notes and don't count. Use Flow or Tempo.

The thresholds are starting defaults, not published norms. They live in `LEVELS` in `curriculum.js`; adjust them once you've seen your own numbers.

## Free practice

Use the **Scale** card to pick a key (12 per scale type), a scale type (major, natural minor, harmonic minor, melodic minor), a range of strings (from one string up to all four, e.g. G to E) and one to four positions (1st–7th, e.g. just 1st, 1st & 3rd, just 3rd, or 1st, 3rd & 5th). It generates the drills for that setup:

- each string on its own in each position, and all the chosen strings together;
- a scale run, as many octaves (up to 3) from tonic to tonic as fit. With one position it stays there. With several it climbs through them in order, shifting once between each pair. When 1st position is chosen, the run uses open strings, so G major in 1st position on G to E is the usual two-octave G3–G5;
- an adaptive Note Hunt;
- with two or more positions, *Shifting down* drills: repeated down-shift pairs with guide notes for each neighbouring pair of positions (on each string, or on the strings the run shifts on when there are more than two), plus a run that starts at the top so you shift down first. Medals and history are kept separately for each setup. Where each note tends to land is tracked per physical spot on the string, so it's shared across scales.

## Tempo mode

Choose **⏱ Tempo** under Mode to practise with a metronome. After a four-click count-in, the drill moves on with the beat. A note counts only if it's in tune *and* on time; the on-time window gets tighter at each medal level.

- Set the BPM and notes per beat (1–4). With **Tempo ladder** on, 3 passed runs in a row raise the tempo 6% and 2 misses in a row lower it 8%. In Path the skill sets the tempo.
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
- `node test/scales.test.js` checks scale spelling and generated fingerings for every key and scale type across a range of string and position choices.
- `node test/curriculum.test.js` checks the Path graph (every skill can be fingered, prerequisites come first, keys need the positions claimed), its drills in both directions, the run metrics, and how skills progress.

## Files

- `index.html`: the app (UI, drills, scoring, progress)
- `piece.js`: Piece tab analysis (note splitting, intonation, metronome and free timing, reports)
- `drills.js`: custom drill format (documentation, validation, import/export)
- `curriculum.js`: Path mode (skill graph, drills per skill and direction, run metrics and pass criteria, tempo, mastery and review, what to practise next)
- `scales.js`: scale spelling, position fingerings (including open strings), finger patterns and scale-run routing through the chosen positions
- `pitch.js`: McLeod pitch detector; the app narrows its frequency range to the current drill's notes so it doesn't jump octaves
