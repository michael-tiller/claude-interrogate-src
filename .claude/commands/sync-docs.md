Sync the cross-reference sections for docs directory `$1`.

Rules:
- If `$1` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__sync $1`.
- If MCP prompts are unavailable, call `design_cross_ref_sync` directly.
- If the MCP server is unavailable, fall back to `node dist/cli.js --sync --docs "$1"`. Add `--style` when config provides `styleTemplate`.

Output contract:
- Report which files changed.
- State that the current sync rewrites sibling cross-reference sections.
- State that it can place clearly answered Open Questions back into body sections.
- State that the placement is heuristic and should still be reviewed when it changes design text.
