# Fingerboard Coach

A practice app that listens through your microphone while you play scales in the positions and strings you're learning, or while you play a whole piece. It tells you, note by note, whether you played it right.

![IMG_7049](https://github.com/user-attachments/assets/8f1286b7-dfb3-45f0-b664-905e2857804b)


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

- each string on its own in each position, and all the chosen strings together. In 1st position these include the open strings when the key has them, and when crossing strings the next open string takes the place of the 4th finger, so the all-strings drill covers the whole range (D minor on D to E: D4 up to B♭5 and back). Note Hunt includes those open strings too;
- a scale run, as many octaves (up to 3) from tonic to tonic as fit. With one position it stays there. With several it climbs through them in order, shifting once between each pair, and prefers to shift on one string, cross over in the new position, then make the next shift on the next string (D major on D to E through 1st, 3rd & 5th: shift to 3rd on A, cross to E, shift to 5th on E). It avoids sliding on the 4th finger. When 1st position is chosen, the run uses open strings, so G major in 1st position on G to E is the usual two-octave G3–G5;
- an adaptive Note Hunt;
- with two or more positions, *Shifting down* drills: repeated down-shift pairs with guide notes for each neighbouring pair of positions (on each string, or on the strings the run shifts on when there are more than two), plus a run that starts at the top so you shift down first. Medals and history are kept separately for each setup. Where each note tends to land is tracked per physical spot on the string, so it's shared across scales.

**Working toward the full scale.** The full scale is the target: the run, the run from the top (*From the top*) and its three rhythms (*Rhythms*: dotted long–short ¾ + ¼, dotted short–long ¼ + ¾, and triplets, all with the same notes and fingering). Each of these goes 🥉 → 🥈 → 🥇 in Flow, then 🥇 in Tempo from 75% of the **Goal** tempo (set on the Scale card, e.g. ♩=60 × 2 notes per beat), up 6% after 3 passes in a row, until it passes at the goal (rhythms: with the clicks on beats). The rhythms join in once the plain run has 🥇. The build-up drills (each string and position, the shift pairs) only need 🥈.

**Next drill:**
- A missed run stays on that drill, so you can jump straight to the full scale and keep at it (playing its first note hands-free goes again).
- A pass on a scale drill moves to the next scale drill that still has a step to make, so the run, the run from the top and the rhythms take turns.
- If 3 or more of a passed run's misses (or 2 or more after three misses in a row) land in one build-up drill's notes, that drill comes next: shift landings go to the shift pairs, the rest to the string and position. Then it's back to the scale.
- Before you've tried the scale, the build-up drills come in order, carrying on from the one you just did.
- Note Hunt only comes up when you pick it, or once everything is done.

## Rhythm drills

A drill whose notes have lengths (`beats`) is a rhythm drill. It's for practising the rhythm of a passage from a piece: dotted rhythms, long notes, repeated notes and rests.

- It is always played with the metronome. After one bar of count-in, a playhead moves over the written rhythm, with the count ("1 & 2 &") underneath.
- **🔊 Hear it** plays the passage with the click first, each note lasting its full written length.
- The same pitch may repeat. The app hears a repeated note as a dip in loudness, so each one needs its own bow or a small stop in the bow (as in a hooked bowing).
- After the run, the whole recording is lined up with the written rhythm. Each note is scored on pitch, on when it starts (±60–120 ms, depending on tempo and medal level) and, for notes of 1½ beats or more, on how long it sounds (80 / 85 / 90% of its length at 🥉 / 🥈 / 🥇).
- The results show the written rhythm against what you played, and how long each kind of note lasted (8th, quarter, half…). The coach names the problem: long notes cut short (moving on early, or the sound fading while the next note still waits), long notes shrinking next to short ones, dotted rhythms played too even (the long:short ratio, 3 : 1 exact, about 2 : 1 for a triplet feel), and repeated notes that rush.
- **Clicks fade out**: with the ladder on, a rhythm drill starts with clicks on 8ths. After 3 passes in a row the clicks drop to beats only, so you count the 8ths yourself; after 3 more, the tempo goes up 6%. 2 misses in a row go back a step.

**Drill packs** (My drills tab) add ready-made drills. *The Two Grenadiers · bars 10–21* works up from the dotted quarter + 8th and half notes on the open A string to bars 10–12, 12–14, 14–16, 16–18, 18–20 and the whole passage. *Theme from “Witches' Dance” · bars 21–41* (D major, 2/4) covers triplet 8ths, slurred dotted 8th + 16th pairs, the minor section's low fingers and the switch from dotted pairs to triplets in bar 37, with six scale drills (S1–S6) for the accidentals.

Packs are JSON files in `packs/`. A pack is a drill import file (see the format on the My drills tab) with an `id`, `title` and `blurb` added:

```json
{ "format": "fingerboard-coach/drill@1", "id": "my-piece", "title": "My piece · bars 1–8", "blurb": "What it works on.", "drills": [ … ] }
```

To add one, save it as `packs/<id>.json` and add the file name to `packs/index.json`. `node test/rhythm.test.js` checks that every pack is listed and imports cleanly. The same file can also be pasted into Import.

## Hands-free start

So you don't have to put the violin down between runs: play and hold a drill's first note (about ¾ s) to start it. On the results, the drill's own first note goes again and the next drill's first note moves on; the notes to play are shown at the top of the results. It waits for a moment without any start note first, so the last note of a run ringing on doesn't restart it. The first note you hold counts as the run's first landing (in Tempo mode it starts the count-in). Turn it off with **Hands-free start** in Settings.

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

### Practice log: a whole session or the last few days

Per-drill reports hold one drill's last 5 runs. To find habits that repeat across drills, and to see whether Claude's drills helped, use **📋 Copy practice log for Claude** on My drills. Pick **This session**, **Today**, the last 3, 7, 14 or 30 days, or everything kept. The app keeps every run, note by note, for 90 days (up to 1,000 runs). The log starts from each drill's last 5 runs if you practised before this feature existed.

- **Patterns:** intonation after shifts up and down, by finger, position and string; the worst spots (a pitch on a string, across every drill and spelling); common wrong notes; timing in tempo runs.
- **Progress:** the range split into an earlier and a later half, overall and per spot, plus each drill's scores and tempos in order.
- **Claude's drills:** for each imported drill, its target notes before and after you added it, measured across all your practice and not just that drill.
- **Every note of every run** adds each run's landings and coach notes. It's on by default for a session or a day; leave it off for longer ranges to keep the log short.

A loop that works: paste a week's log and ask Claude for the consistent problems and drills for them; practise those for a week or two; then paste a new log covering both periods and ask what changed. Claude can also write rhythm drills for any passage: give every note a `beats` length and add `{"rest": …}` entries (see the format).

## Practice plans with Claude

The **Plan** tab holds a practice schedule written for you by Claude: which days you practise, for how long, and what each session covers. Plans use the scale setups you choose, the same as the Scale card in Free practice. Nothing has to be unlocked on the Path first.

1. Press **Copy format for Claude** on the Plan tab and paste it into a conversation with Claude. The format is also in `plan.js` (`FORMAT_DOC`). Say what you're working on (e.g. D major and D melodic minor through 3rd and 5th position on D to E) and which days you can practise.
2. Paste the plan into **Import**. Drills written for the plan go into My drills. If something's wrong you get messages you can paste back. Importing a plan replaces the current one; what you practised is kept.
3. On practice days the **Today** card (Practice tab) lists the session's steps with a timer for each. **Start** sets up the step: the scale setup and its part (full scale, from the top, rhythms, shift pairs, build-up drills or Note Hunt), a drill, Path reviews, tuning, or a piece recording.
   - During a scale step, Next up stays on that part. A missed run stays on the run, and when the run's misses cluster in one spot it sends you to that spot's build-up drill and then back. Medals and tempo carry on as in Free practice.
   - Time counts while you play, tune or record, and for up to 2 minutes between runs. A step is done once its minutes are in; you can also tick it done.
4. Sessions take turns on the practice days. A missed day doesn't skip a session: the next practice day gets the one after the last one you practised. On a rest day you can **Practise anyway**.
5. With a plan, the dots at the top are today's steps, and the 🔥 streak counts practice days in a row with the session done (80% of its minutes). Rest days don't break it.
6. After a week or two, press **📋 Copy plan report for Claude**. It holds the plan, each day's steps (planned and practised minutes), and for each scale setup in the plan its drills' medals and tempo, plus recent runs with the notes missed. Paste it back and Claude writes the next plan.

## Sync across devices

On the app platform (`eklavyamirani/app-platform`, record 0046) the **Progress** tab has a **Sync across devices** card: sign in once per device and your progress follows you. The app still keeps everything in the browser and works offline; it syncs when it starts, a few seconds after each change, and when you come back to the tab.

- What syncs: XP, streak days, medals, note history, recent runs, the practice log, path progress, goals, your drills, your practice plan and what you practised of it, and piece analyses. Settings (iPad mic mode, timing calibration, A4, …) and the selected drill stay on each device.
- If you practised on two devices before they synced, both are kept: XP, practice counts and plan minutes add up, runs from both devices are listed, and something you deleted on one device stays deleted unless you changed it on the other.
- Without the platform (GitHub Pages, `python3 -m http.server`) there is no sign-in and nothing leaves the browser, as before.

### Progress file (backup, or moving to a preview)

**Download progress** on the Progress tab saves everything that syncs (medals, note history, practice log, your drills, piece analyses) to a `fingerboard-coach/progress@1` JSON file. **Load progress file** replaces the progress on that copy of the app with the file's; the device's settings stay. Use it to keep a backup, or to try a preview (`violin-pr-<n>.app.ekkylab.uk`) with your real data. Previews have their own database seeded without anyone's data, so sign in on the preview, then load the file you downloaded from production. Nothing you do in the preview reaches production.

How it works: `sync.js` (sign-in with PKCE, three-way merge against the last synced copy), `db/migrations/` (one row per person, row-level security, `api.get_state` / `api.put_state` served by the platform's PostgREST), `deploy/` (the web image), `.github/workflows/platform-images.yml` (images for the platform). `node test/sync.test.js` checks the merge.

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
- `node test/scales.test.js` checks scale spelling and generated fingerings for every key and scale type across a range of string and position choices.
- `node test/curriculum.test.js` checks the Path graph (every skill can be fingered, prerequisites come first, keys need the positions claimed), its drills in both directions, the run metrics, and how skills progress.

## Files

- `index.html`: the app (UI, drills, scoring, progress)
- `piece.js`: Piece tab analysis (note splitting, intonation, metronome and free timing, reports)
- `practicelog.js`: the 90-day practice log and its export for Claude (patterns, progress, before/after for imported drills)
- `plan.js`: practice plan format (documentation, validation), session rotation, calendar, streak and report days
- `drills.js`: custom drill format (documentation, validation, import/export)
- `curriculum.js`: Path mode (skill graph, drills per skill and direction, run metrics and pass criteria, tempo, mastery and review, what to practise next)
- `scales.js`: scale spelling, position fingerings (including open strings), finger patterns and scale-run routing through the chosen positions
- `pitch.js`: McLeod pitch detector; the app narrows its frequency range to the current drill's notes so it doesn't jump octaves
