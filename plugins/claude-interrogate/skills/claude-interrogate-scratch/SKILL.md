---
name: claude-interrogate-scratch
description: Maintain scratch.md — the project's intraday register of work in flight. Triages existing entries (removes done work, defers non-active items to the roadmap or tech-debt files, keeps and trims active ones), then prepends a dated section for the current session. Use when the user wants to leave notes mid-task — a lunch break, the end of a work day, or a hand-off to another agent — or asks to "scratch this".
---

# Claude Interrogate: Scratch

`scratch.md` is the project's intraday register of **work currently in flight** — the notes that carry an unfinished task across a lunch break, the end of a work day, or a hand-off to another agent. It is not a long-term punch list, not a roadmap, not a tech-debt backlog. Items live here only while they are being actively worked, and they leave the moment the work lands or is parked elsewhere.

This skill invokes no MCP tool. Every invocation does two things, in order: triage what is already there, then prepend a dated section for this session.

## Inputs

- `topic` (optional) — short title for the new section. If absent, infer it from the dominant thread of the current conversation.
- `scratch_file` (optional) — path to the register. Resolve in this order:
  - `scratchFile` in `claude-interrogate.json` or `.claude-interrogate.json` if present (resolved relative to the config file).
  - Otherwise `./scratch.md` at the project root (the current working directory).
- Cross-reference targets for triage come from the `roadmap` block of `claude-interrogate.json` — the same keys the roadmap skill uses: `rcDir` (default `Roadmap`), `indexFile` (default `roadmap.md`), `techDebtFile` (default `Roadmap/TECHNICAL_DEBT.md`), `rcNamingScheme` (default `{prefix}{milestone}_{NAME}.md`). If the project has no roadmap or tech-debt files, skip the "defer to roadmap/tech-debt" disposition entirely and only keep or remove.

## Step 1 — triage existing entries

Read the full file. For every existing entry, pick exactly one disposition:

- **Remove** — work is done (no remaining concrete next step), or the entry duplicates something already tracked in the roadmap (`<indexFile>`, or a file under `<rcDir>/`) or the tech-debt file (`<techDebtFile>`). Deletion is the right exit; do not move it under a "Done" heading — the changelog already does that job.
- **Defer** — work is not actively in flight today and has no concrete next step the user is about to pick up. Move the entry to `<techDebtFile>` (or to a milestone file under `<rcDir>/` if it is clearly milestone-scoped). Rewrite it to the target file's format: a bullet with a concrete next step plus an evidence pointer (file:line / log line / commit). Then remove it from scratch.
- **Keep** — work IS in flight, has a concrete next step, and is not tracked elsewhere. Trim the narrative — strip "what we tried" history, the surrounding session log, and status retrospectives. Leave only what is missing + the next concrete step + a minimal evidence pointer.

When unsure between defer and keep, ask: *"Is the user going to touch this in the next day or two?"* If no, defer.

Never duplicate an entry between scratch and the roadmap/tech-debt files. If it lives there, it does not belong here — even when it is "in progress." Scratch is for the current intraday task, not for all current work.

Before deferring, read the target file: the entry may already exist there and just need an update rather than a fresh add.

## Step 2 — prepend the new section

Pick a topic for the new section:
- Use the `topic` input if provided.
- Otherwise infer it from the dominant thread of the current conversation.
- Title format: `# <Topic> — YYYY-MM-DD`, using today's date.

Write the section using the template below. Pull every fact from the actual conversation — do not invent file paths, line numbers, or hypotheses that were not discussed.

Prepend the new section above any surviving prior content, with a `---` rule between sections so the boundary is clear. Preserve the file-purpose header block at the top if one is present. If the file does not exist yet, create it, seed it with the purpose-header block (below), then add the dated section beneath that block.

Print the path of the file you wrote so the user can open it.

## Purpose-header block (seed only when creating the file)

```markdown
**What this file IS:** a lean operator-facing register of work that is mid-progress, deferred, blocked, or otherwise NOT done. Each entry answers two questions in as few words as possible: (1) what is missing, and (2) the next concrete step (or what is blocking it). Think "punch list," not narrative. Entries are removed when the work is done.

**What this file is NOT:** a changelog, a session log, a closeout report, or a place to celebrate shipped work. Completed work belongs in the changelog or release notes; in-milestone progress belongs in the roadmap; durable decisions belong in an ADR. When a scratch entry is done, delete it — do not move it under a "Done" heading.

---
```

## Template

```markdown
# <Topic> — YYYY-MM-DD

**Status:** <one line — what's done, what's pending, what's blocked>

**Symptom:** <user-observed behavior, in their words where possible>

**Root cause:** <the actual mechanism, with file:line evidence>

**Fix(es):**
- <what landed, what's untested, what's held>

**Files touched this session:**
- `<path>` — <one line on what changed and why>

**Verification:**
- <log line / test / screenshot to confirm on the next run>

**Dead-ends (don't redo):**
- <theory investigated and ruled out, with the reason it was ruled out>

---
```

## Rules

- **Non-destructive on prepend.** Prepend by Editing an existing line as the anchor. Triage edits (remove / defer) are destructive by design — that is the point.
- **Omit empty sections.** No dead-ends to record? Leave the section out — do not write `- None`.
- **Be specific.** Name files, line numbers, functions, log strings. Future-you reading this in three days must be able to act without re-reading the conversation.
- **Capture failed paths.** Anything tried and ruled out goes under "Dead-ends" so the next session does not repeat it.
- **Don't summarize the obvious.** Skip "we discussed the problem" filler. Lead with what changed and what to do next.
- **Don't write a commit message.** That belongs to the commit/release flow (e.g. claude-release's `/commit`).
- **Stay under 60 lines** for the new section. If the work needs more, suggest an ADR or a plan doc.
- **Report the triage.** After both steps, briefly list what was removed, what was deferred (and to where), and what was kept, so the user can sanity-check the disposition calls.
