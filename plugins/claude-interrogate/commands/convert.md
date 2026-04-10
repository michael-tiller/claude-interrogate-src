Convert source artifact `$1` using docs directory `$2`.

Rules:
- If `$1` is empty, stop and ask the user what artifact or doc should be converted.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__convert $1 $2`.
- Do not write anything until the user explicitly confirms the conversion plan.

Behavior:
- First clarify the target form if it is not obvious.
- If the user starts a different file task before this one is resolved, cancel this target-file task immediately, state that it was abandoned without writing, and continue only with the new task.
- Present what will be kept, reframed, dropped, and written.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before any write.
- If the user cancels, abandon the current target-file task, ask no further conversion questions, and make clear that nothing was written.
- Treat canonical-spec conversion as a promotion flow, not a blind overwrite.
