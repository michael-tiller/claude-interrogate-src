Run the internal design interview flow for concept `$1` in docs directory `$2` in fast mode.

Rules:
- If `$1` is empty, stop and ask the user for the concept name.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__interrogate $1 $2 false`.
- If MCP prompts are unavailable but the MCP tools are available, call `design_interview_start` with `challenge_mode="standard"` and `depth_mode="fast"`, run the interview conversationally, then call `design_doc_generate`.

Behavior:
- Keep the question queue private.
- Ask fewer questions than standard mode.
- Focus on decision boundary, release bar, chosen shape, constraints, and major edges.
- Only write after explicit `confirm`.
