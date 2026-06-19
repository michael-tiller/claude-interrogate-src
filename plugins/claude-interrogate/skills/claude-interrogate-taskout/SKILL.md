---
name: claude-interrogate-taskout
description: Run the claude-interrogate per-RC taskout socratic interview and produce a structured per-RC file.
---

# Claude Interrogate: Taskout

Use this skill when the user wants to break a single release candidate into epic-level checklists, blockers, and a definition of done. Requires that `/roadmap` has already produced a `roadmap.md` for the project.

## Inputs

- `rc_id` (required) — release candidate id, e.g. `M8_QUESTS`.
- `docs_dir` (optional) — defaults to `claude-interrogate.json` `docsDir`, then `./docs`.
- `output_dir` (optional) — project root containing `roadmap.md` and `Roadmap/`; defaults to the current working directory.
- `style_template_path` (optional) — golden document template, if configured via `styleTemplate`.

## Steps

1. Resolve `rc_id`, `docs_dir`, and `output_dir`. Load roadmap conventions from the `roadmap` block in `claude-interrogate.json` if present.
2. Call the `design_taskout_start` tool from the `claude-interrogate` MCP server with `rc_id`, `docs_dir`, `output_dir`, and (if configured) `style_template_path`.
3. If the response is `no-roadmap`, tell the user to run `/roadmap` first and stop. If `rc-not-in-index`, tell them to run `/roadmap` in maintenance mode to add the RC first.
4. Use the returned `mode` (`bootstrap-rc` or `maintenance`) verbatim. Do not override.
5. Walk the draft sections with the user in order: Theme, Goals, Targeted, Blockers & Dependencies, Definition of Done, References. For Blockers, the tool surfaces upstream RCs, scanned tech-debt items, and Carried-From candidates from sibling RC Out-of-Scope sections — confirm each and ask the user for any external pending decisions.
6. Targeted is agile-correct: each `### heading` is an **epic** (a feature/area); each item under it is a **ticket** — one goal, INVEST-sized (independently deliverable and testable), and ≈ one ClickUp Task. List tickets in **execution order**, AND order the **epics** themselves top-to-bottom in execution order too — this Targeted list IS the order the human reads off ClickUp as the work sequence, so it must match the intended implementation order. **Never author a separate `## Suggested Order` / `## Execution Order` section** — it diverges silently from the list and the tooling ignores it (the list is the only order that ships; `export` flags such a section in `orderDiagnostics.strayOrderingSections`). Encode every intended ordering — including a soft "do X before Y" with no hard code-dependency — as a `- Blocked-by:` edge on the dependent ticket, whose value MUST be the dependency's full exported key `<RCID>#<epic-slug>#<digest>` (a bare digest or epic letter is rejected at generate time with `order-violation`). A **spike** that de-risks an unknown is its own ticket. Sub-task breakdowns belong in `Plan/` docs. For each ticket, capture its **acceptance criteria**: 1-3 observable pass/fail checks that confirm THIS ticket is done, placed on the confirmed plan's `item.dod` (rendered as `- AC:` sub-bullets — legacy `- DOD:` still parses — kept out of the hashed key text). If the criteria need an "and" across two unrelated checks, split the ticket. Acceptance criteria are per-ticket; the RC-wide **Definition of Done** is the shared ship gate every ticket also clears — tickets with no specific criteria inherit it. For a **warm** ticket — one whose shape already exists in a `Plan/` doc or prior recon — also capture its spec now on `item.howToImplement` (`- How:` — the concrete seam path) and `item.designContext` (`- Why:` — traps and rationale), so flay and the ClickUp mirror inherit execution context instead of re-deriving it. **Anchor `- How:` on SYMBOLS, not bare line numbers**: prefer `Type.Method` / the named call site / the seam (e.g. `JobDispatcher.Enqueue`, `the JobQueue drain seam`) over `foo.ts:573`, which drifts the moment the file is edited. If you give a line number at all, mark it `~approx, verify` (e.g. `src/dispatch.ts:573 ~approx, verify`) so flay re-grounds it rather than trusting it. **Cold** tickets (no prior shape) stay thin and are spec'd at flay; never invent a path you have not traced.
7. For Shipped RCs whose immutable fields change in the confirmed plan, interview the user for a `shipped-lock-bypass` override naming the changed fields and a reason.
8. Coverage gate before write: every section has content; the RC Definition of Done has at least 3 testable assertions; **epics AND tickets are in execution order** (the list order is the ClickUp order) with intended orderings encoded as full-key `- Blocked-by:` edges and no stray `## Suggested Order` section; References cites every doc named inline in Targeted. (`design_taskout_generate` hard-refuses with `order-violation` if a `Blocked-by` edge contradicts the list order or names a non-existent ticket key.)
9. Present the findings summary and ask the user to confirm, modify, deny, or cancel.
10. On confirm, assemble a `ConfirmedTaskoutPlan` and call `design_taskout_generate` with the detected mode. Bootstrap-rc writes the original file; maintenance writes a `.draft.md` sibling. Report the path that landed.
11. If `design_taskout_generate` refuses with `mode-mismatch`, re-fetch state via `design_taskout_start` and retry. If it refuses with `shipped-lock-violation`, surface the changed fields, interview to add the override, re-attempt.
