---
description: Run the design interview flow in adversarial mode
argument-hint: <concept> [docs-dir]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Interrogate Design Hard

The user invoked this command with: $ARGUMENTS

## Instructions

1. Parse the first argument as the concept name.
2. Parse the optional second argument as the docs directory.
3. If the docs directory is missing, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
4. If no config exists, default to `./docs` if it exists; otherwise use `./sample-docs`.
5. If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
6. Prefer the MCP prompt `/mcp__claude_interrogate__interrogate <concept> <docs-dir> true`.
7. If MCP prompts are unavailable, call `design_interview_start` with `challenge=true`, conduct the interview, and then call `design_doc_generate`.

## Behavior

- Keep the full question queue private.
- Ask one question at a time in dependency order.
- Be adversarial about weak assumptions.
- Demand rejected alternatives, failure modes, and evidence for release readiness.
- If an answer stays vague after one follow-up, say so explicitly and keep pressing.
- Present findings and ask the user to `confirm`, `modify`, or `deny` before writing anything.
- Only write after explicit confirmation.
- If the user denies, stop without writing anything.
