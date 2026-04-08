Run the internal design interview flow for concept `$1` in docs directory `$2` in adversarial mode.

Rules:
- If `$1` is empty, stop and ask the user for the concept name.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__interrogate $1 $2 true`.
- If MCP prompts are unavailable but the MCP tools are available, call `design_interview_start` with `challenge=true`, run the interview, then call `design_doc_generate`.
- If the MCP server is unavailable, fall back to the local CLI with `node dist/cli.js "$1" --docs "$2" --challenge`. Add `--style` when config provides `styleTemplate`.

Behavior:
- Keep the full question queue private.
- Ask one question at a time in dependency order.
- Challenge weak assumptions directly.
- Require rejected alternatives, concrete failure modes, and evidence for release readiness.
- If an answer is still vague after one follow-up, say so explicitly and keep pressing until the decision boundary is clear.
- When the concept is resolved enough, present findings and ask the user to `confirm`, `modify`, or `deny`.
- Only write after explicit confirmation.
- If the user denies, stop without writing anything.
