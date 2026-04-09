Derive an aggressively stripped exploration spec for concept `$1` in docs directory `$2`.

Rules:
- If `$1` is empty, stop and ask the user for the concept name.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__distill $1 $2` with `intensity="aggressive"`.
- Treat the distilled spec as a separate living artifact derived from the real spec, not a replacement for it.

Behavior:
- Use aggressive strip intensity.
- Cut to the narrowest believable implementation surface.
- Maximize explicit stubs, fakes, and out-of-scope calls.
- If the user wants it written, write it as a separate doc like `<concept>-distill.md`.
