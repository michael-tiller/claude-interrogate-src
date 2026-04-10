import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { DEFAULT_DOC_VERSION, detectHouseStyle, loadDocFile, loadDocs, postEditNormalizeDocument } from "./docs.js";
import { renderDefaultGoldenTemplate } from "./default-template.js";
const TODAY = "2026-04-08";
export async function designDocGenerate(input, outputPath) {
    const docs = input.docsDir ? await loadDocs(input.docsDir) : [];
    const styleTemplate = input.styleTemplatePath
        ? await loadDocFile(path.resolve(input.styleTemplatePath))
        : {
            path: "<built-in-template>",
            name: "default-golden-template.md",
            title: "Default Golden Template",
            content: renderDefaultGoldenTemplate()
        };
    const style = detectHouseStyle([styleTemplate, ...docs]);
    const resolvedOutputPath = path.resolve(outputPath);
    const siblingDocs = docs.filter((doc) => path.resolve(doc.path) !== resolvedOutputPath);
    const content = renderDoc(input.concept, input.responses, style, siblingDocs.map((doc) => ({
        title: doc.title,
        relativePath: toPosixRelative(path.dirname(resolvedOutputPath), doc.path)
    })));
    const normalized = postEditNormalizeDocument(undefined, content, TODAY, {
        crossRefHeading: style.crossRefHeading,
        openQuestionsHeading: style.openQuestionsHeading
    });
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, normalized.content, "utf8");
    await syncSiblingCrossReferences(resolvedOutputPath, input.concept, siblingDocs, style.crossRefHeading, style.openQuestionsHeading);
    return {
        outputPath: resolvedOutputPath,
        content: normalized.content
    };
}
function renderDoc(concept, responses, style, siblingLinks) {
    const includeInspirations = hasMeaningfulInspirations(responses.inspirations);
    const orderedKeys = [
        "problem",
        "success",
        "shape",
        ...(includeInspirations ? ["inspirations"] : []),
        "constraints",
        "edges",
        "contradictions"
    ];
    const resolvedEntries = orderedKeys.filter((key) => responses[key]?.trim());
    const unresolvedEntries = orderedKeys.filter((key) => !responses[key]?.trim());
    const useSectionSymbol = style.sectionNumbering.startsWith("§") || style.sectionNumbering.startsWith("Â§");
    const title = toTitle(concept);
    const numbered = (index, heading, body) => {
        if (useSectionSymbol) {
            return `§${index} ${heading}\n\n${body}`;
        }
        return `## ${index}. ${heading}\n\n${body}`;
    };
    const sections = [
        `# ${title}`,
        `Created: ${TODAY}`,
        `Updated: ${TODAY}`,
        `Version: ${DEFAULT_DOC_VERSION}`,
        "",
        numbered(1, "Decision", bodyFor("problem", responses.problem, concept, style.toneCues)),
        "",
        numbered(2, "Release Bar", bodyFor("success", responses.success, concept, style.toneCues)),
        "",
        numbered(3, "Chosen Shape", bodyFor("shape", responses.shape, concept, style.toneCues)),
        ""
    ];
    let sectionNumber = 4;
    if (includeInspirations) {
        sections.push(numbered(sectionNumber, "Inspirations", bodyFor("inspirations", responses.inspirations, concept, style.toneCues)), "");
        sectionNumber += 1;
    }
    sections.push(numbered(sectionNumber, "Constraints And Cross-Checks", bodyFor("constraints", responses.constraints, concept, style.toneCues)), "", numbered(sectionNumber + 1, "Failure Modes And Edges", bodyFor("edges", responses.edges, concept, style.toneCues)), "", `## ${style.crossRefHeading}`, "", siblingLinks.length
        ? siblingLinks.map((link) => `- [${link.title}](${link.relativePath})`).join("\n")
        : "- No sibling docs yet.", "", `## Resolved Decisions`, "", resolvedEntries.length
        ? resolvedEntries.map((key) => `- ${labelForKey(key)}: ${responses[key]}`).join("\n")
        : "- No resolved decisions captured yet.", "", `## ${style.openQuestionsHeading}`, "", unresolvedEntries.length
        ? unresolvedEntries.map((key) => `- ${labelForKey(key)}`).join("\n")
        : "- None.", "", "## Version History", "", `- ${DEFAULT_DOC_VERSION} (${TODAY}): Initial documented draft.`);
    return sections.join("\n");
}
async function syncSiblingCrossReferences(outputPath, concept, siblingDocs, crossRefHeading, openQuestionsHeading) {
    const newDocTitle = toTitle(concept);
    await Promise.all(siblingDocs.map(async (doc) => {
        const relativePath = toPosixRelative(path.dirname(doc.path), outputPath);
        const linkLine = `- [${newDocTitle}](${relativePath})`;
        const content = await readFile(doc.path, "utf8");
        if (content.includes(`](${relativePath})`)) {
            return;
        }
        const updated = upsertCrossReference(content, crossRefHeading, linkLine);
        const normalized = postEditNormalizeDocument(content, updated, TODAY, {
            crossRefHeading,
            openQuestionsHeading
        });
        await writeFile(doc.path, normalized.content, "utf8");
    }));
}
function upsertCrossReference(content, crossRefHeading, linkLine) {
    const escapedHeading = escapeRegex(crossRefHeading);
    const sectionPattern = new RegExp(`(##\\s+${escapedHeading}\\s*\\r?\\n)([\\s\\S]*?)(?=\\r?\\n##\\s+|$)`, "i");
    const match = content.match(sectionPattern);
    if (match) {
        const body = match[2].trimEnd();
        const nextBody = body.length > 0 ? `${body}\n${linkLine}` : linkLine;
        return content.replace(sectionPattern, `$1\n${nextBody}\n`);
    }
    return `${content.trimEnd()}\n\n## ${crossRefHeading}\n\n${linkLine}\n`;
}
function labelForKey(key) {
    switch (key) {
        case "problem":
            return "Decision boundary";
        case "success":
            return "Release bar";
        case "shape":
            return "Chosen shape";
        case "inspirations":
            return "Inspirations";
        case "constraints":
            return "Inherited constraints";
        case "edges":
            return "Failure modes";
        case "contradictions":
            return "Consistency updates";
        default:
            return key;
    }
}
function bodyFor(key, response, concept, toneCues) {
    if (response?.trim()) {
        return normalizeTypography(response.trim());
    }
    const defaults = {
        problem: `Define the decision boundary for ${concept}.`,
        success: `State the minimum successful outcome for ${concept}.`,
        shape: `Document the chosen implementation shape for ${concept}.`,
        inspirations: `List any relevant inspirations for ${concept} and explain which design moves are being borrowed and why they apply here.`,
        constraints: `List the sibling-doc decisions that ${concept} must respect.`,
        edges: `Describe the main failure modes and unresolved operational edges.`
    };
    let text = defaults[key] ?? `Document ${concept}.`;
    if (toneCues.includes("normative")) {
        text = `Must decide: ${text.charAt(0).toLowerCase()}${text.slice(1)}`;
    }
    if (toneCues.includes("parenthetical clarifications")) {
        text = `${text} (scope: v1).`;
    }
    return normalizeTypography(text);
}
function hasMeaningfulInspirations(value) {
    if (!value?.trim()) {
        return false;
    }
    return !/^(none|n\/a|na|no meaningful references?|no inspirations?)\.?$/i.test(value.trim());
}
function toPosixRelative(fromDir, toFile) {
    const relative = path.relative(fromDir, toFile).replace(/\\/g, "/");
    return relative.startsWith(".") ? relative : `./${relative}`;
}
function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function toTitle(value) {
    return value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
function normalizeTypography(value) {
    return value
        .replace(/[“”]/g, "\"")
        .replace(/[‘’]/g, "'")
        .replace(/—/g, " - ")
        .replace(/–/g, "-")
        .replace(/−/g, "-")
        .replace(/→/g, "->")
        .replace(/§/g, "Section ")
        .replace(/…/g, "...")
        .replace(/\u00A0/g, " ")
        .replace(/[ \t]{2,}/g, " ")
        .replace(/ +\n/g, "\n");
}
