Find potentially out-of-date elements in docs directory `$1`, optionally narrowed to topic `$2`, and force an interview-driven update plan.

Rules:
- If `$1` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
- Prefer the MCP prompt `/mcp__claude_interrogate__refresh $1 $2`.
- If MCP prompts are unavailable, read the docs directly and build the report conversationally before writing anything.

Behavior:
- If `$2` is present, focus on stale or out-of-date elements related to that topic.
- If `$2` is empty, scan holistically for design elements that appear stale, contradicted, or superseded.
- Prefer findings that need a forced reinterrogation, not just a wording tweak.
- Present the planned stale elements, the affected files or concepts, the reinterrogation areas to reopen, and the proposed output path before any write.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before writing.
- If the user starts a different file task before this one is resolved, cancel this refresh task immediately, state that it was abandoned without writing, and continue only with the new task.
- Only write after explicit confirmation.
- On confirm, write `refresh.md` in the docs directory unless the user chooses a different output path. If the command is topic-specific, prefer `<topic>-refresh.md`.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the refresh task, ask no further refresh questions, and make clear that nothing was written.
