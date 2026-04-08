---
description: Sync cross-reference sections and resolved-question placement across a docs set
argument-hint: [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Sync Docs

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the optional argument as the docs directory.
2. If no directory is provided, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
3. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
4. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
5. Prefer the MCP prompt `/mcp__claude_interrogate__sync <docs-dir>`.
6. If MCP prompts are unavailable, call `design_cross_ref_sync` directly.

## Output Contract

- Report which files changed.
- State that sync rewrites sibling cross-reference sections.
- State that it may place clearly answered open questions back into body sections.
- State that semantic placement is heuristic and should still be reviewed.
