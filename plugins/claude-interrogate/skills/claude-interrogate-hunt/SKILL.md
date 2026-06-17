---
name: claude-interrogate-hunt
description: Hunt down technical debt — scour code (or one feature) for bugs, gaps, design drift, and over-engineering (KISS/DRY/YAGNI), then log a dated kill list to the tech-debt file and offer to destroy the cheap ones. Use when the user says "hunt", "find debt", "find and destroy debt", or wants an adversarial sweep of the implementation (not just the docs).
---

# Claude Interrogate: Hunt (find and destroy debt)

Use this skill when the user wants an adversarial sweep of the **implementation** — code, not just docs — to find problems and log them as technical debt.

Be a debt bounty hunter: a lazy senior dev paged at 3am for someone else's cleverness. Semi-mean, blunt, evidence-first. Every finding names a `file:line` and the cheapest way to kill it — meanness never substitutes for proof.

## Steps

1. **Scope.** Take the optional target (a path, glob, or feature name) from the user. Empty = the whole project; respect `.gitignore`, skip `node_modules`/build output/vendored code.
2. **Resolve targets.** Design source: `docsDir` from `claude-interrogate.json` / `.claude-interrogate.json`, else `./docs`, else none (say so). Kill-list file: `roadmap.techDebtFile` (default `Roadmap/TECHNICAL_DEBT.md`); create it and parents if missing.
3. **Hunt (read-only).** Sweep for: bugs & gaps (unhandled errors, missing validation at trust boundaries, dead code, swallowed exceptions, `TODO`/`FIXME`/`HACK`); design drift (implementation vs. written design — features the design never describes, promises the code never kept, contracts that disagree with their spec, citing both sides); over-engineering (one-impl abstractions, factories for one product, reinvented stdlib/native features, speculative scaffolding, copy-paste — name the simpler approach); and low-impact wins. Separate proven findings from inferences; skip linter-catchable nits.
4. **Kill list.** One bullet per finding: `- [SEV] <title> — <file:line>. <what's wrong>. **Kill:** <cheapest fix>.` with `SEV` ∈ `CRIT`/`HIGH`/`MED`/`LOW`, grouped worst-first. Read the existing tech-debt file first — don't re-post a bounty already there; flag any prior entry now fixed.
5. **Write gate.** Present the kill list, scope, design-drift summary, and target path. Ask `confirm` / `modify` / `deny` / `cancel`. On confirm, **append** a dated `## YYYY-MM-DD — Hunt: <scope>` section (today's date), preserving prior content. If the implementation has structurally drifted from (or lacks) a design, offer to write a post-design `<feature>-as-built.md` in the docs dir — only if it earns its keep.
6. **Destroy (optional).** After logging, offer to destroy the `LOW`/one-line bounties now (deletions, stdlib swaps, dead-code removal). `MED`+ or hard-to-reverse stays on the board for a deliberate pass. Never auto-destroy; verify with type check / lint / tests after any kill.
