export interface DocFile {
    path: string;
    name: string;
    title: string;
    content: string;
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
