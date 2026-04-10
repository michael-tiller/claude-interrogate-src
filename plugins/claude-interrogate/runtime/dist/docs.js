import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
export const DEFAULT_DOC_VERSION = "0.1.0";
const DEFAULT_PATCH_PLACEHOLDER = "- None.";
const DEFAULT_RESOLVED_PLACEHOLDER = "- No resolved decisions captured yet.";
const VERSION_HISTORY_HEADING = "Version History";
const DEFAULT_STYLE = {
    sectionNumbering: "## 1.",
    crossRefHeading: "Cross-References",
    openQuestionsHeading: "Open Questions",
    toneCues: ["terse", "decision-oriented", "cross-linked"]
};
const SECTION_MARKER = /^(#{1,6}\s+|(?:§|Â§)\d+)/;
export async function ensureDocsDir(docsDir) {
    const info = await stat(docsDir);
    if (!info.isDirectory()) {
        throw new Error(`Docs path is not a directory: ${docsDir}`);
    }
}
export async function loadDocs(docsDir) {
    await ensureDocsDir(docsDir);
    const entries = await readdir(docsDir, { withFileTypes: true });
    const files = entries
        .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
        .sort((a, b) => a.name.localeCompare(b.name));
    return Promise.all(files.map(async (file) => {
        const filePath = path.join(docsDir, file.name);
        const content = await readFile(filePath, "utf8");
        return {
            path: filePath,
            name: file.name,
            title: extractTitle(file.name, content),
            content
        };
    }));
}
export async function loadDocFile(filePath) {
    const content = await readFile(filePath, "utf8");
    return {
        path: filePath,
        name: path.basename(filePath),
        title: extractTitle(path.basename(filePath), content),
        content
    };
}
export function detectHouseStyle(docs) {
    if (docs.length === 0) {
        return DEFAULT_STYLE;
    }
    let sectionNumbering = DEFAULT_STYLE.sectionNumbering;
    let crossRefHeading = DEFAULT_STYLE.crossRefHeading;
    let openQuestionsHeading = DEFAULT_STYLE.openQuestionsHeading;
    for (const doc of docs) {
        if (sectionNumbering === DEFAULT_STYLE.sectionNumbering) {
            const numberingMatch = doc.content.match(/^((?:§|Â§)\d+|##\s+\d+\.|#\s+\d+\.)/m);
            if (numberingMatch) {
                sectionNumbering = numberingMatch[1];
            }
        }
        const crossRefMatch = findHeading(doc.content, /(cross[- ]references?|related docs?)/i);
        if (crossRefMatch) {
            crossRefHeading = crossRefMatch;
        }
        const openQuestionsMatch = findHeading(doc.content, /open questions?/i);
        if (openQuestionsMatch) {
            openQuestionsHeading = openQuestionsMatch;
        }
    }
    return {
        sectionNumbering,
        crossRefHeading,
        openQuestionsHeading,
        toneCues: inferToneCues(docs)
    };
}
export function listSections(content) {
    const lines = content.split(/\r?\n/);
    const sections = [];
    let currentHeading = "Preamble";
    let buffer = [];
    const flush = () => {
        sections.push({ heading: currentHeading, body: buffer.join("\n").trim() });
        buffer = [];
    };
    for (const line of lines) {
        if (SECTION_MARKER.test(line)) {
            flush();
            currentHeading = normalizeHeading(line);
            continue;
        }
        buffer.push(line);
    }
    flush();
    return sections.filter((section) => section.body.length > 0);
}
export function getSectionBody(content, heading) {
    const normalizedHeading = heading.toLowerCase();
    const section = listSections(content).find((entry) => entry.heading.toLowerCase() === normalizedHeading);
    return section?.body ?? null;
}
export function extractBullets(sectionBody) {
    return sectionBody
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^[-*]\s+/.test(line))
        .map((line) => line.replace(/^[-*]\s+/, ""));
}
export function summarizeDocs(docs) {
    return docs.flatMap((doc) => listSections(doc.content)
        .slice(0, 6)
        .map((section) => `${doc.title}: ${section.heading} -> ${compact(section.body)}`));
}
export function extractCrossReferences(content) {
    return Array.from(content.matchAll(/\[([^\]]+)\]\(([^)]+\.md)\)/g)).map((match) => match[2]);
}
export function extractOpenQuestions(content, openQuestionsHeading) {
    const sections = listSections(content);
    const section = sections.find((entry) => entry.heading.toLowerCase().includes(openQuestionsHeading.toLowerCase()));
    if (!section) {
        return [];
    }
    return extractBullets(section.body).filter((item) => !/^none\.?$/i.test(item));
}
export function replaceOrAppendSection(content, heading, body) {
    const lines = content.split(/\r?\n/);
    const sectionHeader = `## ${heading}`;
    const startIndex = lines.findIndex((line) => normalizeHeading(line).toLowerCase() === heading.toLowerCase());
    if (startIndex === -1) {
        return `${content.trimEnd()}\n\n${sectionHeader}\n\n${body.trim()}\n`;
    }
    let endIndex = lines.length;
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        if (SECTION_MARKER.test(lines[index])) {
            endIndex = index;
            break;
        }
    }
    const prefix = lines.slice(0, startIndex).join("\n").replace(/\s+$/, "");
    const suffix = lines.slice(endIndex).join("\n").replace(/^\s+/, "");
    const middle = `${sectionHeader}\n\n${body.trim()}`;
    return [prefix, middle, suffix].filter((part) => part.length > 0).join("\n\n").trimEnd() + "\n";
}
export function ensureUpdatedDate(content, isoDate) {
    const lines = content.split(/\r?\n/);
    const updatedLine = `Updated: ${isoDate}`;
    const existingIndex = lines.findIndex((line) => /^Updated:\s+\d{4}-\d{2}-\d{2}$/.test(line));
    if (existingIndex !== -1) {
        lines[existingIndex] = updatedLine;
        return `${lines.join("\n").trimEnd()}\n`;
    }
    const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
    if (titleIndex !== -1) {
        lines.splice(titleIndex + 1, 0, updatedLine, "");
        return `${lines.join("\n").trimEnd()}\n`;
    }
    return `${updatedLine}\n\n${content.trimStart()}`;
}
export function ensureCreatedDate(content, isoDate) {
    const lines = content.split(/\r?\n/);
    const createdLine = `Created: ${isoDate}`;
    const existingIndex = lines.findIndex((line) => /^Created:\s+\d{4}-\d{2}-\d{2}$/.test(line));
    if (existingIndex !== -1) {
        return `${lines.join("\n").trimEnd()}\n`;
    }
    const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
    if (titleIndex !== -1) {
        lines.splice(titleIndex + 1, 0, createdLine, "");
        return `${lines.join("\n").trimEnd()}\n`;
    }
    return `${createdLine}\n\n${content.trimStart()}`;
}
export function ensureVersionLine(content, version) {
    const lines = content.split(/\r?\n/);
    const versionLine = `Version: ${version}`;
    const existingIndex = lines.findIndex((line) => /^Version:\s+\S.*$/.test(line));
    if (existingIndex !== -1) {
        lines[existingIndex] = versionLine;
        return `${lines.join("\n").trimEnd()}\n`;
    }
    const updatedIndex = lines.findIndex((line) => /^Updated:\s+\d{4}-\d{2}-\d{2}$/.test(line));
    if (updatedIndex !== -1) {
        lines.splice(updatedIndex + 1, 0, versionLine);
        return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
    }
    const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
    if (titleIndex !== -1) {
        lines.splice(titleIndex + 1, 0, versionLine, "");
        return `${lines.join("\n").trimEnd()}\n`;
    }
    return `${versionLine}\n\n${content.trimStart()}`;
}
export function ensureDocumentMetadata(content, isoDate, version) {
    return ensureVersionLine(ensureUpdatedDate(ensureCreatedDate(content, isoDate), isoDate), version);
}
export function postEditNormalizeDocument(previousContent, nextContent, isoDate, options) {
    const previousVersion = previousContent ? extractVersion(previousContent) : null;
    const bump = previousContent
        ? inferSemverBump(previousContent, nextContent, options)
        : "none";
    const version = previousVersion
        ? bumpSemver(previousVersion, bump)
        : DEFAULT_DOC_VERSION;
    let content = ensureDocumentMetadata(nextContent, isoDate, version);
    if (options?.crossRefHeading) {
        const existing = getSectionBody(content, options.crossRefHeading);
        content = replaceOrAppendSection(content, options.crossRefHeading, existing?.trim() ? existing.trim() : DEFAULT_PATCH_PLACEHOLDER);
    }
    const resolvedBody = getSectionBody(content, "Resolved Decisions");
    content = replaceOrAppendSection(content, "Resolved Decisions", resolvedBody?.trim() ? resolvedBody.trim() : DEFAULT_RESOLVED_PLACEHOLDER);
    if (options?.openQuestionsHeading) {
        const existing = getSectionBody(content, options.openQuestionsHeading);
        content = replaceOrAppendSection(content, options.openQuestionsHeading, existing?.trim() ? existing.trim() : DEFAULT_PATCH_PLACEHOLDER);
        content = moveSectionBefore(content, "Resolved Decisions", options.openQuestionsHeading);
    }
    content = ensureVersionHistoryEntry(content, version, isoDate, bump, previousContent ? "update" : "initial");
    return { content, version, bump };
}
export function moveSectionBefore(content, heading, beforeHeading) {
    const lines = content.split(/\r?\n/);
    const startIndex = lines.findIndex((line) => normalizeHeading(line).toLowerCase() === heading.toLowerCase());
    const beforeIndex = lines.findIndex((line) => normalizeHeading(line).toLowerCase() === beforeHeading.toLowerCase());
    if (startIndex === -1 || beforeIndex === -1 || startIndex < beforeIndex) {
        return `${content.trimEnd()}\n`;
    }
    const endIndex = findSectionEnd(lines, startIndex);
    const sectionLines = lines.slice(startIndex, endIndex);
    const withoutSection = [...lines.slice(0, startIndex), ...lines.slice(endIndex)];
    const insertionIndex = withoutSection.findIndex((line) => normalizeHeading(line).toLowerCase() === beforeHeading.toLowerCase());
    if (insertionIndex === -1) {
        return `${content.trimEnd()}\n`;
    }
    const rebuilt = [
        ...withoutSection.slice(0, insertionIndex),
        ...sectionLines,
        "",
        ...withoutSection.slice(insertionIndex)
    ];
    return `${rebuilt.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
export function removeSection(content, heading) {
    const lines = content.split(/\r?\n/);
    const startIndex = lines.findIndex((line) => normalizeHeading(line).toLowerCase() === heading.toLowerCase());
    if (startIndex === -1) {
        return `${content.trimEnd()}\n`;
    }
    const endIndex = findSectionEnd(lines, startIndex);
    const rebuilt = [...lines.slice(0, startIndex), ...lines.slice(endIndex)];
    return `${rebuilt.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}
function extractTitle(fileName, content) {
    const heading = content.match(/^#\s+(.+)$/m)?.[1];
    if (heading) {
        return heading.trim();
    }
    return fileName.replace(/\.md$/i, "");
}
function compact(value) {
    return value.replace(/\s+/g, " ").slice(0, 140);
}
function findHeading(content, pattern) {
    for (const line of content.split(/\r?\n/)) {
        if (!SECTION_MARKER.test(line.trim())) {
            continue;
        }
        const normalized = normalizeHeading(line);
        if (pattern.test(normalized)) {
            return normalized;
        }
    }
    return null;
}
function normalizeHeading(line) {
    return line.replace(/^(#+\s*|(?:§|Â§)\d+\s*)/, "").trim();
}
function findSectionEnd(lines, startIndex) {
    for (let index = startIndex + 1; index < lines.length; index += 1) {
        if (SECTION_MARKER.test(lines[index])) {
            return index;
        }
    }
    return lines.length;
}
function inferToneCues(docs) {
    const corpus = docs.map((doc) => doc.content).join("\n");
    const toneCues = ["decision-oriented"];
    if (/\([^)]{10,}\)/.test(corpus)) {
        toneCues.push("parenthetical clarifications");
    }
    if (/inspiration/i.test(corpus)) {
        toneCues.push("inspirations callouts");
    }
    if (/\bmust\b/i.test(corpus)) {
        toneCues.push("normative");
    }
    return toneCues;
}
function extractVersion(content) {
    return content.match(/^Version:\s+(\d+\.\d+\.\d+)$/m)?.[1] ?? null;
}
function bumpSemver(version, bump) {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) {
        return DEFAULT_DOC_VERSION;
    }
    const major = Number(match[1]);
    const minor = Number(match[2]);
    const patch = Number(match[3]);
    switch (bump) {
        case "major":
            return `${major + 1}.0.0`;
        case "minor":
            return `${major}.${minor + 1}.0`;
        case "patch":
            return `${major}.${minor}.${patch + 1}`;
        case "none":
        default:
            return version;
    }
}
function inferSemverBump(previousContent, nextContent, options) {
    const previousTitle = extractTitle("<unknown>", previousContent);
    const nextTitle = extractTitle("<unknown>", nextContent);
    if (previousTitle !== nextTitle) {
        return "major";
    }
    const managedHeadings = new Set([
        options?.crossRefHeading,
        options?.openQuestionsHeading,
        "Resolved Decisions",
        VERSION_HISTORY_HEADING
    ].filter((value) => Boolean(value)).map((value) => canonicalSectionHeading(value)));
    const previousSections = comparableSections(previousContent);
    const nextSections = comparableSections(nextContent);
    const changedCoreSections = new Set();
    const changedManagedSections = new Set();
    const allHeadings = new Set([...previousSections.keys(), ...nextSections.keys()]);
    for (const heading of allHeadings) {
        const previousBody = previousSections.get(heading) ?? null;
        const nextBody = nextSections.get(heading) ?? null;
        if (previousBody === nextBody) {
            continue;
        }
        if (managedHeadings.has(heading)) {
            changedManagedSections.add(heading);
            continue;
        }
        changedCoreSections.add(heading);
    }
    if (changedCoreSections.size === 0 && changedManagedSections.size === 0) {
        return "none";
    }
    const previousCoreHeadings = new Set(Array.from(previousSections.keys()).filter((heading) => !managedHeadings.has(heading)));
    const nextCoreHeadings = new Set(Array.from(nextSections.keys()).filter((heading) => !managedHeadings.has(heading)));
    const removedCoreHeading = Array.from(previousCoreHeadings).some((heading) => !nextCoreHeadings.has(heading));
    const addedCoreHeading = Array.from(nextCoreHeadings).some((heading) => !previousCoreHeadings.has(heading));
    if (removedCoreHeading ||
        changedCoreSections.size >= 3 ||
        (changedCoreSections.has("decision") && changedCoreSections.has("chosen shape"))) {
        return "major";
    }
    if (changedCoreSections.size > 0 || addedCoreHeading) {
        return "minor";
    }
    return "patch";
}
function comparableSections(content) {
    return new Map(listSections(stripMetadataLines(content)).map((section) => [
        canonicalSectionHeading(section.heading),
        normalizeComparableText(section.body)
    ]));
}
function canonicalSectionHeading(value) {
    return normalizeHeading(value)
        .replace(/^(?:\d+(?:\.\d+)*[.)]?\s+)+/, "")
        .toLowerCase();
}
function stripMetadataLines(content) {
    return content
        .split(/\r?\n/)
        .filter((line) => !/^Created:\s+\d{4}-\d{2}-\d{2}$/.test(line) &&
        !/^Updated:\s+\d{4}-\d{2}-\d{2}$/.test(line) &&
        !/^Version:\s+\d+\.\d+\.\d+$/.test(line))
        .join("\n");
}
function normalizeComparableText(value) {
    return value.replace(/\s+/g, " ").trim();
}
function ensureVersionHistoryEntry(content, version, isoDate, bump, mode) {
    const summary = versionHistorySummary(bump, mode);
    const entry = `- ${version} (${isoDate}): ${summary}`;
    const existingBody = getSectionBody(content, VERSION_HISTORY_HEADING);
    const lines = existingBody
        ? existingBody
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .filter((line) => !line.startsWith(`- ${version} (`))
        : [];
    return replaceOrAppendSection(content, VERSION_HISTORY_HEADING, [entry, ...lines].join("\n"));
}
function versionHistorySummary(bump, mode) {
    if (mode === "initial") {
        return "Initial documented draft.";
    }
    switch (bump) {
        case "major":
            return "Major design revision or contract shift.";
        case "minor":
            return "Substantive design update.";
        case "patch":
            return "Metadata, linkage, or narrow doc maintenance update.";
        case "none":
        default:
            return "No substantive content change.";
    }
}
