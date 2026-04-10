import { AuditReport, InterviewStartResult, SummaryReport, SyncReport } from "./types.js";
export declare function formatInterviewStart(result: InterviewStartResult): string;
export declare function formatAudit(report: AuditReport): string;
export declare function formatSync(report: SyncReport): string;
export declare function formatSummary(report: SummaryReport): string;
