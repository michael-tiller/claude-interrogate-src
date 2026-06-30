---
name: claude-interrogate-inquisitor
description: Pick the next logical flay target by ranking the auto-pickable taskout items, then recommend it (default) or dispatch /flay-auto on it (auto mode). On an empty board, surface /roadmap and /hunt for the human to choose. The deliberate counterpart to flay's "never pick" rule — selection is Inquisitor's job, where flay refuses it. Use when the user asks "what's next?", "/inquisitor", or "/inquisitor-auto".
---

# Claude Interrogate: Inquisitor (next-target orchestrator)

flay refuses to pick work — "taste is the human's." Inquisitor is the deliberate
counterpart: it answers *"what should I flay next?"* so the human never stares at a
blank roadmap. It does the **selection** flay won't, then hands the actual execution
back to flay unchanged. Inquisitor picks; flay (still the only thing that touches the
SDLC chain) executes. It adds no execution machinery of its own — it is a ranker plus
a dispatch table.

Mode comes from the invoking command:
`/inquisitor` = **recommend** (rank, propose the top target + rationale, then STOP —
the human invokes /flay); `/inquisitor-auto` = **dispatch** (pick the top auto-pickable
target and fire `/flay-auto` on it). Default is recommend.

## Single flay at a time (hard gate, runs first)

Inquisitor enforces the same WIP=1 flay holds. **Before ranking anything**, check for
`.captain-sdlc/flay-state.json`. If it exists, a flay is already in flight — STOP and
report its `task_id`, `phase`, and `status`; tell the human to finish or abandon it
(`/flay` to resume) before starting another. Never pick a new target over a live one,
in either mode.

## The pick (ranking)

The "next logical target" is the first **auto-pickable** item in roadmap order — where
*auto-pickable* means flay-auto will actually accept it, so a dispatch is never a dead
end. Runnability is judged from a **single RC's export**; Inquisitor never resolves
cross-RC blockers (see *Why single-RC* below).

### RC walk (active-RC source)

RC order comes from the roadmap **index file** — `roadmap.indexFile` (default
`roadmap.md`), resolved from the project's `claude-interrogate.json` roadmap config the
same way the MCP server does (`rcDir` / `Roadmap` is where the per-RC files live, NOT the
index). No MCP tool exposes RC order, so read the index directly.

**Assemble the literal `rcId` from the index table — never numeric-normalized.** The
standard generated index has columns `| Milestone | Name | Status | Anchor | Marketing |`
and **no File column**, so build `rcId = <Milestone cell>_<Name cell>` from both cells as
literal text — the `Milestone` cell carries the exact prefix + padding, e.g. row
`| M04 | CLASSES_SKILLS | … → M04_CLASSES_SKILLS`. A *migrated* index that has a `File`
column instead of `Name` takes the basename minus `.md`
(`Roadmap/M04_CLASSES_SKILLS.md → M04_CLASSES_SKILLS`). Either shape: preserve zero-padding
and `MRC` vs `M`, and never rebuild the id from a parsed integer milestone — the export
mints item keys from `rcId` verbatim, so a rebuilt `M4` instead of literal `M04` mints the
wrong keys and breaks `blockedBy` prefix matching.

Step through the RCs in index order, running a fresh `design_taskout_export` per RC,
caching by `rcId`:

- An RC that is **fully checked** (every item `[x]`) is done → advance past it.
- **Carry-redirect breadcrumbs don't count as open work.** A pre-ADR-0030 roadmap can leave an
  *unchecked* item in the **source** RC that only points its live form elsewhere — text marked
  `CARRIED to <other RC>` (legacy) or a bare `→ M{NN}_NAME` arrow to a different RC. Under
  ADR-0030 (`carried = Targeted by default`) the real item lives in the destination RC's
  `### Carried from M0x` Targeted epic (or the source's `## Out of Scope`), so the breadcrumb is
  a pointer, not work. Treat it as satisfied for the walk: an RC whose **only** unchecked items
  are carry-redirects is "fully checked" → advance past it. Never land the walk on, or dispatch,
  a carry-redirect — flay-auto would get an empty pointer with no spec. (The export surfaces no
  structured carry flag, so this is a text-match on the item; a `carriedTo` export field is the
  robust upgrade.)
- The **first RC with genuine incomplete work** — an unchecked item that is NOT a carry-redirect
  — is where the walk lands. Do NOT advance past incomplete-but-blocked work to a later RC
  (roadmap order is the human's sequence; surface the gate, don't leap it). In that RC: an
  **auto-pickable** item exists → that is the pick; none (only blocked / cross-RC / stale /
  carry-redirect) → report the **needs-a-human** bucket and STOP.
- **Empty board** may be claimed only after confirming **every** listed RC is fully checked
  (or there is no roadmap). The export is a *prefix* — stop as soon as an RC lands the walk —
  but to declare empty you must have walked them all.
- **Edge case:** a listed RC whose taskout file doesn't exist yet makes
  `design_taskout_export` throw `rc-file-not-found`. Catch it — that RC isn't flayable yet:
  surface "RC<n> is next per the roadmap but has no taskout; run `/taskout <rc>` first" and
  stop (don't skip ahead). Honest error handling, not a new mode.

### Why single-RC and not cross-RC resolution

flay-auto also consumes a single-RC export, and its Blocked-detector cancels a `blockedBy`
key absent from that export as a stale reference (no cross-RC carve-out). So if Inquisitor
resolved a cross-RC blocker upstream and dispatched the item, flay-auto would immediately
cancel it — a dead-end dispatch. Instead Inquisitor applies the export producer's own
intra-vs-cross test and **excludes** cross-RC items from auto-pick rather than resolving
them.

### Blocker classification

For a candidate item, classify each `blockedBy` token:

1. **No `blockedBy` field** (it is omitted, not `[]`, when empty) → no blockers.
2. **Resolves in this RC's export** (the token is a key in the same export) → read its
   `checked`. Any unchecked blocker → the item is **blocked** (not auto-pickable).
3. **Intra-RC-shaped but unresolved** — `token` starts with `${rcId}#`, or has no `#` at
   all (a bare digest / epic letter), yet is not a key in this export → **stale reference**:
   exclude + flag the dangling anchor (the human or `/taskout` repairs it).
4. **Cross-RC full key** — has a `#` and does NOT start with `${rcId}#` → a legitimate
   upstream dep flay can't see in a single-RC export. **Not auto-pickable:** surface it
   ("blocked by cross-RC `<key>` — verify upstream is done, then flay manually"); never rank
   it top, never dispatch it.

**Auto-pickable** = unchecked AND not a carry-redirect (a `CARRIED to <RC>` / `→ M{NN}_NAME`
breadcrumb whose live form is another RC, per ADR-0030) AND not present in
`.captain-sdlc/blocked-hitl.json` AND not in-review (no live `Needs-QA:` / `Implements:` Seam-7
footer lacking a later `Completes:` / `[x]` — see *In-review detection*) AND every blocker (if any)
is case-1/2-satisfied (all resolve in-RC and are checked). Rank the auto-pickable set by export order — it already encodes the
human's intended sequence — and the top one is the pick. No scoring matrix.
<!-- ponytail: export order IS the ranking. Add weighting only if a real priority signal
     ever lands on the items; today there isn't one. -->

`.captain-sdlc/blocked-hitl.json` liveness: an entry's *presence* is its liveness — flay
appends a key on downgrade and *deletes* it at Done / on `[x]`, with no resolved-but-present
state. So "has a live entry" = the key is present in the JSON.

### In-review detection (Seam-7 footer aware)

The roadmap checkbox is binary, so an item **built but not yet QA-closed** — flayed to a
`Needs-QA:` footer, or mid-build with an `Implements:` footer, both still `[ ]` — reads identically
to fresh to-do work. flay's own gate only catches the terminal `[x]`, so without this the autopilot
re-dispatches in-review work to be *rebuilt from scratch*.

Reuse the **Seam-7 footer** as the in-review signal (the same one `clickup-sync` derives lifecycle
from) — don't invent a marker; markdown stays binary (clickup protocol Principle 1).

- **Resolve the latest verb per item key** over the consuming repo, range `<last tag>..HEAD`:
  `Implements:` → in-progress, `Needs-QA:` → in-review, `Completes:` → done; **last verb wins per
  key**. Prefer `release-pass.mjs --list-transitions --range <lastTag>..HEAD --repo <project>` when
  the Seam-7 engine (claude-release-clickup) is installed and reachable; **else parse inline** —
  `git log` the trailer block (last paragraph) of each commit for lines matching
  `^(Implements|Needs-QA|Completes): <key>$`, newest-wins per key (this mirrors release-pass's own
  resolver, which is itself just git-footer parsing). **Degrade gracefully:** no git / no footers /
  neither path reachable → skip this check, fall back to binary (today's behavior). Never block.
- An item whose latest verb is `Needs-QA:` or `Implements:` (with no later `Completes:`, box still
  `[ ]`) is **in-review → not auto-pickable**. Put it in the **needs-a-human** bucket: "in review
  (Needs-QA) — it's built; verify/QA it, don't flay-build." Never rank it top, never dispatch.

**Residual gap (process, not detection).** Work built *entirely outside* the Seam-7 flow leaves no
footer — a `[ ]` with no verb reads as genuine to-do even when the code is done and only the
roadmap text went stale. Pick-time detection can't catch that; the guards are process (route work
through flay/Seam-7 so it carries a footer) and verifying code state before a from-scratch flay.
Called out so it's a known limit, not a silent miss.
<!-- ponytail: footer-aware — no new markdown glyph, no hard ClickUp dep. The inline git-parse is
     faithful (release-pass resolves the same way), so the dependency-free path isn't a degraded
     approximation. -->

### Three outcomes

- An auto-pickable target exists → recommend / dispatch it (see **Modes**).
- Items remain but none auto-pickable — intra-RC blockers unchecked (case 2), cross-RC deps
  (case 4), only stale-flagged (case 3), or **in-review** (Seam-7 Needs-QA/Implements) → report them
  with blockers / owners / lifecycle state; this is
  the **needs-a-human** bucket, NOT an empty board. Do **not** fall through to the
  empty-board fallback.
- The board is genuinely empty (all items checked across the roadmap, or no roadmap at all)
  → the **Empty-board fallback**.

## Modes

**Recommend (`/inquisitor`).** Present the pick: key, item text, its RC, and a one-line
*why this one* (e.g. "first auto-pickable item in MRC1, no open blockers"). Show one or two
runners-up for context. Then STOP — the human runs `/flay <key>` (or `/flay-auto`).
Inquisitor never invokes flay in this mode; it only proposes. (No vibe opt-in is carried —
the human is right there.)

**Dispatch (`/inquisitor-auto`).** Pick the top auto-pickable target and invoke
`/flay-auto` on its key — one target, then stop. It does not chain to the next item; the
human re-invokes for the next.
<!-- ponytail: one pick per invocation, no queue. The human's re-invoke is the checkpoint.
     Add a chain only when single-shot proves too slow to babysit. -->

The taste gate still belongs to flay. But `/flay-auto` *stops at Assigned* on a taste-laden
item with no recorded opt-in — which would stall the autopilot on the first UI task. So when
`/inquisitor-auto` dispatches, it carries a **standing vibe opt-in** for the dispatched item
(the human chose the vibes-only autopilot by invoking it): flay records the opt-in in its
`history` as "vibe opt-in via /inquisitor-auto", and the vibe-leaves-a-trail rule still fires
— every vibed taste call lands in `.captain-sdlc/taste-debt.md` for a later HITL polish pass.
Nothing is buried; it is queued.

## Empty-board fallback

When there is genuinely nothing left to flay, Inquisitor doesn't pick — it offers the two
ways forward and lets the **human choose** (it never auto-decides which):

- **`/roadmap`** — the roadmap is thin or exhausted; plan new RCs / scope new work.
- **`/hunt`** — scour the implementation for tech debt, then flay the kills.

Present both with a one-line read of the board state (e.g. "MRC1 and MRC2 fully checked, no
further RCs — extend the roadmap, or hunt the code for debt"). Whichever the human picks,
hand off to that command. In auto mode, surface the same two and stop — choosing the *kind*
of new work is a human call, not the autopilot's.

## Hard rules

- Keys, `checked`, and `blockedBy` come only from a fresh `design_taskout_export`; RC order
  and the literal `rcId` come only from the configured roadmap index. Never derived or
  guessed; all inputs read-only.
- WIP=1: an existing `flay-state.json` blocks any pick. Inquisitor never runs two flays.
- Inquisitor selects; it never executes the SDLC chain itself — `/flay`(`-auto`) does.
- It never reorders the roadmap, rewords a task, or writes a tracker. A stale blocker
  reference (case 3) is surfaced, not repaired (the human or `/taskout` fixes the anchor).
- Cross-RC-blocked items (case 4) are surfaced for a human, never auto-picked — Inquisitor
  resolves no cross-RC dependency and dispatches none.
- Empty-board → present `/roadmap` and `/hunt`; the human picks the kind of new work.
