import path from "node:path";
import { detectHouseStyle, extractCrossReferences, extractOpenQuestions, loadDocFile, loadDocs } from "./docs.js";
import { renderDefaultGoldenTemplate } from "./default-template.js";
export async function designAudit(docsDir, styleTemplatePath) {
    const docs = await loadDocs(docsDir);
    const styleTemplate = styleTemplatePath ? await loadDocFile(path.resolve(styleTemplatePath)) : null;
    const effectiveStyleSource = styleTemplate ??
        {
            path: "<built-in-template>",
            name: "default-golden-template.md",
            title: "Default Golden Template",
            content: renderDefaultGoldenTemplate()
        };
    const style = detectHouseStyle([effectiveStyleSource, ...docs]);
    const findings = [];
    for (const doc of docs) {
        const crossRefs = extractCrossReferences(doc.content);
        if (crossRefs.length === 0) {
            findings.push({
                severity: "medium",
                file: doc.path,
                summary: "Missing cross-references",
                detail: `${doc.name} does not link to sibling documents.`
            });
        }
        const openQuestions = extractOpenQuestions(doc.content, style.openQuestionsHeading);
        for (const question of openQuestions) {
            findings.push({
                severity: "low",
                file: doc.path,
                summary: "Open question remains unresolved",
                detail: question
            });
        }
        if (!containsUpdatedDate(doc.content)) {
            findings.push({
                severity: "medium",
                file: doc.path,
                summary: "Missing updated date",
                detail: `${doc.name} should include a current updated date near the top.`
            });
        }
        if (!containsCreatedDate(doc.content)) {
            findings.push({
                severity: "medium",
                file: doc.path,
                summary: "Missing created date",
                detail: `${doc.name} should include a created date near the top so document age is visible.`
            });
        }
        if (!containsVersionLine(doc.content)) {
            findings.push({
                severity: "medium",
                file: doc.path,
                summary: "Missing version line",
                detail: `${doc.name} should include a version near the top so revisions are trackable.`
            });
        }
    }
    const pairwiseLinks = new Set(docs.flatMap((doc) => extractCrossReferences(doc.content).map((target) => `${path.basename(doc.path)}->${path.basename(target)}`)));
    for (const doc of docs) {
        for (const ref of extractCrossReferences(doc.content)) {
            const forward = `${path.basename(doc.path)}->${path.basename(ref)}`;
            const reverse = `${path.basename(ref)}->${path.basename(doc.path)}`;
            if (pairwiseLinks.has(forward) && !pairwiseLinks.has(reverse)) {
                findings.push({
                    severity: "medium",
                    file: doc.path,
                    summary: "Cross-reference mismatch",
                    detail: `${path.basename(doc.path)} links to ${path.basename(ref)}, but the reverse link is missing.`
                });
            }
        }
    }
    if (docs.length === 0) {
        findings.push({
            severity: "high",
            summary: "Empty docs directory",
            detail: "Bootstrap a skeleton document set before starting an interview."
        });
    }
    return {
        docsDir: path.resolve(docsDir),
        styleTemplatePath: styleTemplate?.path,
        style,
        findings,
        actionItems: findings.map((finding, index) => `${index + 1}. ${finding.summary}: ${finding.detail}`)
    };
}
function containsUpdatedDate(content) {
    return /^Updated:\s+\d{4}-\d{2}-\d{2}$/m.test(content);
}
function containsCreatedDate(content) {
    return /^Created:\s+\d{4}-\d{2}-\d{2}$/m.test(content);
}
function containsVersionLine(content) {
    return /^Version:\s+\S.*$/m.test(content);
}
