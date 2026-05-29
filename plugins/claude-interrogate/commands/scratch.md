---
description: Maintain scratch.md — triage the intraday in-flight register, then prepend a dated section for this session
argument-hint: [topic]
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write]
---

# Scratch

The user invoked this command with: $ARGUMENTS

`scratch.md` is the project's intraday register of **work currently in flight** — notes that carry an unfinished task across a lunch break, the end of a work day, or a hand-off to another agent. It is not a roadmap, a changelog, or a tech-debt backlog. Do two things, in order: triage what is already there, then prepend a dated section for this session.

## Resolve targets

1. Resolve the register file: `scratchFile` in `claude-interrogate.json` or `.claude-interrogate.json` if present (relative to the config file); otherwise `./scratch.md` at the project root.
2. Resolve the triage cross-reference targets from the `roadmap` block of `claude-interrogate.json` (same keys the roadmap command uses): `rcDir` (default `Roadmap`), `indexFile` (default `roadmap.md`), `techDebtFile` (default `Roadmap/TECHNICAL_DEBT.md`), `rcNamingScheme` (default `{prefix}{milestone}_{NAME}.md`). If the project has no roadmap or tech-debt files, skip the "defer to roadmap/tech-debt" disposition and only keep or remove.

## Step 1 — triage existing entries

Read the full file. For every existing entry, pick exactly one disposition:

- **Remove** — work is done (no remaining concrete next step), or it duplicates something already tracked in the roadmap (`<indexFile>`, or a file under `<rcDir>/`) or the tech-debt file (`<techDebtFile>`). Delete it; do not move it under a "Done" heading — the changelog already does that.
- **Defer** — work is not actively in flight today and has no concrete next step the user is about to pick up. Move it to `<techDebtFile>` (or a milestone file under `<rcDir>/` if clearly milestone-scoped), rewritten to that file's format: a bullet with a concrete next step plus an evidence pointer (file:line / log line / commit). Then remove it from scratch.
- **Keep** — work IS in flight, has a concrete next step, and is not tracked elsewhere. Trim the narrative — strip "what we tried" history, the session log, and status retrospectives. Leave only what is missing + the next concrete step + a minimal evidence pointer.

When unsure between defer and keep, ask: *"Is the user going to touch this in the next day or two?"* If no, defer. Never duplicate an entry between scratch and the roadmap/tech-debt files. Before deferring, read the target file — the entry may already exist there and just need an update.

## Step 2 — prepend the new section

Treat `$ARGUMENTS` as the section topic. If empty, infer the topic from the dominant thread of the current conversation. Title format: `# <Topic> — YYYY-MM-DD`, using today's date.

Pull every fact from the actual conversation — do not invent file paths, line numbers, or hypotheses that were not discussed. Prepend the new section above any surviving prior content, with a `---` rule between sections. Preserve the file-purpose header block at the top if one is present. If the file does not exist yet, create it, seed it with the purpose-header block below, then add the dated section beneath it. Print the path of the file you wrote.

### Purpose-header block (seed only when creating the file)

```markdown
**What this file IS:** a lean operator-facing register of work that is mid-progress, deferred, blocked, or otherwise NOT done. Each entry answers two questions in as few words as possible: (1) what is missing, and (2) the next concrete step (or what is blocking it). Think "punch list," not narrative. Entries are removed when the work is done.

**What this file is NOT:** a changelog, a session log, a closeout report, or a place to celebrate shipped work. Completed work belongs in the changelog or release notes; in-milestone progress belongs in the roadmap; durable decisions belong in an ADR. When a scratch entry is done, delete it — do not move it under a "Done" heading.

---
```

### Template

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

- **Non-destructive on prepend.** Prepend by Editing an existing line as the anchor. Triage edits (remove / defer) are destructive by design.
- **Omit empty sections.** No dead-ends to record? Leave the section out — do not write `- None`.
- **Be specific.** Name files, line numbers, functions, log strings. Future-you reading this in three days must be able to act without re-reading the conversation.
- **Capture failed paths.** Anything tried and ruled out goes under "Dead-ends" so the next session does not repeat it.
- **Don't write a commit message.** That belongs to the commit/release flow (e.g. claude-release's `/commit`).
- **Stay under 60 lines** for the new section. If the work needs more, suggest an ADR or a plan doc.
- **Report the triage.** After both steps, briefly list what was removed, what was deferred (and to where), and what was kept, so the user can sanity-check the disposition calls.
