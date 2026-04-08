# Claude Interrogate Plugin
Updated: 2026-04-08

Install this plugin from a Claude Code marketplace to get design-doc commands and the backing MCP server in one package.

Commands:

- `/claude-interrogate:interrogate <concept> [docs-dir]`
- `/claude-interrogate:interrogate-hard <concept> [docs-dir]`
- `/claude-interrogate:audit-docs [docs-dir]`
- `/claude-interrogate:sync-docs [docs-dir]`

Requirements:

- The repository must include the built server at `dist/server.js`.
- If you install from source, run `npm install` and `npm run build` once before using the MCP-backed commands.

For runtime distribution, publish the prepared payload from `runtime-dist/` instead of this source repo directly.
