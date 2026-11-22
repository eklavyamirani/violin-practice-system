# Brief: Fingerboard Coach (violin)

The scout reads this before every run. It steers what to look for and how to rank.
The owner edits it; triage decisions update it (see [decisions.md](decisions.md)).

Status: drafted 2026-11-19 from the README and the PR history; the owner confirmed who it is for, the non-goals and the taste notes the same day (one non-goal kept of four drafted).

## Who it is for

- **First: the owner.** An adult violin learner in their first years, working through 1st, 3rd and 5th position scales and Suzuki Book 2 level pieces (The Two Grenadiers, Witches' Dance). Has weekly lessons with a teacher and practises alone between them on a Mac, iPhone or iPad, and uses Claude to write drills and practice plans and to read the reports.
- **Second: other adult self-directed learners at the same stage**, who can open the GitHub Pages copy with no install and no account.
- Not designed for: children, complete beginners who have never held a violin, advanced players, teachers managing a studio.

## Goals

1. **Play in tune, measurably.** Every note scored in cents against a reference; the thresholds are stated and adjustable.
2. **Climb a clear path**: scales from 1st position to two octaves through 5th, with mastery and spaced review, plus ear training that matches it.
3. **Work up real pieces**: rhythm drills and packs for passages the owner is learning.
4. **Practice without friction**: hands-free start, Next up, timed plans; the violin stays under the chin.
5. **Claude in the loop**: anything worth discussing can be copied out as a report, and anything Claude writes (drills, plans) can be pasted back in.
6. **Own your data**: works offline in the browser; sync across devices on the owner's platform is optional.

## Non-goals

- Native apps or anything that needs an install. It stays a web page that runs offline.

The owner explicitly did **not** rule out lesson content, sheet music or score following, or social and sharing features (2026-11-19). They are in scope when the evidence is strong.

## Context that matters for ranking

- The owner has a **teacher with weekly lessons**. The app is for the practice between lessons; things that make the next lesson better (what to show or ask the teacher) are in scope. It does not replace the teacher.

## Taste

- Evidence over vibes: thresholds come from a stated source or are labelled "starting defaults", and are checked with synthetic audio in tests.
- Plain words and numbers on screen (cents, ms, medals with stated criteria). No dark patterns, no streak guilt.
- Small, testable increments. Each change says what it was verified with and what was not.
- Privacy by default: nothing leaves the browser without sign-in; recordings stay on the device.
- Copy/paste with Claude over built-in AI calls.

## What the scout should favour

- Problems the owner will hit in the next months at this stage (shifting, 3rd and 5th position, tone and intonation in pieces, practising efficiently).
- Real complaints and questions from violin learners (forums, Q&A, issues of comparable tools) over guesses.
- Changes that use the data the app already keeps (note history, practice log, piece analyses).

## What the scout should avoid

- Anything in Non-goals, and anything the app already does (check `docs/guide.md`).
- Ideas rejected in [decisions.md](decisions.md), unless new evidence answers the stated reason; then say so and cite the decision.
