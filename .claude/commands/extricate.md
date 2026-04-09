Extricate feature `$1` from the docs directory `$2`.

Rules:
- If `$1` is empty, stop and ask the user for the concept name.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__extricate $1 $2`.
- This is dependency-aware removal, not blind deletion.

Behavior:
- Summarize where the feature currently appears.
- Ask whether this is removal, retirement, or replacement.
- Present an extrication plan before any edits.
- Only apply changes after explicit `confirm`.
