---
name: claude-interrogate-taskout
description: Run the claude-interrogate per-RC taskout socratic interview and produce a structured per-RC file.
---

# Claude Interrogate: Taskout

Use this skill when the user wants to break a single release candidate into epic-level checklists, blockers, and a definition of done. Requires that `/roadmap` has already produced a `roadmap.md` for the project.

## Inputs

- `rc_id` (required) — release candidate id, e.g. `0_8_0_QUESTS`.
- `docs_dir` (optional) — defaults to `claude-interrogate.json` `docsDir`, then `./docs`.
- `output_dir` (optional) — project root containing `roadmap.md` and `Roadmap/`; defaults to the current working directory.
- `style_template_path` (optional) — golden document template, if configured via `styleTemplate`.

## Steps

1. Resolve `rc_id`, `docs_dir`, and `output_dir`. Load roadmap conventions from the `roadmap` block in `claude-interrogate.json` if present.
2. Call the `design_taskout_start` tool from the `claude-interrogate` MCP server with `rc_id`, `docs_dir`, `output_dir`, and (if configured) `style_template_path`.
3. If the response is `no-roadmap`, tell the user to run `/roadmap` first and stop. If `rc-not-in-index`, tell them to run `/roadmap` in maintenance mode to add the RC first.
4. Use the returned `mode` (`bootstrap-rc` or `maintenance`) verbatim. Do not override.
5. Walk the draft sections with the user in order: Theme, Goals, Targeted, Blockers & Dependencies, Definition of Done, References. For Blockers, the tool surfaces upstream RCs, scanned tech-debt items, and Carried-From candidates from sibling RC Out-of-Scope sections — confirm each and ask the user for any external pending decisions.
6. Targeted granularity is epic-level checklist items, not story-level tasks. Detailed task breakdowns belong in `Plan/` docs.
7. For Shipped RCs whose immutable fields change in the confirmed plan, interview the user for a `shipped-lock-bypass` override naming the changed fields and a reason.
8. Coverage gate before write: every section has content; DoD has at least 3 testable assertions; References cites every doc named inline in Targeted.
9. Present the findings summary and ask the user to confirm, modify, deny, or cancel.
10. On confirm, assemble a `ConfirmedTaskoutPlan` and call `design_taskout_generate` with the detected mode. Bootstrap-rc writes the original file; maintenance writes a `.draft.md` sibling. Report the path that landed.
11. If `design_taskout_generate` refuses with `mode-mismatch`, re-fetch state via `design_taskout_start` and retry. If it refuses with `shipped-lock-violation`, surface the changed fields, interview to add the override, re-attempt.
