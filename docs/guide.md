# Fingerboard Coach: the full guide

Everything the app does, feature by feature, with the exact thresholds and rules. For what the app is and why it exists, start with the [README](../README.md); for the research and teaching sources behind it, [references.md](references.md). To run it locally, test it or find your way around the code, see [development.md](development.md).

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
- Lock-in and Place runs are for learning the notes and their spots, and don't count. Use Flow or Tempo.

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
- **Move on:** when Next up stays on the drill you just played (a medal earned and the next one to go for, or a miss), the results also offer **Move on** to the next other drill with a step to make, by button or by playing its first note. Next up brings the skipped drill back later. If both drills start on the same note, one of them gets an open string instead (see Hands-free start).
- After a medal, **↻ Again** goes for the next medal on the same drill (its button says which). **Hide fingering** and **Ears first** only take away help; they don't change medals, so they're suggested once a drill is done (🥈 for a build-up drill, 🥇 otherwise).

### Watch line and Fix a note

Before a run, the line under the note strip can say **👀 Watch F♯4**: a note in the selected drill that has been landing off on the same side lately. It shows when that note's last landings (at least 8 of them, up to the last 20) average 6¢ or more off, with at least 70% on that side. It names the string, finger, the average and which way to move, and marks that note's chip ↑ or ↓. It reads the same per-spot history as the note map, so it works the same in Path and in Free practice, across every drill that uses the spot. Nothing shows for a drill without such a note, nothing changes during a run, and the line is worked out again after each run.

From the Watch line:
- **🎯 Fix this note:** play the note on its own, then stop.
- **🔁 Fix this progression:** play the note before it in the drill, then the note, then stop. When the note comes after a shift or a string crossing somewhere in the drill, that approach is the one chosen.

Both follow Molly Gebrian's microbreaks:
- **Three clean in a row fill a set.** A miss empties the set.
- **Clean** means the note is judged like a Place try: where the finger touched down (its first ~80 ms) is within the drill's tolerance (🥉 ±25¢, 🥈 ±15¢, 🥇 ±10¢; a Path skill's own window), it isn't then slid or adjusted by 15¢ or more, and there's no wrong note on the way. A finger that lands off and slides in is a miss: lift it and place it again. In a progression, the first note only has to be the right note; after a shift, the note is judged where it settles, since a shift's own slide is expected.
- **Between repetitions** the app waits for 0.3 s of quiet, so one long note never counts twice.
- **After set 1**, a 10-second break with a countdown; nothing is scored while it runs. **After set 2** the fix is done: come back to it once or twice more today.
- **Three misses in a row** also give a 10-second break, so a bad patch turns into a reset instead of a grind.
- **Stop**, **Escape**, starting a run or choosing another drill ends a fix.

Fix repetitions are kept apart from your progress: they never change the note history, XP, medals, the path or the practice log's runs. The Watch line keeps judging the note from your real drills, so the next runs show whether the fix carried over; it also says how many fixes you finished today. Each fix is logged with every repetition's cents (and any slide or wrong note), synced like the rest of your progress, and included in the practice log for Claude, so a miss the microphone heard wrongly can be told from a real one.

## Rhythm drills

A drill whose notes have lengths (`beats`) is a rhythm drill. It's for practising the rhythm of a passage from a piece: dotted rhythms, long notes, repeated notes and rests.

- It is always played with the metronome. After one bar of count-in, a playhead moves over the written rhythm, with the count ("1 & 2 &") underneath.
- **🔊 Hear it** plays the passage with the click first, each note lasting its full written length.
- The same pitch may repeat. The app hears a repeated note as a dip in loudness, so each one needs its own bow or a small stop in the bow (as in a hooked bowing).
- After the run, the whole recording is lined up with the written rhythm. Each note is scored on pitch, on when it starts (±60–120 ms, depending on tempo and medal level) and, for notes of 1½ beats or more, on how long it sounds (80 / 85 / 90% of its length at 🥉 / 🥈 / 🥇).
- The results show the written rhythm against what you played, and how long each kind of note lasted (8th, quarter, half…). The coach names the problem: long notes cut short (moving on early, or the sound fading while the next note still waits), long notes shrinking next to short ones, dotted rhythms played too even (the long:short ratio, 3 : 1 exact, about 2 : 1 for a triplet feel), and repeated notes that rush.
- **Clicks fade out**: with the ladder on, a rhythm drill starts with clicks on 8ths. After 3 passes in a row the clicks drop to beats only, so you count the 8ths yourself; after 3 more, the tempo goes up 6%. 2 misses in a row go back a step.

**Drill packs** (My drills tab) add ready-made drills. *The Two Grenadiers · bars 10–21* works up from the dotted quarter + 8th and half notes on the open A string to bars 10–12, 12–14, 14–16, 16–18, 18–20 and the whole passage. *Theme from “Witches' Dance” · bars 21–41* (D major, 2/4) covers triplet 8ths, slurred dotted 8th + 16th pairs, the minor section's low fingers and the switch from dotted pairs to triplets in bar 37, with six scale drills (S1–S6) for the accidentals.

On the Practice page (Path or Free practice) the pack of the selected drill sits at the top of the list, its drills in order with their medals, like a stage of the Path. Nothing is locked: pick any drill. **Next up** follows the pack: a miss stays on the drill, a pass moves on to the next drill in the pack still short of 🥇, so each lap through the pack aims one medal higher. A drill picked by hand is where it carries on from; ▶ Practice on My drills carries on where the pack was left. Other packs and imported drills are at the bottom of the list. After a miss the results also offer **Move on** to the next drill in the pack short of 🥇.

Packs are JSON files in `packs/`. A pack is a drill import file (see the format on the My drills tab) with an `id`, `title` and `blurb` added:

```json
{ "format": "fingerboard-coach/drill@1", "id": "my-piece", "title": "My piece · bars 1–8", "blurb": "What it works on.", "drills": [ … ] }
```

To add one, save it as `packs/<id>.json` and add the file name to `packs/index.json`. `node test/rhythm.test.js` checks that every pack is listed and imports cleanly. The same file can also be pasted into Import.

## Hands-free start

So you don't have to put the violin down between runs: play and hold a drill's first note (about ¾ s) to start it. On the results, every button that starts a drill has its own note: the drill's own first note goes again and the next drill's (or the **Move on** drill's) first note moves on. When two of them start on the same note, the next drill keeps it (after a miss, going again does) and the other one gets an open string that none of them start on ("or play open D to go again"); the notes to play are shown at the top of the results. It waits for a moment without any start note first, so the last note of a run ringing on doesn't restart it. The first note you hold counts as the run's first landing (in Tempo mode it starts the count-in). Turn it off with **Hands-free start** in Settings.

## Clean landings and Place mode

**How a landing is scored (Flow, Tempo, Lock-in).** Each note is scored from where the finger first touched down: the median of its first ~80 ms (skipping the attack's first frame). If the steady pitch the app then hears is 15¢ or more away from that, the finger slid in, and the touchdown is what's scored. In Flow it also watches the note while you hold it: moving it 15¢ or more toward in tune before the next note counts as a correction too. Corrected notes are marked ↝ on the chart, their tooltip says how far they moved, and the coach counts them ("You moved the finger after it landed on 4 of 9 notes…") once it's 2 or more notes and at least 15% of the run. After a shift (or a wrong note) the way in is a slide anyway, so there only an adjustment while the note is held counts. Lock-in still scores the touchdown but doesn't count its corrections: correcting is what Lock-in is for. The 80 ms and 15¢ are starting defaults (`landing.js`), checked with synthetic audio, not published norms.

**Place mode** (under Mode, between Lock-in and Flow) practises landing cleanly, after the "Place and Play" exercise (*The Instrumentalist*, May 2019):

- Stop the bow, put the finger down, then play. The app waits for ¼ s of quiet before each note.
- A try is judged 0.32 s after it starts: clean if it touched down within the target accuracy, didn't slide 15¢ or more, and was the right note.
- Clean: the next note. Not clean: the note stays. Lift the finger, and place it again; don't wiggle it into tune. After two misses on a note, the app plays it before the next try (as does **Hear it first**).
- The run's score and medals count first tries only. The results list the notes that needed more tries. Place runs don't count toward the Path.

## When it goes off: coach's notes by context

Besides which notes were off, the coach looks at *when* they were off (`context.js`):

- **After a frame change:** an accidental (outside the drill's key), a finger moved off the spot it usually plays on that string and position (a low or high variant), or a 4x stretch. The next 3 notes in that position are compared with the *same notes in the same direction* elsewhere in the run, so a note that's always a little sharp isn't blamed on the accidental. If they're 10¢ or more off that way (2 or more notes, ¾ of them the same side), it says which way the hand went: back with a lowered finger, forward with a raised one or a stretch. Fischer: "keep the left hand in one basic position and reach the accidentals by moving the finger… Keep the thumb in one place on the neck" (*Basics*, "Chromatic scales").
- **After a shift:** the note the shift lands on, then the next 3 notes in the new position. A clean landing followed by notes off one way means the frame isn't set after arriving; the landing and the notes after it off the same way means the whole hand arrived in the wrong place.
- **Coming down vs going up:** only notes heard both ways in the run count (3 or more), and the notes after a frame change are left out. (Path skills keep their own version.)
- The **Piece tab** does the first and last for notes outside the chosen key (it has no fingering, so no shifts).
- The **practice log** adds the same across runs: `corrections`, `place`, `byDirection`, `afterShiftFrame` and `afterFrameChange`.

## Tempo mode

Choose **⏱ Tempo** under Mode to practise with a metronome. After a four-click count-in, the drill moves on with the beat. A note counts only if it's in tune *and* on time; the on-time window gets tighter at each medal level.

- Set the BPM and notes per beat (1–4). With **Tempo ladder** on, 3 passed runs in a row raise the tempo 6% and 2 misses in a row lower it 8%. In Path the skill sets the tempo.
- Press **Calibrate timing** once: after the count-in, play 8 notes on the click, alternating two open strings. This measures the delay your speakers and mic add, so early and late are judged against the click you hear.
- Results show a timing chart next to the pitch chart, and the coach flags rushing, dragging, and shifts that make you late.

## Piece tab

Record yourself playing a whole piece; you don't need to enter the music. The app splits the recording into notes and reports:

- **Intonation:** each note against the nearest equal-tempered pitch, measured on the steady middle of the note (vibrato is measured at its centre). It also lists notes that are consistently sharp or flat, and notes outside the key if you pick one. With a key, it compares the notes after an out-of-key note with the same notes elsewhere, and the same notes going up and coming down (see *When it goes off*).
- **Timing:** with the metronome on, each note against the click grid (beat, half, triplet or quarter beat) and any drift ahead of or behind the click. With it off, your own pulse, how steady it was, and the stretches where you sped up or slowed down.
- **Moments to check**, each with a ▶ button that plays that spot of the recording. The analysis is kept (the last 10 performances), but the audio only lasts until you leave the page.
- **📋 Copy report for Claude**, to talk through the performance and get drills for the weak spots.

Calibrate timing once in the metronome panel of this tab. It listens across all four strings, so it has its own calibration, separate from Tempo mode's.

## Ear tab

Two quizzes, by ear: **Flat or sharp** (relative pitch) and **Which string** (the same note on different strings), using recordings of your own violin.

### Flat or sharp

Relative pitch: G major plays up and back down, usually with one note out of tune. Tap the note that was off and say whether it was ♭ flat or ♯ sharp, or answer **All in tune** (about 1 in 4 scales have nothing wrong). The first note is the reference and is never off.

- **Stages**, built up like the Path: 1st position one octave (G3–G4), 1st position two octaves (G3–G5), two octaves through 3rd (G3–G5, shifting on D), three octaves through 5th (G3–G6). Each note's tile shows its string, finger and position, so you hear where on the fingerboard it is. Nothing is locked; the stage selected by default is the first one without 🥈.
- **How far off:** a 2-down/1-up staircase (Levitt 1971). 2 right in a row → the next wrong note is closer to in tune (50 → 40 → 30 → 25 → 20 → 15 → 12 → 10 → 8 → 6 → 5¢); 1 wrong → back a step. It settles where you're right about 71% of the time. "You hear ≈ X¢" is the mean of the last 6 turning points, once there are 4.
- **Medals** use the playing targets: 🥉 25¢, 🥈 15¢, 🥇 10¢, earned at the level where you got 2 in a row right.
- **After each answer:** ▶ As played, ▶ In tune, and ▶ That spot (the wrong note and the two before it, as played and then in tune).
- **What you miss:** per scale degree, how often you caught it flat and sharp, and how often you said "all in tune" correctly. Degrees and directions you miss come up more often.
- In tune is equal temperament from your A4 (Settings). Note length (Slow / Medium / Fast) is on the Sound card.
- **Sound:** a synthesized bowed tone (with optional ±12¢ vibrato), or **My violin** once every note of the stage is recorded (see below). Recordings are retuned to the exact note first, then the wrong note is put in.

### Which string

The same note sounds different on each string (an open string rings; the G string is darker than the A). Only the string can be heard: the same note on one string in two positions uses the same length of string, so the quiz asks for the string, and shows the fingering.

- **Stages:** 1st position, open or 4th finger (D4, A4, E5: 6 recordings); through 3rd (9 notes, 18 recordings); through 5th (13 notes, 28). A4 and E5 can be played on three strings by 5th position.
- **Compare two:** the same note on two strings: which was on the lower string? 🥉 at 8 of the last 10. **Name the string:** one note: which string? 🥈 at 14 of the last 20, 🥇 at 18 of the last 20. Guessing gets 8/10 or 14/20 about 5% of the time. Compare is picked until 🥉, then Name; you can pick either.
- After each answer, ▶ plays the note on each string, low to high. Notes you miss come up more often.

### Recording your violin

The **Your violin** card lists the recordings the current stage needs (both quizzes). **● Record** goes through them string by string, low to high: play and hold the note shown. Once it has been steady within ±70¢ of the note for 1.2 s, the app keeps that plus the start of the note (the bow's attack), chimes and moves on. Before each next note it waits for a moment without the last one. You can re-record or delete a single note in the list.

- Each recording is played back retuned to the exact note (from its measured average pitch) and at a common loudness, so pitch and volume don't give the string away.
- The drone is switched off while recording. With iPad mic mode on, Safari's voice processing changes the sound a little.
- Recordings stay in this browser (IndexedDB, about 100 KB each). They aren't synced or in the progress file, and Reset all progress keeps them.

## Custom drills with Claude

The **My drills** tab lets you import drills written for you, for example by Claude after you describe a specific problem. It also exports reports so Claude can see how you did.

1. Press **Copy format for Claude** on that tab and paste it into your conversation with Claude. The format is also in `drills.js` (`FORMAT_DOC`).
2. Describe the problem. Paste Claude's drill JSON into **Import**; code fences and surrounding text are fine. If something's wrong, you get per-note error messages you can paste back.
3. Practise it like any other drill. Afterwards, press **📋 Copy report for Claude** (in the results, or on My drills). The report holds the drill, your last 5 runs note by note (cents, wrong notes, shift direction), the coach's notes and per-note trends.
4. Paste the report back. Claude can spot the pattern and write the next drill.

Built-in drills keep reports too, and any report can be imported as a drill.

### Practice log: a whole session or the last few days

Per-drill reports hold one drill's last 5 runs. To find habits that repeat across drills, and to see whether Claude's drills helped, use **📋 Copy practice log for Claude** on My drills. Pick **This session**, **Today**, the last 3, 7, 14 or 30 days, or everything kept. The app keeps every run, note by note, for 90 days (up to 1,000 runs). The log starts from each drill's last 5 runs if you practised before this feature existed.

- **Patterns:** intonation after shifts up and down, by finger, position and string; corrections after landing; Place mode tries; the same notes up against down; the notes after a shift and after a frame change (see *When it goes off*); the worst spots (a pitch on a string, across every drill and spelling); common wrong notes; timing in tempo runs.
- **Progress:** the range split into an earlier and a later half, overall and per spot, plus each drill's scores and tempos in order.
- **Claude's drills:** for each imported drill, its target notes before and after you added it, measured across all your practice and not just that drill.
- **Fixes:** each Fix this note / Fix this progression, with every repetition's cents, apart from the runs.
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

