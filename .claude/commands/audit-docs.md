Audit the design docs directory `$1`.

Rules:
- If `$1` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__audit $1`.
- If MCP prompts are unavailable, call `design_audit` directly.
- If the MCP server is unavailable, fall back to `node dist/cli.js --audit --docs "$1"`. Add `--style` when config provides `styleTemplate`.

Output contract:
- Present findings first, ordered by severity.
- Then present concrete action items.
- Focus on contradictions, missing cross-references, stale open questions, and missing updated dates.
