---
name: claude-interrogate-adr
description: Log an Architecture Decision Record under <docs-dir>/ADR/ with NNNN-slug numbering. Use when the user has settled a non-trivial design, architecture, tooling, or pipeline decision and wants it filed for later reference.
---

# Claude Interrogate: ADR

Use this skill when the user has just settled a non-trivial decision and wants it recorded so future sessions can find it. The skill writes a single numbered ADR file and appends an index entry. It does not invoke any MCP tool.

## Inputs

- `title` (optional) — short noun phrase. If absent, infer from the most recent decision in the conversation.
- `adr_dir` (optional) — where to write the ADR.

## Steps

1. Decide the title:
   - If the user provided one, use it verbatim.
   - Otherwise infer it from the most recent design, architecture, tooling, or pipeline decision in the conversation, and confirm the inferred title with the user before writing.
   - Keep it a short noun phrase, not a sentence.
2. Resolve the ADR directory:
   - If the user passed one, use it.
   - Else, look for `adrDir` in `claude-interrogate.json` or `.claude-interrogate.json`.
   - Else, resolve `docsDir` the same way other claude-interrogate skills do (config → `./docs`) and use `<docsDir>/ADR/`.
   - Create the directory if it does not exist.
3. List the ADR directory and find the highest existing `NNNN-` prefix (ignore `index.md`). The new ADR number is that +1, zero-padded to 4 digits. If empty, start at `0001`.
4. Slugify the title for the filename: lowercase, ASCII only, hyphens between words, no punctuation. Filename: `NNNN-slug.md`.
5. Write the ADR file using this template, with today's date in `YYYY-MM-DD`:

   ```markdown
   # ADR-NNNN: <Title>

   **Date:** YYYY-MM-DD

   ## Problem

   <one or two paragraphs on the situation that forced the decision>

   ## Solution

   <what was chosen, with the specific reason it won>

   ## Alternatives

   - **<alt>** — <why it was rejected, deferred, or set aside>
   - **<alt>** — <…>
   ```

   Pull Problem / Solution / Alternatives from the actual conversation. Do not invent strawman alternatives to pad the section. If only one option was seriously on the table, write `- No alternatives were seriously considered.` under Alternatives.
6. Append the new entry to `<adr-dir>/index.md` in numeric order. Line format: `- [ADR-NNNN: Title](NNNN-slug.md)`. If `index.md` does not exist, create it with `# ADR Index` followed by a blank line, then the entry. Do not rewrite the existing index — insert the new line in the right place.
7. Print the relative path of the new ADR file.

## Don'ts

- Don't add sections the user didn't ask for (Status, Consequences, Supersedes, Tags). The format is intentionally minimal.
- Don't write an ADR without first confirming the user wants one, unless they explicitly invoked the skill.
- Don't paraphrase the decision so abstractly that a future reader can't tell what was actually chosen. Name the concrete approach, file, library, or pattern.
