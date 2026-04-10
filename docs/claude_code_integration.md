# Client Integration
Updated: 2026-04-08

## 1. Current Integration

`claude-interrogate` now integrates with Claude Code directly and with Codex through the same MCP server runtime:

- project-scoped MCP configuration via [.mcp.json](E:/Personal/claude-interrogate/.mcp.json)
- project slash commands via [.claude/commands/README.md](E:/Personal/claude-interrogate/.claude/commands/README.md)

The MCP server entrypoint remains [src/server.ts](E:/Personal/claude-interrogate/src/server.ts), and the package exposes it as `claude-interrogate-mcp` in [package.json](E:/Personal/claude-interrogate/package.json).

## 2. What Each Client Gets

After `npm install` and `npm run build`, either client can attach the project MCP server from [.mcp.json](E:/Personal/claude-interrogate/.mcp.json).

That same build also syncs the compiled server into [plugins/claude-interrogate/runtime/dist](E:/Personal/claude-interrogate/plugins/claude-interrogate/runtime/dist) so a locally installed Claude Code plugin copy can start its MCP server without depending on sibling directories outside the installed plugin root.

That gives both clients:

- MCP tools
- MCP prompt definitions

Claude Code also gets repo-local project slash commands.

For Codex, the documented path is manual MCP attachment through [.mcp.json](E:/Personal/claude-interrogate/.mcp.json), which runs `node ./dist/server.js`.

## 3. MCP Tool Surface

The MCP server exposes these tools:

- `design_interview_start`
- `design_doc_generate`
- `design_audit`
- `design_cross_ref_sync`

These map to:

- [src/interview.ts](E:/Personal/claude-interrogate/src/interview.ts)
- [src/generate.ts](E:/Personal/claude-interrogate/src/generate.ts)
- [src/audit.ts](E:/Personal/claude-interrogate/src/audit.ts)
- [src/sync.ts](E:/Personal/claude-interrogate/src/sync.ts)

## 4. MCP Prompt Slash Commands

The server now exposes MCP prompts. Claude Code can discover them as slash commands with normalized names:

- `/mcp__claude_interrogate__interrogate <concept> <docs-dir> [challenge]`
- `/mcp__claude_interrogate__audit <docs-dir>`
- `/mcp__claude_interrogate__sync <docs-dir>`

These prompts are implemented in [src/server.ts](E:/Personal/claude-interrogate/src/server.ts).

## 5. Project And Plugin Commands

The repository also ships project-local Claude Code commands:

- `/interrogate <concept> [docs-dir]`
- `/interrogate-hard <concept> [docs-dir]`
- `/audit-docs [docs-dir]`
- `/sync-docs [docs-dir]`

These live in:

- [interrogate.md](E:/Personal/claude-interrogate/.claude/commands/interrogate.md)
- [interrogate-hard.md](E:/Personal/claude-interrogate/.claude/commands/interrogate-hard.md)
- [audit-docs.md](E:/Personal/claude-interrogate/.claude/commands/audit-docs.md)
- [sync-docs.md](E:/Personal/claude-interrogate/.claude/commands/sync-docs.md)

The project commands are intentionally written to:

- prefer MCP prompt slash commands
- fall back to direct MCP tool usage
- fall back again to the local CLI when the MCP server is unavailable

For Codex, use the checked-in MCP configuration rather than a plugin marketplace flow.

## 6. Remaining Gaps

What still is not finished:

- automatic permission presets for the MCP tools
- a packaged binary/distribution path that avoids the build step
- more precise semantic placement of resolved answers within the best target section
- a verified Codex plugin install flow

So the internal-tool answer is now:

- direct Claude Code slash commands: yes
- MCP-backed Codex workflow: yes, via manual MCP attachment
- MCP-backed Claude Code workflow: yes
- fully polished enterprise distribution: not yet
