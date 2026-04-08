# claude-interrogate

A Socratic design-document interviewer for Claude Code, shipped as an MCP server. Turns the "Claude asks good questions, then writes a formatted spec" pattern into an installable tool.

## The Pattern It Automates

1. User points Claude at a concept ("gate event") and an existing docs folder.
2. Claude reads the folder, finds what's already decided, and generates targeted questions about what isn't.
3. User answers conversationally; Claude asks follow-ups until each area is resolved.
4. Claude writes a new doc in the house style (§-numbered sections, cross-refs, Open Questions) and syncs cross-references across sibling docs.

The engine is the prompt. The MCP server is plumbing that makes it installable, invocable, and demoable.

## Modes

- **`interrogate <concept>`** — new doc generation. Reads docs dir → interview → writes `<concept>.md` → updates cross-refs in siblings.
- **`interrogate --audit`** — reads all docs, reports gaps, contradictions, missing cross-refs, stale Open Questions.
- **`interrogate --sync`** — rewrites the cross-reference section in every doc so they agree.

## MCP Tools Exposed

- `design_interview_start(concept, docs_dir)` → returns grounded question set after reading existing docs.
- `design_doc_generate(concept, responses, output_path)` → writes formatted markdown in the detected house style.
- `design_audit(docs_dir)` → returns gap/contradiction report.
- `design_cross_ref_sync(docs_dir)` → rewrites cross-ref sections in place.

Each tool is thin. The model does the thinking; the server handles file I/O, style detection, and formatting guarantees.

## Interview Prompt Contract

The interview prompt must:

- Ask about **decisions**, not descriptions.
- Expose **trade-offs** and present forks as explicit options.
- Never re-ask anything already answered in the existing docs.
- Order questions by dependency (foundations before details).
- Group by theme; stay conversational.
- Flag contradictions with existing docs when the user's answer introduces one.
- Terminate when the concept is resolved enough to write, not when a fixed question count is hit.
- Any edited file should be updated with current date somewhere near top of file.

Three knobs to decide before first build:

1. **Depth per topic** — fixed cap vs. "until resolved." Default: until resolved, with a soft cap the user can raise.
2. **Adversarial vs. clarifying** — does it push back on weak answers? Default: clarifying, with an opt-in `--challenge` flag.
3. **Contradiction handling** — silent note, inline flag, or hard stop. Default: inline flag, user decides.

## House-Style Detection

The server doesn't hardcode a format. On first run in a docs dir, it samples existing files and extracts:

- Section numbering convention (`§1`, `## 1.`, etc.)
- Cross-reference section location and shape
- Presence/shape of an Open Questions section
- Tone cues (terse, parenthetical clarifications, inspirations callouts)

These become part of the generation prompt so new docs match what's already there.

## Tech Stack

- TypeScript, `@modelcontextprotocol/sdk`, stdio transport.
- No database. Docs dir is the source of truth.
- Packaged as npm CLI (`npx claude-interrogate-mcp`) and as an MCPB desktop extension.

## Scope for v1 (weekend)

- Mode 1 (`interrogate <concept>`) end-to-end.
- Mode 2 (`--audit`) reporting only, no auto-fix.
- House-style detection limited to section numbering + cross-ref shape.
- README with a recorded demo against a sample docs dir.

Deferred: `--sync` auto-rewrite, `--challenge` adversarial mode, multi-project memory, non-markdown formats.

## Distribution

- npm package
- GitHub repo with sample docs dir + demo recording
- Submission to awesome-mcp-servers and the MCP registry
- MCPB desktop extension build
- Short write-up framing it as "infrastructure for AI-assisted design work," not "a prompt I wrote"

## Open Questions

- Should audit mode auto-open a PR-style diff, or just print a report? Sequenced Report. A list of "Action Items" is more actionable than a giant diff. Let the user run interrogate --fix <issue_id> later.
- Does the interview persist partial state across sessions, or is each run atomic? Atomic runs for v1. Keep it simple. If the user quits, they restart. For v2, save an .interrogate.json state file in the docs folder.
- How does it behave when the docs dir is empty (greenfield project)? Bootstrap a skeleton, or refuse? Bootstrap a skeleton in safe format.
- Is there value in a `--style <path>` flag that points at a reference doc to mimic, independent of the target dir? Yes, it will allow people to customize their template.
- Does cross-ref sync touch Open Questions sections, or leave them alone as user-owned? Sync touches both. If a question is answered during an interview, the sync tool should move it from "Open Questions" to the body text or "Resolved Decisions."

