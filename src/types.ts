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

export type RCKind = "build" | "release-candidate";

/**
 * The filename / id prefix for an RC of the given kind.
 * - `"build"` (or undefined) → `"M"` — a regular work milestone.
 * - `"release-candidate"` → `"MRC"` — a pop-corks-moment milestone, the design-side
 *   marker for a release-readiness checkpoint. Versions remain orthogonal (SemVer is
 *   process; milestones are design).
 */
export function rcPrefix(kind?: RCKind): string {
  return kind === "release-candidate" ? "MRC" : "M";
}

export interface RCMetadata {
  id: string;
  milestone: number;
  name: string;
  kind?: RCKind;
  status: "Stub" | "Active" | "Shipped" | string;
  anchors: RCAnchor[];
  blocks: string[];
  // RC-level upstream blockers (other RC ids). Distinct from the per-ticket
  // `blockedBy` on TargetedSubsection.items, which lists upstream TICKET keys.
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

export type ShippedLockChangedField =
  | "theme"
  | "goals"
  | "targeted"
  | "definitionOfDone"
  | "anchors"
  | "milestone"
  | "name"
  | "marketing-waypoint"
  | "edges"
  | "references-removed"
  | "status-downgrade";

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
  edges: { from: string; to: string; kind: "blocks" | "depends-on"; reason: string }[];
  docMappings: DocMapping[];
  unmappedConcepts: UnmappedConcept[];
  waypoints: MarketingWaypointAssignment[];
  overrides: ScopeOverride[];
}

export interface TargetedSubsection {
  heading: string;
  // Per-ticket fields beyond the checkbox text, each held separately so item keys
  // (hashed from text only) stay stable:
  //   dod             — observable pass/fail acceptance criteria (the done-bar)
  //   howToImplement  — the concrete implementation path (file:line / seam)
  //   designContext   — traps and rationale to carry into execution
  //   blockedBy       — upstream TICKET keys this ticket can't start before
  //                     (per-ticket; distinct from RC-level RCMetadata.blockedBy)
  //   owner           — the single human accountable for this ticket
  items: {
    text: string;
    checked: boolean;
    dod?: string[];
    howToImplement?: string[];
    designContext?: string[];
    blockedBy?: string[];
    owner?: string;
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
  kind?: RCKind;
  status: string;
  anchor?: string;
  marketing?: string;
}

export interface ParsedRoadmapIndex {
  thesis: ThesisAnchor | null;
  minPlayWaypoint: MinPlayWaypoint | null;
  rcRows: ParsedRoadmapRCRow[];
  prerequisiteChain: { from: string; to: string; reason?: string }[];
  marketingWaypoints: { name: string; targetRC?: string; rationale?: string }[];
  unmappedConcepts: { docPath: string; reason?: string }[];
  raw: string;
}

export interface ParsedRC {
  path: string;
  milestone: number;
  kind?: RCKind;
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

export interface TaskoutExportItem {
  text: string;
  checked: boolean;
  key: string;
  /** Per-ticket acceptance criteria (the `- AC:` sub-bullets; legacy `- DOD:` also parses); omitted when none authored. */
  dod?: string[];
  /** How to implement this ticket — concrete code path/seam, ideally `file:line` (the `- How:` sub-bullets); omitted when none authored. */
  howToImplement?: string[];
  /** Design context — traps and the why behind this ticket (the `- Why:` sub-bullets); omitted when none authored. */
  designContext?: string[];
  /** Upstream TICKET keys this ticket can't start before (the `- Blocked-by:` sub-bullets); omitted when none authored. Per-ticket — distinct from RC-level RCMetadata.blockedBy. */
  blockedBy?: string[];
  /** The single human accountable for this ticket (the `- Owner:` sub-bullet); omitted when unauthored. */
  owner?: string;
}

export interface TaskoutExportSection {
  heading: string;
  key: string;
  items: TaskoutExportItem[];
}

export interface OrderViolation {
  /** Dependent ticket key whose `Blocked-by` edge points at-or-after itself in the pushed (Targeted/ClickUp) order. */
  item: string;
  /** The blocker ticket key (resolved within this RC) that sits at/after the dependent. */
  blocker: string;
}

export interface UnresolvedBlockedBy {
  /** Dependent ticket key carrying the bad token. */
  item: string;
  /** A `Blocked-by` token that looks intra-RC (this RC's prefix, or contains no `#`) but matches no ticket key here — a typo / wrong digest / stale ref. */
  token: string;
}

export interface StrayOrderingSection {
  /** The offending prose ordering heading (e.g. "Suggested Order") — a divergent second order source the parser ignores. */
  heading: string;
}

/**
 * Ordering health of a taskout RC. The Targeted list order IS the ClickUp order, so a `Blocked-by`
 * edge that contradicts it (or a typo'd edge) means the pushed order lies about the dependencies.
 * Surfaced by {@link TaskoutExportResult.orderDiagnostics} on the read path (never throws) and
 * enforced by `generateTaskout` on the write path (refuses on `blockedByViolations` /
 * `unresolvedBlockedBy`). `strayOrderingSections` is advisory-only.
 */
export interface OrderDiagnostics {
  blockedByViolations: OrderViolation[];
  unresolvedBlockedBy: UnresolvedBlockedBy[];
  strayOrderingSections: StrayOrderingSection[];
}

export interface TaskoutExportResult {
  rcId: string;
  path: string;
  milestone: number;
  kind: RCKind;
  name: string;
  status: string;
  lastUpdated?: string;
  theme?: string;
  goals: string[];
  targeted: TaskoutExportSection[];
  blockersAndDeps: BlockerEntry[];
  definitionOfDone: string[];
  references: string[];
  /** Ordering health (additive; always present). Empty lists = clean. See {@link OrderDiagnostics}. */
  orderDiagnostics: OrderDiagnostics;
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
