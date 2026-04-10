import { DEFAULT_DOC_VERSION } from "./docs.js";
const TODAY = "2026-04-08";
export function renderDefaultGoldenTemplate(title = "Golden Template") {
    return `# ${title}
Created: ${TODAY}
Updated: ${TODAY}
Version: ${DEFAULT_DOC_VERSION}

## 1. Decision

State the concrete decision this document exists to lock down.

## 2. Release Bar

State what must be true for this design to be ready to implement.

## 3. Chosen Shape

State the selected approach and the most important rejected alternative.

## 4. Constraints And Cross-Checks

List inherited constraints from sibling docs, systems, or product commitments.

## 5. Failure Modes And Edges

List the operational risks, edge cases, and failure modes that should not stay implicit.

## Cross-References

- Add sibling docs here.

## Resolved Decisions

- Capture the final calls this doc makes.

## Open Questions

- None.

## Version History

- ${DEFAULT_DOC_VERSION} (${TODAY}): Initial documented draft.`;
}
