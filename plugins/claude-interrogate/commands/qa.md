---
description: Orchestrate the QA pass that clears a Needs-QA taskout item — walk a human through its acceptance criteria, capture screenshots as evidence, and on pass authorize the Completes: footer; --elevate runs objective AC as tests and omits the human
argument-hint: "<task-key> [output-dir] [--elevate]"
allowed-tools: [Read, Glob, Grep, Bash, Edit, Write, Agent]
---

# QA (acceptance pass)

The user invoked this command with: $ARGUMENTS

Follow the `claude-interrogate-qa` skill.

1. First argument is the task key (an interrogate key from `design_taskout_export`,
   e.g. `MRC1_LAUNCH#auth-hardening#a1b2c3d4e5f6`). Required — if missing, do NOT
   pick one: list the active RC's `Needs-QA` keys and ask the human to assign.
2. Optional: an output directory (default: current working directory).
3. `--elevate` (or "elevate past HITL" / "skip the human" / "just run the tests")
   asks QA to omit the human where it can. Honored **per-AC**: objective AC run as
   real checks with no human; a taste-laden AC (look / feel / layout / copy) can
   never be elevated — it stays HITL or goes `unseen`, never auto-`pass`. Default is
   HITL.
4. QA validates built work; it never builds. PASS → hand the key to the task-footers
   flow with verb `Completes`; FAIL → leave it at `Needs-QA` and point at `/flay`.
5. Capture screenshots only for visible AC, into `.captain-sdlc/qa/<key>/`; a taste
   AC's screenshot is the artifact the human accepts against. Outcome line goes to
   `scratch.md`.
6. QA never selects, ranks, or recommends which item to QA. Assignment is the human's.
