# References

The sources the app's design rests on, and how much weight each one carries. The in-app **Why it works** tab cites these by short name and lists them in its **Sources** card. Keep the two in step: a new claim on that tab names a source here, or says plainly that it's a design choice.

**How strong is each source?**

| Kind | Means |
|---|---|
| **Study** | A peer-reviewed experiment that measured the effect |
| **Review** | A peer-reviewed review or meta-analysis of many studies |
| **Method** | A peer-reviewed method the app implements as published |
| **Book** | An expert's synthesis of research for musicians; strong for direction, not for exact numbers |
| **Teaching** | Practitioner advice from an established teacher or journal; widely used, not tested as such |
| **Design choice** | No source; the app's own rule or threshold, labelled as a starting default |

Thresholds (15¢ slide, 80 ms touchdown, 85% pass, 6% tempo steps, ¼ s lift and the rest) are starting defaults unless a source below gives the number. None of the sources gives them.

## Sources

1. **Sogin, D. W. (1989).** An analysis of string instrumentalists' performed intonational adjustments within an ascending and descending pitch set. *Journal of Research in Music Education*, 37(2), 104–111. — **Study.** Advanced string players played descending whole-tone tetrachords sharper than the same notes ascending (as summarised in later intonation research; the full text wasn't read for this page). Used for: *Coming down is its own skill*, the up/down coach's notes, Path's two directions.
2. **Kantorski, V. J. (1986).** String instrument intonation in upper and lower registers: The effects of accompaniment. *Journal of Research in Music Education*, 34(3), 200–210. [doi:10.2307/3344749](https://doi.org/10.2307/3344749) — **Study.** Its title is about register and accompaniment; later papers cite it with Sogin for descending passages running sharp. Treat it as supporting evidence for the direction effect, with Sogin as the direct source. Not read in full here.
3. **Salmoni, A. W., Schmidt, R. A., & Walter, C. B. (1984).** Knowledge of results and motor learning: A review and critical reappraisal. *Psychological Bulletin*, 95(3), 355–386. [doi:10.1037/0033-2909.95.3.355](https://doi.org/10.1037/0033-2909.95.3.355) — **Review.** More frequent and more precise feedback helps performance *during* practice, but constant feedback can hurt what's kept afterwards (the "guidance hypothesis"). Used for: *Instant, specific feedback* and *Removing the help over time* (Hide fingering, Ears first).
4. **Shea, J. B., & Morgan, R. L. (1979).** Contextual interference effects on the acquisition, retention, and transfer of a motor skill. *Journal of Experimental Psychology: Human Learning and Memory*, 5(2), 179–187. — **Study.** Random practice order was worse during practice but better for retention and transfer than blocked practice. Used for: *Mixing and spacing your practice* (mixed reviews, Note Hunt).
5. **Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006).** Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132(3), 354–380. [doi:10.1037/0033-2909.132.3.354](https://doi.org/10.1037/0033-2909.132.3.354) — **Review** (meta-analysis of 317 experiments). Spacing practice out improves retention. The evidence is from verbal memory, not motor skills, so it supports the direction of the Path's growing review intervals (1, 2, 4, 7, 14, 30 days), not the intervals themselves.
6. **Bloom, B. S. (1968).** Learning for mastery. *Evaluation Comment*, 1(2), 1–12. UCLA Center for the Study of Evaluation of Instructional Programs. [ERIC ED053419](https://eric.ed.gov/?id=ED053419) — **Teaching** (education theory; classroom instruction, not music). Master one level before moving to the next. Used for: medals 🥉 → 🥈 → 🥇 and the Path's unlocks. The 85% pass mark is the app's own.
7. **Levitt, H. (1971).** Transformed up-down methods in psychoacoustics. *Journal of the Acoustical Society of America*, 49(2), 467–477. [doi:10.1121/1.1912375](https://doi.org/10.1121/1.1912375) — **Method.** The 2-down/1-up staircase converges on about 70.7% correct. Used for: the Ear tab's cents ladder (`ear.js`).
8. **Gebrian, M. (2024).** *Learn Faster, Perform Better: A Musician's Guide to the Neuroscience of Practicing.* Oxford University Press. ISBN 9780197680063. [Oxford Academic](https://academic.oup.com/book/57630) — **Book.** Practice as problem solving: find the exact spot that goes wrong, work on it in short focused repetitions, and use mistakes as information. Used for: the app's overall loop (coach's notes → a drill for the spot → measure again) and *Practise the hard part on its own*.
9. **Fischer, S.** *Basics*: "Chromatic scales." [simonfischeronline.com (PDF)](https://www.simonfischeronline.com/uploads/5/7/7/9/57796211/211_jan_chromatic_scales.pdf) — **Teaching.** "Keep the left hand in one basic position and reach the accidentals by moving the finger… Keep the thumb in one place on the neck. … Otherwise the hand can lose its orientation and intonation may suffer." (Read in full.) Used for: *Move the finger, not the hand* and the coach's notes after an accidental, a moved finger or a stretch.
10. **George, S. (2019, May).** Improving intonation and hand habits in first position. *The Instrumentalist*. [theinstrumentalist.com](https://theinstrumentalist.com/may-2019/improving-intonation-and-hand-habits-in-first-position/) — **Teaching.** "Place and Play": place a finger, commit, then bow; "the finger is either in the right place or it is not"; instead of wiggling it, "take the hand away, regroup, sing the pitch, and start over." Used for: *Place it, don't slide it* and Place mode.
11. **McLeod, P., & Wyvill, G. (2005).** A smarter way to find pitch. *Proceedings of the International Computer Music Conference*, Barcelona, 138–141. [Otago Tartini papers](https://www.cs.otago.ac.nz/graphics/Geoff/tartini/papers.html) — **Method.** The McLeod pitch method the app's detector implements (`pitch.js`); `test/pitch.test.js` checks it against synthesized violin tones.

## What each Why it works card rests on

| Card | Sources | Strength |
|---|---|---|
| Instant, specific feedback | 3 | Review |
| Scoring the first landing | 10 | Teaching + design choice (what "touchdown" means and the 80 ms / 15¢ are the app's) |
| Place it, don't slide it | 10 | Teaching |
| Move the finger, not the hand | 9 | Teaching; the comparison method (same notes, same direction) is a design choice |
| Tightening the target step by step | 6 | Teaching (education theory); thresholds are design choices |
| Removing the help over time | 3 | Review |
| Record yourself and listen back | — | Design choice |
| Accuracy first, then speed | — | Teaching practice, no source cited; the 6% / 8% / 3-in-a-row ladder is a design choice |
| A path, not a menu | 6, 5 | Teaching + review; the graph and intervals are design choices |
| Coming down is its own skill | 1, 2 | Study |
| Practise the hard part on its own | 8 | Book |
| Mixing and spacing your practice | 4, 5 | Study + review |
| Hear the note before you play it | — | Teaching practice, no source cited |

## Adding a source

- Check the citation (authors, year, title, venue, volume, pages, DOI) against the publisher, a DOI record, ERIC or the author's own page, not memory. Say in the entry if the paper wasn't read in full.
- Quote only what you read. If the claim comes from someone else's summary, say so.
- Add it here, add it to the **Sources** card in `index.html` (same number), and cite it on the card that uses it.
