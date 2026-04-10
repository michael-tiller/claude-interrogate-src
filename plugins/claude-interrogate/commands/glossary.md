---
description: Build a glossary of common design-space terms from a docs set
argument-hint: [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Build Glossary

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the optional first argument as the docs directory.
2. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
3. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
4. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
5. Prefer the MCP prompt `/mcp__claude_interrogate__glossary <docs-dir>`.
6. If MCP prompts are unavailable, read the docs directly and compile the glossary conversationally before writing anything.

## Behavior

- Identify repeated domain terms, workflow labels, role names, object names, and other design-space vocabulary that matters to this docs set.
- Prefer terms that recur across multiple docs or act as authority-bearing language.
- Exclude generic filler terms that do not help a reader navigate the design space.
- Present the planned terms, any aliases or conflicting usages, and the proposed output path before any write.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before writing.
- If the user starts a different file task before this one is resolved, cancel this glossary task immediately, state that it was abandoned without writing, and continue only with the new task.
- Only write after explicit confirmation.
- On confirm, write `glossary.md` in the docs directory unless the user chooses a different output path.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the glossary task, ask no further glossary questions, and make clear that nothing was written.
