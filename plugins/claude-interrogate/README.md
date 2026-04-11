# Claude Interrogate Plugin
Updated: 2026-04-08

Install this plugin from a Claude Code marketplace to get design-doc commands and the backing MCP server in one package.

Claude Code commands (namespaced):

- `/claude-interrogate:claude-interrogate-interrogate <concept> [docs-dir]`
- `/claude-interrogate:claude-interrogate-interrogate-hard <concept> [docs-dir]`
- `/claude-interrogate:claude-interrogate-reinterrogate <doc-path> [docs-dir]`
- `/claude-interrogate:claude-interrogate-redress <doc-path> [docs-dir]`
- `/claude-interrogate:claude-interrogate-distill <concept> [docs-dir]`
- `/claude-interrogate:claude-interrogate-distill-hard <concept> [docs-dir]`
- `/claude-interrogate:claude-interrogate-extricate <concept> [docs-dir]`
- `/claude-interrogate:claude-interrogate-trace <concept> [docs-dir]`
- `/claude-interrogate:claude-interrogate-trace --index [docs-dir]`
- `/claude-interrogate:claude-interrogate-convert <source> [docs-dir]`
- `/claude-interrogate:claude-interrogate-expose [docs-dir]`
- `/claude-interrogate:claude-interrogate-glossary [docs-dir]`
- `/claude-interrogate:claude-interrogate-refresh [docs-dir] [topic]`
- `/claude-interrogate:claude-interrogate-reveal [docs-dir] [topic]`
- `/claude-interrogate:claude-interrogate-summarize <concept> [docs-dir]`
- `/claude-interrogate:claude-interrogate-audit-docs [docs-dir]`
- `/claude-interrogate:claude-interrogate-sync-docs [docs-dir]`

Codex note: when installed as a Codex plugin, interactive slash commands come from `commands/*.md` filenames as bare slash names (no `claude-interrogate:` namespace). These command filenames are prefixed to avoid collisions. For example, use `/claude-interrogate-interrogate test-concept`, not `/claude-interrogate:claude-interrogate-interrogate test-concept`.

Requirements:

- The plugin payload must include the built server at `runtime/dist/server.js`.
- If you install from source, run `npm install` and `npm run build` once before using the MCP-backed commands. The build now syncs the runtime into the plugin payload automatically.

For runtime distribution, publish the prepared payload from `runtime-dist/` instead of this source repo directly.

For Codex, use the repository or runtime `.mcp.json` to attach the MCP server manually rather than a plugin marketplace flow.
