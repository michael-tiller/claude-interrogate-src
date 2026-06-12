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
   file.
2. **Planning.** Enter Claude Code plan mode for the implementation design. Plan
   approval (ExitPlanMode) is a harness gate in BOTH modes. On approval → record
   `plan-approved`.
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
   key, phases walked, verify result, commit hash, footer verb.

## Hard rules

- Keys come only from `design_taskout_export` — never derived, never guessed.
- Flay never picks work, never reorders the roadmap, never rewords a task.
- No git hooks; everything is in-session orchestration.
- Downstream blades read the state file advisorily; flay never calls a tracker.
