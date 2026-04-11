# claude-interrogate
Updated: 2026-04-08

A Socratic design-document interviewer for Claude Code, shipped as an MCP server. The same server can also be attached from Codex via MCP. It reads an existing docs folder, finds what is already decided, asks targeted questions about what is still unresolved, and writes a new document in the local house style.

The interview is mildly adversarial by design: it asks for rejected alternatives, failure evidence, and the cost of leaving a decision vague. `--challenge` raises that tone further.

Current release history lives in [CHANGELOG.md](CHANGELOG.md).

## What It Does

- `interrogate <concept>` runs an interactive interview in a TTY and writes the resulting doc.
- `interrogate <concept>` also supports non-interactive response flags for scripted runs.
- `interrogate --summarize <concept>` reports what the docs already establish about a feature without asking questions or writing anything.
- `reinterrogate <doc>` modernizes an existing spec against newer sibling knowledge without silently preserving stale assumptions.
- `redress <doc>` brings an existing file up to the contemporary local house style without silently reopening its core decisions.
- `distill <concept>` derives a separate exploratory spec without narrowing the canonical spec.
- `extricate <concept>` plans careful feature removal, retirement, or replacement across the docs set.
- `trace <concept>` maps where a concept is defined, consumed, and drifting across the docs set.
- `trace --index` builds a TOC-style `map.md` for the docs set when you want topology instead of a single-feature trace.
- `convert <source>` promotes or transforms one design artifact into another form with explicit confirmation before write.
- `expose` builds an `expose.md` report of missing decisions, undefined seams, and risky ambiguities across the docs set.
- `glossary` builds a `glossary.md` file of common domain terms used across the docs set.
- `refresh` builds a `refresh.md` report of potentially out-of-date elements and the forced interview areas required to update them.
- `reveal` builds a `reveal.md` report of remaining open questions across the docs set or for one specific topic.
- `interrogate <concept> --challenge` pushes harder on weak or underspecified decisions.
- `interrogate --sync` rewrites cross-reference sections so each doc lists the same sibling set and can place clearly answered questions back into body sections.
- `interrogate --audit` reports missing cross-references, stale open questions, and basic house-style drift.
- Generated docs can include an optional `Inspirations` section for relevant reference designs and why their design moves apply.
- Empty docs directories are bootstrapped with a safe skeleton so greenfield projects still have a starting point.

## Current Status

- The repo currently ships a working CLI and a working MCP server.
- The repo now includes a project `.mcp.json` so Claude Code or Codex can attach the MCP server at project scope after build.
- The MCP server exposes tools and prompts either client can call once the server is connected.
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
/plugin marketplace add michael-tiller/claude-interrogate
/plugin install claude-interrogate
```

Codex manual MCP setup from this repo:

```json
{
  "mcpServers": {
    "claude-interrogate": {
      "command": "node",
      "args": ["./dist/server.js"]
    }
  }
}
```

This repository already includes that configuration in [`.mcp.json`](.mcp.json). Build the repo, then attach the workspace MCP server from Codex.

For a clean public/runtime repo split, generate the distribution payload with:

```bash
npm run prepare:runtime-dist
```

That produces `runtime-dist/`, which is intended to be published as the separate runtime/install repository.

After install in Claude Code, the plugin provides:

See `plugins/claude-interrogate/README.md` for the full plugin command list (and details on Codex vs Claude Code command naming).

Codex TUI uses bare slash commands (drop the `claude-interrogate:` namespace). Because plugin commands are prefixed to avoid collisions, use commands like `/claude-interrogate-interrogate ...`.

Command naming quick map:

- Claude Code project commands (from `.claude/commands/`): `/interrogate ...`
- Claude Code plugin commands (plugin-installed, namespaced): `/claude-interrogate:claude-interrogate-interrogate ...`
- Codex plugin commands (plugin-installed, bare): `/claude-interrogate-interrogate ...`

Note: the `.claude/commands/` project command set includes extra variants like `/interrogate-easy` and `/interrogate-fast`; the plugin command set does not.

Note: the Codex plugin command names were previously unprefixed (for example `/interrogate`); the prefix is a breaking change intended to avoid collisions.

Source-repo setup:

```bash
npm install
npm run build
```

Project MCP setup:

```bash
/mcp
```

This repository includes both a project-scoped [.mcp.json](.mcp.json) and an installable plugin scaffold under [plugins/claude-interrogate](plugins/claude-interrogate). After `npm run build`, Claude Code can use the plugin/project command path and Codex can attach the MCP server from the checked-in config. The build now syncs the compiled server into `plugins/claude-interrogate/runtime/dist/` so installed plugin copies remain self-contained.

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

## Codex And Claude Code

This project now integrates with Claude Code directly and with Codex through the shared MCP server:

1. MCP prompts exposed by the server
2. Project slash commands committed under `.claude/commands/`
3. Installable plugin commands under `plugins/claude-interrogate/commands/`

What works now:

- Claude Code can use the MCP tools exposed by this server after the project `.mcp.json` is active.
- Codex can use the same MCP tools after attaching the workspace MCP server from `.mcp.json`.
- The server exposes MCP prompt surfaces that Claude Code can discover as slash commands:
  - `/mcp__claude_interrogate__interrogate <concept> <docs-dir> [challenge]`
  - `/mcp__claude_interrogate__redress <doc-path> <docs-dir>`
  - `/mcp__claude_interrogate__trace <concept> <docs-dir>`
  - `/mcp__claude_interrogate__convert <source> <docs-dir> [target_form]`
  - `/mcp__claude_interrogate__expose <docs-dir> [output_path]`
  - `/mcp__claude_interrogate__glossary <docs-dir> [output_path]`
  - `/mcp__claude_interrogate__refresh <docs-dir> [topic] [output_path]`
  - `/mcp__claude_interrogate__reveal <docs-dir> [topic] [output_path]`
  - `/mcp__claude_interrogate__summarize <concept> <docs-dir>`
  - `/mcp__claude_interrogate__audit <docs-dir>`
  - `/mcp__claude_interrogate__sync <docs-dir>`
- Claude Code can use project slash commands:
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
- Claude Code can use plugin-installed slash commands (namespaced); see the install section above.
- The tool surface is:
  - `design_interview_start`
  - `design_summarize`
  - `design_doc_generate`
  - `design_audit`
  - `design_cross_ref_sync`

What does not exist yet:

- A zero-setup binary distribution that avoids the initial `npm install && npm run build`
- Automatic permission presets for MCP tools inside either client
- A richer plugin layer beyond project commands and MCP prompts
- A verified Codex plugin install flow

## MCP Tools

- `design_interview_start(concept, docs_dir)`
- `design_summarize(concept, docs_dir)`
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
/trace routing-spec ./sample-docs
/trace --index ./sample-docs
/convert ./sample-docs/routing-spec-distill.md ./sample-docs
/audit-docs ./sample-docs
/sync-docs ./sample-docs
/mcp__claude_interrogate__audit ./sample-docs
```

Sample output shape:

```text
Concept: gateway-events
Docs Dir: .../sample-docs
Style: ## 1.; cross-refs="Cross-References"; open-questions="Open Questions"
Prepared 5 interview topics.
The question queue is kept internal; ask them one at a time and only surface the current question.
```

## Repository Layout

- `src/` TypeScript sources for the CLI, MCP server, and core logic.
- `.claude/commands/` project slash commands for Claude Code.
- `.mcp.json` project MCP configuration for Claude Code and Codex.
- `plugins/claude-interrogate/` installable Claude Code plugin scaffold and the source for runtime packaging.
- `runtime-dist/` generated publishable payload for the separate runtime repo.
- `sample-docs/` a tiny reference docs directory for demos and local testing.
- `docs/` project notes, including Claude Code integration status.
- `PLAN.md` the original implementation brief used for this scaffold.


Plugin Repository:

- https://github.com/michael-tiller/claude-interrogate

## Deferred

- Multi-session interview state.
- Automatic follow-up termination based on semantic resolution instead of a lightweight heuristic.
- More precise semantic placement of resolved answers within the best target section.
- Non-markdown formats.
