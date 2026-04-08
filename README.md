# claude-interrogate
Updated: 2026-04-08

A Socratic design-document interviewer for Claude Code, shipped as an MCP server. It reads an existing docs folder, finds what is already decided, asks targeted questions about what is still unresolved, and writes a new document in the local house style.

The interview is mildly adversarial by design: it asks for rejected alternatives, failure evidence, and the cost of leaving a decision vague. `--challenge` raises that tone further.

Current release history lives in [CHANGELOG.md](E:/Personal/claude-interrogate/CHANGELOG.md).

## What It Does

- `interrogate <concept>` runs an interactive interview in a TTY and writes the resulting doc.
- `interrogate <concept>` also supports non-interactive response flags for scripted runs.
- `interrogate <concept> --challenge` pushes harder on weak or underspecified decisions.
- `interrogate --sync` rewrites cross-reference sections so each doc lists the same sibling set and can place clearly answered questions back into body sections.
- `interrogate --audit` reports missing cross-references, stale open questions, and basic house-style drift.
- Generated docs can include an optional `Inspirations` section for relevant reference designs and why their design moves apply.
- Empty docs directories are bootstrapped with a safe skeleton so greenfield projects still have a starting point.

## Current Status

- The repo currently ships a working CLI and a working MCP server.
- The repo now includes a project `.mcp.json` so Claude Code can attach the MCP server at project scope after build.
- The MCP server exposes tools and prompts Claude Code can call once the server is connected.
- The repo now also provides first-class project slash commands in `.claude/commands/`.
- Cross-reference sync now normalizes sibling link sections and can place clearly answered open questions back into body sections.

## v1 Scope

- End-to-end interview start flow for `interrogate <concept>`.
- Mildly adversarial questioning by default, with an explicit `--challenge` mode.
- Reporting-only audit mode.
- Cross-reference sync mode that normalizes sibling links across the docs set.
- Sync can place already-answered open questions back into body sections when the answer is explicit elsewhere in the docs set.
- House-style detection for section numbering, cross-reference heading shape, and open-questions heading shape.
- Sample docs and demo commands in this repository.

## Install

Claude Code marketplace install target:

```text
/plugin marketplace add <your-org-or-repo>
/plugin install claude-interrogate-internal@claude-interrogate
```

For a clean public/runtime repo split, generate the distribution payload with:

```bash
npm run prepare:runtime-dist
```

That produces `runtime-dist/`, which is intended to be published as the separate runtime/install repository.

After install, the plugin provides:

- `/claude-interrogate:interrogate <concept> [docs-dir]`
- `/claude-interrogate:interrogate-hard <concept> [docs-dir]`
- `/claude-interrogate:audit-docs [docs-dir]`
- `/claude-interrogate:sync-docs [docs-dir]`

Source-repo setup:

```bash
npm install
npm run build
```

Claude Code project setup:

```bash
/mcp
```

This repository includes both a project-scoped [.mcp.json](E:/Personal/claude-interrogate/.mcp.json) and an installable plugin scaffold under [plugins/claude-interrogate](E:/Personal/claude-interrogate/plugins/claude-interrogate). After `npm run build`, Claude Code can discover the server's MCP tools and prompt-based slash commands.

Run the CLI:

```bash
npm run cli -- gateway-events --docs ./sample-docs
```

Non-interactive example:

```bash
npm run cli -- gateway-events --docs ./sample-docs --challenge --problem "Decide how gate events are represented." --success "A single event schema works across API and UI." --shape "Use markdown-backed docs plus MCP tools because bespoke storage adds cost without solving a real problem." --constraints "Respect existing event naming conventions and markdown-as-source-of-truth." --edges "Handle greenfield docs directories, partial answers, and ambiguous ownership."
```

Run the MCP server over stdio:

```bash
npm start
```

## Claude Code

This project now integrates with Claude Code in two ways:

1. MCP prompts exposed by the server
2. Project slash commands committed under `.claude/commands/`
3. Installable plugin commands under `plugins/claude-interrogate/commands/`

What works now:

- Claude Code can use the MCP tools exposed by this server after the project `.mcp.json` is active.
- Claude Code can use MCP prompt slash commands:
  - `/mcp__claude_interrogate__interrogate <concept> <docs-dir> [challenge]`
  - `/mcp__claude_interrogate__audit <docs-dir>`
  - `/mcp__claude_interrogate__sync <docs-dir>`
- Claude Code can use project slash commands:
  - `/interrogate <concept> [docs-dir]`
  - `/interrogate-hard <concept> [docs-dir]`
  - `/audit-docs [docs-dir]`
  - `/sync-docs [docs-dir]`
- Claude Code can use plugin-installed slash commands:
  - `/claude-interrogate:interrogate <concept> [docs-dir]`
  - `/claude-interrogate:interrogate-hard <concept> [docs-dir]`
  - `/claude-interrogate:audit-docs [docs-dir]`
  - `/claude-interrogate:sync-docs [docs-dir]`
- The tool surface is:
  - `design_interview_start`
  - `design_doc_generate`
  - `design_audit`
  - `design_cross_ref_sync`

What does not exist yet:

- A zero-setup binary distribution that avoids the initial `npm install && npm run build`
- Automatic permission presets for MCP tools inside Claude Code
- A richer Claude Code plugin layer beyond project commands and MCP prompts

## MCP Tools

- `design_interview_start(concept, docs_dir)`
- `design_doc_generate(concept, responses, output_path, docs_dir?)`
- `design_audit(docs_dir)`
- `design_cross_ref_sync(docs_dir)`

## Demo

```bash
npm run cli -- gateway-events --docs ./sample-docs
npm run cli -- --sync --docs ./sample-docs
npm run cli -- --audit --docs ./sample-docs
```

Claude Code slash command examples:

```text
/interrogate gateway-events ./sample-docs
/interrogate-hard routing-spec ./sample-docs
/audit-docs ./sample-docs
/sync-docs ./sample-docs
/mcp__claude_interrogate__audit ./sample-docs
```

Sample output shape:

```text
Concept: gateway-events
Docs Dir: .../sample-docs
Style: ## 1.; cross-refs="Cross-References"; open-questions="Open Questions"
Questions:
- [Foundations] problem: What concrete decision does "gateway-events" need to lock down...
```

## Repository Layout

- `src/` TypeScript sources for the CLI, MCP server, and core logic.
- `.claude/commands/` project slash commands for Claude Code.
- `.mcp.json` project MCP configuration for Claude Code.
- `plugins/claude-interrogate/` installable Claude Code plugin scaffold.
- `.agents/plugins/marketplace.json` marketplace metadata for plugin installation.
- `runtime-dist/` generated publishable payload for the separate runtime repo.
- `sample-docs/` a tiny reference docs directory for demos and local testing.
- `docs/` project notes, including Claude Code integration status.
- `PLAN.md` the original implementation brief used for this scaffold.

## Deferred

- Multi-session interview state.
- Automatic follow-up termination based on semantic resolution instead of a lightweight heuristic.
- More precise semantic placement of resolved answers within the best target section.
- Non-markdown formats.
