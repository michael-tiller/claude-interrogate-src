---
description: Expose gaps, undefined seams, and risky ambiguities in a docs set
argument-hint: [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Expose Gaps

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the optional first argument as the docs directory.
2. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
3. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
4. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
5. Prefer the MCP prompt `/mcp__claude_interrogate__expose <docs-dir>`.
6. If MCP prompts are unavailable, read the docs directly and build the report conversationally before writing anything.

## Behavior

- Focus on missing decisions, undefined ownership, fuzzy boundaries, unstated dependencies, unclear lifecycle transitions, and vague or overloaded terms.
- Separate grounded findings from inferences.
- Present the planned findings, the affected files or concepts, and the proposed output path before any write.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before writing.
- If the user starts a different file task before this one is resolved, cancel this expose task immediately, state that it was abandoned without writing, and continue only with the new task.
- Only write after explicit confirmation.
- On confirm, write `expose.md` in the docs directory unless the user chooses a different output path.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the expose task, ask no further expose questions, and make clear that nothing was written.
