# Claude Interrogate Plugin
Updated: 2026-04-08

Install this plugin from a Claude Code marketplace to get design-doc commands and the backing MCP server in one package.

Claude Code commands (namespaced):

- `/claude-interrogate:interrogate <concept> [docs-dir]`
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

Codex note: Codex does not register new top-level `/...` slash commands from this plugin. Instead, use the installed skills:

- Run `/skills` and select one of:
  - `claude-interrogate-interrogate`
  - `claude-interrogate-audit-docs`
  - `claude-interrogate-sync-docs`
- Or type `$` and mention the skill by name.

If you want to confirm the MCP server is attached in the current Codex session, run `/mcp`.

Requirements:

- The plugin payload must include the built server at `runtime/dist/server.js`.
- If you install from source, run `npm install` and `npm run build` once before using the MCP-backed commands. The build now syncs the runtime into the plugin payload automatically.

For runtime distribution, publish the prepared payload from `runtime-dist/` instead of this source repo directly.

For Codex, install the plugin if you want the skills UX. If you only want MCP tools, attach the repository or runtime `.mcp.json` manually.
