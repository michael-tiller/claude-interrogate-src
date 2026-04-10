# Claude Interrogate Plugin
Updated: 2026-04-08

Install this plugin from a Claude Code marketplace to get design-doc commands and the backing MCP server in one package.

Commands:

- `/claude-interrogate:interrogate <concept> [docs-dir]`
- `/claude-interrogate:interrogate-easy <concept> [docs-dir]`
- `/claude-interrogate:interrogate-fast <concept> [docs-dir]`
- `/claude-interrogate:interrogate-hard <concept> [docs-dir]`
- `/claude-interrogate:reinterrogate <doc-path> [docs-dir]`
- `/claude-interrogate:redress <doc-path> [docs-dir]`
- `/claude-interrogate:distill <concept> [docs-dir]`
- `/claude-interrogate:distill-hard <concept> [docs-dir]`
- `/claude-interrogate:extricate <concept> [docs-dir]`
- `/claude-interrogate:trace <concept> [docs-dir]`
- `/claude-interrogate:trace --index [docs-dir]`
- `/claude-interrogate:convert <source> [docs-dir]`
- `/claude-interrogate:expose [docs-dir]`
- `/claude-interrogate:glossary [docs-dir]`
- `/claude-interrogate:refresh [docs-dir] [topic]`
- `/claude-interrogate:reveal [docs-dir] [topic]`
- `/claude-interrogate:summarize <concept> [docs-dir]`
- `/claude-interrogate:audit-docs [docs-dir]`
- `/claude-interrogate:sync-docs [docs-dir]`

Requirements:

- The plugin payload must include the built server at `runtime/dist/server.js`.
- If you install from source, run `npm install` and `npm run build` once before using the MCP-backed commands. The build now syncs the runtime into the plugin payload automatically.

For runtime distribution, publish the prepared payload from `runtime-dist/` instead of this source repo directly.

For Codex, use the repository or runtime `.mcp.json` to attach the MCP server manually rather than a plugin marketplace flow.
