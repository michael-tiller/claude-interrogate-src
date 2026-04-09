Summarize what the docs already establish about concept `$1` in docs directory `$2`.

Rules:
- If `$1` is empty, stop and ask the user for the concept name.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__summarize $1 $2`.
- If MCP prompts are unavailable, call `design_summarize` directly.

Behavior:
- Present only what is grounded in the docs.
- Do not interrogate.
- Do not propose new decisions.
- Clearly separate learned facts from unresolved areas.
