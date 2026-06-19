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
 * byte-identical keys. Keys hash item TEXT (+ encounter occurrence) only — sub-bullets ride along
 * untouched, so reordering or adding `- Blocked-by:`/`- Owner:` leaves keys stable.
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
