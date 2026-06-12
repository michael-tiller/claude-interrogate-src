import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertWithinDir } from "./path-safety.js";
// Migrates a pre-existing roadmap directory (RC files without a root index,
// possibly zero-padded filenames and nonstandard checkbox markers) into the
// format the roadmap/taskout/export flows expect. Promised as future work in
// the 0.1.6 release notes; first real customer is a dirigible2D-style layout.
const RC_FILENAME_PATTERN = /^(M|MRC)(\d+)_([A-Z][A-Z0-9_]*)\.md$/;
const STATUS_PATTERN = /^Status:\s+(.+)$/m;
// "- [<char>]" where char is not a valid binary marker (space/x/X).
const DASH_CHECKBOX_PATTERN = /^(\s*- \[)(.)(\]\s)/;
const NUMBERED_CHECKBOX_PATTERN = /^\s*\d+[.)]\s*\[.\]\s/;
const KNOWN_STATUSES = new Set(["stub", "active", "shipped"]);
export class RoadmapMigrateError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "RoadmapMigrateError";
    }
}
export async function migrateRoadmap(input) {
    const apply = input.apply ?? false;
    const normalizeMarkers = input.normalizeMarkers ?? false;
    const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
    const indexAbs = path.resolve(input.outputDir, input.roadmapConfig.indexFile);
    const warnings = [];
    if (!(await dirExists(rcDirAbs))) {
        throw new RoadmapMigrateError("no-rc-dir", `No RC directory at ${rcDirAbs}. Nothing to migrate.`);
    }
    const indexAlreadyExists = await fileExists(indexAbs);
    if (apply && indexAlreadyExists) {
        throw new RoadmapMigrateError("index-exists", `${indexAbs} already exists. Migration refuses to overwrite a roadmap index — merge by hand or remove it first.`);
    }
    if (indexAlreadyExists) {
        warnings.push(`${input.roadmapConfig.indexFile} already exists — apply will refuse; this dry-run shows what a fresh index would contain.`);
    }
    const entries = await readdir(rcDirAbs, { withFileTypes: true });
    const files = [];
    for (const entry of entries) {
        if (!entry.isFile())
            continue;
        const match = entry.name.match(RC_FILENAME_PATTERN);
        if (!match)
            continue;
        const [, prefix, digits, name] = match;
        const filePath = path.join(rcDirAbs, entry.name);
        const raw = await readFile(filePath, "utf8");
        const lines = raw.split(/\r?\n/);
        const nonstandardMarkers = [];
        const numberedChecklistLines = [];
        const flatTargetedLines = [];
        let inTargeted = false;
        let subsectionSeen = false;
        for (let i = 0; i < lines.length; i += 1) {
            const h2 = lines[i].match(/^##(?!#)\s+(.+?)\s*$/);
            if (h2) {
                inTargeted = h2[1].trim().toLowerCase() === "targeted";
                subsectionSeen = false;
            }
            else if (inTargeted && /^###\s/.test(lines[i])) {
                subsectionSeen = true;
            }
            const dash = lines[i].match(DASH_CHECKBOX_PATTERN);
            if (dash && dash[2] !== " " && dash[2] !== "x" && dash[2] !== "X") {
                nonstandardMarkers.push({ line: i + 1, marker: dash[2] });
            }
            if (dash && inTargeted && !subsectionSeen) {
                flatTargetedLines.push(i + 1);
            }
            if (NUMBERED_CHECKBOX_PATTERN.test(lines[i])) {
                numberedChecklistLines.push(i + 1);
            }
        }
        const milestone = Number.parseInt(digits, 10);
        const kind = prefix === "MRC" ? "release-candidate" : "build";
        const status = raw.match(STATUS_PATTERN)?.[1]?.trim() ?? "Stub";
        files.push({
            filename: entry.name,
            rcId: `${prefix}${milestone}_${name}`,
            milestoneDigits: digits,
            milestone,
            kind,
            name,
            status,
            zeroPadded: digits.length > 1 && digits.startsWith("0"),
            nonstandardMarkers,
            numberedChecklistLines,
            flatTargetedLines,
        });
    }
    if (files.length === 0) {
        throw new RoadmapMigrateError("no-rc-files", `No RC-shaped files (M<digits>_<NAME>.md / MRC<digits>_<NAME>.md) found in ${rcDirAbs}.`);
    }
    files.sort((a, b) => a.kind === b.kind ? a.milestone - b.milestone : a.kind === "build" ? -1 : 1);
    const duplicates = new Map();
    for (const file of files) {
        const key = `${file.kind}:${file.milestone}`;
        duplicates.set(key, (duplicates.get(key) ?? 0) + 1);
    }
    for (const [key, count] of duplicates) {
        if (count > 1) {
            warnings.push(`Duplicate milestone number across files: ${key} appears ${count} times.`);
        }
    }
    const paddingDetected = files.some((f) => f.zeroPadded);
    const padWidth = paddingDetected
        ? Math.max(...files.map((f) => f.milestoneDigits.length))
        : 0;
    const suggestedNamingScheme = paddingDetected
        ? `{prefix}{milestone:0${padWidth}}_{NAME}.md`
        : "{prefix}{milestone}_{NAME}.md";
    if (paddingDetected) {
        warnings.push(`Zero-padded filenames detected — set roadmap.rcNamingScheme to "${suggestedNamingScheme}" in claude-interrogate.json so the flows resolve these files without renames.`);
    }
    for (const file of files) {
        if (!KNOWN_STATUSES.has(file.status.toLowerCase())) {
            warnings.push(`${file.filename}: status "${file.status}" is outside {Stub, Active, Shipped} — shipped-lock and drift checks key on "Shipped"; consider mapping it.`);
        }
        if (file.flatTargetedLines.length > 0) {
            warnings.push(`${file.filename}: ${file.flatTargetedLines.length} Targeted checkbox(es) sit directly under "## Targeted" with no "###" subsection (e.g. line ${file.flatTargetedLines[0]}) — the parser drops them; group them under "###" headings (each heading becomes an epic key).`);
        }
        if (file.numberedChecklistLines.length > 0) {
            warnings.push(`${file.filename}: ${file.numberedChecklistLines.length} numbered checklist line(s) (e.g. line ${file.numberedChecklistLines[0]}) — the parser only reads "- [ ]" dash checkboxes, so these items are invisible to taskout/export until converted.`);
        }
    }
    const totalNonstandard = files.reduce((sum, f) => sum + f.nonstandardMarkers.length, 0);
    if (totalNonstandard > 0 && !normalizeMarkers) {
        warnings.push(`${totalNonstandard} nonstandard checkbox marker(s) (e.g. "[~]") found — the parser skips these lines entirely. Re-run with normalize_markers to rewrite them to "[ ]" (per Seam 7, in-progress state lives in commit footers, not checkbox glyphs).`);
    }
    const today = formatIsoDate((input.clock ?? (() => new Date()))());
    const proposedIndex = renderIndex(files, today);
    let markersNormalized = 0;
    if (apply) {
        await assertWithinDir(indexAbs, path.resolve(input.outputDir));
        await writeFile(indexAbs, proposedIndex, "utf8");
        if (normalizeMarkers && totalNonstandard > 0) {
            for (const file of files) {
                if (file.nonstandardMarkers.length === 0)
                    continue;
                const filePath = path.join(rcDirAbs, file.filename);
                const raw = await readFile(filePath, "utf8");
                const rewritten = raw
                    .split(/\r?\n/)
                    .map((line) => {
                    const dash = line.match(DASH_CHECKBOX_PATTERN);
                    if (dash && dash[2] !== " " && dash[2] !== "x" && dash[2] !== "X") {
                        markersNormalized += 1;
                        return line.replace(DASH_CHECKBOX_PATTERN, `$1 $3`);
                    }
                    return line;
                })
                    .join("\n");
                await writeFile(filePath, rewritten, "utf8");
            }
        }
    }
    return {
        mode: apply ? "applied" : "dry-run",
        indexPath: indexAbs,
        files,
        paddingDetected,
        suggestedNamingScheme,
        proposedIndex,
        markersNormalized,
        warnings,
    };
}
function renderIndex(files, today) {
    const lines = [];
    lines.push("# Roadmap");
    lines.push(`Last Updated: ${today}`);
    lines.push("");
    lines.push("## Definition of Done");
    lines.push("- [ ] Every concept doc is mapped to a milestone or listed in Unmapped Concepts with a reason.");
    lines.push("");
    lines.push("## 1.0 Thesis");
    lines.push("(TBD — state the project thesis and link its anchor doc. Generated by /migrate-roadmap.)");
    lines.push("");
    lines.push("## MIN PLAY Waypoint");
    lines.push("(TBD — name the RC and its criterion.)");
    lines.push("");
    lines.push("## Release Candidates");
    lines.push("| Milestone | Name | Status | Anchor | Marketing |");
    lines.push("|---|---|---|---|---|");
    for (const file of files) {
        const prefix = file.kind === "release-candidate" ? "MRC" : "M";
        lines.push(`| ${prefix}${file.milestoneDigits} | ${file.name} | ${file.status} | — | — |`);
    }
    lines.push("");
    lines.push("## Prerequisite Chain");
    lines.push("(TBD — add `- M1_A → M2_B (reason)` lines; the DAG must be acyclic.)");
    lines.push("");
    lines.push("## Marketing Waypoints");
    lines.push("(none configured)");
    lines.push("");
    lines.push("## Unmapped Concepts");
    lines.push("(none recorded)");
    lines.push("");
    return lines.join("\n");
}
function formatIsoDate(date) {
    return date.toISOString().slice(0, 10);
}
async function fileExists(target) {
    try {
        return (await stat(target)).isFile();
    }
    catch {
        return false;
    }
}
async function dirExists(target) {
    try {
        return (await stat(target)).isDirectory();
    }
    catch {
        return false;
    }
}
