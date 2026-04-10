# Claude Code Project Commands
Updated: 2026-04-08

These files create project-local Claude Code slash commands for this repository.

Available commands:

- `/interrogate <concept> [docs-dir]`
- `/interrogate-easy <concept> [docs-dir]`
- `/interrogate-fast <concept> [docs-dir]`
- `/interrogate-hard <concept> [docs-dir]`
- `/reinterrogate <doc-path> [docs-dir]`
- `/reinterrogate-easy <doc-path> [docs-dir]`
- `/reinterrogate-fast <doc-path> [docs-dir]`
- `/redress <doc-path> [docs-dir]`
- `/distill <concept> [docs-dir]`
- `/distill-hard <concept> [docs-dir]`
- `/extricate <concept> [docs-dir]`
- `/trace <concept> [docs-dir]`
- `/trace --index [docs-dir]`
- `/convert <source> [docs-dir]`
- `/expose [docs-dir]`
- `/glossary [docs-dir]`
- `/refresh [docs-dir] [topic]`
- `/reveal [docs-dir] [topic]`
- `/summarize <concept> [docs-dir]`
- `/audit-docs [docs-dir]`
- `/sync-docs [docs-dir]`

They are designed to prefer the MCP prompts exposed by this repo's server and fall back to direct MCP tool calls or the local CLI when necessary.
