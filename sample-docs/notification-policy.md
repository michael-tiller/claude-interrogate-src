# Notification Policy
Created: 2026-04-08

Updated: 2026-04-08
Version: 0.1.0

## 1. Decision

Decide how notification urgency is communicated across channels.

## 2. Release Bar

A reviewer can explain when a notification escalates and how that shows up in product behavior.

## 3. Chosen Shape

Use one urgency model across email, in-product alerts, and webhook delivery instead of channel-specific rules.

## 4. Constraints And Cross-Checks

Respect existing naming, docs structure, and event-intake assumptions.

## 5. Failure Modes And Edges

Call out spam risk, suppressed critical alerts, and inconsistent retry behavior.

## Cross-References

- [Event Intake](./event-intake.md)
- [Gateway Events](./gateway-events.md)
- [Platform Overview](./overview.md)
- [Review Queue](./review-queue.md)
- [Review Triage](./review-triage.md)
- [Routing Spec](./routing-spec.md)

## Resolved Decisions

- Decision boundary: Decide how notification urgency is communicated across channels.
- Release bar: A reviewer can explain when a notification escalates and how that shows up in product behavior.
- Chosen shape: Use one urgency model across email, in-product alerts, and webhook delivery instead of channel-specific rules.
- Inherited constraints: Respect existing naming, docs structure, and event-intake assumptions.
- Failure modes: Call out spam risk, suppressed critical alerts, and inconsistent retry behavior.

## Open Questions

- None.
