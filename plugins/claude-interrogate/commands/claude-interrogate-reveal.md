---
description: Reveal remaining open questions across a docs set or for a specific topic
argument-hint: [docs-dir] [topic]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Reveal Open Questions

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the optional first argument as the docs directory.
2. Parse the optional second argument as the topic to narrow the report.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
6. Prefer the MCP prompt `/mcp__claude_interrogate__reveal <docs-dir> <topic>`.
7. If MCP prompts are unavailable, read the docs directly and build the report conversationally before writing anything.

## Behavior

- If a topic is provided, focus on remaining open questions about that topic.
- If no topic is provided, scan holistically for the most important unresolved questions across the docs set.
- Separate explicitly open questions from questions that remain open by inference.
- Present the planned question groups, whether they are explicit or inferred, and the proposed output path before any write.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before writing.
- If the user starts a different file task before this one is resolved, cancel this reveal task immediately, state that it was abandoned without writing, and continue only with the new task.
- Only write after explicit confirmation.
- On confirm, write `reveal.md` in the docs directory unless the user chooses a different output path. If the command is topic-specific, prefer `<topic>-reveal.md`.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the reveal task, ask no further reveal questions, and make clear that nothing was written.
