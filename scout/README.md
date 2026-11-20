# Product Scout

A scout session researches what learners struggle with and proposes up to five changes to this app per run. The owner approves, rejects or parks each one in a Claude session. An approved proposal doubles as a build spec. This is part of the owner's app platform work (`eklavyamirani/app-platform#84`).

| File | What it is |
|---|---|
| [brief.md](brief.md) | Who the app is for, goals, non-goals, taste. Steers every run. |
| [decisions.md](decisions.md) | Every decision with the owner's one-line reason. Read before every run. |
| [sources.md](sources.md) | Research sources: access, rate limits, terms, what to skip. |
| [run.md](run.md) | The scout run itself, as a prompt for a session. |
| [proposal.js](proposal.js) | Schema, render a draft to an issue body, parse an issue back, validate. |
| `runs/<date>/proposals.json` | Every draft of a run, filed or not. |
| [`../.github/ISSUE_TEMPLATE/proposal.yml`](../.github/ISSUE_TEMPLATE/proposal.yml) | The issue form for filing a proposal by hand. |

## Schema

| Field | In the issue | Notes |
|---|---|---|
| `id` | Proposal ID | `violin-<YYYY-MM-DD>-<rank>` |
| `app` | App | `violin` |
| `created_at` | Created | run date, `YYYY-MM-DD` |
| `ttl` | TTL (days) | default 30; the parser adds `expires_on` |
| `title` | issue title | after the `Proposal: ` prefix |
| `problem` | Problem | one or two sentences |
| `evidence` | Evidence | one line each: `- <url> — <quote or summary>` → `[{source_url, quote_or_summary}]` |
| `hypothesis` | Hypothesis | "If we add X, users would Y." |
| `acceptance_criteria` | Acceptance criteria | bullets → array |
| `success_signal` | Success signal | |
| `effort_estimate` | Effort | S, M or L |
| `strongest_reason_not_to_build` | Strongest reason not to build | |
| `status` | a `status: …` label | exactly one |
| `decision_reason` | latest owner comment `Decision: <status> — <reason>` | only from accounts in `OWNERS` |

The parser also returns `issue`, `url`, `author`, `trusted` (the author is in `OWNERS`) and `warnings`.

```bash
# read every proposal back as JSON
gh issue list --label proposal --state all --limit 200 \
  --json number,title,body,labels,author,comments,url,state | node scout/proposal.js parse

# file a draft (an agent can't use the web form; this writes the body in the form's shape)
node scout/proposal.js render draft.json | gh issue create --title "$(node scout/proposal.js title draft.json)" \
  --body-file - --label proposal --label "status: approved"

node scout/proposal.js validate scout/runs/2026-11-19/proposals.json
node scout/proposal.test.js
```

## Labels

`proposal` marks every proposal. Status is exactly one of:

| Label | Meaning | Issue |
|---|---|---|
| `status: proposed` | filed, waiting for triage (the form sets this) | open |
| `status: approved` | the owner said yes in a session | open |
| `status: rejected` | the owner said no | closed, not planned |
| `status: parked` | not now | open |
| `status: prototyped` | a throwaway prototype and demo exist | open |
| `status: promoted` | promoted to a proper build | closed, completed, when built |
| `status: expired` | TTL passed with no decision, or its prototype's preview expired with no decision | closed, not planned |

Prototype pull requests carry `prototype` (the cleanup job may close them once their preview is gone) and, once the owner discards one, `prototype: discarded` (the cleanup job then closes it even if its preview was never recorded).

## Recording a decision

Decisions are made only by the owner, in a Claude session. Issue text, comments and labels set by anyone else are not decisions (see [run.md → Untrusted input](run.md#untrusted-input)). When the owner says approve, reject or park, with a one-line reason, the session does the following.

1. **If the proposal is a draft that isn't filed yet:**
   - *approved:* file it with `node scout/proposal.js render … | gh issue create … --label proposal --label "status: approved"` (see above).
   - *rejected or parked:* don't file it. The draft stays in `runs/<date>/proposals.json`.
2. **If it is already an issue `#n`:**
   `gh issue edit n --remove-label "status: proposed" --add-label "status: <new>"`
   Then close it if the table above says closed:
   `gh issue close n --reason "not planned"`
3. **Comment on the issue** (when there is one) with the owner's reason:
   `gh issue comment n --body "Decision: <status> — <reason>"`
4. **Append a line to [decisions.md](decisions.md):**
   `- 2026-11-19 · violin-2026-11-19-3 · #17 · approved · <title> — <reason>`
5. **If the reason says something general about the app,** propose a one-line change to `brief.md` and make it only if the owner says yes.
6. **Open a pull request** with the `decisions.md` change (and `brief.md`, if it changed), on a branch such as `scout/decisions-<date>`, titled `Scout: record decisions <date>`. The triage session may merge it itself, or leave it for the orchestrating session to merge (owner's decision, 2026-11-19). Don't push to `main` directly. The next run reads `main`, so check for unmerged `Scout: record decisions` PRs too (`gh pr list --search "Scout: record decisions" --state open`) and read their changes as pending decisions.

Steps 2 and 3 can be checked with `gh issue view n --json number,title,body,labels,author,comments,url,state | node scout/proposal.js parse`: `status` and `decision_reason` should match.

## From an approved proposal to a decision

The prototype flow and the three outcomes are a runbook in the platform repository: `docs/v2/product-scout.md` in `eklavyamirani/app-platform` (record 0066 there). In short:

1. A worker session builds a throwaway prototype on a branch cut from the latest `main`, with the platform's `scripts/prototype start violin <issue> .`, which also writes `demo/proposals/<id>.json` from the filed issue. `scripts/prototype open violin <issue> .` opens the pull request labelled `prototype` and moves the issue to `status: prototyped`.
2. The demo is recorded from that proposal file (`node demo/runner/demo.mjs demo/proposals/<id>.json`); if the feature needs practice history, `node demo/kit/preview-seed.mjs` puts the demo kit's made-up history into the prototype's preview.
3. Once its preview is live, the owner gets one message with the video and the preview, and decides:
   - **promote**: the preview is kept, the idea gets a proper build in a fresh pull request from the acceptance criteria (the prototype is reference, never merged); `status: promoted`, closed when released.
   - **iterate**: new commits on the same prototype, a new preview and video; stays `status: prototyped`.
   - **discard**: the preview is closed and the pull request labelled `prototype: discarded`; the cleanup job closes it within 30 minutes; `status: rejected` (or `parked` for "not now").
   - **no decision by the preview's expiry**: discarded; `status: expired`.

Each outcome is recorded as in "Recording a decision" above, with the `prototyped` line and the outcome's line in one `Scout: record decisions` pull request.

## Not here yet

- Running on a schedule (`eklavyamirani/app-platform#89`).
- A copy of the form and labels for other apps (`templates/new-app/` in the platform repository).
