# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project uses Semantic Versioning.

## [0.1.1] - 2026-04-08

### Added

- Read-only `summarize` mode for reporting what the docs already establish about a feature without interrogating or writing.
- `reinterrogate` flow for modernizing an existing spec against newer sibling knowledge before overwrite confirmation.
- `distill` flow for deriving a separate exploratory implementation slice from the canonical spec.
- `extricate` flow for dependency-aware removal, retirement, or replacement planning across the docs set.
- Challenge/depth variants for interview flows, including easy and fast modes.
- Additional Claude Code command surfaces for `interrogate-easy`, `interrogate-fast`, `reinterrogate`, `reinterrogate-easy`, `reinterrogate-fast`, `distill`, `distill-hard`, `extricate`, and `summarize`.
- `design_summarize` MCP tool and matching prompt surface.

### Changed

- Interview orchestration now better matches manual testing: one-question-at-a-time flow, private question queue, and confirm/modify/deny before writing.
- Generated docs now normalize authoring metadata more aggressively and favor ASCII-safe typography in generated prose.
- The exploratory MVP flow was renamed to `distill` and explicitly positioned as a separate living artifact that does not constrain the canonical spec.
- README and runtime/distribution docs were updated to reflect the current command surface and maintenance workflows.
- Public marketplace install docs now use the Claude Code flow for `michael-tiller/claude-interrogate`.
- Distribution prep can now refresh a checked-out `distribution-repo/` without deleting its nested `.git/` directory.

### Notes

- Manual testing against `laird2` validated the reinterrogation loop and surfaced the next likely quality focus: better long-section structuring in generated docs and deeper maintenance flows.

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
