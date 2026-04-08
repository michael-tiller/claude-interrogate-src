# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project uses Semantic Versioning.

## [0.1.0] - 2026-04-08

### Added

- Initial TypeScript CLI and MCP server for design-doc interrogation, audit, and sync flows.
- Claude Code project commands, MCP prompt integration, and installable plugin scaffolding.
- Repo config support via `claude-interrogate.json` or `.claude-interrogate.json`.
- Optional `styleTemplate` support for a golden document template.
- Built-in fallback golden template when no explicit template is configured.
- Metadata enforcement for managed docs: `Created`, `Updated`, and `Version`.
- `Version History` scaffold for newly generated docs.
- Runtime/distribution repo generation scripts and supporting documentation.

### Changed

- Interview flow now instructs Claude Code to keep the question queue private and ask one question at a time.
- Plain `/interrogate` now explicitly forces `challenge=false`; hard mode is isolated to `/interrogate-hard`.
- Inspirations are now optional and only appear in generated docs when actually provided.
- Sample docs were rewritten to use generic product/system examples instead of game-specific examples.

### Notes

- Packaging and demo recording remain the next major steps after manual testing.
