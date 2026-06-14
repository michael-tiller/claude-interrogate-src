---
description: Execute one human-assigned taskout item end-to-end without phase pauses — harness gates still apply; verify failures downgrade to HITL; completion defaults to Needs-QA
argument-hint: "<task-key> [output-dir]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, Agent]
---

# Flay Auto (full-auto task execution)

The user invoked this command with: $ARGUMENTS

Follow the `claude-interrogate-flay` skill with **mode = auto**.

1. First argument is the task key (from `design_taskout_export`). Required — never
   pick one yourself; assignment is the human's even in auto mode.
2. Optional second argument: output directory (default: current working directory).
3. No pauses at phase boundaries, BUT harness gates can never be waived: plan-mode
   approval (ExitPlanMode) and permission prompts remain hard gates.
4. Any verification failure → announce and downgrade to HITL for the rest of this
   flay. Never retry-loop.
5. The completion footer defaults to `Needs-QA:` — unwatched work is exactly what
   QA exists for. `Completes:` only if the human pre-authorized it when invoking.
6. **Taste gate.** A taste-laden item (art / UX / UI — see the skill) does NOT
   silently auto-run: STOP at Assigned and push for collaboration or a
   Socratic-into-attempt. Vibe-based full-auto only on an explicit per-item opt-in.
