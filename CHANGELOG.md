# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog and the project uses Semantic Versioning.

## [0.1.25] - 2026-07-10

### Changed

- **Flay outcome log moved out of `scratch.md` into a dedicated `.captain-sdlc/flay-log.md`.** `/flay` and `/flay-auto` now prepend the done/abandon outcome line to `flay-log.md` — a durable, committed, newest-first audit trail — instead of `scratch.md`, the ephemeral in-flight register that heals to empty and is the wrong home for a persistent flay record. Skill + `/flay` command doc retargeted; the skill clarifies `flay-log.md` is committed (unlike the gitignored `flay-state.json`).

### Fixed

- **Definition-of-Done checked state and nested subsections now round-trip.** `definitionOfDone` was typed `string[]`, so every `design_taskout_generate` maintenance pass silently reset every RC's DOD checkboxes to unchecked, and a nested `### <subheading>` checklist under `## Definition of Done` (e.g. a separately-gated accelerated/parallel track) collapsed into the flat list, losing its own grouping. New `DoDItem { text, checked, subheading? }` carries checked state and subsection grouping end-to-end through `parseRCFile`, `ConfirmedTaskoutPlan`, and `renderTaskout`; `design_taskout_start`'s DOD interview question now tells the caller to echo checked state back and how to group a sub-track. Found and reproduced against dirigible2D's `M04_CLASSES_SKILLS` RC file (a `.draft.md` diff showed 56→47 checked items before promotion was caught and aborted). 144/144 tests green, including a new explicit round-trip assertion for mixed checked-state + subheading grouping.

## [0.1.24] - 2026-06-30

### Fixed

- **Inquisitor carry-redirect detection** — the RC-walk no longer wedges on a pre-ADR-0030 source-RC breadcrumb. Such a roadmap leaves an *unchecked* `CARRIED to <RC>` (or `→ M{NN}`) pointer in the source milestone whose live form is a fresh box in the destination milestone; the walk treated that pointer as open work and never advanced past it. Now an RC whose only unchecked items are carry-redirects is treated as fully checked and stepped past, and carry-redirects are excluded from auto-pick (dispatching one would hand flay-auto an empty pointer with no spec).
- **Inquisitor in-review detection** — auto-pick now skips work that is built but not yet QA-closed. Because the roadmap checkbox is binary, an item flayed to a `Needs-QA:` (or mid-build `Implements:`) footer still reads `[ ]` and looked identical to fresh to-do, so the autopilot would re-dispatch it to be rebuilt from scratch (flay's own gate only catches the terminal `[x]`). The walk now resolves the latest Seam-7 footer verb per item key — reusing `release-pass --list-transitions` when the engine is reachable, else parsing commit footers inline with `git log`, and degrading to today's binary behavior when neither is available — and routes in-review items to the needs-a-human bucket. Markdown stays binary (clickup protocol Principle 1): no new glyph, no hard dependency on the ClickUp mirror. Residual gap documented in the skill: work built entirely outside the Seam-7 flow leaves no footer and cannot be caught at pick time (a process guard, not detection).

## [0.1.23] - 2026-06-23

### Added

- **`/inquisitor` next-target orchestrator** — the deliberate counterpart to flay's "never pick" rule. It ranks the auto-pickable taskout items in roadmap order and either recommends the next one with rationale (`/inquisitor`) or dispatches `/flay-auto` on it (`/inquisitor-auto`); on an empty board it surfaces `/roadmap` and `/hunt` for the human to choose. Single-stream (WIP=1, gated on `flay-state.json`), single-RC export, literal `rcId` from the roadmap index (preserves zero-padding so keys mint correctly). Cross-RC blocked items are surfaced for the human and never auto-picked, so a dispatch is never the dead-end flay-auto's single-RC Blocked-detector would cancel. Ranker + dispatch table only — flay still owns the SDLC chain. Ships as plugin commands (`inquisitor`, `inquisitor-auto`) and a Codex/Skill-tool `SKILL.md` wrapper.

## [0.1.22] - 2026-06-22

### Added

- **flay per-task branch discipline** — flay now does the per-task tier of git hygiene instead of committing onto whatever branch is checked out. At Implementing it creates a `feat/<slug>` branch off the integration base (recorded as `baseBranch`; the working branch as `branch` in `flay-state.json`) and never edits the base directly; at Done it lands the task via a PR into `baseBranch` — `dev` (a sink) is squash-merged, `main`/`master` (protected) is push + PR + stop for the human to merge (never `--admin` bypass). HITL confirms the merge; auto merges a sink but always stops on a protected base. The higher `dev → main` tier (versioning, changelog, tags) stays with release (claude-release). New additive `branch`/`baseBranch` state fields (legacy files predate the discipline → treat the current branch as base, skip the auto-PR); documented in the skill's new **Branch discipline** section.
- **flay begin-of-flay in-progress hook** — when a flay begins (the Assigned phase, after the key validates and the Blocked-detector clears), flay now **auto-loads the warm spec** (the item's `howToImplement` / `designContext`) so the ticket is warm from the start instead of re-read at Planning, and writes the new `status: "in-progress"` field into `.captain-sdlc/flay-state.json`. That field is the local in-progress record AND an advisory hook a downstream tracker (the ClickUp mirror) can read to mirror the ticket to its in-progress status — flay still never calls a tracker itself (it emits the state; the blade reads it on its own next run). The contract — in-progress ⇔ a `flay-state.json` with `status: "in-progress"` and the immutable `task_id`; no-longer-in-progress ⇔ the file is gone, with the terminal `Needs-QA:`/`Completes:` status arriving via the existing Seam 7 commit footer — is documented in the flay skill's new **In-progress hook** section. Additive field: a legacy state file without `status` is still valid (file-presence = in-progress).

### Changed

- **`/qa` is now a guided tour** — the HITL acceptance pass no longer hands the human a setup chore. The AI stands up the test environment and drives the app to each criterion (launch via the `run` skill, navigate, seed preconditions), so the human is handed a ready-to-judge check, confirms one AC at a time, and on a clean pass the two close the ticket together (`Completes:` → the ClickUp lifecycle hook moves it Review → Done and stops the stopwatch). Elevation past HITL still omits the human for objective AC. Documented in the QA skill's guided-tour workflow.

## [0.1.21] - 2026-06-20

### Added

- **`/qa` acceptance-pass skill** — a new station that resolves the `Needs-QA` state flay leaves behind. flay ships unwatched work with a `Needs-QA:` footer, and its own taste gate already defers `Completes:` until "the human has actually SEEN the result"; `/qa <task-key>` is that seeing. It reads the assigned item's AC/DoD from `design_taskout_export`, walks the human through each criterion, captures screenshots for the visible ones into `.captain-sdlc/qa/<key>/`, and on a clean pass authorizes the Seam 7 promotion `Needs-QA: → Completes:` (handing the key to the task-footers flow); a failure leaves the item at `Needs-QA` and points back at `/flay` — QA validates built work, it never builds or rewrites the roadmap. It classifies every AC as **objective** (machine-decidable) or **taste** (needs a human eye) and, at an explicit request to elevate past HITL (`/qa <key> --elevate`), runs the objective AC as real tests and omits the human — per-AC, never blanket: a taste-laden AC can never be elevated (it stays HITL or goes `unseen`, never auto-`pass`), so a mixed item runs *partial* (objective checks headless, taste AC to the human). Ships as a plugin command, a local dogfood mirror, and a Codex/Skill-tool `SKILL.md` wrapper, like `/flay` and `/hunt`.
- **Immutable taskout ticket keys** — a Targeted ticket's interrogate key (`<RCID>#<epic-slug>#<digest>`) is now **stored, not re-derived**, so rewording a ticket, renaming its epic, or moving it no longer mints a new key and orphans the references that depend on it (flay assignment, `- Blocked-by:` edges, Seam 7 commit footers, the ClickUp mirror). Each ticket persists its key as a trailing `<!-- key: … -->` comment on the checkbox line and reads it back as the source of truth: `parseTargeted` strips/captures it (item text stays clean and hash-stable), `keyedTargeted` mints a digest only for a brand-new keyless ticket (the unchanged algorithm, so legacy files reproduce today's keys then freeze) and derives the epic key from its items so it survives a heading rename, and `renderTaskout`/`renderRCStub` re-emit the comment. The maintenance rebuild path (`generateTaskout`) reattaches prior keys before render via `carryForwardKeys` — agent-echoed key → exact-text match → unambiguous single-reword — never guessing a key onto the wrong ticket (an unresolved ticket is minted fresh, a clean miss rather than a wrong identity). The invariant is documented in `seam-task-identity.md` and covered by `tests/taskout-key-immutability.test.ts`.

### Changed

- **flay plan-review gate is now sequential and cached** — the dual-critic gate added in 0.1.17 ran both critics on every revision and capped auto at two rounds. It now runs **one critic at a time**: Claude's `plan-reviewer` loops to `IMPLEMENTATION READY` first, then codex validates that exact unedited revision, and any codex fix sends the plan back to Claude — so a critic's call is never spent on a plan the other would still reject. The loop is unbounded (each revision is a real improvement) with a deadlock guard that downgrades to HITL rather than oscillate forever (replacing the old two-round auto cap). Both critics read and write a single verdict artifact (`.captain-sdlc/plan-review.txt`) instead of re-scanning each other's prose, and the plan-reviewer keeps a grounding-fact cache (`.captain-sdlc/plan-review-grounding.txt`) it reads back across rounds (codex may consult it too) so the same repo facts are not re-grepped every round; both files are deleted when the review phase ends so the next task starts fresh.

## [0.1.20] - 2026-06-18

### Added

- **Sequential `Phase N` epic convention (deterministic)** — a roadmap's `## Targeted` epics should be labeled as 1-indexed phases (`### Phase 1 — …`, `### Phase 2 — …`, …) in execution order, so the number IS the order and ClickUp reads coherently 1→2→3 instead of an out-of-sequence letter jumble (`E0, A, C, B…`). `analyzeTaskoutOrder` now computes `phaseSequenceViolations` (folded into `orderDiagnostics`): once ANY epic is phase-labeled, ALL must be (`partial-adoption` — a `Phase 1` / `Unnumbered` / `Phase 2` mix defeats "the number is the order"); the numbers must strictly ascend (`out-of-order`; gaps from a deferred phase are allowed) starting at 0 or 1 (`bad-start`; Phase 0 = the de-risking pre-work idiom, e.g. a spike). Silent for descriptive-heading RCs — the convention is opt-in via the `### Phase N` label. Surfaced (never thrown) at `design_taskout_export`; `design_taskout_generate` hard-refuses with `order-violation` on a violation. Authoring guidance (the `targeted` interview question + `taskout` skill + command + `design_taskout_start` prose) now directs authors to phase-label epics in execution order.

## [0.1.19] - 2026-06-18

### Added

- **Taskout order guard** — the Targeted list order IS the pushed (ClickUp) order, so an out-of-order or typo'd dependency now surfaces instead of shipping silently as the wrong "next task." A new pure `analyzeTaskoutOrder` classifies a Targeted list's `- Blocked-by:` edges against the list order: `blockedByViolations` (a blocker listed at/after its dependent — the order contradicts the dependency), `unresolvedBlockedBy` (a token that looks intra-RC — this RC's prefix, OR a bare digest / epic letter with no `#` — but matches no ticket key: a typo / wrong digest / stale ref; a full key with a *different* RC prefix is a legitimate upstream dep and is ignored), and `strayOrderingSections` (a `## Suggested/Execution/Implementation Order/Sequence` prose section — a divergent second order source the parser ignores). `design_taskout_export` now returns these as an additive, always-present `orderDiagnostics` field. A shared `keyedTargeted` key helper (extracted from `exportTaskout`) lets export and generate derive byte-identical keys.

### Changed

- **`design_taskout_generate` now refuses `order-violation`** — the write path runs the order guard **unconditionally** (so bootstrap-rc, the first-author path, is gated too) and throws when a `- Blocked-by:` edge contradicts the Targeted list order or points at a non-existent ticket key, naming each offending edge. The READ path (`design_taskout_export`) deliberately stays clean — it never throws on order diagnostics — so the flay blocked-detector and clickup-sync keep their "stale reference stays blocking, classified downstream" contract. Taskout authoring guidance (the `targeted`/`blockers` interview questions, the `taskout` skill + command) now directs authors to order EPICS (not just tickets within an epic) in execution order, never to author a separate ordering section, and to encode intended orderings as full-key `- Blocked-by:` edges (`<RCID>#<epic-slug>#<digest>`).

## [0.1.18] - 2026-06-18

### Added

- **Per-ticket Blocked-by / Owner** — a Targeted ticket can now carry indented `- Blocked-by:` (comma-separated upstream ticket keys it can't start before) and `- Owner:` (the single accountable human) sub-bullets, alongside the existing `- AC:` / `- How:` / `- Why:`. `parseTargeted` (`roadmap-parse`) comma-splits `Blocked-by` into a list and keeps `Owner` a single string; `design_taskout_export` surfaces them as optional `blockedBy` / `owner` ride-along fields (omitted when unauthored). Like the other sub-bullets they are held separately from the hashed item text, so existing item keys stay byte-stable — verified by a round-trip test that re-exports a fixture before/after adding the full sub-bullet set and asserts every key is unchanged. This is the export contract the ClickUp mirror's blocked-dependency sync and the flay blocked-detector consume. Per-ticket `blockedBy` is a distinct axis from the RC-level `RCMetadata.blockedBy` (other RC ids), noted in the types.
- **flay blocked-detector (pre-flight, read-only)** — at the Assigned phase, before creating `flay-state.json`, flay now confirms the work is actually runnable. It reads the fresh `design_taskout_export` plus a new flay-owned `.captain-sdlc/blocked-hitl.json` ledger and cancels (writing nothing — flay stays read-only) when: a `blockedBy` blocker is still unchecked (`blocked-dep`, both modes); a `blockedBy` key is absent from a clean export (a reworded-blocker **stale reference**, repaired by the human / `/taskout`, never reported as "unblocked"); or the key has a live `blocked-hitl` ledger entry (cancel in `/flay-auto`, proceed in `/flay` — the human is resuming). The auto→HITL verify downgrade now appends the key to that ledger (and records `downgradedAt` / `downgradedPhase` in flay-state); the entry clears at the Done step that deletes flay-state, auto-cleans when the item flips `[x]`, and has a documented manual reset.

### Changed

- **`- How:` anchors prefer symbols over line numbers** — the taskout skill and the `design_taskout_start` Targeted guidance now direct authors to anchor `- How:` on symbols (`Type.Method` / the named call site / the seam) rather than bare line numbers, which drift on the next edit; a cited line number must be marked `~approx, verify` so flay re-grounds it. Curbs the warm-anchor drift seen on long-lived RCs.
- **`renderRCStub` no longer drops per-ticket sub-bullets** — a maintenance scope rewrite previously emitted only each Targeted item's checkbox line, silently losing its `- AC:` / `- How:` / `- Why:` (and now `- Blocked-by:` / `- Owner:`). It now renders the full sub-bullet set, matching `renderTaskout`. Per-renderer round-trip tests assert each renderer's output parses and re-renders byte-identical against its own shape (the two are not mutually byte-equal — the RC stub adds Status / Last Updated / index lines).

## [0.1.17] - 2026-06-18

### Added

- **flay plan-review gate** — flay's Planning phase now runs an internal plan review *before* the human's plan approval. After a plan is drafted, two independent critics vet it and their blocking issues are folded back in before `ExitPlanMode`: a new in-plugin **`claude-interrogate:plan-reviewer`** subagent (a ruthless principal-engineer reviewer that hunts gaps, smells, conflicts, unverified assumptions, scope creep, and weak tests, ending in `VERDICT: NEEDS REVISION | IMPLEMENTATION READY`), plus a best-effort **codex third opinion** (`codex exec -s read-only`, skipped with a note when `codex` is absent so the gate never blocks on it). HITL loops revise→re-review until both verdicts read READY or the human waives; auto caps at two rounds and carries any unresolved blocker forward as an explicit caveat. The new agent ships in the plugin's `agents/` directory, so it always travels alongside the flay skill.

## [0.1.16] - 2026-06-17

### Added

- **Deep-shape-first taskout** — a *warm* ticket (one whose shape already exists in a `Plan/` doc or prior recon) can now carry its full implementation spec at taskout time, not just a title plus acceptance criteria. Two new per-ticket sub-bullets parse, render, and export alongside `- AC:`: `- How:` (the concrete implementation path — `file:line` / seam, held as `howToImplement`) and `- Why:` (traps + rationale, held as `designContext`). Both ride along as separate fields — never folded into the hashed item text — so item keys stay byte-stable. The taskout interview gains a warm-only `targeted-spec` question; *cold* tickets (no prior shape) stay thin and are spec'd at flay. `design_taskout_export` emits both fields (omitted when unauthored), so the ClickUp mirror and flay inherit execution context instead of re-deriving it.
- **`/hunt` (find and destroy debt)** — a new semi-mean review command that scours the whole project or a directed `[target]` for bugs, gaps, implementation-vs-design drift, and over-engineering (KISS/DRY/YAGNI), then logs a dated, severity-ordered **kill list** to the roadmap tech-debt file (each finding with `file:line` evidence and the cheapest fix) and offers to destroy the `LOW`/one-line bounties immediately. Ships as a plugin command, a local dogfood mirror, and a Codex/Skill-tool `SKILL.md` wrapper.

### Changed

- **flay warm/cold planning** — at Planning, flay reads the assigned item's spec from the export: a *warm* ticket (carries `howToImplement` / `designContext`) carries that spec forward as the plan's spine (verify against code, fill gaps, correct drift) rather than re-deriving it; a *cold* ticket derives the plan from scratch as before.
- **Taskout skill text** — the MCP `taskout` prompt's Targeted guidance still described the pre-agile "epic-level checklist items" model (a leftover the 0.1.15 agile rework missed in `server.ts`); it now matches the agile-correct epic/ticket/AC framing and documents warm-ticket spec capture.

### Fixed

- **`design_taskout_generate` opaque crash** — `confirmed_plan` reaches the MCP layer typed only as a bare object, so an LLM caller routinely omits optional arrays (e.g. `overrides`). The renderer then crashed with `Cannot read properties of undefined (reading 'find')`, naming no field. `generate` now normalizes missing arrays and validates `confirmed_plan` shape up front, failing with the offending field named.

## [0.1.15] - 2026-06-17

### Changed

- **Agile-correct taskout** — the per-RC interview and its directives (`SKILL.md`, `commands/taskout.md`) now use standard agile terms and resolve a prior contradiction (the skill called Targeted items "coarse work units" while the command called them "epic-level checklist items"). A `### heading` is an **epic** (a feature/area); each item under it is a **ticket** — one INVEST-sized goal, ≈ one ClickUp Task, listed in **execution order** (that order is the priority). Inter-ticket and external **dependencies** are always solicited: the Blockers & Dependencies question is no longer gated on auto-surfaced tech-debt/carried items. A de-risking **spike** is its own ticket.
- **Acceptance Criteria vs Definition of Done** — per-ticket criteria are now named **Acceptance Criteria** (the "is THIS ticket done" spec) and explicitly distinguished from the RC-wide **Definition of Done** (the shared ship gate every ticket inherits on top of its own criteria). The sizing rule is baked into the prompt: criteria needing an "and" across two unrelated checks means it is two tickets — split it.
- **`- AC:` token with `- DOD:` dual-parse** — acceptance criteria now render under `- AC:` instead of `- DOD:`. The parser accepts **both** tokens, so RC files authored before the rename (e.g. dirigible2D's 19 RC files) keep parsing unchanged. The export `dod` field name is unchanged, so the ClickUp mirror — which reads the export field, not the raw token — is unaffected. Downstream readers that grep the raw markdown should accept both tokens.

## [0.1.14] - 2026-06-14

### Added

- **Taste gate (flay)** — flay classifies each item at Assigned and, for taste-laden work (UI / panel / modal / designator-feel / icon / art / layout / copy), pushes up a ladder: collaborate (preferred) → Socratic-into-attempt (automation ceiling) → vibe-based (only on an explicit per-item opt-in). Auto mode never silently clears the gate, and `Completes:` on taste work requires the human to have actually seen the result, not just a green build. Vibe-shipping appends a finalize-UI follow-up to `.captain-sdlc/taste-debt.md` (a holding pen promoted into a Targeted item via `/taskout`, which re-trips the gate when flayed) — logged even when tiny, so the vibe path forces the HITL eventually instead of burying the polish. `/flay` and `/flay-auto` commands reference the gate.

## [0.1.13] - 2026-06-14

### Added

- **Per-item Definition of Done** — a Targeted item can carry indented `- DOD:` sub-bullets (1-3 observable pass/fail criteria). Parsed by `parseTargeted` (`roadmap-parse`), surfaced as an optional `dod` field on `design_taskout_export` items, rendered on write-back, and prompted by a new `targeted-dods` interview question. DOD is held separately from the hashed item text, so existing item keys are unchanged. Pairs with the ClickUp mirror writing each item's DOD into its task body at create.

## [0.1.12] - 2026-06-11

### Fixed

- **Zero-padded RC ids resolve against the index** — `design_taskout_start` rebuilt the candidate id as `M${milestone}_${name}` from the integer-parsed milestone, so a padded id like `M04_CLASSES_SKILLS` could never match and refused with `rc-not-in-index`. The matcher now compares kind/milestone/name numerically (mirroring `design_taskout_export`'s parse), so padded and unpadded ids both resolve to the same RC. Softens the 0.1.10 "RC ids stay unpadded" stance: projects with `{milestone:0N}` filenames (dirigible2D) key ClickUp maps and task footers by the padded id, so the padded form is now first-class on input; the id a caller passes is still echoed verbatim into keys.

## [0.1.11] - 2026-06-11

### Added

- **House-style parsing tolerance**, driven by the first real adopter layout (dirigible2D):
  - Bold metadata labels parse everywhere: `**Status**: X` and `**Status:** X` now equal `Status: X` (same for `Last Updated`), in both the RC parser and the migration scanner.
  - Section aliases: `1.0 Promise` → thesis, `MIN PLAY definition` → MIN PLAY waypoint, `Milestone Sequence` → Release Candidates; trailing parentheticals in headings ("(effort-gated, not time-gated)") are ignored for alias matching.
  - Index-table column synonyms: `#` → Milestone; a `File` link column (`Roadmap/M02_CRAFTING.md`) supplies the RC name when no Name column exists; a `MRC Stage`/`Stage` column supplies status (shipped/active detected, other stage labels pass through).

### Changed

- `design_roadmap_migrate` apply semantics: the index is **written only when absent** (never overwritten, no error), and marker normalization runs independently — projects that already maintain their own `roadmap.md` can normalize `[~]` markers without touching the index.

## [0.1.10] - 2026-06-11

### Added

- **`design_roadmap_migrate` MCP tool and `/migrate-roadmap` command** — adopts a pre-existing roadmap directory without renames: scans RC-shaped files, generates the missing `roadmap.md` index (round-trips through the index parser), detects zero-padded filenames and suggests the matching naming scheme, and optionally normalizes nonstandard checkbox markers (`[~]` → `[ ]` — per Seam 7, in-progress state lives in commit footers, not checkbox glyphs). Dry-run by default; refuses to overwrite an existing index. Warns on everything the parser would silently drop: nonstandard markers, numbered checklists, flat Targeted checkboxes with no `###` subsection, and statuses outside {Stub, Active, Shipped}. Fulfils the migration flow promised in the 0.1.6 notes; first customer is the dirigible2D layout.
- **Zero-padded milestone placeholder `{milestone:0N}`** in `rcNamingScheme` (e.g. `{prefix}{milestone:02}_{NAME}.md` resolves `M1_CORE` to `M01_CORE.md`). Padding is display-only; RC ids stay unpadded.

## [0.1.9] - 2026-06-11

### Added

- **`flay` / `flay-auto` commands and `claude-interrogate-flay` skill — a human-assigned task execution harness.** The human assigns one taskout item by its interrogate key; flay conducts it through the existing SDLC stations — Claude Code plan mode, implementation, the project's own verification commands, and a Seam 7 footered commit (`Implements:`/`Completes:`/`Needs-QA:`). `/flay` pauses human-in-the-loop at every phase boundary; `/flay-auto` runs through (harness gates still apply), downgrades to HITL on any verify failure, and defaults its completion footer to `Needs-QA:`. Flay never selects, ranks, or recommends work — assignment is the human's (ADR-0012). Phase state lives in `.captain-sdlc/flay-state.json` (schema_version 1, single object = WIP limit 1 by structure, gitignored), which sibling plugins read advisorily; the outcome line lands in `scratch.md`. Zero new deterministic code — pure orchestration of existing elements.

## [0.1.8] - 2026-06-11

### Added

- **`design_taskout_export` MCP tool — tracker-neutral structured export of a single RC taskout file.** Takes `rc_id` (and optional `output_dir`), resolves the RC file directly from the id (no roadmap-index lookup required, so export works even when `roadmap.md` is absent), and returns the parsed RC as JSON: status, theme, goals, targeted sections with checkbox state, blockers, definition of done, and references. The verbatim `raw` document body is deliberately excluded.
- **Stable per-item keys for external tracker mirrors.** Every `### Targeted` section gets an epic key (`{rcId}#{heading-slug}`, with deterministic `-2`/`-3` suffixes for duplicate headings and a `section` fallback for punctuation-only headings) and every checkbox item gets an item key (`{epicKey}#{12-hex sha1}` over NFKC/whitespace-normalized text plus an occurrence counter, so duplicate item text under one heading still yields distinct, stable keys). Keys are computed deterministically in core so downstream consumers (e.g. the claude-interrogate-clickup companion plugin) never have to re-derive identity.

### Fixed

- MCP server identity version was stale at 0.1.1; now tracks the release version.
- Taskout command/skill docs still showed pre-0.1.6 SemVer-shaped RC id examples (`0_8_0_QUESTS`) that `validateRCId` rejects; examples updated to `M8_QUESTS` style.

## [0.1.7] - 2026-05-28

### Added

- **MRC prefix notation for release-candidate milestones.** RCs now carry an optional `kind` field (`"build"` | `"release-candidate"`) that drives a `{prefix}` placeholder in the roadmap naming scheme:
  - `kind: "build"` (default) → prefix `M` → ID `M{n}_{NAME}`, filename `M{n}_{NAME}.md`, table row `| M{n} | ... |`, RC stub header `# M{n} — NAME`.
  - `kind: "release-candidate"` → prefix `MRC` → ID `MRC{n}_{NAME}`, filename `MRC{n}_{NAME}.md`, table row `| MRC{n} | ... |`, RC stub header `# MRC{n} — NAME`.
- MRC denotes the design-side marker for a pop-corks-moment milestone (release-readiness checkpoint). Versions remain orthogonal — SemVer is process; milestones are design. The first MRC is `MRC1` (first release candidate); subsequent MRCs cover DLC / major-revision pop-corks moments (`MRC2`, `MRC3`, ...).
- `rcPrefix(kind)` helper exported from `types.ts`; consumers don't need to ternary-inline the prefix choice.
- Default `rcNamingScheme` changed from `M{milestone}_{NAME}.md` to `{prefix}{milestone}_{NAME}.md`. The new `{prefix}` placeholder resolves to `M` or `MRC` from the RC's kind at render time. Backward compatible — existing `M{milestone}_{NAME}.md` templates still work (no `{prefix}` substitution, just literal `M`).
- `validateRCId` accepts both `M{n}_{NAME}` and `MRC{n}_{NAME}` patterns. Roadmap-parser detects `MRC` prefix in both RC stub headers and the Milestone column of the roadmap table, populating `kind` on parsed rows automatically.
- End-to-end test in `scope.test.ts`: a plan with one build-kind and one release-candidate-kind RC produces both `M{n}` and `MRC{n}` outputs in the right places (filenames, IDs, table rows, stub headers).
- **`scratch` skill and `/scratch` command — an intraday register of work in flight.** Canonized from the dirigible2D prototype into the interrogate set. Maintains a `scratch.md` register that carries unfinished work across breaks, end-of-day, and hand-offs to another agent. Each run triages existing entries (removes done work, defers non-active items to the roadmap or tech-debt files, keeps and trims active ones), then prepends a dated section for the current session. Shipped as a namespaced Codex skill (`claude-interrogate-scratch`), a plugin command (`/claude-interrogate:scratch`), and a project command (`/scratch`).
  - The register path resolves from a new `scratchFile` config key (default `./scratch.md` at the project root). Triage cross-reference targets reuse the existing `roadmap` config block (`rcDir` / `indexFile` / `techDebtFile` / `rcNamingScheme`), so scratch is project-agnostic — no hardcoded paths or milestone numbers, and the "defer to roadmap/tech-debt" disposition is skipped when no roadmap exists.
- `adrDir` and `scratchFile` are now declared on the `InterrogateConfig` type, matching the keys the ADR and scratch flows read from `claude-interrogate.json`.

### Changed

- Auto-proposed RCs from concept docs (`proposeRCsFromConcepts`) explicitly set `kind: "build"`. Release-candidate milestones are authored intentionally (a DoD / pop-corks marker), never auto-proposed from docs.
- `ParsedRC`, `ParsedRoadmapRCRow`, and `RCMetadata` all gain an optional `kind` field. Tools reading roadmaps in maintenance mode preserve the kind through the round-trip.

## [0.1.6] - 2026-05-28

### Changed (breaking, pre-1.0)

- **Decoupled milestones from SemVer in the roadmap data model.** Versions are about compatibility at release time; milestones are about what gets built when. Conflating them let dependency-ordering wear SemVer's costume, which biased every roadmap toward indie-game-style version-as-content-milestone planning. The fix:
  - `RCMetadata.version: string` → `milestone: number`. Same for `ReservedSlot` and `ParsedRoadmapRCRow`.
  - Default `rcNamingScheme` is now `M{milestone}_{NAME}.md` (was `{major}_{minor}_{patch}_{NAME}.md`). Required placeholders are now `{milestone}` and `{NAME}`.
  - RC ID format is now `M<n>_<NAME>` (e.g., `M8_QUESTS`), not `<major>_<minor>_<patch>_<NAME>` (e.g., `0_8_0_QUESTS`).
  - `ShippedLockChangedField` "version" enum value → "milestone".
  - Roadmap table column heading "Version" → "Milestone".
  - RC stub file headers `# v{version} — {NAME}` → `# M{milestone} — {NAME}`.
  - Reserved slots are keyed by integer `milestone`, not SemVer string. Default `reservedSlots` is `[]` (no implied "milestone 1 = first stable").
  - `compareSemver` removed; RC ordering is now numeric milestone sort.
- The waypoints interview rationale no longer mentions "version numbers"; it speaks in terms of milestone ordering.

### Out of scope for this release

- **Migration tool for existing roadmaps.** Pre-existing `roadmap.md` files using the old `Version` column / SemVer-shaped RC IDs will not parse against 0.1.6. There are no known external roadmaps to migrate (interrogate is pre-1.0 and pre-adoption); a `/migrate-roadmap` flow that normalizes old roadmaps to the new schema is tracked for a future release. The general principle: where interrogate's flows can adopt the house style automatically (as `redress` already does for prose), the same should apply to schema migrations.

## [0.1.5] - 2026-05-28

### Changed

- Default roadmap config is now generic, not game-dev biased. `reservedSlots` defaults from four game-dev slots (Showcase content / Stretch / Late-stage polish / Release readiness) to a single `1.0.0` slot ("First stable release"). `marketingWaypoints` defaults from `["Wishlist", "Early Access", "Launch"]` to `[]`. Interrogate is a general design tool; the previous defaults imposed an indie-game mental model on every project, which is wrong for users designing tooling, libraries, infra, or any non-game work. Game-dev defaults remain available — they belong in per-project `claude-interrogate.json` files, not as imposed defaults.
- The scope/roadmap interview no longer asks the marketing-waypoints question when no waypoints are configured. When waypoints are configured, the question now interpolates the actual configured names rather than hardcoding "Wishlist, Early Access, Launch."
- Roadmap command documentation updated to drop the "dirigible-style defaults" framing.

## [0.1.4] - 2026-05-28

### Fixed

- Re-publish the `adr`, `roadmap`, and `taskout` flows that landed in 0.1.3's source but did not make it into the 0.1.3 distribution-repo artifact. The 0.1.3 marketplace build shipped the runtime code for the new flows but was missing their command markdown and skill SKILL.md files — installed users had v0.1.3 with no surfaced way to invoke the new flows. The packaging error was a manual version-bump in distribution-repo without re-running `npm run prepare:distribution-repo`; this release re-runs the prepare step end-to-end so the marketplace artifact actually contains what 0.1.3 was named for.

## [0.1.3] - 2026-05-28

### Added

- `adr` flow (`/adr`, `/claude-interrogate:adr`, `claude-interrogate-adr` skill) for logging numbered Architecture Decision Records under `<docs-dir>/ADR/` with a minimal Problem/Solution/Alternatives template and a markdown index.
- `roadmap` flow (`/roadmap`, `/claude-interrogate:roadmap`, `claude-interrogate-roadmap` skill) for socratically scoping a concept-doc set into `roadmap.md` plus per-RC stubs. Backed by new MCP tools `design_scope_start` and `design_scope_generate`.
- `taskout` flow (`/taskout`, `/claude-interrogate:taskout`, `claude-interrogate-taskout` skill) for breaking a release candidate into epic-level checklists and a definition of done. Backed by new MCP tools `design_taskout_start` and `design_taskout_generate`.
- Path-safety module with validators for relative paths, RC ids, RC naming schemes, and `assertWithinDir` (guards against parent traversal, drive letters, and sibling-prefix traps). Covered by a new vitest suite.
- Roadmap config loader with defaults (`indexFile`, `rcDir`, `rcNamingScheme`, `techDebtFile`, `reservedSlots`, `marketingWaypoints`, `anchorSources`) under a new `roadmap` block in `claude-interrogate.json`.
- `VERSION` file at the repo root tracking the released semver.

### Changed

- `distill` and `distill-hard` flows now lead their output specs with an explicit Definition of Done checklist.
- READMEs and the runtime-distribution preparation script updated to enumerate the new commands and skills.

## [0.1.2] - 2026-04-09

### Added

- New `redress` flow for bringing an existing doc up to current local house style without reopening its core decisions.
- New report-oriented flows for `expose`, `glossary`, `refresh`, and `reveal`, with matching Claude command and plugin surfaces.
- Post-edit document normalization that can infer semantic version bumps, ensure managed sections exist, and append version-history entries automatically.
- Coverage for post-edit normalization behavior, including patch, minor, and major document-version bump cases.
- Release-readiness checks for the generated Codex MCP runtime configuration in the runtime distribution.

### Changed

- Project docs now document a manual Codex MCP attachment path instead of an unverified plugin install flow.
- Runtime distribution prep now emits a checked-in `.mcp.json` for Codex alongside the existing Claude Code plugin payload.
- Interview, conversion, and maintenance prompt flows now consistently support explicit `cancel` handling for abandoned write tasks.
- Cross-reference sync and doc generation now route file updates through the same metadata and version-history normalization path.

## [0.1.1] - 2026-04-08

### Added

- Read-only `summarize` mode for reporting what the docs already establish about a feature without interrogating or writing.
- `reinterrogate` flow for modernizing an existing spec against newer sibling knowledge before overwrite confirmation.
- `distill` flow for deriving a separate exploratory implementation slice from the canonical spec.
- `extricate` flow for dependency-aware removal, retirement, or replacement planning across the docs set.
- Challenge/depth variants for interview flows, including easy and fast modes.
- Additional Claude Code command surfaces for `interrogate-easy`, `interrogate-fast`, `reinterrogate`, `reinterrogate-easy`, `reinterrogate-fast`, `distill`, `distill-hard`, `extricate`, and `summarize`.
- `design_summarize` MCP tool and matching prompt surface.

### Changed

- Interview orchestration now better matches manual testing: one-question-at-a-time flow, private question queue, and confirm/modify/deny before writing.
- Generated docs now normalize authoring metadata more aggressively and favor ASCII-safe typography in generated prose.
- The exploratory MVP flow was renamed to `distill` and explicitly positioned as a separate living artifact that does not constrain the canonical spec.
- README and runtime/distribution docs were updated to reflect the current command surface and maintenance workflows.
- Public marketplace install docs now use the Claude Code flow for `michael-tiller/claude-interrogate`.
- Distribution prep can now refresh a checked-out `distribution-repo/` without deleting its nested `.git/` directory.

### Notes

- Manual testing against `laird2` validated the reinterrogation loop and surfaced the next likely quality focus: better long-section structuring in generated docs and deeper maintenance flows.

## [0.1.0] - 2026-04-08

### Added

- Initial TypeScript CLI and MCP server for design-doc interrogation, audit, and sync flows.
- Claude Code project commands, MCP prompt integration, and installable plugin scaffolding.
- Repo config support via `claude-interrogate.json` or `.claude-interrogate.json`.
- Optional `styleTemplate` support for a golden document template.
- Built-in fallback golden template when no explicit template is configured.
- Metadata enforcement for managed docs: `Created`, `Updated`, and `Version`.
- `Version History` scaffold for newly generated docs.
- Runtime/distribution repo generation scripts and supporting documentation.

### Changed

- Interview flow now instructs Claude Code to keep the question queue private and ask one question at a time.
- Plain `/interrogate` now explicitly forces `challenge=false`; hard mode is isolated to `/interrogate-hard`.
- Inspirations are now optional and only appear in generated docs when actually provided.
- Sample docs were rewritten to use generic product/system examples instead of game-specific examples.

### Notes

- Packaging and demo recording remain the next major steps after manual testing.
