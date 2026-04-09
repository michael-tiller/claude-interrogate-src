Run the reinterrogation flow for existing doc path `$1` in docs directory `$2` in fast mode.

Rules:
- If `$1` is empty, stop and ask the user for the existing document path.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__reinterrogate $1 $2`.
- If MCP prompts are unavailable but the MCP tools are available, read the target document, then call `design_interview_start` with `challenge_mode="standard"` and `depth_mode="fast"` before running the reinterrogation.

Behavior:
- Keep the question queue private.
- Ask fewer questions than standard mode.
- Focus on what is stale, contradictory, or newly required.
- Only overwrite on explicit `confirm`.
