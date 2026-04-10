Bring existing document `$1` up to the current house style using docs directory `$2`.

Rules:
- If `$1` is empty, stop and ask the user for the existing document path.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
- Prefer the MCP prompt `/mcp__claude_interrogate__redress $1 $2`.
- If MCP prompts are unavailable, read the target document and sibling docs directly, then build the redress plan conversationally before writing anything.

Behavior:
- Focus on style drift: headers, metadata, section ordering, house headings, cross-reference shape, open-questions shape, and version-history conventions.
- Preserve substantive decisions unless a style repair cannot be separated from a small clarification.
- Present what will change structurally, what will stay substantively the same, and any risky wording clarifications before any write.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before writing.
- If the user starts a different file task before this one is resolved, cancel this redress task immediately, state that it was abandoned without writing, and continue only with the new task.
- Only write after explicit confirmation.
- On confirm, overwrite the target document path with the redressed version.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the redress task, ask no further redress questions, and make clear that nothing was written.
