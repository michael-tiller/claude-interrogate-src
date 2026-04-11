---
description: Audit a design-doc directory for contradictions, missing links, and stale questions
argument-hint: [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash]
---

# Audit Docs

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the optional argument as the docs directory.
2. If no directory is provided, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
3. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
4. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
5. Prefer the MCP prompt `/mcp__claude_interrogate__audit <docs-dir>`.
6. If MCP prompts are unavailable, call `design_audit` directly.

## Output Contract

- Present findings first, ordered by severity.
- Then present action items.
- Focus on contradictions, missing cross-references, stale open questions, and missing updated dates.
