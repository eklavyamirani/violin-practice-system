# Decision history

Every triage decision on a scout proposal, newest last. The scout reads this before each run (see [run.md](run.md)) and cites an entry when it brings an idea back.

One line per decision, appended by the session where the owner decided (see [README.md → Recording a decision](README.md#recording-a-decision)):

```
- <YYYY-MM-DD> · <proposal id> · <issue #n or "draft"> · <status> · <title> — <owner's one-line reason>
```

`status` is approved, rejected, parked, prototyped, promoted or expired. A later line for the same id supersedes an earlier one. The reason is the owner's own words, shortened only if the owner agrees.

## Log

- 2026-11-19 · violin-2026-11-19-test · #16 · rejected · [test] Round-trip check of the proposal format — format test of the parser, not a real proposal
- 2026-11-19 · violin-2026-11-19-1 · #17 · approved · Keep piece recordings so you can hear progress over weeks — no reason given
- 2026-11-19 · violin-2026-11-19-2 · #18 · approved · Score against the drone and pure open strings, not only equal temperament — no reason given
- 2026-11-19 · violin-2026-11-19-3 · #19 · approved · An eyes-off pass to finish a drill — no reason given
- 2026-11-19 · violin-2026-11-19-4 · draft · parked · Long tones with a tone meter — "For tone meter, I don't fully understand it or the need."
- 2026-11-19 · violin-2026-11-19-5 · draft · rejected · Lesson card: the teacher's assignments in, a since-last-lesson sheet out — "Lesson card is too much. I will let my claude session manage my lessons and drills for now."
- 2026-11-19 · watch-out-notes · #27 · approved · Watch-out notes before you start — no reason given (approved for a prototype; written by the demo kit, not a scout run, and filed on 2026-11-20 once prototype #24 existed)
- 2026-11-19 · watch-out-notes · #27 · prototyped · Watch-out notes before you start — "I like the demo. We should deploy it to a preview deployment."
