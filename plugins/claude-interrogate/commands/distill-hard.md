---
description: Derive an aggressively stripped exploratory spec
argument-hint: <concept> [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Distill Hard

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the concept name.
2. Parse the optional second argument as the docs directory.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. Prefer the MCP prompt `/mcp__claude_interrogate__distill <concept> <docs-dir>` with `intensity="aggressive"`.
6. Treat the distilled spec as a separate living artifact derived from the real spec, not a replacement for it.

## Behavior

- Use aggressive strip intensity.
- Cut to the narrowest believable implementation surface.
- Maximize stubs, fakes, and explicit out-of-scope calls.
- If the user wants it written, write a separate distilled doc instead of overwriting the canonical spec.
