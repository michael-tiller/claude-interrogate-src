# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project uses Semantic Versioning.

## [0.1.4] - 2026-05-28

### Fixed

- Re-publish the `adr`, `roadmap`, and `taskout` flows that landed in 0.1.3's source but did not make it into the 0.1.3 distribution-repo artifact. The 0.1.3 marketplace build shipped the runtime code for the new flows but was missing their command markdown and skill SKILL.md files — installed users had v0.1.3 with no surfaced way to invoke the new flows. The packaging error was a manual version-bump in distribution-repo without re-running `npm run prepare:distribution-repo`; this release re-runs the prepare step end-to-end so the marketplace artifact actually contains what 0.1.3 was named for.

## [0.1.3] - 2026-05-28

### Added

- `adr` flow (`/adr`, `/claude-interrogate:adr`, `claude-interrogate-adr` skill) for logging numbered Architecture Decision Records under `<docs-dir>/ADR/` with a minimal Problem/Solution/Alternatives template and a markdown index.
- `roadmap` flow (`/roadmap`, `/claude-interrogate:roadmap`, `claude-interrogate-roadmap` skill) for socratically scoping a concept-doc set into `roadmap.md` plus per-RC stubs. Backed by new MCP tools `design_scope_start` and `design_scope_generate`.
- `taskout` flow (`/taskout`, `/claude-interrogate:taskout`, `claude-interrogate-taskout` skill) for breaking a release candidate into epic-level checklists and a definition of done. Backed by new MCP tools `design_taskout_start` and `design_taskout_generate`.
- Path-safety module with validators for relative paths, RC ids, RC naming schemes, and `assertWithinDir` (guards against parent traversal, drive letters, and sibling-prefix traps). Covered by a new vitest suite.
- Roadmap config loader with defaults (`indexFile`, `rcDir`, `rcNamingScheme`, `techDebtFile`, `reservedSlots`, `marketingWaypoints`, `anchorSources`) under a new `roadmap` block in `claude-interrogate.json`.
- `VERSION` file at the repo root tracking the released semver.

### Changed

- `distill` and `distill-hard` flows now lead their output specs with an explicit Definition of Done checklist.
- READMEs and the runtime-distribution preparation script updated to enumerate the new commands and skills.

## [0.1.2] - 2026-04-09

### Added

- New `redress` flow for bringing an existing doc up to current local house style without reopening its core decisions.
- New report-oriented flows for `expose`, `glossary`, `refresh`, and `reveal`, with matching Claude command and plugin surfaces.
- Post-edit document normalization that can infer semantic version bumps, ensure managed sections exist, and append version-history entries automatically.
- Coverage for post-edit normalization behavior, including patch, minor, and major document-version bump cases.
- Release-readiness checks for the generated Codex MCP runtime configuration in the runtime distribution.

### Changed

- Project docs now document a manual Codex MCP attachment path instead of an unverified plugin install flow.
- Runtime distribution prep now emits a checked-in `.mcp.json` for Codex alongside the existing Claude Code plugin payload.
- Interview, conversion, and maintenance prompt flows now consistently support explicit `cancel` handling for abandoned write tasks.
- Cross-reference sync and doc generation now route file updates through the same metadata and version-history normalization path.

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
