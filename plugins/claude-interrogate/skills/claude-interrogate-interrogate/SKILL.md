---
name: claude-interrogate-interrogate
description: Run the claude-interrogate design interview flow for a concept against an existing docs directory.
---

# Claude Interrogate: Interrogate

Use this skill when the user wants to interrogate a new design concept against an existing documentation set and produce a new spec in the local house style.

## Inputs

- `concept` (required)
- `docs_dir` (optional)

## Steps

1. Ask for the `concept` and (optionally) a `docs_dir`.
2. If `docs_dir` was not provided, resolve it the same way the CLI does:
   - If `claude-interrogate.json` or `.claude-interrogate.json` exists, use its `docsDir`.
   - Otherwise default to `./docs`.
3. If a style template is configured (via `styleTemplate` in the same config file), use it as `style_template_path`.
4. Ensure `docs_dir` exists before invoking the MCP tools. If it does not exist, ask the user whether Codex should create it.
5. Call the `design_interview_start` tool from the `claude-interrogate` MCP server with:
   - `concept`
   - `docs_dir`
   - `challenge=false`
   - `challenge_mode="standard"` (unless the user explicitly asks for adversarial pressure)
   - `depth_mode="standard"` (or `"fast"` if the user asks for a quicker pass)
6. Present a short summary of the returned `knownDecisions` / `contradictions`, then ask the interview questions one at a time in dependency order.
7. Collect answers keyed by question `id`.
8. Before writing, restate the key decisions back to the user and ask for explicit confirmation.
9. If confirmed, call the `design_doc_generate` tool from the same MCP server with:
   - `concept`
   - `docs_dir`
   - `style_template_path` (if configured)
   - `responses`
   - `output_path` = `<docs_dir>/<slugified concept>.md` (match the CLI naming convention)
