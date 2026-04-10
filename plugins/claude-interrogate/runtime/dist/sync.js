import { writeFile } from "node:fs/promises";
import path from "node:path";
import { detectHouseStyle, extractBullets, extractOpenQuestions, getSectionBody, listSections, loadDocFile, loadDocs, moveSectionBefore, postEditNormalizeDocument, removeSection, replaceOrAppendSection } from "./docs.js";
import { renderDefaultGoldenTemplate } from "./default-template.js";
const TODAY = "2026-04-08";
const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "beside",
    "by",
    "does",
    "for",
    "from",
    "how",
    "if",
    "in",
    "into",
    "is",
    "it",
    "live",
    "of",
    "on",
    "or",
    "should",
    "the",
    "their",
    "them",
    "this",
    "to",
    "what",
    "when",
    "with"
]);
export async function designCrossRefSync(docsDir, styleTemplatePath) {
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
    const updatedFiles = [];
    const notes = [];
    const candidates = buildResolutionCandidates(docs, style.openQuestionsHeading, style.crossRefHeading);
    let resolvedQuestionsMoved = 0;
    let resolvedQuestionsPlacedInBody = 0;
    for (const doc of docs) {
        const expectedLinks = docs
            .filter((candidate) => candidate.path !== doc.path)
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((candidate) => `- [${candidate.title}](${toPosixRelative(path.dirname(doc.path), candidate.path)})`);
        let nextContent = doc.content;
        nextContent = replaceOrAppendSection(nextContent, style.crossRefHeading, expectedLinks.length ? expectedLinks.join("\n") : "- No sibling docs yet.");
        const openQuestions = extractOpenQuestions(nextContent, style.openQuestionsHeading);
        const existingResolved = extractBullets(getSectionBody(nextContent, "Resolved Decisions") ?? "").filter((item) => !/^no resolved decisions/i.test(item));
        const unresolvedQuestions = [];
        const resolvedAdditions = [];
        for (const question of openQuestions) {
            const resolution = findResolution(question, doc.path, candidates);
            if (!resolution) {
                unresolvedQuestions.push(question);
                continue;
            }
            resolvedQuestionsMoved += 1;
            const relativePath = toPosixRelative(path.dirname(doc.path), resolution.docPath);
            const resolutionLine = `Resolved via [${resolution.docTitle}](${relativePath}) / ${resolution.heading}: ${resolution.text}`;
            const insertionHeading = chooseInsertionHeading(nextContent, question, resolution, style);
            if (insertionHeading) {
                nextContent = appendResolutionToSection(nextContent, insertionHeading, resolutionLine);
                resolvedQuestionsPlacedInBody += 1;
            }
            else {
                resolvedAdditions.push(`Previously open question ${resolutionLine.charAt(0).toLowerCase()}${resolutionLine.slice(1)}`);
            }
        }
        const resolvedDecisionItems = dedupeBullets([...existingResolved, ...resolvedAdditions]);
        if (resolvedDecisionItems.length > 0) {
            nextContent = replaceOrAppendSection(nextContent, "Resolved Decisions", resolvedDecisionItems.map((item) => `- ${item}`).join("\n"));
        }
        else {
            nextContent = removeSection(nextContent, "Resolved Decisions");
        }
        nextContent = replaceOrAppendSection(nextContent, style.openQuestionsHeading, unresolvedQuestions.length
            ? unresolvedQuestions.map((question) => `- ${question}`).join("\n")
            : "- None.");
        nextContent = moveSectionBefore(nextContent, "Resolved Decisions", style.openQuestionsHeading);
        nextContent = postEditNormalizeDocument(doc.content, nextContent, TODAY, {
            crossRefHeading: style.crossRefHeading,
            openQuestionsHeading: style.openQuestionsHeading
        }).content;
        if (nextContent !== doc.content) {
            await writeFile(doc.path, nextContent, "utf8");
            updatedFiles.push(doc.path);
        }
    }
    if (docs.length === 0) {
        notes.push("Docs directory is empty; nothing to sync.");
    }
    else {
        notes.push("Cross-reference sections were normalized to list every sibling doc.");
        notes.push(`Managed docs were normalized to include Created, Updated, and Version headers.`);
        if (resolvedQuestionsMoved > 0) {
            notes.push(`${resolvedQuestionsMoved} open question${resolvedQuestionsMoved === 1 ? "" : "s"} resolved because matching answers already existed.`);
            notes.push(`${resolvedQuestionsPlacedInBody} resolved answer${resolvedQuestionsPlacedInBody === 1 ? "" : "s"} placed directly into body sections.`);
        }
        else {
            notes.push("No open questions met the confidence threshold for automatic resolution movement.");
        }
    }
    return {
        docsDir: path.resolve(docsDir),
        styleTemplatePath: styleTemplate?.path,
        style,
        updatedFiles,
        notes
    };
}
function buildResolutionCandidates(docs, openQuestionsHeading, crossRefHeading) {
    return docs.flatMap((doc) => listSections(doc.content)
        .filter((section) => section.heading.toLowerCase() !== openQuestionsHeading.toLowerCase() &&
        section.heading.toLowerCase() !== crossRefHeading.toLowerCase())
        .flatMap((section) => {
        const bullets = extractBullets(section.body);
        const entries = bullets.length > 0 ? bullets : section.body.split(/\r?\n/).filter(Boolean);
        return entries
            .map((entry) => entry.trim())
            .filter(Boolean)
            .map((entry) => ({
            docPath: doc.path,
            docTitle: doc.title,
            heading: section.heading,
            text: entry,
            tokens: tokenize(entry)
        }));
    }));
}
function findResolution(question, docPath, candidates) {
    const questionTokens = tokenize(question);
    if (questionTokens.size === 0) {
        return null;
    }
    let best = null;
    for (const candidate of candidates) {
        if (candidate.docPath === docPath && candidate.heading.toLowerCase() === "open questions") {
            continue;
        }
        const overlap = countOverlap(questionTokens, candidate.tokens);
        if (overlap < 2) {
            continue;
        }
        const headingBoost = /resolved decisions|decision|chosen shape|constraints|release bar/i.test(candidate.heading) ? 1 : 0;
        const score = overlap + headingBoost;
        if (!best || score > best.score) {
            best = { candidate, score };
        }
    }
    return best?.candidate ?? null;
}
function dedupeBullets(items) {
    return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}
function appendResolutionToSection(content, heading, resolutionLine) {
    const currentBody = getSectionBody(content, heading) ?? "";
    if (currentBody.includes(resolutionLine)) {
        return content;
    }
    const bullets = extractBullets(currentBody);
    const nextBody = bullets.length > 0
        ? `${currentBody.trim()}\n- ${resolutionLine}`
        : `${currentBody.trim()}\n\nResolved: ${resolutionLine}`.trim();
    return replaceOrAppendSection(content, heading, nextBody);
}
function chooseInsertionHeading(content, question, resolution, style) {
    const sections = listSections(content).filter((section) => !equalsIgnoreCase(section.heading, style.crossRefHeading) &&
        !equalsIgnoreCase(section.heading, style.openQuestionsHeading) &&
        !equalsIgnoreCase(section.heading, "Resolved Decisions"));
    if (sections.some((section) => equalsIgnoreCase(section.heading, resolution.heading))) {
        return sections.find((section) => equalsIgnoreCase(section.heading, resolution.heading))?.heading ?? null;
    }
    const questionTokens = tokenize(question);
    const resolutionHeadingTokens = tokenize(resolution.heading);
    let best = null;
    for (const section of sections) {
        const headingTokens = tokenize(section.heading);
        const score = countOverlap(questionTokens, headingTokens) +
            countOverlap(resolutionHeadingTokens, headingTokens);
        if (score <= 0) {
            continue;
        }
        if (!best || score > best.score) {
            best = { heading: section.heading, score };
        }
    }
    if (best) {
        return best.heading;
    }
    const numberedSection = sections.find((section) => /^\d+\./.test(section.heading));
    return numberedSection?.heading ?? sections[0]?.heading ?? null;
}
function tokenize(value) {
    return new Set(value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}
function countOverlap(a, b) {
    let overlap = 0;
    for (const token of a) {
        if (b.has(token)) {
            overlap += 1;
        }
    }
    return overlap;
}
function toPosixRelative(fromDir, toFile) {
    const relative = path.relative(fromDir, toFile).replace(/\\/g, "/");
    return relative.startsWith(".") ? relative : `./${relative}`;
}
function equalsIgnoreCase(a, b) {
    return a.toLowerCase() === b.toLowerCase();
}
