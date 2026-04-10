import path from "node:path";
import { detectHouseStyle, listSections, loadDocFile, loadDocs } from "./docs.js";
import { renderDefaultGoldenTemplate } from "./default-template.js";
const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "with"
]);
export async function designSummarize(concept, docsDir, styleTemplatePath) {
    const docs = await loadDocs(docsDir);
    const styleTemplate = styleTemplatePath
        ? await loadDocFile(path.resolve(styleTemplatePath))
        : {
            path: "<built-in-template>",
            name: "default-golden-template.md",
            title: "Default Golden Template",
            content: renderDefaultGoldenTemplate()
        };
    const style = detectHouseStyle([styleTemplate, ...docs]);
    const conceptTokens = tokenize(concept);
    const matches = docs
        .map((doc) => {
        const sections = listSections(doc.content);
        const matchedSections = sections.filter((section) => {
            const haystack = `${doc.title} ${section.heading} ${section.body}`.toLowerCase();
            return Array.from(conceptTokens).some((token) => haystack.includes(token));
        });
        return {
            doc,
            matchedSections
        };
    })
        .filter((entry) => entry.matchedSections.length > 0);
    const learned = matches.flatMap(({ doc, matchedSections }) => matchedSections.slice(0, 4).map((section) => `${doc.title}: ${section.heading} -> ${compact(section.body)}`));
    const unresolved = matches.flatMap(({ doc, matchedSections }) => matchedSections
        .filter((section) => /open questions?/i.test(section.heading))
        .flatMap((section) => section.body
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^[-*]\s+/, ""))
        .filter((line) => line.length > 0 && !/^none\.?$/i.test(line))
        .map((line) => `${doc.title}: ${line}`)));
    return {
        concept,
        docsDir: path.resolve(docsDir),
        styleTemplatePath: styleTemplate.path === "<built-in-template>" ? undefined : styleTemplate.path,
        style,
        learned: learned.slice(0, 12),
        unresolved: unresolved.slice(0, 8),
        relatedDocs: matches.map(({ doc }) => doc.path)
    };
}
function tokenize(value) {
    return new Set(value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((token) => token.length > 2 && !STOP_WORDS.has(token)));
}
function compact(value) {
    return value.replace(/\s+/g, " ").trim().slice(0, 180);
}
