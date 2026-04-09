# Claude Interrogate Plugin
Updated: 2026-04-08

Install this plugin from a Claude Code marketplace to get design-doc commands and the backing MCP server in one package.

Commands:

- `/claude-interrogate:interrogate <concept> [docs-dir]`
- `/claude-interrogate:interrogate-easy <concept> [docs-dir]`
- `/claude-interrogate:interrogate-fast <concept> [docs-dir]`
- `/claude-interrogate:interrogate-hard <concept> [docs-dir]`
- `/claude-interrogate:reinterrogate <doc-path> [docs-dir]`
- `/claude-interrogate:distill <concept> [docs-dir]`
- `/claude-interrogate:distill-hard <concept> [docs-dir]`
- `/claude-interrogate:extricate <concept> [docs-dir]`
- `/claude-interrogate:trace <concept> [docs-dir]`
- `/claude-interrogate:trace --index [docs-dir]`
- `/claude-interrogate:convert <source> [docs-dir]`
- `/claude-interrogate:summarize <concept> [docs-dir]`
- `/claude-interrogate:audit-docs [docs-dir]`
- `/claude-interrogate:sync-docs [docs-dir]`

Requirements:

- The repository must include the built server at `dist/server.js`.
- If you install from source, run `npm install` and `npm run build` once before using the MCP-backed commands.

For runtime distribution, publish the prepared payload from `runtime-dist/` instead of this source repo directly.
