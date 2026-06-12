---
description: Migrate a pre-existing roadmap directory into the interrogate format — generate the missing roadmap.md index, detect zero-padded naming, normalize nonstandard checkbox markers
argument-hint: "[output-dir]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Migrate Roadmap

The user invoked this command with: $ARGUMENTS

## Instructions

1. Optional argument: output directory (default: current working directory). Roadmap
   conventions come from the `roadmap` block in `claude-interrogate.json`.
2. Call `design_roadmap_migrate` with `output_dir` only (dry-run) and present the
   report: files found, padding detection, the suggested `rcNamingScheme`, the
   proposed `roadmap.md` content, and EVERY warning verbatim — especially:
   - nonstandard markers (`[~]` etc.) the parser silently skips,
   - numbered checklists (`1. [ ]`) the parser cannot see,
   - flat Targeted checkboxes with no `###` subsection (dropped by the parser),
   - statuses outside {Stub, Active, Shipped}.
3. Walk the user through the decisions: adopt the suggested naming scheme in
   `claude-interrogate.json` (zero-padded projects need it — no file renames)?
   Normalize markers? Fix numbered/flat checklists by hand or have you convert them?
4. On explicit confirmation, re-run with `apply: true` (plus `normalize_markers`
   if chosen). The tool refuses to overwrite an existing `roadmap.md`.
5. After apply: remind the user the generated index has TBD placeholders (Thesis,
   MIN PLAY, Prerequisite Chain, Anchors) — `/roadmap` maintenance mode is the
   socratic way to fill them.
