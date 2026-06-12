---
description: Execute one human-assigned taskout item through plan mode, implementation, verification, and a Seam 7 footered commit — HITL at every phase boundary
argument-hint: "<task-key> [output-dir]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, Agent]
---

# Flay (HITL task execution)

The user invoked this command with: $ARGUMENTS

Follow the `claude-interrogate-flay` skill with **mode = hitl**.

1. First argument is the task key (an interrogate key from `design_taskout_export`,
   e.g. `MRC1_LAUNCH#auth-hardening#a1b2c3d4e5f6`). Required — if missing, do NOT
   pick one: list the active RC's exported keys and ask the human to assign.
2. Optional second argument: output directory (default: current working directory).
3. Pause for an explicit go-ahead at every phase boundary:
   assigned → planning → plan-approved → implementing → verifying → committing → done.
4. State lives in `.captain-sdlc/flay-state.json` (single task — an existing file
   forces resume-or-abandon first). Outcome line goes to `scratch.md` on completion.
5. Flay never selects, ranks, or recommends work. Assignment is the human's.
