# Decisions

A running log of decisions about how this repository is built and run, newest
first. Each entry says what was decided, who decided, and which alternatives
were rejected and why, so a later session does not reopen a settled question
without new information.

Product decisions about individual proposals (approved, rejected, parked) are
not here: they are in [scout/decisions.md](scout/decisions.md), which the
scout reads before each run.

Add an entry in the pull request that carries the change, or in a small pull
request of its own. Format:

```
## YYYY-MM-DD · <what was decided>
- Decided by: <the owner, in their words where possible | an agent session, on the owner's behalf>
- Decision: <one or two sentences>
- Rejected: <alternative> — <why>
- Revisit if: <what would change the answer>
```

---

## 2026-11-19 · The watch-out notes prototype goes to a preview before any promote decision
- Decided by: the owner ("I like the demo. We should deploy it to a preview deployment.")
- Decision: the prototype (PR #24, label `prototype`) is deployed as a preview that expires after three days, so the owner can try it by hand. Promote, iterate or discard is decided after that.
- Rejected: deciding from the video alone — the owner wanted to try it. Merging the prototype — a prototype is never merged; a promoted idea gets a proper build from its acceptance criteria.
- Revisit if: trying previews by hand turns out not to change decisions made from the video.

## 2026-11-19 · Demo narration on the two 5-second sections stays short
- Decided by: the owner ("We can keep the voice and the 5s sections for now. I can revisit it later as needed.")
- Decision: five seconds fits about 14 spoken words, so the problem card speaks only the title and the reason card only its first clause; the cards show the full text.
- Rejected: an optional short spoken line in each proposal — it changes the proposal record for every app; kept as the next step if the narration feels thin. Lengthening those sections — it breaks the fixed 60 seconds, which exists so that polish does not vary between ideas.
- Revisit if: the owner finds the narration too thin after more demos.

## 2026-11-19 · Demo voice: the built-in macOS voice
- Decided by: the owner (same answer as above)
- Decision: narration uses the free built-in macOS voice (`say`, Samantha).
- Rejected: a free Premium macOS voice — better sounding and recommended by the session that built the runner, but the owner chose to keep the current one for now; it needs no code change later (`DEMO_VOICE`). A paid text-to-speech service — costs money and needs an API key.
- Revisit if: demos are recorded on a machine that is not a Mac (the fallbacks there are untested), or the voice gets in the way of judging a demo.

## 2026-11-19 · Demos are recorded against the app running in the development session
- Decided by: the owner ("Demo is recorded against the session.")
- Decision: the recorder starts the app in the session with a synthetic fixture and records that. Nothing for recording runs on the platform.
- Rejected: recording against the deployed preview — the preview sits behind passkey sign-ins, so a recorder would need a robot sign-in credential. Recording on the platform itself — it would add load there for something a development machine does well.
- Revisit if: a bug that only shows on the deployed app slips past a demo.

## 2026-11-19 · Scripted audio is fed to the page directly
- Decided by: the demo runner session, on the owner's behalf
- Decision: for audio features, the recorder gives the scripted audio to the page itself; the app's own analysis code runs unchanged on it.
- Rejected: Chromium's fake microphone flags — still supported in a walkthrough, but they hang in headless Chromium on macOS. The `?sim` tone simulator alone — enough for simple tones, not for a recorded passage with deliberate mistakes.
- Revisit if: the fake microphone flags work headless on the machine that records, or a feature needs the browser's real capture path.

## 2026-11-19 · Proposals are public issues in this repository
- Decided by: the owner ("Public to start with")
- Decision: scout proposals are filed as issues here through the proposal form, with status as labels. The first run's five drafts, including the parked and the rejected one, stay in the repository ("Its fine.").
- Rejected: a private repository for proposals — it would keep ideas and competitor research out of view, but the owner chose to start in public. Dropping the rejected draft from the first run — the decision history refers to it.
- Revisit if: a proposal needs evidence that should not be public.

## 2026-11-19 · Triage decisions are written back by pull request
- Decided by: the owner ("PR. They can then complete the PRs or let you.")
- Decision: a session that records a triage decision in `scout/decisions.md` does it in a pull request, which it may merge itself or leave to the orchestrating session.
- Rejected: committing straight to `main` — the recommendation of the session that built the scout, because the file is documentation only; the owner preferred a pull request.
- Revisit if: the pull requests become noise for a one-line change.

## 2026-11-19 · The scout does not use the Reddit API
- Decided by: the owner ("Reddit api is not feasible.")
- Decision: Reddit content reaches the scout only when the owner pastes a thread into a session.
- Rejected: registering a Reddit app and requesting API access on the owner's account — not feasible for the owner.
- Revisit if: Reddit access becomes practical, with terms that have actually been read.

## 2026-11-19 · Prototype pull requests are cleaned up by a job in this repository
- Decided by: the preview lifecycle session, on the owner's behalf; the owner approved unattended cleanup with notification through GitHub
- Decision: `.github/workflows/preview-cleanup.yml` acts only on open pull requests labelled `prototype`. Once such a pull request's preview is gone, it closes the pull request and deletes its branch and its images. Ordinary pull requests are never touched.
- Rejected: having the platform's repository close pull requests here — a workflow in one repository has no write access to another, by design. Leaving prototype pull requests open — they would pile up, and prototypes are disposable by default.
- Revisit if: the job ever closes a pull request whose preview was only briefly unreachable.

## 2026-11-19 · This file
- Decided by: the orchestrating session, on the owner's instruction ("add the decision and the alternatives rejected with reasoning to the running decisions file in corresponding repos")
- Decision: this repository had no running decisions file, so this one was started at the root, as a single file with newest entries first.
- Rejected: numbered records in `docs/decisions/` as the platform repository uses — more structure than a small app needs today. Putting these in `scout/decisions.md` — that file is the product triage history the scout reads, and mixing engineering decisions into it would steer the scout with the wrong material.
- Revisit if: the file grows past what is comfortable to read in one pass.
