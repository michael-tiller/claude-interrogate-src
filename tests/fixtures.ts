export const SAMPLE_RC = `# Sample M8 — QUESTS
Status: Active
Last Updated: 2026-05-12

## Definition of Done
- [ ] Quest skeleton is deterministic.
- [x] LLM dressing is optional.

## Theme
Moodlet-to-quest skeleton pipeline.

## Goals
- Deterministic generation.
- Dispatch parity.

## Targeted
### Moodlet → Quest Skeleton
- [ ] Salience threshold drives generation
- [x] LLM-optional dressing

### Dispatch
- [ ] Go yourself
- [ ] Lead a squad

## Blockers & Dependencies
- **Upstream RC**: 0_4_0_COLONY — dispatch needs colony
- **Tech Debt**: pathfinding cache (\`Roadmap/TECHNICAL_DEBT.md:42\`)
- **External**: pending ADR-0007

## References
- Concept/quests.md
- Plan/dispatch_quest_plan.md
`;
