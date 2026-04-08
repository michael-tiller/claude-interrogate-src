---
description: Run the design interview flow for a concept against an existing docs folder
argument-hint: <concept> [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Interrogate Design

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the concept name.
2. Parse the optional second argument as the docs directory.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
6. Prefer the MCP prompt `/mcp__claude_interrogate__interrogate <concept> <docs-dir> false`.
7. If MCP prompts are unavailable, call the `design_interview_start` tool directly with `challenge=false`, conduct the interview conversationally, and then call `design_doc_generate`.
8. If the MCP server is unavailable, fall back to `node dist/server.js` tooling only if needed and summarize any blocker.

## Behavior

- Summarize what the existing docs already decide before asking anything new.
- Keep the full question queue private.
- Ask one question at a time in dependency order.
- Push on weak, vague, or incomplete answers.
- Present findings and ask the user to `confirm`, `modify`, or `deny` before writing anything.
- Only write after explicit confirmation.
- If the user denies, stop without writing anything.
- Never set `challenge=true` in this command path.
