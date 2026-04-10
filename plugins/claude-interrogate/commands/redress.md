---
description: Bring an existing file up to the current local house style
argument-hint: <doc-path> [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Redress File

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the existing document path.
2. Parse the optional second argument as the docs directory.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
6. Prefer the MCP prompt `/mcp__claude_interrogate__redress <doc-path> <docs-dir>`.
7. If MCP prompts are unavailable, read the target document and sibling docs directly, then build the redress plan conversationally before writing anything.

## Behavior

- Focus on style drift: headers, metadata, section ordering, house headings, cross-reference shape, open-questions shape, and version-history conventions.
- Preserve substantive decisions unless a style repair cannot be separated from a small clarification.
- Present what will change structurally, what will stay substantively the same, and any risky wording clarifications before any write.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before writing.
- If the user starts a different file task before this one is resolved, cancel this redress task immediately, state that it was abandoned without writing, and continue only with the new task.
- Only write after explicit confirmation.
- On confirm, overwrite the target document path with the redressed version.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the redress task, ask no further redress questions, and make clear that nothing was written.
