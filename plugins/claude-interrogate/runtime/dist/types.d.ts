export interface DocFile {
    path: string;
    name: string;
    title: string;
    content: string;
    anchorSource?: AnchorSource;
}
export interface SectionInfo {
    heading: string;
    body: string;
}
export interface HouseStyle {
    sectionNumbering: string;
    crossRefHeading: string;
    openQuestionsHeading: string;
    toneCues: string[];
}
export interface InterviewQuestion {
    id: string;
    theme: string;
    question: string;
    rationale: string;
    dependsOn?: string;
}
export interface InterviewStartResult {
    concept: string;
    docsDir: string;
    styleTemplatePath?: string;
    challengeMode: "easy" | "standard" | "adversarial";
    depthMode: "fast" | "standard";
    style: HouseStyle;
    knownDecisions: string[];
    contradictions: string[];
    questions: InterviewQuestion[];
}
export interface GenerateDocInput {
    concept: string;
    responses: Record<string, string>;
    docsDir?: string;
    styleTemplatePath?: string;
}
export interface AuditFinding {
    severity: "high" | "medium" | "low";
    file?: string;
    summary: string;
    detail: string;
}
export interface AuditReport {
    docsDir: string;
    styleTemplatePath?: string;
    style: HouseStyle;
    findings: AuditFinding[];
    actionItems: string[];
}
export interface SyncReport {
    docsDir: string;
    styleTemplatePath?: string;
    style: HouseStyle;
    updatedFiles: string[];
    notes: string[];
}
export interface SummaryReport {
    concept: string;
    docsDir: string;
    styleTemplatePath?: string;
    style: HouseStyle;
    learned: string[];
    unresolved: string[];
    relatedDocs: string[];
}
export type AnchorSource = "Concept" | "Plan" | "ADR" | "Inline" | string;
export interface ReservedSlot {
    milestone: number;
    purpose: string;
}
export interface RoadmapConfig {
    indexFile: string;
    rcDir: string;
    rcNamingScheme: string;
    techDebtFile: string | null;
    reservedSlots: ReservedSlot[];
    marketingWaypoints: string[];
    anchorSources: string[];
}
export interface RCAnchor {
    kind: AnchorSource;
    path?: string;
    thesis?: string;
}
export interface RCMetadata {
    id: string;
    milestone: number;
    name: string;
    status: "Stub" | "Active" | "Shipped" | string;
    anchors: RCAnchor[];
    blocks: string[];
    blockedBy: string[];
    marketingWaypoint?: string;
    shippedAt?: string;
}
export interface DAGCandidate {
    from: string;
    to: string;
    kind: "blocks" | "depends-on" | "parallel";
    confidence: "low" | "medium" | "high";
    reason: string;
}
export interface ConceptDocSummary {
    path: string;
    title: string;
    anchorSource: AnchorSource;
    headings: string[];
    crossRefs: string[];
}
export interface DriftSummary {
    newConceptsUnmapped: string[];
    shippedRCs: string[];
    rcsMissingFromIndex: string[];
    cycles: string[][];
}
export interface ScopeStartResult {
    docsDir: string;
    outputDir: string;
    styleTemplatePath?: string;
    roadmapConfig: RoadmapConfig;
    mode: "bootstrap" | "maintenance";
    conceptDocs: ConceptDocSummary[];
    proposedRCs: RCMetadata[];
    dagCandidates: DAGCandidate[];
    driftSummary?: DriftSummary;
    questions: InterviewQuestion[];
}
export type ShippedLockChangedField = "theme" | "goals" | "targeted" | "definitionOfDone" | "anchors" | "milestone" | "name" | "marketing-waypoint" | "edges" | "references-removed" | "status-downgrade";
export interface ShippedLockOverride {
    kind: "shipped-lock-bypass";
    rcId: string;
    changedFields: ShippedLockChangedField[];
    reason: string;
}
export interface ScopeOverride {
    rcId: string;
    kind: "shipped-lock-bypass" | "reserved-slot-collision";
    changedFields?: ShippedLockChangedField[];
    reason: string;
}
export interface ThesisAnchor {
    text: string;
    anchorDoc?: string;
}
export interface MinPlayWaypoint {
    rcId: string;
    criterion: string;
}
export interface DocMapping {
    docPath: string;
    rcId: string;
    sections?: string[];
}
export interface UnmappedConcept {
    docPath: string;
    reason: string;
}
export interface MarketingWaypointAssignment {
    name: string;
    targetRC: string;
    rationale: string;
}
export interface ConfirmedScopePlan {
    thesis: ThesisAnchor;
    minPlayWaypoint: MinPlayWaypoint;
    rcs: RCMetadata[];
    edges: {
        from: string;
        to: string;
        kind: "blocks" | "depends-on";
        reason: string;
    }[];
    docMappings: DocMapping[];
    unmappedConcepts: UnmappedConcept[];
    waypoints: MarketingWaypointAssignment[];
    overrides: ScopeOverride[];
}
export interface TargetedSubsection {
    heading: string;
    items: {
        text: string;
        checked: boolean;
    }[];
}
export interface BlockerEntry {
    kind: "Upstream RC" | "Tech Debt" | "External";
    item: string;
    sourcePath?: string;
    sourceLine?: number;
}
export interface ConfirmedTaskoutPlan {
    rc: RCMetadata;
    theme: string;
    goals: string[];
    targeted: TargetedSubsection[];
    blockersAndDeps: BlockerEntry[];
    definitionOfDone: string[];
    references: string[];
    overrides: ShippedLockOverride[];
}
export type TaskoutMode = "bootstrap-rc" | "maintenance";
export interface CarriedFromCandidate {
    sourceRC: string;
    item: string;
    sourceLine: number;
}
export interface TechDebtBlocker {
    item: string;
    sourcePath: string;
    sourceLine: number;
    severity?: string;
}
export interface MappedConceptSummary {
    path: string;
    relevantSections: string[];
}
export interface TaskoutDraftSections {
    theme: string;
    goals: string[];
    targeted: TargetedSubsection[];
    blockersAndDeps: BlockerEntry[];
    definitionOfDone: string[];
    references: string[];
}
export interface TaskoutStartResult {
    rc: RCMetadata;
    outputDir: string;
    mode: TaskoutMode;
    mappedConcepts: MappedConceptSummary[];
    carriedFromCandidates: CarriedFromCandidate[];
    techDebtBlockers: TechDebtBlocker[];
    draftSections: TaskoutDraftSections;
    questions: InterviewQuestion[];
}
export interface ParsedRoadmapRCRow {
    milestone: number;
    name: string;
    status: string;
    anchor?: string;
    marketing?: string;
}
export interface ParsedRoadmapIndex {
    thesis: ThesisAnchor | null;
    minPlayWaypoint: MinPlayWaypoint | null;
    rcRows: ParsedRoadmapRCRow[];
    prerequisiteChain: {
        from: string;
        to: string;
        reason?: string;
    }[];
    marketingWaypoints: {
        name: string;
        targetRC?: string;
        rationale?: string;
    }[];
    unmappedConcepts: {
        docPath: string;
        reason?: string;
    }[];
    raw: string;
}
export interface ParsedRC {
    path: string;
    milestone: number;
    name: string;
    status: string;
    lastUpdated?: string;
    theme?: string;
    goals: string[];
    targeted: TargetedSubsection[];
    blockersAndDeps: BlockerEntry[];
    definitionOfDone: string[];
    references: string[];
    raw: string;
}
export interface ParsedTechDebtItem {
    text: string;
    blocks: string[];
    severity?: string;
    sourceLine: number;
}
export interface ParsedTechDebt {
    path: string;
    items: ParsedTechDebtItem[];
}
