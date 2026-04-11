---
description: Summarize what the docs already establish about a feature
argument-hint: <concept> [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash]
---

# Summarize Feature

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the concept name.
2. Parse the optional second argument as the docs directory.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. Prefer the MCP prompt `/mcp__claude_interrogate__summarize <concept> <docs-dir>`.
6. If MCP prompts are unavailable, call `design_summarize` directly.

## Behavior

- Present only what is grounded in the docs.
- Do not interrogate.
- Do not propose new decisions.
- Clearly separate learned facts from unresolved areas.
