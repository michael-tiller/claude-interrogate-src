---
name: claude-interrogate-audit-docs
description: Audit a docs directory for gaps, contradictions, and stale questions using the claude-interrogate MCP server.
---

# Claude Interrogate: Audit docs

Use this skill when the user wants a read-only audit of a docs directory.

## Steps

1. Ask for the target `docs_dir`.
2. If a style template is configured (via `styleTemplate` in `claude-interrogate.json` / `.claude-interrogate.json`), pass it as `style_template_path`.
3. Call the `design_audit` tool from the `claude-interrogate` MCP server.
4. Present:
   - the top findings (with severity)
   - concrete action items
5. Do not modify files unless the user explicitly asks for follow-up edits.
