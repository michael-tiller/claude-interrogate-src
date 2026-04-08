# Gateway Events
Created: 2026-04-08

Updated: 2026-04-08
Version: 0.1.0

## 1. Decision

Decide how gateway events are represented across API and UI boundaries.

## 2. Release Bar

One event contract can be reviewed and implemented without follow-up clarification.

## 3. Chosen Shape

Keep markdown docs as source of truth and expose interview/generation through MCP tools; reject a database-backed registry because it adds state without improving review quality.

## 4. Constraints And Cross-Checks

Respect existing markdown docs, visible cross-references, and the current event-intake normalization decision.

## 5. Failure Modes And Edges

Call out greenfield bootstrap, partial interviews, and mismatches with deferred replay work.

## Cross-References

- [Event Intake](./event-intake.md)
- [Notification Policy](./notification-policy.md)
- [Platform Overview](./overview.md)
- [Review Queue](./review-queue.md)
- [Review Triage](./review-triage.md)
- [Routing Spec](./routing-spec.md)

## Resolved Decisions

- Decision boundary: Decide how gateway events are represented across API and UI boundaries.
- Release bar: One event contract can be reviewed and implemented without follow-up clarification.
- Chosen shape: Keep markdown docs as source of truth and expose interview/generation through MCP tools; reject a database-backed registry because it adds state without improving review quality.
- Inherited constraints: Respect existing markdown docs, visible cross-references, and the current event-intake normalization decision.
- Failure modes: Call out greenfield bootstrap, partial interviews, and mismatches with deferred replay work.
- Consistency updates: If gateway events redefine intake semantics, event-intake.md must change in the same review.

## Open Questions

- None.
