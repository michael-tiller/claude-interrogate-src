---
name: claude-interrogate-sync-docs
description: Normalize cross-references across a docs directory using the claude-interrogate MCP server.
---

# Claude Interrogate: Sync docs

Use this skill when the user wants cross-reference sections normalized across a docs directory.

## Steps

1. Ask for the target `docs_dir`.
2. If a style template is configured (via `styleTemplate` in `claude-interrogate.json` / `.claude-interrogate.json`), pass it as `style_template_path`.
3. Warn the user this operation may edit multiple files.
4. If confirmed, call the `design_cross_ref_sync` tool from the `claude-interrogate` MCP server.
5. Summarize `updatedFiles` and any `notes`.
