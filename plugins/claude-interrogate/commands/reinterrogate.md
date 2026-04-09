---
description: Reinterrogate an existing design doc against newer sibling knowledge
argument-hint: <doc-path> [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Reinterrogate Doc

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the existing document path.
2. Parse the optional second argument as the docs directory.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
6. Prefer the MCP prompt `/mcp__claude_interrogate__reinterrogate <doc-path> <docs-dir>`.
7. Read the existing target document first.
8. If MCP prompts are unavailable, read the target doc, call `design_interview_start` with `challenge=false`, conduct the reinterrogation conversationally, and then call `design_doc_generate`.

## Behavior

- Summarize what the target doc currently says and what sibling docs have settled since it was written.
- Keep the full question queue private.
- Ask one question at a time, focusing on stale assumptions, contradictions, and missing decisions.
- Present findings and ask the user to `confirm`, `modify`, or `deny` before writing anything.
- Only write after explicit confirmation.
- If the user denies, stop without writing anything.
