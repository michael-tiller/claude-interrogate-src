Run the reinterrogation flow for existing doc path `$1` in docs directory `$2`.

Rules:
- If `$1` is empty, stop and ask the user for the existing document path.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__reinterrogate $1 $2`.
- Read the existing target document first.
- If MCP prompts are unavailable but the MCP tools are available, read the target document, call `design_interview_start` with `challenge=false`, and run the reinterrogation conversationally against current sibling knowledge before calling `design_doc_generate`.
- Never set `challenge=true` in this command path.

Behavior:
- Summarize what the target doc currently says and what sibling docs have settled since it was written.
- Keep the full question queue private.
- Ask one question at a time, focusing on stale assumptions, contradictions, and missing decisions.
- Present findings and ask the user to `confirm`, `modify`, or `deny` before writing anything.
- On confirm, overwrite the target document path with the modernized version.
- If the user denies, stop without writing anything.
