# Watch-out notes, round 2: fix this note, fix this progression

Throwaway prototype on `claude/proto-watch-out-notes` (violin PR 24, proposal #27). Never merged.

The owner's decision, 2026-11-21 (iterate): "I like the idea. Let's take this further. Research Molly
Gebrian's method of repetition to reinforce the correct muscle memory. It should be a "fix this note" or "fix
this progression" mode."

## 1. What Molly Gebrian recommends about repetition (research, 2026-11-21)

**Primary source:** her book *Learn Faster, Perform Better: A Musician's Guide to the Neuroscience of
Practicing* (Oxford University Press, 2024). The source is Appendix A, a list of every practice strategy by
chapter, published on her own site
([PDF](https://static1.squarespace.com/static/62d41f4e5352371c9d792542/t/66aa5bfa8bbdee7b22dd1dc4/1722440698583/Gebrian+Appendix+A.pdf)).
I read the appendix, not the book's chapters, and fetched no copy of the book.

| What she recommends | Where |
|---|---|
| **Microbreaks.** Do three correct repetitions, take a 10-second break, then do three more correct repetitions. If any repetition had errors, start over and repeat the process. | Appendix A, ch. 4, "The Fastest Way to Learn Music: Take More Breaks" |
| Practise for shorter stretches with breaks between them. During longer breaks, practise contrasting music. | Appendix A, ch. 4 |
| **Spacing.** Keep breaks short while the music is new and longer once you know it. While a passage is new, revisit it two or three times in a day. Once it is comfortable, take a day or two off from it. If unsure, take the longer break. | Appendix A, ch. 6 |
| **Interference.** When two very similar passages are new, practise them 6 hours apart, or with a nap between them. | Appendix A, ch. 4 and 5 |
| **Sleep.** A full night's sleep improves the next day's performance. Rest quietly, or take a short nap, after practising. | Appendix A, ch. 5 |
| **Serial practice, for consistency.** Play each hard spot on a list in turn. A good performance earns that spot a tick; a poor one erases the spot's ticks. The goal is five ticks per spot. She also suggests interval timers, switching task every two to five minutes, and random order. | Appendix A, ch. 7 |
| "Exact repetitions may not be the best goal": vary the tempo, articulation, dynamics and character. | Appendix A, ch. 8 |
| For intonation, use a drone instead of a tuner, and sing what you play. | Appendix A, ch. 15 |
| Focus on the sound you make, not on what the body does. | Appendix A, ch. 11 |

In a 2024 masterclass transcript, she says to take breaks between repetitions "and not just do them over and
over". Her own habit is to play a passage three times in a row without mistakes, then pause
([Musical U](https://www.musical-u.com/learn/learn-music-faster-by-doing-less-with-dr-molly-gebrian/)).

**The studies behind it**, as far as I could check:
- **Short rests:** Bönstrup et al. 2019, *Current Biology* 29(8), "A Rapid Form of Offline Consolidation in
  Skill Learning". Early gains in a motor-sequence task came in the short rests between practice periods, not
  during practice ([PMC6482074](https://pmc.ncbi.nlm.nih.gov/articles/PMC6482074),
  [NIH summary](https://www.ninds.nih.gov/News-Events/News-and-Press-Releases/Press-Releases/Want-learn-new-skill-Take-some-short-breaks)).
  I checked only the abstract and summaries. The permission check refused fetching the full text, so I have
  not verified the exact 10 s practice / 10 s rest timing myself.
  - In the Musical U talk, Gebrian describes a 10-second practice / 10-second break button study as "summer
    2021". I could not tell which paper she means.
- **Interleaving:** Carter & Grahn 2016, *Frontiers in Psychology*. Ten clarinettists' pieces practised
  interleaved were rated better than pieces practised blocked whenever raters differed
  ([PMC4989027](https://pmc.ncbi.nlm.nih.gov/articles/PMC4989027)). I read the abstract.
- **Interference:** Brashers-Krug, Shadmehr & Bizzi 1996, *Nature*. A second, opposing motor task learned soon
  after the first disrupts it, and the window is about 4 to 6 hours. I read only later papers that cite it,
  and one 2005 study did not replicate it.

**Not found, or not hers:**
- **The "overlearn by 50 % or 100 % of the tries it took" rule** appears only in a podcast summary of the
  book, credited to "research shows" and not to her
  ([Ashley Danyew, ep. 089](https://www.ashleydanyew.com/episodes/089)). Not used.
- **"Five in a row after a fix"** is a reviewer's paraphrase
  ([Interlude](https://interlude.hk/how-neuroscience-helps-musicians-learn-faster-perform-better/)). It matches
  her serial-practice goal of five ticks, not the microbreak rule.
- **Not read:**
  - The book's chapters themselves.
  - A violinist.com blog post that a search linked to microbreaks
    ([violabrain](https://www.violinist.com/blog/violabrain/20228/29335)); the permission check refused the
    fetch, so I don't know whether it is hers.
  - A violinist.com interview with her; the connection dropped.

## 2. The design

**Fix this note:** the note the Watch line flags, played on its own.
- Each repetition: land the note, then stop. The app waits for 0.3 s of quiet before it listens for the next
  one, so one long note can't count twice.

**Fix this progression:** the note before it in the drill, then the flagged note.
- If the flagged note comes in the drill after a shift or a string crossing, that approach is chosen first.
- Each repetition: play the approach note, move to the flagged note, then stop.

**What the app measures:**
- It uses the same pitch detector as a drill. A landing is the first steady pitch (220 ms) within ±60 cents of
  the target.
- **A clean repetition** is right on both counts:
  - The flagged note's landing is within the player's medal tolerance (Bronze ±25, Silver ±15, Gold ±10
    cents).
  - No wrong note was heard on the way. In the progression, the approach note only has to be the right note.
- The app is tested with synthetic audio: the demo kit's violin-like tone, scripted in cents
  (`demo/test/fix-mode.mjs`).

**The rules are Gebrian's microbreaks:**
- Three clean in a row fill a set, and a miss empties the set. After set 1 there is a 10-second break with a
  countdown, during which nothing is scored. After set 2 the fix is done.
- **One addition:** three misses in a row also get a 10-second break. This follows her advice to break off
  and reset rather than grind, and limits the frustration loop described below.

**The screen:**
- **Watch line:** two buttons under it, plus how many fixes were done today.
- **Fix panel:** set 1 and set 2 as three dots each, the last repetition (clean ±n cents, or the miss and that
  the set restarts), what to play now, the break countdown, and the rule in one line.
- **Big note card:** shows the string and finger of the note to play.

**When it is done:**
- "Come back to it once or twice more today, then let sleep do its part" (her spacing and sleep advice).
- Fix repetitions are logged in `DB.fixes`, not in the note history. The Watch line keeps judging the note
  from real drills, so the next day's runs are the test.

**What I chose between:**
- **Chosen: microbreaks on one spot.** It is her rule for building a skill, it fits "fix this note", and it
  can be measured exactly.
- **Rejected for this round: serial practice across spots** (tick marks, a miss erases them, five per spot).
  She files it under consistency in performance, not building the habit. It needs several flagged spots, and
  the Watch line flags one. It would suit a later "fix my spots" mode across every flagged note.
- **Also not in this round: variety** (different tempos, dynamics, a drone).
  - The app can't judge dynamics or articulation.
  - A drone is already a setting.
  - Tempo variety in a progression could come next.

**The strongest reason not to build it this way:** any miss the microphone hears empties the set, including a
wrong one. In a noisy room, or with a tolerance on the edge, the fix can become a loop that builds tension
instead of the habit. The three-miss break softens this but doesn't remove it.
