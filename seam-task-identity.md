# Seam: Task Identity

The contract for ticket (and epic) keys produced by `/taskout` and consumed by `/flay`,
`design_taskout_export`, `- Blocked-by:` edges, and the ClickUp mirror.

## Key shape

- **Ticket key**: `<RCID>#<epic-slug>#<digest>` — e.g. `M8_QUESTS#dispatch#a1b2c3d4e5f6`.
  `digest` is the first 12 hex of `sha1(NFKC/whitespace-normalized item text \0 occurrence)`.
- **Epic key**: `<RCID>#<epic-slug>` (with `-2`/`-3` suffixes for duplicate headings).

## The invariant: keys are immutable

**Once a ticket has a key, that key never changes** — not when the ticket text is reworded,
not when its epic heading is renamed, not when it is reordered or moved between epics. The
key is the ticket's stable identity, so downstream lookups (flay, blocked-by, ClickUp) keep
resolving it. A changed key orphans every reference to the ticket.

## How it holds: stored, not re-derived

Keys are **persisted inline** in the RC markdown as a trailing comment on the checkbox line,
and read back as the source of truth — they are NOT recomputed from content on each read:

```
- [ ] Dispatch background jobs  <!-- key: M8_QUESTS#dispatch#a1b2c3d4e5f6 -->
```

- **Read** (`parseTargeted`): strips the `<!-- key: … -->` off the text, captures `item.key`.
- **Key** (`keyedTargeted`): `item.key` wins; the digest is minted ONLY for a keyless (brand-new)
  ticket, by the original hash algorithm — so legacy keyless files reproduce today's exact keys,
  then freeze on the next write. The epic key is taken from the section's first already-keyed
  item, falling back to the heading slug only for a wholly new epic.
- **Write** (`renderTaskout`, `renderRCStub`): re-emit the key comment for every ticket.

## Who may mint vs. echo

- **Mint** (assign a fresh key): only `keyedTargeted`, and only for a ticket that has never been
  keyed. Minting is deterministic.
- **Echo** (preserve an existing key): everyone else. The maintenance write path rebuilds the
  file from a keyless LLM plan, so `generateTaskout` re-attaches prior keys before render via
  `carryForwardKeys` — (1) an agent-echoed `item.key` is authoritative; (2) else exact-text match
  to the prior file; (3) else an unambiguous single-reword within a heading-matched epic. It never
  guesses a key onto the wrong ticket; an unresolved keyless ticket is minted fresh (a clean miss,
  never a wrong identity). The taskout skill instructs the agent to carry each edited ticket's key.

## Implementation

`src/taskout.ts` (`keyedTargeted`, `renderTaskout`, `generateTaskout`/`carryForwardKeys`),
`src/roadmap-parse.ts` (`parseTargeted`, `KEY_COMMENT_PATTERN`), `src/scope.ts` (`renderRCStub`).
Tests: `tests/taskout-key-immutability.test.ts`.
