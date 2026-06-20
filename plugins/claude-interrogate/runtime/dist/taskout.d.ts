import { ConfirmedTaskoutPlan, OrderDiagnostics, RoadmapConfig, TargetedSubsection, TaskoutExportResult, TaskoutExportSection, TaskoutMode, TaskoutStartResult } from "./types.js";
export declare class TaskoutError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface AnalyzeTaskoutInput {
    rcId: string;
    docsDir: string;
    outputDir: string;
    styleTemplatePath?: string;
    roadmapConfig: RoadmapConfig;
    configBaseDir: string;
    clock?: () => Date;
}
export interface GenerateTaskoutInput {
    plan: ConfirmedTaskoutPlan;
    outputDir: string;
    mode: TaskoutMode;
    roadmapConfig: RoadmapConfig;
    clock?: () => Date;
}
export declare function analyzeTaskout(input: AnalyzeTaskoutInput): Promise<TaskoutStartResult>;
export declare function generateTaskout(input: GenerateTaskoutInput): Promise<{
    path: string;
    content: string;
}>;
export interface ExportTaskoutInput {
    rcId: string;
    outputDir: string;
    roadmapConfig: RoadmapConfig;
}
/**
 * Compute the stable export keys (epic + per-ticket) for a Targeted section list. Extracted so the
 * read path ({@link exportTaskout}) and the write-path order gate (`generateTaskout`) derive
 * byte-identical keys.
 *
 * Identity is PERSISTED, not re-derived: an item that carries `item.key` (read back from its inline
 * `<!-- key: … -->` comment, or echoed by the maintenance plan) keeps that key verbatim — so
 * rewording the ticket text or its epic heading does NOT mint a new key (see seam-task-identity.md).
 * Only a brand-new keyless item is minted, by the original algorithm (hash of TEXT + encounter
 * occurrence; sub-bullets never hashed) — so legacy keyless files reproduce today's exact keys, then
 * freeze on the next write. The epic key is taken from the section's first already-keyed item (so it
 * stays coherent with its items across a heading rename) and only falls back to the heading slug for
 * a wholly new epic.
 */
export declare function keyedTargeted(targeted: TargetedSubsection[], rcId: string): TaskoutExportSection[];
/**
 * Order health of a keyed Targeted list. The list order IS the pushed (ClickUp) order, so:
 *  - a `Blocked-by` edge whose target resolves to a ticket at-or-after the dependent is a
 *    `blockedByViolation` (the pushed order contradicts the dependency);
 *  - a `Blocked-by` token that looks intra-RC (starts with `${rcId}#`, OR contains no `#` at all —
 *    a bare digest / epic letter) but matches no ticket key is `unresolvedBlockedBy` (typo / wrong
 *    digest / stale). A token that DOES contain `#` with a different RC prefix is a legitimate
 *    cross-RC/upstream dep and is ignored.
 * `raw` (when provided, i.e. at export) is scanned for stray prose ordering sections — a divergent
 * second order source. Pure + side-effect-free so both export and generate can call it.
 */
export declare function analyzeTaskoutOrder(sections: TaskoutExportSection[], rcId: string, raw?: string): OrderDiagnostics;
export declare function exportTaskout(input: ExportTaskoutInput): Promise<TaskoutExportResult>;
