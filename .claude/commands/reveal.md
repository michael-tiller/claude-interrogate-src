Reveal remaining open questions in docs directory `$1`, optionally narrowed to topic `$2`.

Rules:
- If `$1` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
- Prefer the MCP prompt `/mcp__claude_interrogate__reveal $1 $2`.
- If MCP prompts are unavailable, read the docs directly and build the report conversationally before writing anything.

Behavior:
- If `$2` is present, focus on remaining open questions about that topic.
- If `$2` is empty, scan holistically for the most important unresolved questions across the docs set.
- Separate explicitly open questions from questions that remain open by inference.
- Present the planned question groups, whether they are explicit or inferred, and the proposed output path before any write.
- Ask the user to `confirm`, `modify`, `deny`, or `cancel` before writing.
- If the user starts a different file task before this one is resolved, cancel this reveal task immediately, state that it was abandoned without writing, and continue only with the new task.
- Only write after explicit confirmation.
- On confirm, write `reveal.md` in the docs directory unless the user chooses a different output path. If the command is topic-specific, prefer `<topic>-reveal.md`.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the reveal task, ask no further reveal questions, and make clear that nothing was written.
