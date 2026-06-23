---
description: Recommend the next logical flay target — rank the auto-pickable taskout items, propose the top one with rationale, then STOP. The human invokes /flay. Never dispatches.
argument-hint: "[output-dir]"
allowed-tools: [Read, Glob, Grep, Bash]
---

# Inquisitor (recommend the next target)

The user invoked this command with: $ARGUMENTS

Follow the `claude-interrogate-inquisitor` skill with **mode = recommend**.

1. Optional argument: output directory (default: current working directory).
2. **WIP gate first.** If `.captain-sdlc/flay-state.json` exists, a flay is already in
   flight — STOP and report it; do not pick. (See the skill's single-flay gate.)
3. Walk the roadmap in index order, judge each candidate from a single RC's export, and
   recommend the top **auto-pickable** item: key, text, its RC, a one-line *why this one*,
   and a runner-up or two. Then STOP. This command never invokes flay — the human runs
   `/flay <key>` (or `/flay-auto`). No vibe opt-in is carried.
4. If items remain but none are auto-pickable (blocked / cross-RC / stale), report the
   **needs-a-human** bucket with blockers and owners — do NOT fall through to the
   empty-board fallback.
5. If the board is genuinely empty (every listed RC fully checked, or no roadmap), present
   both `/roadmap` and `/hunt` and let the human choose. Never auto-decide which.
