---
description: Socratic per-RC taskout interview — break a release candidate into epic-level checklists and a definition of done
argument-hint: "<rc-id> [docs-dir]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Taskout (per-RC breakdown)

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the RC id (e.g. `M8_QUESTS`). It is required. If missing, list the RC ids declared in `roadmap.md` and ask.
2. Parse the optional second argument as the docs directory. Resolve via `claude-interrogate.json` `docsDir`, then `./docs`, then `./sample-docs`.
3. If config provides `styleTemplate`, pass it through as `style_template_path`.
4. Output directory defaults to the current working directory. Roadmap conventions come from the `roadmap` block in `claude-interrogate.json` and fall back to dirigible-style defaults.
5. Prefer the MCP prompt `/mcp__claude_interrogate__taskout <rc-id>`.
6. If MCP prompts are unavailable, call `design_taskout_start` with `rc_id`, `docs_dir`, `output_dir`. Then conduct the interview and call `design_taskout_generate` with a typed `ConfirmedTaskoutPlan` and the detected mode.

## Behavior

- If `design_taskout_start` refuses with `no-roadmap`, tell the user to run `/roadmap` first. If it refuses with `rc-not-in-index`, tell them to run `/roadmap` in maintenance mode to add the RC.
- The tool returns the detected mode (`bootstrap-rc` or `maintenance`). Use it verbatim — do not override.
- Keep the question queue private. Walk the draft sections in order: Theme, Goals, Targeted, Blockers & Dependencies, Definition of Done, References.
- For Blockers & Dependencies, the tool surfaces upstream RCs, scanned tech-debt items (with `path:line` citations), and Carried-From items from sibling RC Out-of-Scope sections. Confirm each. Ask the user for any external pending decisions (ADRs not yet ratified, vendor decisions).
- Targeted is agile-correct: each `### heading` is an epic (a feature/area); each item under it is a ticket — one goal, INVEST-sized, ≈ one ClickUp Task. List tickets in execution order (the order is the priority) and note inter-ticket dependencies. A spike that de-risks an unknown is its own ticket. Each ticket carries 1-3 acceptance criteria (`- AC:` sub-bullets; legacy `- DOD:` still parses); if they need an "and" across unrelated checks, split the ticket. Acceptance criteria are per-ticket; the RC-wide Definition of Done is the shared ship gate. Sub-task breakdowns belong in `Plan/` docs.
- For Shipped RCs whose immutable fields (theme, goals, targeted, definitionOfDone, anchors, version, name, or removed references) change in the confirmed plan, interview the user for a `shipped-lock-bypass` override naming the changed fields and a reason. Without the override, generation will refuse.
- Coverage gate before write: every section has content; the RC Definition of Done has at least 3 testable assertions; tickets are in execution order with known dependencies recorded under Blockers & Dependencies; References cites every doc named inline in Targeted.
- Present a concise findings summary and ask the user to choose: confirm, modify, deny, or cancel.
- On confirm, call `design_taskout_generate`. Bootstrap-rc writes the original file; maintenance writes a `.draft.md` sibling. Tell the user where the file landed.
- If `design_taskout_generate` refuses with `mode-mismatch`, re-fetch state via `design_taskout_start` and retry with the correct mode.
- If it refuses with `shipped-lock-violation` or `immutable fields without override`, surface the changed fields, interview to add the override or restate unchanged values, re-attempt.
- If the user denies, stop without writing. If the user cancels, abandon the task entirely.
