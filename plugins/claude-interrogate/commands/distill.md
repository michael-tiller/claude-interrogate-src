---
description: Derive a reduced exploratory spec from the canonical design
argument-hint: <concept> [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Distill

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the concept name.
2. Parse the optional second argument as the docs directory.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. Prefer the MCP prompt `/mcp__claude_interrogate__distill <concept> <docs-dir>` with `intensity="balanced"`.
6. Treat the distilled spec as a separate living artifact derived from the real spec, not a replacement for it.

## Output Structure

Produce the distilled spec in this order:

1. **Definition of Done** — a `- [ ]` checklist placed at the top of the spec, before anything else.
   Each item must be specific, testable, and scoped to this exploration slice only.
   Cover: core happy-path criterion, key integration points, explicit deferred/out-of-scope acknowledgements, and the validation gate.
   No vague items ("works correctly") — every item must be checkable by the implementer without further clarification.

2. Core loop
3. Must-build systems
4. Stubbed/faked systems
5. Out-of-scope items
6. Validation goal

## Behavior

- Use balanced strip intensity by default.
- Ask the minimum number of questions needed to scope exploration honestly.
- If the user wants it written, write a separate distilled doc instead of overwriting the canonical spec.
