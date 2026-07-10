---
name: claude-interrogate-flay
description: Execute one human-assigned taskout item through the full SDLC chain — plan mode, implementation, verification, and a Seam 7 footered commit — pausing for the human at every phase boundary (or running through in explicit auto mode). Use when the user assigns a task by its interrogate key via /flay or /flay-auto, or says "flay <key>". Never use this to pick or recommend which task to work on — assignment is the human's.
---

# Claude Interrogate: Flay (task execution harness)

Flay drives ONE human-assigned task through the existing SDLC stations. It is a
conductor, not an instrument: it adds no machinery of its own. The human picks the
task (taste is theirs — never suggest, rank, or recommend); flay makes the chain
after the pick consistent (correctness is the tool's).

Arguments: `<task-key> [output-dir]`. The mode comes from the invoking command:
`/flay` = HITL (pause at EVERY phase boundary for an explicit go-ahead);
`/flay-auto` = full-auto (no phase pauses — but harness gates still apply: plan-mode
approval and permission prompts can never be waived). Default is always HITL.

## State file: `.captain-sdlc/flay-state.json`

Single JSON object (NOT an array — the WIP limit of 1 is enforced by structure):

```json
{
  "schema_version": 1,
  "task_id": "<interrogate key>",
  "rcId": "<rc id>",
  "taskText": "<item text from the export>",
  "mode": "hitl",
  "phase": "implementing",
  "status": "in-progress",
  "baseBranch": "dev",
  "branch": "feat/<slug>",
  "startedAt": "<ISO>", "updatedAt": "<ISO>",
  "history": [{ "phase": "assigned", "at": "<ISO>" }]
}
```

`status` is the coarse, tracker-facing rollup — set to `"in-progress"` on the first
write at Assigned and left there for the whole active life (the fine-grained `phase`
still tracks the SDLC station). It is the in-progress hook a downstream tracker reads
(see **In-progress hook**); additive, so a legacy file without it is still valid.

`baseBranch` is the integration branch flay started on (the PR target at Done);
`branch` is the per-task `feat/…` working branch, created at Implementing. Both are
additive — a legacy file without them predates branch discipline (treat the current
branch as base, skip the auto-PR). See **Branch discipline**.

Rewrite it at EVERY phase transition. Delete it on done or abandon, and prepend an
outcome line to `.captain-sdlc/flay-log.md` (e.g. `- flayed <key>: committed <hash> as Needs-QA`).
Create `.captain-sdlc/` lazily. `flay-log.md` is the DURABLE, committed flay audit trail (newest-first, created lazily) — NOT churning state, so the consuming project gitignores
`flay-state.json` (it is churning local state — see captain-sdlc conventions).
Unknown `schema_version` in an existing file → refuse and ask the human.

## Ledger: `.captain-sdlc/blocked-hitl.json`

Flay-owned, also churning local state — gitignore it alongside `flay-state.json`.
It records keys an auto run downgraded to HITL, keyed by task key (entries are
created lazily on the first downgrade). Lifecycle:

- **Append** on the auto→HITL downgrade at Verifying (phase 4).
- **Clear the entry** at Done (phase 6), when the HITL resume completes and the
  state file is deleted.
- **Auto-clean** when the item flips to `[x]` (the work is done — the marker is moot;
  the sync side that observes the checkbox flip drops the entry, same trigger that
  retires the `blocked-hitl` tag).
- **Manual reset:** to clear a stranded marker by hand, delete its entry from the
  JSON (or delete the whole file to reset all). Use this if a downgrade was logged
  but the flay was abandoned outside the Done path.

The Blocked-detector at Assigned reads this ledger to cancel `/flay-auto` (and let
`/flay` proceed) on a downgraded key.

## In-progress hook (for downstream trackers)

flay marks the ticket in-progress the moment it commits to the work — the Assigned
write sets `status: "in-progress"` in `flay-state.json`. That field is both the local
in-progress record and the seam a tracker (the ClickUp mirror) consumes. flay itself
still never calls a tracker (Principle 1): it emits the state; the blade reads it.

Contract for a consumer (advisory, best-effort — a missing/disabled mirror changes
nothing about the flay):

- **In-progress** ⇔ `.captain-sdlc/flay-state.json` exists with `status:
  "in-progress"`. Read `task_id` (the immutable ticket key) and `rcId`, map the key
  to the tracker's in-progress status. A legacy file without `status` → treat
  file-presence as in-progress.
- **No longer in-progress** ⇔ the file is gone (deleted at Done/abandon). flay does
  not encode the terminal status here — that arrives via the Seam 7 commit footer
  (`Needs-QA:` / `Completes:`) the release-clickup blade already mirrors.

This is in-session orchestration: flay only writes the signal. A consumer reads it on
its next `clickup-sync`, and the ClickUp mirror plugin additionally ties a PostToolUse
hook to this write so — when its time-tracking opt-in is on — the begin is mirrored in
real time. Either way flay never calls the tracker: the signal is observed, not pushed.

## Branch discipline

flay owns the **per-task tier** of git hygiene: it never edits or commits on the base
branch. Each task gets its own `feat/<slug>` branch, created off the integration base
at Implementing and landed via a PR at Done — `dev` is a sink (PR squash-merged to land
the task), `main`/`master` is protected (push + PR, the human merges; never an
`--admin` bypass). The base is whatever branch flay started on, captured as
`baseBranch`. The higher tier — `dev → main`, versioning, changelog, tags — belongs to
release (claude-release), not flay. Costs almost nothing and keeps every flayed task a
reviewable unit.

## Phases

`assigned → planning → plan-approved → implementing → verifying → committing → done`

0. **Stale-state gate.** If `flay-state.json` already exists, STOP and offer:
   resume (continue from its recorded phase) or abandon (delete it, log the
   abandonment to `.captain-sdlc/flay-log.md`). Never silently overwrite — a second flay while one
   is active forces this decision first.
1. **Assigned.** Validate the key against a fresh `design_taskout_export` for its
   RC (key prefix before the first `#`). Exact match only. Unknown key → stop,
   show the export's nearby keys, let the human re-pick — never fuzzy-assign.
   Already-checked item → stop and say so (the work appears done). Then run the
   **Blocked-detector** (below); if it cancels, abort here — do NOT write the state
   file. Otherwise: **auto-load the warm spec** from the same export (the assigned
   item's `howToImplement` / `designContext`, if any) so the ticket is warm from the
   start rather than re-read at Planning; write the state file with `status:
   "in-progress"` (the in-progress hook — see **In-progress hook**); then classify the
   item for taste (see **Taste gate**) before planning.

   **Blocked-detector (pre-flight, READ-ONLY).** Before committing to the work,
   confirm it is actually runnable. This reads only — the fresh `design_taskout_export`
   plus the `.captain-sdlc/blocked-hitl.json` ledger — and never writes the roadmap,
   the tracker, or anything but its own cancel decision (Principle 1; see Hard rules).
   Locate the assigned item in the export and check, in order:
   - **`blocked-dep`** — the item carries a `blockedBy` list. For each listed blocker
     key, find it in the same export and read its `checked` flag. If ANY blocker has
     `checked === false`, the work is not runnable yet → **cancel in BOTH modes**:
     `Blocked by <key> "<text>" — owned by <owner | "unassigned">. Resolve it / talk
     to <owner> first.` (`<text>` is the blocker item's text; `<owner>` is the
     blocker's `owner`, else the assigned item's, else `"unassigned"`).
   - **Stale blocker reference** — a `blockedBy` key that is ABSENT from this (clean)
     export. Ticket keys are now immutable (they persist inline and survive reweords),
     so absence means the blocker ticket was DELETED or the anchor is a typo/wrong key —
     a dangling reference, NOT an unblock. **Cancel** with a stale-reference repair
     message — name the missing key and say the blocker was likely removed or mistyped;
     the human or `/taskout`-maintenance must repair the `- Blocked-by:` anchor. Never
     report it as "unblocked" and never proceed.
   - **`blocked-hitl`** — the item's key has a live entry in
     `.captain-sdlc/blocked-hitl.json` (a downgrade marker from a prior auto run).
     **Cancel in auto** (`/flay-auto`): auto must not resume work an earlier auto run
     punted to a human — `This task was downgraded to HITL on a prior run; resume it
     with /flay.` **Proceed in HITL** (`/flay`): the human IS resuming, which is
     exactly what the marker waits for.

   Cancel = abort the Assigned phase before any `flay-state.json` is created; report
   the reason and stop. The detector adds no machinery: it surfaces the blocker, the
   human (or `/taskout`) resolves it in the markdown.
2. **Planning.** Enter Claude Code plan mode for the implementation design. The
   assigned item's spec was already loaded at Assigned. **Warm vs cold:**
   - *Warm* — the item carries `howToImplement` / `designContext` (taskout already
     grounded it in a Plan/ doc). Carry that spec forward as the plan's spine:
     verify it against the live code, fill gaps, correct drift. Do NOT re-derive it
     from scratch — that repeats work already done and loses the captured *why*.
   - *Cold* — no spec on the item. Derive the plan from scratch as normal.

   **Plan review gate (before approval).** A freshly drafted plan is a draft, not
   the plan. Run it past two independent critics, fold their blocking issues in,
   and only then take it to the human:
   - *Critic 1 — Claude plan-reviewer.* Launch the `claude-interrogate:plan-reviewer`
     subagent (Agent tool, `subagent_type: claude-interrogate:plan-reviewer`) on the
     drafted plan. It ships in this plugin, so it is always present alongside this
     skill. It returns a structured critique ending in exactly one line:
     `VERDICT: NEEDS REVISION` or `VERDICT: IMPLEMENTATION READY`.
   - *Critic 2 — codex out-of-model gate (best-effort).* Runs only after Critic 1 is
     satisfied. If `codex` is on PATH, get an out-of-model second pair of eyes —
     read-only so it critiques but never edits.
     Append its output to the same artifact instead of dumping stdout into context:
     `codex exec -s read-only "<brief>\n\n<the full plan text>" >> .captain-sdlc/plan-review.txt 2>&1`,
     then read codex's verdict back from that file. `<brief>` is
     "Act as a ruthless principal-engineer plan reviewer; do not write code. Ground
     every load-bearing claim in the actual repo (an empty grep is not proof of
     absence) — you may read `.captain-sdlc/plan-review-grounding.txt` for facts the
     first critic already verified, to skip re-grepping them. Hunt for gaps,
     speculative abstraction, conflicts with existing conventions, unverified
     assumptions, scope creep, and tests that cannot fail when the logic changes.
     List blocking issues (each with location, why it matters, and a concrete fix),
     then end with exactly one line: VERDICT: NEEDS REVISION or VERDICT:
     IMPLEMENTATION READY." codex missing or erroring → note
     "codex unavailable — skipped" and proceed on Critic 1 alone. Never block the
     gate on codex.

   Address every blocking issue — revise the plan, or record why it does not apply.
   **Run one critic at a time** so you never spend a critic's call on a plan the other
   would still reject. Alternate:
   1. **Claude until READY.** Run Critic 1 on the current plan, revise against its
      blocking issues, re-run Critic 1. Loop until it returns `IMPLEMENTATION READY`
      on a revision you did not edit afterward.
   2. **Then codex on that exact revision.** Run Critic 2 with no edits in between. If
      it returns READY too, both critics have approved the *same* unedited plan →
      **gate clears**.
   3. **Any codex fix sends it back to Claude.** A READY verdict covers only the exact
      plan text the critic saw, so folding codex's blocking issues in yields a new
      revision that invalidates Claude's READY — return to step 1 and re-validate it
      with Claude before codex sees it again.

   There is no round limit: each revision is a real improvement, so recurse until one
   revision survives both critics back-to-back with no edits after either verdict.
   Never silently drop a blocking issue. HITL: show each verdict and its blocking list
   as it lands; the human may waive what remains to clear early. Auto: keep cycling —
   but if the two critics deadlock (each rejecting the change the other required), the
   tool can't resolve that conflict alone → announce it and downgrade to HITL rather
   than oscillate forever. If codex is unavailable, step 1's Claude READY clears the
   gate on its own.

   Read each critic's verdict from the artifact, not its raw return. Whichever critic
   ran writes its review to `.captain-sdlc/plan-review.txt` — Critic 1 overwrites it
   each round; codex appends its section when its turn comes. Read THAT file for the
   current critic's verdict and blocking list; it is the single read target, rewritten
   fresh as the alternation proceeds, so re-reviews don't re-scan verbose prose.
   Critic 1 also keeps a longer-lived grounding cache at
   `.captain-sdlc/plan-review-grounding.txt` where it records verified repo facts and
   reads them back across rounds (codex may consult it), so they don't re-grep the same
   facts. When this review phase ends — the gate clears, the human waives, or auto
   downgrades on a deadlock — DELETE both files, so the next task's review phase starts
   fresh. (Churning local state like the rest of `.captain-sdlc/`; gitignore them
   alongside `flay-state.json`.)

   Plan approval (ExitPlanMode) is a harness gate in BOTH modes. On approval →
   record `plan-approved`.
3. **Implementing.** First put the work on its own branch — **flay never edits on the
   base branch.** From a clean `baseBranch` (the branch flay started on, recorded at
   Assigned), create and switch to a `feat/<slug>` branch (slug from the task key,
   sanitized — no `#`, e.g. `feat/<epic-slug>-<digest>`); record `branch` in the state
   file. On resume, switch to the recorded `branch` (create it off `baseBranch` if
   missing). If `baseBranch` is the protected default (`main`/`master`), still branch
   off it but warn that the Done PR targets a protected base. Then execute the approved
   plan. HITL: confirm before starting; auto: proceed.
4. **Verifying.** Run the project's OWN verify commands — from its CLAUDE.md,
   package.json scripts, or equivalent. Never invent a test command; if none
   exists, say so and let the human decide what verification means here.
   - HITL: failures → show output, human decides next step.
   - Auto: ANY verify failure → announce "downgrading to HITL" and switch modes
     permanently for this flay. Never retry-loop. On the downgrade, record it in TWO
     places: (a) write `downgradedAt` (ISO) and `downgradedPhase` (`"verifying"`) to
     `flay-state.json`; (b) append the task key to `.captain-sdlc/blocked-hitl.json`
     (create the file lazily as a JSON array/object keyed by task key — match the
     ledger shape the Blocked-detector reads). This `blocked-hitl` marker makes a
     later `/flay-auto` on the same key cancel (it must not silently re-attempt the
     punted work), while `/flay` (human resuming) proceeds past it.
5. **Committing.** Stage the work, then follow the task-footers flow
   (claude-release-clickup) if installed — it will default to this key from the
   state file; otherwise compose the footer per Seam 7 directly. Before the footer
   lands, re-validate the key against a FRESH export — if it retired mid-flight
   (item reworded), surface it and let the human re-pick; the commit must carry an
   exact live key. Footer verb:
   - HITL: ask the human — `Completes:` or `Needs-QA:`?
   - Auto: default `Needs-QA:` (unwatched work is exactly what QA exists for);
     only use `Completes:` if the human pre-authorized it when invoking.
   Use `Implements:` instead when the commit advances but does not finish the item.
6. **Done.** **Land the branch first:** push `branch` and open a PR into `baseBranch`
   (use `gh pr create` when available; else push and tell the human to open it). If
   `baseBranch` is the protected default (`main`/`master`) → push + open the PR + STOP
   for the human to merge (never `--admin`-bypass a protected branch). Else (a sink like
   `dev`) → merge the PR (squash) and delete the feat branch, landing the task. HITL
   confirms the merge; auto merges a sink but always stops on a protected base. Then
   delete the state file AND clear this key's entry from
   `.captain-sdlc/blocked-hitl.json` if present (the HITL resume completed, so the
   downgrade marker has served its purpose — leaving it would wrongly cancel a future
   `/flay-auto` on the same key). Prepend the `.captain-sdlc/flay-log.md` outcome line, report: key,
   phases walked, verify result, commit hash, footer verb. If the item was
   taste-laden and vibe-shipped, also append its finalize-UI follow-up to
   `.captain-sdlc/taste-debt.md` (see **Taste gate**).

## Taste gate (protect the HITL taste moments)

Some items can only be finished *well* with human taste — art, UX, UI, layout,
icon, copy, the *feel* of an interaction. Correctness is the tool's; **taste is the
human's**, so flay must never let auto mode quietly make taste calls on the human's
behalf.

At **Assigned**, after the key validates, classify the item. Treat it as
*taste-laden* when its text (or the obvious implementation) touches a UI / panel /
modal / screen / HUD, a cursor or designator tool's *feel*, an icon / sprite / art /
color / theme, or layout / spacing / wording — anything where a screenshot is the
real acceptance test. When unsure, assume taste-laden.

For a taste-laden item, push UP this ladder — best outcome first:

1. **Collaborate (preferred).** Work the taste decisions out *with* the human,
   interactively — a UI built together, not handed over. HITL already affords this;
   in **auto, STOP at Assigned**, say the item needs taste, and offer to drop to
   collaborate.
2. **Socratic-into-attempt (automation ceiling).** If the human won't sit in the
   loop, first run a full Socratic interview on the taste decisions (placement,
   naming, icon, layout, feel — enumerate options, don't default them), fold the
   answers into ONE attempt, and expect human verification after. This is as
   automated as a taste-laden item gets.
3. **Vibe-based (fallback).** Full-auto on a taste-laden item is allowed ONLY when
   the human explicitly opts in for this item ("just vibe it"); record the opt-in in
   the state file's `history` note.

Auto never *silently* clears this gate — a taste-laden item with no recorded opt-in
forces the choice above before `implementing`. And `Completes:` on a taste-laden
item requires the human to have actually SEEN the result (screenshot / live check),
not just a green build; otherwise it is `Needs-QA:`.

**Vibe leaves a trail.** Whenever a taste-laden item ships via the vibe-based path —
or any taste-laden commit the human did not collaborate on or has not yet seen —
append a follow-up *finalize-UI* task to `.captain-sdlc/taste-debt.md`: one `- [ ]`
line naming the element, what was vibed (icon reused, layout guessed, feel un-QA'd…),
and the commit + key. This is the holding pen for deferred polish (e.g. a research
panel, trait/moodlet strips). A human promotes each into a real Targeted item via
`/taskout`; because it is taste-laden, flaying it later trips this gate again — so
the vibe path **forces the HITL eventually**, it never buries the taste work.
Log the follow-up even when it is tiny — small, sharply-scoped tasks are the goal
here, never a reason to skip the trail.

## Hard rules

- Keys come only from `design_taskout_export` — never derived, never guessed.
- Warm tickets (export carries `howToImplement` / `designContext`) carry their spec
  forward at Planning; re-derive from scratch only for cold tickets.
- Flay never picks work, never reorders the roadmap, never rewords a task. The
  Blocked-detector is READ-ONLY too: it reads the export + `blocked-hitl.json` ledger
  and may only cancel; it never writes the roadmap or a tracker. A surfaced blocker /
  stale reference is repaired by the human or `/taskout`, not by flay.
- No git hooks; everything is in-session orchestration.
- Per-task branch: flay edits on a `feat/<slug>` branch (created at Implementing) and
  lands it via a PR into `baseBranch` at Done — never commits to a protected branch
  (`main`) directly (see **Branch discipline**).
- Downstream blades read the state file advisorily; flay never calls a tracker. The
  `status: "in-progress"` field is the begin-of-flay hook a tracker (ClickUp mirror)
  consumes — flay emits it, the blade reads it (see **In-progress hook**).
- Taste-laden items (art/UX/UI) trip the **taste gate**: auto must push for
  collaboration or a Socratic-into-attempt — never silently vibe a taste call.
