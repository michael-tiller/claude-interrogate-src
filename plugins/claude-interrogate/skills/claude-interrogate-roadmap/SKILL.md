---
name: claude-interrogate-roadmap
description: Run the claude-interrogate scope/roadmap socratic interview against a docs set and produce roadmap.md plus per-RC stubs.
---

# Claude Interrogate: Roadmap

Use this skill when the user wants to scope the project into release candidates, order them into a main roadmap, and seed per-RC stub files. The interview is socratic — present-form-then-confirm — so it stays grounded in the docs.

## Inputs

- `docs_dir` (optional) — defaults to the `docsDir` in `claude-interrogate.json` / `.claude-interrogate.json`, or `./docs`.
- `output_dir` (optional) — project root where `roadmap.md` and `Roadmap/` live; defaults to the current working directory.
- `style_template_path` (optional) — golden document template, if configured via `styleTemplate`.

## Steps

1. Resolve `docs_dir` and `output_dir`. Load roadmap conventions from the `roadmap` block in `claude-interrogate.json` if present (defaults to the dirigible pattern otherwise).
2. Call the `design_scope_start` tool from the `claude-interrogate` MCP server with `docs_dir`, `output_dir`, and (if configured) `style_template_path`.
3. If the response is `no-concept-docs`, tell the user to run `/interrogate <concept>` first and stop.
4. Use the returned `mode`. In `maintenance`, present the drift summary first and scope the interview to the gaps. In `bootstrap`, run the full interview.
5. Walk the question set one at a time. Confirm the prerequisite DAG edges and marketing waypoints in parallel — each candidate edge needs the user to confirm direction (`blocks`, `depends-on`, `parallel`) with a one-line reason. Inferred edges are low-confidence seeds, not facts.
6. For RCs colliding with reserved version slots, surface the collision and let the user pick `rename`, `replace` (recorded as a `reserved-slot-collision` override), or `cancel`.
7. For Shipped RCs whose immutable fields (`version`, `name`, `anchors`, marketing waypoint) change in the confirmed plan, interview the user for a `shipped-lock-bypass` override with a reason.
8. Coverage gate before write: every concept doc is mapped or appendix'd with a reason; every RC has an anchor and marketing-waypoint position; the confirmed DAG is acyclic.
9. Present the findings summary and ask the user to confirm, modify, deny, or cancel.
10. On confirm, assemble a `ConfirmedScopePlan` and call `design_scope_generate` with the detected mode. In maintenance, the tool writes `roadmap.draft.md` and per-RC `*.draft.md` siblings — never the originals. Report the paths that landed.
11. If `design_scope_generate` refuses with `cycle-detected` or `shipped-lock-violation`, surface the offending detail, interview the user to resolve, and re-attempt.
