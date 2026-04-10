Run the internal design interview flow for concept `$1` in docs directory `$2`.

Rules:
- If `$1` is empty, stop and ask the user for the concept name.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__interrogate $1 $2`.
- If MCP prompts are unavailable but the MCP tools are available, call `design_interview_start` with `challenge=false`, run the interview conversationally, then call `design_doc_generate`.
- If the MCP server is unavailable, fall back to the local CLI with `node dist/cli.js "$1" --docs "$2"` and continue the interview from there. Add `--style` when config provides `styleTemplate`.
- Never set `challenge=true` in this command path.

Behavior:
- Summarize what the existing docs already decide before asking anything new.
- Keep the full question queue private.
- Ask one question at a time in dependency order.
- If the user starts a different file task before this one is resolved, cancel this task immediately, state that it was abandoned without writing, and continue only with the new task.
- Push back on vague answers. Ask follow-ups when the answer is weak, short, or dodges trade-offs.
- When the concept is resolved enough, present findings and ask the user to `confirm`, `modify`, `deny`, or `cancel`.
- Only write after explicit confirmation.
- If the user denies, stop without writing anything.
- If the user cancels, abandon the current file task, ask no further task questions, and make clear that nothing was written.
- Treat this as decision-making work, not brainstorming theater.
