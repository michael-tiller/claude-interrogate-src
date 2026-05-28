---
description: Socratic scope/roadmap interview — turn a concept-doc set into roadmap.md plus per-RC stubs
argument-hint: "[docs-dir]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Roadmap (scope + ordering)

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the optional first argument as the docs directory.
2. If the docs directory is missing, look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir`. Otherwise default to `./docs` if it exists; otherwise `./sample-docs`.
3. If config provides `styleTemplate`, pass it through as `style_template_path`.
4. Output directory defaults to the current working directory (project root). Roadmap conventions (`roadmap.indexFile`, `roadmap.rcDir`, `roadmap.rcNamingScheme`, `roadmap.techDebtFile`, `roadmap.reservedSlots`, `roadmap.marketingWaypoints`, `roadmap.anchorSources`) come from the `roadmap` block in `claude-interrogate.json`. Defaults are deliberately generic (empty marketing waypoints, a single 1.0.0 reserved slot) since interrogate is a general design tool; project-type-specific conventions (game-dev waypoints, content passes, etc.) belong in per-project config.
5. Prefer the MCP prompt `/mcp__claude_interrogate__roadmap`.
6. If MCP prompts are unavailable, call `design_scope_start` directly with `docs_dir`, `output_dir`, and (if configured) `style_template_path`. Then conduct the interview and call `design_scope_generate` with a typed `ConfirmedScopePlan` and the detected mode.

## Behavior

- If `design_scope_start` refuses with `no-concept-docs`, tell the user the project has no concept docs and point them to `/interrogate <concept>`. Do not write anything.
- If `design_scope_start` returns `mode: "maintenance"`, present the drift summary first and scope the interview to the gaps. Otherwise run the full bootstrap interview.
- Keep the question queue private. Ask one question at a time in dependency order.
- Interview the prerequisite DAG and marketing waypoints in parallel — every candidate edge needs the user to confirm direction (`blocks`, `depends-on`, `parallel`) with a one-line reason. Inferred edges are low-confidence seeds, not facts.
- For RCs that collide with reserved version slots, surface the collision; let the user pick `rename`, `replace` (recorded as a `reserved-slot-collision` override), or `cancel`. Default is `rename`.
- For Shipped RCs whose immutable fields (version, name, anchors, marketing waypoint) change in the confirmed plan, interview the user for a `shipped-lock-bypass` override naming the changed fields and a reason. Without the override, generation will refuse.
- Coverage gate before write: every concept doc is mapped to an RC or appendix'd with a reason; every RC has an anchor (Concept / Plan / ADR / Inline thesis) and a marketing-waypoint position (or "none"); the confirmed DAG is acyclic.
- Present a concise findings summary and ask the user to choose: confirm, modify, deny, or cancel.
- On confirm, call `design_scope_generate`. In maintenance mode the tool writes `roadmap.draft.md` and per-RC `*.draft.md` siblings — never the originals. Tell the user where the drafts landed.
- If `design_scope_generate` refuses with `cycle-detected`, surface the cycle, interview to break it, re-attempt.
- If it refuses with `shipped-lock-violation` or `without override`, surface the changed fields, interview to add an override or restate unchanged values, re-attempt.
- If the user denies, stop without writing. If the user cancels, abandon the task entirely.
