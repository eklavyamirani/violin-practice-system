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

## 2026-11-20 · The prototype cleanup job also runs on every push to main, and the flow starts it itself
- Decided by: the orchestrating session, on the owner's behalf (eklavyamirani/app-platform records 0063, 0066 and 0067; reversible)
- Decision: `.github/workflows/preview-cleanup.yml` also runs on `push` to `main`; the 30-minute schedule and `workflow_dispatch` stay, but the schedule is best effort. The session working on a prototype starts the job once with `gh workflow run preview-cleanup.yml -R eklavyamirani/violin-practice-system --ref main` after its preview goes live and after it is discarded or closed (app-platform `docs/v2/product-scout.md`). The job also reads the default branch from the API when the event does not carry it, so its "commit is on main" check for images never runs against an empty name.
- Rejected: relying on the schedule alone — GitHub started none of the runs at 06:41, 08:41, 10:11 or 10:41 UTC on 2026-11-20, so nothing was recorded or cleaned up without a manual start. A token from the platform repository to start the job here — a long-lived cross-repository credential. `pull_request` or `pull_request_target` triggers — a write-capable job started from pull requests on a public repository.
- Revisit if: GitHub's scheduled runs become reliable here, or a push to `main` starts the job often enough to matter.

## 2026-11-20 · Scheduled scout runs file nothing before triage
- Decided by: the orchestrating session, on the owner's behalf (reversible; within the owner's rule that agents act only on the owner's yes in a session)
- Decision: a scout run, scheduled or not, files no issues by itself (`scout/run.md` "Filing mode: drafts first"). After the owner's reply, the run's own session files the approved proposals with `status: approved` and a `Decision:` comment, and opens the `Scout: record decisions <date>` pull request. Where and how often runs are scheduled is still with the owner (eklavyamirani/app-platform#89).
- Rejected: filing every draft as `status: proposed` before triage — public issues for ideas the owner has not seen, and noise for the TTL to expire.
- Revisit if: the owner asks to see proposals as issues before triage (switch the filing mode line in `scout/run.md`).

## 2026-11-20 · A draft that looks like a rejected or parked idea must say what it revisits
- Decided by: the orchestrating session, on the owner's behalf (reversible)
- Decision: drafts carry `revisits` (`null`, or the decision id and what changed). `node scout/proposal.js validate` fails a draft whose title roughly matches a rejected or parked title in `scout/decisions.md` unless `revisits` names that decision, and `node scout/proposal.js triage` renders the owner's message with a "Previously:" line for every proposal.
- Rejected: the prompt alone (`scout/run.md` asking the scout to read the history) — nothing checked it, so nothing stopped a repeat. Exact title matching — a reworded repeat would pass. Judging similarity by problem text or an AI check — heavier, and the owner sees every revisit in the message anyway.
- Revisit if: the rough title match lets a repeat through, or flags so many different ideas that `revisits` becomes boilerplate.

## 2026-11-20 · The demo runner's upload host has a default in this repository
- Decided by: the orchestrating session, on the owner's behalf (reversible)
- Decision: `demo/runner/publish.mjs` keeps a default upload host, so a session only needs the token to publish a demo. `DEMO_UPLOAD_HOST` overrides it. The token is never in the repository; it comes from the environment or a file on the recording machine.
- Rejected: taking the host only from the environment — the name was already public in the pull request that added it, the platform's domain is already named in this repository's cleanup job, and the host accepts nothing without the token. Keeping the publish step out of this public repository — every app's recorder would then need a private companion to finish a demo.
- Revisit if: requests from strangers to the upload host become noise for the owner, who is told about every request to it.

## 2026-11-20 · The demo kit contract covers server-backed apps
- Decided by: the workout demo kit session's findings (eklavyamirani/workout-app#46), accepted by the orchestrating session on the owner's behalf
- Decision: `demo/CONTRACT.md` now lets a kit start a database and API with the app's own local-development tooling (isolated per session, on loopback, nothing left running after `close()`, a stop command for leftovers), load data through the app's own data path (browser storage, or the server's seed, ideally the preview fixture), and run a stand-in sign-in service that only that session's API trusts, for fixture users only. A seed the app's tests already cover counts as the app's own code; fixed preview dates are fine when the walkthrough doesn't need recent ones. Each kit lists what it needs on the machine and how long its first and later starts take. Violin's kit is unchanged and still conforms.
- Rejected: keeping the violin-shaped wording (in-process only, browser storage, no sign-in at all) — it would make every server-backed app's kit a contract violation, although workout's kit keeps the same guarantees (isolated, nothing left running, no real credential, no change to app code).
- Revisit if: a kit needs something on the platform or a real account to record, or the runner moves to its own repository (planned when a third app needs it or it next changes for both apps; until then each app keeps a copy with a drift check).

## 2026-11-20 · A prototype's preview gets the demo kit's made-up practice history on one tap
- Decided by: the prototype-flow session, on the owner's behalf (app-platform record 0066; reversible)
- Decision: `node demo/kit/preview-seed.mjs` puts the fixture and a loader page into a prototype branch's image, served at `/__demo/load.html`; the page loads it into the browser after one tap and refuses on any address that is not a preview or local. The script refuses on `main`.
- Rejected: seeding the preview's database — progress is stored per signed-in person, so a seed would need the owner's identity in this public repository. Having the owner download production progress and load it in the preview — three taps across two sites on a phone, every round (it still works as an alternative). Shipping the loader on `main` — a release would carry a page that overwrites progress, with only the address check in the way.
- Revisit if: a preview needs data a browser can't hold (server-side features), or the made-up history misleads the owner about a feature.

## 2026-11-20 · The prototype cleanup job runs every 30 minutes and also cleans up discarded prototypes
- Superseded in part (2026-11-20, entry above): the schedule turned out to be best effort; the job also runs on every push to `main`, and the session starts it after a preview goes live and after a discard.
- Decided by: the prototype-flow session, on the owner's behalf (app-platform record 0066; reversible)
- Decision: the job runs at :11 and :41, so a live preview is recorded as a deployment on its pull request within half an hour, long before its three-day expiry. A prototype pull request labelled `prototype: discarded` whose preview is gone is cleaned up even without a recorded deployment.
- Rejected: dispatching the job by hand after each preview goes live — what the first run needed, a manual step every round. A token from the platform repository to notify this one — a long-lived cross-repository credential. Running the job on the `labeled` pull request event — a write-capable job triggered from pull requests on a public repository, for a gain of minutes.
- Revisit if: scheduled runs here start costing money, or the job closes a pull request the owner did not discard.

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
