---
description: Pick the next logical flay target and dispatch /flay-auto on it — one auto-pickable target, then stop. Carries a standing vibe opt-in so the autopilot doesn't stall on flay's taste gate.
argument-hint: "[output-dir]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, Agent]
---

# Inquisitor Auto (pick and dispatch)

The user invoked this command with: $ARGUMENTS

Follow the `claude-interrogate-inquisitor` skill with **mode = dispatch**.

1. Optional argument: output directory (default: current working directory).
2. **WIP gate first.** If `.captain-sdlc/flay-state.json` exists, a flay is already in
   flight — STOP and report it; do not pick. (See the skill's single-flay gate.)
3. Pick the top **auto-pickable** item (single-RC export, roadmap order — never a cross-RC
   or blocked one) and invoke `/flay-auto` on its key. **One target, then stop** — do not
   chain to the next item; the human re-invokes for the next.
4. **Standing vibe opt-in.** `/flay-auto` stops at Assigned on a taste-laden item with no
   opt-in, which would stall the autopilot. So carry the vibe opt-in for the dispatched
   item — flay records it in `history` as "vibe opt-in via /inquisitor-auto", and still logs
   the vibed taste call to `.captain-sdlc/taste-debt.md` (polish queued, never buried).
5. If items remain but none are auto-pickable, report the **needs-a-human** bucket and stop
   — do NOT fall through to the empty-board fallback.
6. If the board is genuinely empty, surface both `/roadmap` and `/hunt` and stop — choosing
   the kind of new work is a human call, not the autopilot's.
