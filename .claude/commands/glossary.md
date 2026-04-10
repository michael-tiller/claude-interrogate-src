Build a glossary of common design-space terms from docs directory `$1`.

Rules:
- If `$1` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP prompts.
- Prefer the MCP prompt `/mcp__claude_interrogate__glossary $1`.
- If MCP prompts are unavailable, read the docs directly and compile the glossary conversationally before writing anything.

Behavior:
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
