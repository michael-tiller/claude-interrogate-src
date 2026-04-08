# Routing Spec
Created: 2026-04-08

Updated: 2026-04-08
Version: 0.1.0

## 1. Decision

Decide how routes are versioned.

## 2. Release Bar

A reviewer can tell which route version rules are stable.

## 3. Chosen Shape

Use one versioning rule for external APIs and document exceptions explicitly.

## 4. Constraints And Cross-Checks

Respect markdown-first docs and existing event-intake assumptions.

## 5. Failure Modes And Edges

Call out migration and rollback behavior.

## Cross-References

- [Event Intake](./event-intake.md)
- [Gateway Events](./gateway-events.md)
- [Notification Policy](./notification-policy.md)
- [Platform Overview](./overview.md)
- [Review Queue](./review-queue.md)
- [Review Triage](./review-triage.md)

## Resolved Decisions

- Decision boundary: Decide how routes are versioned.
- Release bar: A reviewer can tell which route version rules are stable.
- Chosen shape: Use one versioning rule for external APIs and document exceptions explicitly.
- Inherited constraints: Respect markdown-first docs and existing event-intake assumptions.
- Failure modes: Call out migration and rollback behavior.
- Consistency updates: If versioning changes event intake contracts, update event-intake.md in the same review.

## Open Questions

- None.
