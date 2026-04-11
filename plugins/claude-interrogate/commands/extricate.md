---
description: Carefully remove, retire, or replace a feature across the docs set
argument-hint: <concept> [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Extricate

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the concept name.
2. Parse the optional second argument as the docs directory.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. Prefer the MCP prompt `/mcp__claude_interrogate__extricate <concept> <docs-dir>`.
6. Treat this as dependency-aware removal, not blind deletion.

## Behavior

- Summarize where the feature currently appears.
- Ask whether this is removal, retirement, or replacement.
- Present an extrication plan before any edits.
- Only apply changes after explicit confirmation.
