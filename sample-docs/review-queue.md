# Review Queue
Created: 2026-04-08

Updated: 2026-04-08
Version: 0.1.0

## 1. Decision

Decide how the review queue prioritizes incoming items.

## 2. Release Bar

A reviewer can explain why an item appears where it does and what can change its rank.

## 3. Chosen Shape

Use a small set of explicit priority bands with deterministic tie-breakers instead of opaque scoring.

## 4. Constraints And Cross-Checks

Respect markdown-first docs and existing routing assumptions.

## 5. Failure Modes And Edges

Call out starvation risk, priority inversion, and unclear manual overrides.

## Cross-References

- [Event Intake](./event-intake.md)
- [Gateway Events](./gateway-events.md)
- [Notification Policy](./notification-policy.md)
- [Platform Overview](./overview.md)
- [Review Triage](./review-triage.md)
- [Routing Spec](./routing-spec.md)

## Resolved Decisions

- Decision boundary: Decide how the review queue prioritizes incoming items.
- Release bar: A reviewer can explain why an item appears where it does and what can change its rank.
- Chosen shape: Use a small set of explicit priority bands with deterministic tie-breakers instead of opaque scoring.
- Inherited constraints: Respect markdown-first docs and existing routing assumptions.
- Failure modes: Call out starvation risk, priority inversion, and unclear manual overrides.

## Open Questions

- None.
