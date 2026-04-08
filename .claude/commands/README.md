# Claude Code Project Commands
Updated: 2026-04-08

These files create project-local Claude Code slash commands for this repository.

Available commands:

- `/interrogate <concept> [docs-dir]`
- `/interrogate-hard <concept> [docs-dir]`
- `/audit-docs [docs-dir]`
- `/sync-docs [docs-dir]`

They are designed to prefer the MCP prompts exposed by this repo's server and fall back to direct MCP tool calls or the local CLI when necessary.
