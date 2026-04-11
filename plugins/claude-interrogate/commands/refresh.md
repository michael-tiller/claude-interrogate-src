---
description: Find potentially out-of-date elements and force an interview-driven update plan
argument-hint: [docs-dir] [topic]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Refresh Stale Elements

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the optional first argument as the docs directory.
2. Parse the optional second argument as the topic to narrow the refresh pass.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
6. Prefer the MCP prompt `/mcp__claude_interrogate__refresh <docs-dir> <topic>`.
7. If MCP prompts are unavailable, read the docs directly and build the report conversationally before writing anything.

## Behavior

- If a topic is provided, focus on stale or out-of-date elements related to that topic.
- If no topic is provided, scan holistically for design elements that appear stale, contradicted, or superseded.
- Prefer findings that need a forced reinterrogation, not just a wording tweak.
- Present the planned stale elements, the affected files or concepts, the reinterrogation areas to reopen, and the proposed output path before any write.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before writing.
- If the user starts a different file task before this one is resolved, cancel this refresh task immediately, state that it was abandoned without writing, and continue only with the new task.
- Only write after explicit confirmation.
- On confirm, write `refresh.md` in the docs directory unless the user chooses a different output path. If the command is topic-specific, prefer `<topic>-refresh.md`.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the refresh task, ask no further refresh questions, and make clear that nothing was written.
