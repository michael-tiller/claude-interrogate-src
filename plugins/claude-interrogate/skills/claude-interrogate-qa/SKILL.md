---
name: claude-interrogate-qa
description: Orchestrate the QA pass that clears a Needs-QA taskout item — walk a human through its acceptance criteria, capture screenshots as evidence, and on pass authorize the Seam 7 Completes: footer. Recognizes when every AC is objectively checkable and, at the human's request to elevate past HITL, runs those checks as tests and omits the human — but a taste-laden AC can never be elevated. Use when the user says "qa <key>", runs /qa, or asks to QA / acceptance-test a Needs-QA item. Never use this to pick which item to QA — that is the human's.
---

# Claude Interrogate: QA (acceptance pass harness)

QA is the station that **resolves the `Needs-QA` state flay leaves behind**. flay
ships unwatched work with a `Needs-QA:` footer, and flay's own taste gate says
`Completes:` *requires the human to have actually SEEN the result*. QA is that
seeing: it checks one item against its acceptance criteria, captures evidence, and
on a pass authorizes the promotion `Needs-QA: → Completes:`.

Like flay, QA is a conductor, not an instrument — it adds no machinery of its own
and it never picks the work (the human assigns the key). The default instrument is
the **human's eyes**. Elevation swaps in **tests** for that instrument, but ONLY
where a machine can actually decide the AC — taste it must always hand back.

Arguments: `<task-key> [output-dir]`. Elevation is a request, not a separate
command: `/qa <key>` runs HITL; `/qa <key> --elevate` (or "elevate past HITL",
"skip the human", "just run the tests") asks QA to omit the human where it can.
Default is always HITL.

## Evidence dir: `.captain-sdlc/qa/<key>/`

Per-key, churning local state — gitignore `.captain-sdlc/qa/` alongside
`flay-state.json`. Holds:

- `verdict.json` — `{ schema_version: 1, task_id, rcId, mode: "hitl"|"elevated"|"partial", acResults: [{ ac, kind: "objective"|"taste", verdict: "pass"|"fail"|"unseen", evidence: ["screenshot.png", …], note }], result: "pass"|"fail", at }`
- screenshots / logs captured during the pass (only the visual/visible AC — see **Screenshots**).

Create it lazily. Unknown `schema_version` in an existing file → refuse and ask the
human. No global WIP lock (unlike flay) — QA can clear several `Needs-QA` items.

## The pass

`assigned → classified → checking → verdict`

1. **Assigned.** Validate the key against a FRESH `design_taskout_export` for its RC
   (prefix before the first `#`). Exact match only — never fuzzy-assign; on an
   unknown key show nearby keys and let the human re-pick. Then check state:
   - Item already `[x]` → stop, the work reads as Complete; nothing to QA.
   - Item shows no implementation / no `Needs-QA` history → this is flay's job, not
     QA's. Say so and point at `/flay <key>`. QA validates built work; it does not
     build.

2. **Classified.** Read the item's **AC / DoD** from the export (`AC` sub-bullets;
   the RC's Definition of Done for cross-cutting checks). Enumerate every AC and
   classify each:
   - **Objective** — a machine can decide it: an HTTP status, a returned value, a
     DOM/CLI assertion, a test that *fails when the behavior breaks*. (A test that
     can't fail when the logic changes is not objective evidence — it is theater.)
   - **Taste** — needs a human eye: does the panel look right, does the cursor feel
     right, is the copy good, is the layout balanced. Reuse flay's taste-laden
     notion (UI / panel / modal / screen / HUD, feel, icon / art / color / theme,
     layout / spacing / wording). **When unsure, classify as taste.**

   Announce the split. This recognition runs in BOTH modes — even a plain `/qa`
   should say "all N AC are objectively checkable — I can elevate and skip the human
   if you want," so the human knows elevation is on the table.

3. **Mode resolution (the elevation gate).**
   - **HITL (default).** Walk the human through each AC in order. For a visual AC,
     capture a screenshot first, then ask the human to accept/reject against it.
     Record each verdict in `verdict.json`.
   - **Elevated (`--elevate` / explicit request).** Honored per-AC, never blanket:
     - **All AC objective** → write/run real checks for each, decide pass/fail
       mechanically, **omit the human entirely**. mode = `elevated`.
     - **Some AC taste** → QA CANNOT fully elevate (auto-passing a taste call is
       exactly what HITL protects — same principle as flay's taste gate). Default to
       **partial**: run the objective AC as checks headless, then present ONLY the
       taste AC (with their screenshots) to the human. mode = `partial`. Never
       silently mark a taste AC `pass`; an unseen taste AC is `unseen`, and an
       all-taste item with an `--elevate` request just stays HITL with a one-line
       note that there was nothing to elevate.
   - **Persisting the checks.** The durable form of "orchestrate with tests" is a
     test in the project's suite, so the next regression is caught for free. After
     an elevated run, offer to land the generated checks as real suite tests (web
     flows via the project's e2e/Playwright setup; logic via its unit tests). If the
     human takes it, those test files are a code change → commit them with
     `Implements:`/`Completes: <key>` per Seam 7.

4. **Checking.** Run the resolved plan. Use the project's OWN commands — its test
   runner, its run/start script (see the `run` skill / its CLAUDE.md). Never invent
   a verify command; if an objective AC has no runnable check and you can't write a
   fair one, say so and fall back to a human check for that AC.

5. **Verdict.** Write `verdict.json` and a short human-readable summary, then:
   - **PASS** (every AC `pass`; every taste AC human-seen with evidence) → the item
     is cleared to Complete. Hand the key to the **task-footers flow**
     (claude-release-clickup) if installed, with verb **`Completes`** — it defaults
     to this key. If QA produced a commit (persisted tests/evidence), that commit
     carries `Completes: <key>`. If QA changed no code, record the cleared verdict
     and hand it to the human / release pass to mark the checkbox `[x]` — **QA never
     rewrites the roadmap itself** and never fabricates a commit just to carry a
     footer.
   - **FAIL** (any AC `fail`) → the fix is implementation work, which is flay's job.
     Record which AC failed and the evidence, leave the item at `Needs-QA` (do NOT
     promote), and point at `/flay <key>`.
   - Prepend a one-line outcome to `scratch.md`
     (e.g. `- qa'd <key>: PASS (3/3 AC, 2 screenshots) → Completes`).

## Screenshots

Capture evidence only where an AC is actually visible — a pure-logic AC needs a
log/assertion, not a screenshot ("if necessary" means exactly the visual ones).
For a browser app, drive it with the Playwright MCP browser tools if attached
(`browser_navigate` → the relevant state → `browser_take_screenshot`). For other
app types, use the project's existing run/screenshot path (the `run` skill knows
it). Save every shot into `.captain-sdlc/qa/<key>/` and reference it from the
matching `acResults[].evidence`. A taste AC's screenshot is the artifact the human
accepts against — never mark a taste AC `pass` without one.

## Taste-debt tie-in

flay parks vibe-shipped UI in `.captain-sdlc/taste-debt.md` precisely because no
human has seen it yet. QA on a taste-laden item IS that deferred seeing. When a QA
pass clears a key that has a live taste-debt entry, check off / drop that entry as
part of the PASS outcome — the polish it was holding has now been human-verified.

## Hard rules

- Keys come only from `design_taskout_export` — never derived, never guessed.
- QA validates built work; it never builds. No implementation, no roadmap rewrite —
  PASS hands off to the footer/release blade, FAIL hands off to `/flay`.
- QA never picks which item to QA, and never ranks or recommends. Assignment is the
  human's.
- A taste-laden AC can never be elevated past the human. `--elevate` omits the human
  only on objective AC; taste AC stay HITL or go `unseen`, never auto-`pass`.
- Elevation uses real checks — a test that can't fail when the behavior breaks is
  not evidence. If you can't write a fair check, keep the human.
- `Completes:` only after a genuine pass with evidence; otherwise the item stays
  `Needs-QA`.
