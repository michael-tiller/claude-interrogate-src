---
description: Log an Architecture Decision Record under <docs-dir>/ADR/ with NNNN-slug numbering
argument-hint: [title]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# ADR

The user invoked this command with: $ARGUMENTS

## Instructions

1. Treat `$ARGUMENTS` as the ADR title (free-form). If empty, infer the title from the most recent design, architecture, tooling, or pipeline decision in the conversation. Use a short noun phrase, not a sentence ("SO-as-source-of-truth content load path", not "We decided to make SO the source of truth").
2. Resolve the ADR directory in this order:
   - `adrDir` in `claude-interrogate.json` or `.claude-interrogate.json` if present.
   - Otherwise resolve `docsDir` the same way the other commands do (config → `./docs` → `./sample-docs`) and use `<docsDir>/ADR/`.
   - Create the directory if it does not exist.
3. List the ADR directory and find the highest existing `NNNN-` prefix (ignore `index.md`). The new ADR number is that +1, zero-padded to 4 digits. If the folder is empty, start at `0001`.
4. Slugify the title for the filename: lowercase, hyphens between words, ASCII only, no punctuation. The filename is `NNNN-slug.md`.
5. Write the file with this exact template, using today's date in `YYYY-MM-DD`. Pull Problem / Solution / Alternatives from the actual conversation — do not invent strawman alternatives to pad the section. If only one option was ever seriously on the table, write `- No alternatives were seriously considered.` under Alternatives.

   ```markdown
   # ADR-NNNN: <Title>

   **Date:** YYYY-MM-DD

   ## Problem

   <one or two paragraphs on the situation that forced the decision — the constraint, conflict, or pain point>

   ## Solution

   <what was chosen, with the specific reason it won over the alternatives>

   ## Alternatives

   - **<alt>** — <one line on why it was rejected, deferred, or set aside>
   - **<alt>** — <…>
   ```

6. Append a line for the new ADR to `<adr-dir>/index.md`, in numeric order. Line format: `- [ADR-NNNN: Title](NNNN-slug.md)`. If `index.md` does not exist, create it with a top-level heading `# ADR Index` followed by a blank line before the first entry. Don't rewrite the existing index — just insert the new line in the right place.
7. Print the relative path of the file you wrote so the user can open it.

## Don'ts

- Don't add sections the user didn't ask for (Status, Consequences, Supersedes, Tags). The format is intentionally minimal — extend it only when the user explicitly requests it.
- Don't write an ADR without first confirming the user wants one, unless they invoked `/claude-interrogate:adr` directly.
- Don't paraphrase the decision so abstractly that a future reader can't tell what was actually chosen. Name the concrete approach, file, library, or pattern.
