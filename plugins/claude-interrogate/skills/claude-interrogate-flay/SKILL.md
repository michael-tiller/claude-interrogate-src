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
  "startedAt": "<ISO>", "updatedAt": "<ISO>",
  "history": [{ "phase": "assigned", "at": "<ISO>" }]
}
```

Rewrite it at EVERY phase transition. Delete it on done or abandon, and prepend an
outcome line to `scratch.md` (e.g. `- flayed <key>: committed <hash> as Needs-QA`).
Create `.captain-sdlc/` lazily; ensure the consuming project gitignores
`flay-state.json` (it is churning local state — see captain-sdlc conventions).
Unknown `schema_version` in an existing file → refuse and ask the human.

## Phases

`assigned → planning → plan-approved → implementing → verifying → committing → done`

0. **Stale-state gate.** If `flay-state.json` already exists, STOP and offer:
   resume (continue from its recorded phase) or abandon (delete it, log the
   abandonment to scratch.md). Never silently overwrite — a second flay while one
   is active forces this decision first.
1. **Assigned.** Validate the key against a fresh `design_taskout_export` for its
   RC (key prefix before the first `#`). Exact match only. Unknown key → stop,
   show the export's nearby keys, let the human re-pick — never fuzzy-assign.
   Already-checked item → stop and say so (the work appears done). Write the state
   file, then classify the item for taste (see **Taste gate**) before planning.
2. **Planning.** Enter Claude Code plan mode for the implementation design. First
   read the assigned item's spec from the export. **Warm vs cold:**
   - *Warm* — the item carries `howToImplement` / `designContext` (taskout already
     grounded it in a Plan/ doc). Carry that spec forward as the plan's spine:
     verify it against the live code, fill gaps, correct drift. Do NOT re-derive it
     from scratch — that repeats work already done and loses the captured *why*.
   - *Cold* — no spec on the item. Derive the plan from scratch as normal.

   Plan approval (ExitPlanMode) is a harness gate in BOTH modes. On approval →
   record `plan-approved`.
3. **Implementing.** Execute the approved plan. HITL: confirm before starting;
   auto: proceed.
4. **Verifying.** Run the project's OWN verify commands — from its CLAUDE.md,
   package.json scripts, or equivalent. Never invent a test command; if none
   exists, say so and let the human decide what verification means here.
   - HITL: failures → show output, human decides next step.
   - Auto: ANY verify failure → announce "downgrading to HITL" and switch modes
     permanently for this flay. Never retry-loop.
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
6. **Done.** Delete the state file, prepend the scratch.md outcome line, report:
   key, phases walked, verify result, commit hash, footer verb. If the item was
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
- Flay never picks work, never reorders the roadmap, never rewords a task.
- No git hooks; everything is in-session orchestration.
- Downstream blades read the state file advisorily; flay never calls a tracker.
- Taste-laden items (art/UX/UI) trip the **taste gate**: auto must push for
  collaboration or a Socratic-into-attempt — never silently vibe a taste call.
