import { AuditReport, InterviewStartResult, SummaryReport, SyncReport } from "./types.js";

export function formatInterviewStart(result: InterviewStartResult): string {
  return [
    `Concept: ${result.concept}`,
    `Docs Dir: ${result.docsDir}`,
    `Challenge Mode: ${result.challengeMode}`,
    `Style: ${result.style.sectionNumbering}; cross-refs="${result.style.crossRefHeading}"; open-questions="${result.style.openQuestionsHeading}"`,
    "",
    "Known decisions:",
    ...prefixLines(result.knownDecisions.length ? result.knownDecisions : ["None detected yet."]),
    "",
    `Prepared ${result.questions.length} interview topics.`,
    "The question queue is kept internal; ask them one at a time and only surface the current question."
  ].join("\n");
}

export function formatAudit(report: AuditReport): string {
  return [
    `Audit for ${report.docsDir}`,
    `Style: ${report.style.sectionNumbering}; cross-refs="${report.style.crossRefHeading}"; open-questions="${report.style.openQuestionsHeading}"`,
    "",
    "Findings:",
    ...(report.findings.length
      ? report.findings.map(
          (finding) =>
            `- ${finding.severity.toUpperCase()}${finding.file ? ` ${finding.file}` : ""}: ${finding.summary} -> ${finding.detail}`
        )
      : ["- None."]),
    "",
    "Action Items:",
    ...(report.actionItems.length ? report.actionItems.map((item) => `- ${item}`) : ["- None."])
  ].join("\n");
}

export function formatSync(report: SyncReport): string {
  return [
    `Sync for ${report.docsDir}`,
    `Style: ${report.style.sectionNumbering}; cross-refs="${report.style.crossRefHeading}"; open-questions="${report.style.openQuestionsHeading}"`,
    "",
    "Updated Files:",
    ...(report.updatedFiles.length ? report.updatedFiles.map((file) => `- ${file}`) : ["- None."]),
    "",
    "Notes:",
    ...(report.notes.length ? report.notes.map((note) => `- ${note}`) : ["- None."])
  ].join("\n");
}

export function formatSummary(report: SummaryReport): string {
  return [
    `Summary for ${report.concept}`,
    `Docs Dir: ${report.docsDir}`,
    `Style: ${report.style.sectionNumbering}; cross-refs="${report.style.crossRefHeading}"; open-questions="${report.style.openQuestionsHeading}"`,
    "",
    "Learned:",
    ...(report.learned.length ? report.learned.map((item) => `- ${item}`) : ["- No grounded matches found."]),
    "",
    "Unresolved:",
    ...(report.unresolved.length ? report.unresolved.map((item) => `- ${item}`) : ["- None surfaced in matching sections."]),
    "",
    "Related Docs:",
    ...(report.relatedDocs.length ? report.relatedDocs.map((item) => `- ${item}`) : ["- None."])
  ].join("\n");
}

function prefixLines(lines: string[]): string[] {
  return lines.map((line) => `- ${line}`);
}
