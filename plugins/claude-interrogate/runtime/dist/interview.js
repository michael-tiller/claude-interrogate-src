import path from "node:path";
import { detectHouseStyle, loadDocFile, loadDocs, summarizeDocs } from "./docs.js";
import { renderDefaultGoldenTemplate } from "./default-template.js";
export async function designInterviewStart(concept, docsDir, options) {
    const docs = await loadDocs(docsDir);
    const styleTemplate = options?.styleTemplatePath
        ? await loadDocFile(path.resolve(options.styleTemplatePath))
        : {
            path: "<built-in-template>",
            name: "default-golden-template.md",
            title: "Default Golden Template",
            content: renderDefaultGoldenTemplate()
        };
    const style = detectHouseStyle([styleTemplate, ...docs]);
    const docSummaries = summarizeDocs(docs);
    const knownDecisions = deriveKnownDecisions(docSummaries);
    const contradictions = findPotentialContradictions(concept, docSummaries);
    const challengeMode = normalizeChallengeMode(options);
    const depthMode = options?.depthMode === "fast" ? "fast" : "standard";
    const questions = buildQuestions(concept, knownDecisions, contradictions, challengeMode, depthMode);
    return {
        concept,
        docsDir: path.resolve(docsDir),
        styleTemplatePath: styleTemplate.path === "<built-in-template>" ? undefined : styleTemplate.path,
        challengeMode,
        depthMode,
        style,
        knownDecisions,
        contradictions,
        questions
    };
}
function deriveKnownDecisions(summaries) {
    return summaries
        .filter((summary) => /\b(decision|default|must|should|deferred|scope)\b/i.test(summary))
        .slice(0, 10);
}
function findPotentialContradictions(concept, summaries) {
    return summaries
        .filter((summary) => summary.toLowerCase().includes("deferred") || summary.toLowerCase().includes("not"))
        .map((summary) => `${concept}: verify against existing note -> ${summary}`)
        .slice(0, 5);
}
function buildQuestions(concept, knownDecisions, contradictions, challengeMode, depthMode) {
    const foundationsKnown = knownDecisions.join(" ").toLowerCase();
    const suffix = challengeMode === "adversarial"
        ? " Be specific: vague answers are not enough to justify a design decision."
        : challengeMode === "easy"
            ? " Keep it concrete, but concise is fine."
            : "";
    const questions = [
        {
            id: "problem",
            theme: "Foundations",
            question: `What concrete decision does "${concept}" need to lock down, and what breaks if it stays ambiguous?${suffix}`,
            rationale: challengeMode === "adversarial"
                ? "Start from the decision boundary and force a falsifiable claim."
                : challengeMode === "easy"
                    ? "Start from the decision boundary without overcomplicating the first pass."
                    : "Start from the decision boundary so later questions stay scoped."
        },
        {
            id: "success",
            theme: "Foundations",
            question: `What outcome would make "${concept}" clearly successful for the first release, and what evidence would show the current idea is not ready yet?${suffix}`,
            rationale: "Defines the bar for writing the document and for rejecting scope creep.",
            dependsOn: "problem"
        },
        {
            id: "shape",
            theme: "System Shape",
            question: `Which implementation shape are you choosing for "${concept}", what alternatives are you explicitly rejecting, and why do they fail?${suffix}`,
            rationale: "Forces trade-offs into the open instead of collecting description.",
            dependsOn: "success"
        },
        {
            id: "constraints",
            theme: "Constraints",
            question: `What existing constraints from sibling docs must "${concept}" obey, and which tempting shortcuts are invalid because of them?${suffix}`,
            rationale: "Prevents re-asking already settled decisions.",
            dependsOn: depthMode === "fast" ? "shape" : "inspirations"
        },
        {
            id: "edges",
            theme: "Failure Modes",
            question: `What edge cases or failure modes should the spec call out now instead of leaving implicit, and what would be irresponsible to postpone?${suffix}`,
            rationale: "Captures the first set of operational risks.",
            dependsOn: "constraints"
        }
    ];
    if (depthMode !== "fast") {
        questions.splice(3, 0, {
            id: "inspirations",
            theme: "Inspirations",
            question: `Are there any reference products, systems, workflows, or prior designs influencing "${concept}"? If so, which specific design moves are applicable here, and why do they transfer to this problem?${suffix}`,
            rationale: "Turns optional inspirations into concrete transferable design choices instead of loose references.",
            dependsOn: "shape"
        });
    }
    if (depthMode !== "fast" && !foundationsKnown.includes("contradiction")) {
        questions.push({
            id: "contradictions",
            theme: "Consistency",
            question: contradictions.length
                ? `Your docs suggest a few possible conflicts. Which of these is still authoritative, which should "${concept}" override, and why is that override justified? ${contradictions.join(" | ")}`
                : `If "${concept}" changes an existing assumption, which document should be updated alongside it, and what would break if you skipped that update?`,
            rationale: "Turns contradictions into explicit decisions.",
            dependsOn: "constraints"
        });
    }
    return questions;
}
function normalizeChallengeMode(options) {
    if (options?.challengeMode) {
        return options.challengeMode;
    }
    return options?.challenge ? "adversarial" : "standard";
}
