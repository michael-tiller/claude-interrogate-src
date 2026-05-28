import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadDocsRecursive } from "./docs.js";
import { assertWithinDir, renderRCFilename } from "./path-safety.js";
import { parseRoadmapIndex, parseRCFile } from "./roadmap-parse.js";
export class ScopeError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "ScopeError";
    }
}
export async function analyzeScope(input) {
    const indexAbs = path.resolve(input.outputDir, input.roadmapConfig.indexFile);
    const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
    const docsExclusions = resolveDocsExclusions(input);
    const docs = await loadDocsRecursive(input.docsDir, {
        excludeDirs: docsExclusions.dirs,
        excludeFiles: docsExclusions.files,
    });
    if (docs.length === 0) {
        throw new ScopeError("no-concept-docs", `Roadmap needs concept docs to scope from. Found none under ${input.docsDir}. Run /interrogate <concept> for each major feature first.`);
    }
    const conceptDocs = docs.map(toConceptDocSummary);
    const conceptByPath = new Map(conceptDocs.map((c) => [c.path, c]));
    const existingIndex = await parseRoadmapIndex(indexAbs);
    const mode = existingIndex ? "maintenance" : "bootstrap";
    const proposedRCs = mode === "maintenance" && existingIndex
        ? await proposeRCsFromExisting(existingIndex, rcDirAbs, input.roadmapConfig, conceptByPath)
        : proposeRCsFromConcepts(conceptDocs);
    const dagCandidates = inferDAGCandidates(docs, proposedRCs);
    let driftSummary;
    if (mode === "maintenance" && existingIndex) {
        driftSummary = await computeDriftSummary({
            existingIndex,
            rcDirAbs,
            conceptDocs,
            proposedRCs,
            dagCandidates,
            roadmapConfig: input.roadmapConfig,
        });
    }
    const questions = buildScopeQuestions(mode, proposedRCs, dagCandidates, input.roadmapConfig.marketingWaypoints);
    return {
        docsDir: input.docsDir,
        outputDir: input.outputDir,
        styleTemplatePath: input.styleTemplatePath,
        roadmapConfig: input.roadmapConfig,
        mode,
        conceptDocs,
        proposedRCs,
        dagCandidates,
        driftSummary,
        questions,
    };
}
export async function generateScope(input) {
    validateScopePlan(input.plan);
    const cycles = detectCycles(input.plan.edges.map((edge) => ({ from: edge.from, to: edge.to })));
    if (cycles.length > 0) {
        throw new ScopeError("cycle-detected", `DAG contains cycles; refusing to write. Cycles: ${cycles.map((c) => c.join(" -> ")).join("; ")}`);
    }
    if (input.mode === "maintenance") {
        await enforceShippedScopeLock(input);
    }
    const today = formatIsoDate((input.clock ?? (() => new Date()))());
    const indexAbs = path.resolve(input.outputDir, input.roadmapConfig.indexFile);
    const indexTarget = input.mode === "maintenance" ? withDraftSuffix(indexAbs) : indexAbs;
    const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
    await assertWithinDir(indexTarget, input.outputDir);
    await mkdir(path.dirname(indexTarget), { recursive: true });
    const indexContent = renderRoadmapIndex(input.plan, today, input.roadmapConfig);
    await writeFile(indexTarget, indexContent, "utf8");
    const rcOutputs = [];
    await mkdir(rcDirAbs, { recursive: true });
    for (const rc of input.plan.rcs) {
        const filename = renderRCFilename(input.roadmapConfig.rcNamingScheme, {
            milestone: rc.milestone,
            name: rc.name,
        });
        const rcAbs = path.resolve(rcDirAbs, filename);
        const rcTarget = input.mode === "maintenance" ? withDraftSuffix(rcAbs) : rcAbs;
        await assertWithinDir(rcTarget, rcDirAbs);
        const existingRC = input.mode === "maintenance" ? await parseRCFile(rcAbs) : null;
        const stubContent = renderRCStub(rc, today, input.plan, existingRC);
        await writeFile(rcTarget, stubContent, "utf8");
        rcOutputs.push({ path: rcTarget, content: stubContent });
    }
    const paths = [indexTarget, ...rcOutputs.map((rc) => rc.path)];
    return {
        paths,
        content: {
            indexPath: indexTarget,
            indexContent,
            rcs: rcOutputs,
        },
    };
}
export function detectCycles(edges) {
    const adj = new Map();
    for (const edge of edges) {
        if (!adj.has(edge.from))
            adj.set(edge.from, []);
        adj.get(edge.from).push(edge.to);
        if (!adj.has(edge.to))
            adj.set(edge.to, []);
    }
    const cycles = [];
    const visiting = new Set();
    const visited = new Set();
    const stack = [];
    function dfs(node) {
        if (visited.has(node))
            return;
        if (visiting.has(node)) {
            const start = stack.indexOf(node);
            if (start !== -1) {
                cycles.push([...stack.slice(start), node]);
            }
            return;
        }
        visiting.add(node);
        stack.push(node);
        for (const next of adj.get(node) ?? []) {
            dfs(next);
        }
        stack.pop();
        visiting.delete(node);
        visited.add(node);
    }
    for (const node of adj.keys()) {
        dfs(node);
    }
    return cycles;
}
function validateScopePlan(plan) {
    for (const rc of plan.rcs) {
        if (!rc.id || rc.milestone === undefined || rc.milestone === null || !rc.name) {
            throw new ScopeError("invalid-rc", `RC missing required fields: ${JSON.stringify(rc)}`);
        }
    }
    const ids = new Set();
    for (const rc of plan.rcs) {
        if (ids.has(rc.id)) {
            throw new ScopeError("duplicate-rc-id", `Duplicate RC id: ${rc.id}`);
        }
        ids.add(rc.id);
    }
    for (const edge of plan.edges) {
        if (!ids.has(edge.from) || !ids.has(edge.to)) {
            throw new ScopeError("edge-references-unknown-rc", `Edge references unknown RC: ${edge.from} -> ${edge.to}`);
        }
    }
}
async function enforceShippedScopeLock(input) {
    const indexAbs = path.resolve(input.outputDir, input.roadmapConfig.indexFile);
    const existingIndex = await parseRoadmapIndex(indexAbs);
    if (!existingIndex)
        return;
    const overridesByRC = indexOverrides(input.plan.overrides);
    for (const row of existingIndex.rcRows) {
        if (row.status.toLowerCase() !== "shipped")
            continue;
        const existingId = `M${row.milestone}_${row.name}`;
        const proposed = input.plan.rcs.find((rc) => rc.id === existingId || (rc.milestone === row.milestone && rc.name === row.name));
        if (!proposed)
            continue;
        const changed = [];
        if (proposed.milestone !== row.milestone)
            changed.push("milestone");
        if (proposed.name !== row.name)
            changed.push("name");
        if (proposed.marketingWaypoint !== row.marketing && row.marketing !== "—") {
            changed.push("marketing-waypoint");
        }
        const anchorString = proposed.anchors.map((a) => a.path ?? a.kind).join(",");
        if (row.anchor && row.anchor !== "—" && row.anchor !== anchorString) {
            changed.push("anchors");
        }
        if (changed.length === 0)
            continue;
        const override = overridesByRC.get(proposed.id);
        const granted = new Set(override?.changedFields ?? []);
        const ungranted = changed.filter((field) => !granted.has(field));
        if (ungranted.length > 0) {
            throw new ScopeError("shipped-lock-violation", `Shipped RC ${proposed.id} changes fields without override: ${ungranted.join(", ")}`);
        }
    }
}
function indexOverrides(overrides) {
    return new Map(overrides.map((o) => [o.rcId, o]));
}
function proposeRCsFromConcepts(concepts) {
    const filtered = concepts.filter((c) => c.anchorSource === "Concept" || !c.anchorSource);
    const sources = filtered.length > 0 ? filtered : concepts;
    return sources.map((concept, idx) => {
        const milestone = idx + 1;
        const name = deriveRCName(concept.title || concept.path);
        return {
            id: `M${milestone}_${name}`,
            milestone,
            name,
            status: "Stub",
            anchors: [{ kind: "Concept", path: concept.path }],
            blocks: [],
            blockedBy: [],
        };
    });
}
async function proposeRCsFromExisting(existingIndex, rcDirAbs, config, conceptByPath) {
    const rcs = [];
    for (const row of existingIndex.rcRows) {
        const filename = renderRCFilename(config.rcNamingScheme, {
            milestone: row.milestone,
            name: row.name,
        });
        const rcAbs = path.join(rcDirAbs, filename);
        const parsed = await parseRCFile(rcAbs);
        const anchors = parsed?.references
            ?.filter((ref) => conceptByPath.has(path.resolve(rcDirAbs, "..", ref)))
            .map((ref) => ({ kind: "Concept", path: ref }));
        rcs.push({
            id: `M${row.milestone}_${row.name}`,
            milestone: row.milestone,
            name: row.name,
            status: row.status,
            anchors: anchors && anchors.length > 0 ? anchors : [{ kind: "Inline" }],
            blocks: [],
            blockedBy: [],
            marketingWaypoint: row.marketing && row.marketing !== "—" ? row.marketing : undefined,
        });
    }
    return rcs;
}
function deriveRCName(raw) {
    const cleaned = raw
        .replace(/\.md$/i, "")
        .replace(/[\\/]/g, "_")
        .replace(/[^A-Za-z0-9_\s]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase();
    if (cleaned.length === 0) {
        return "FEATURE";
    }
    if (!/^[A-Z]/.test(cleaned)) {
        return `RC_${cleaned}`;
    }
    return cleaned;
}
function inferDAGCandidates(docs, rcs) {
    const candidates = [];
    const rcByAnchorPath = new Map();
    for (const rc of rcs) {
        for (const anchor of rc.anchors) {
            if (anchor.path) {
                rcByAnchorPath.set(path.basename(anchor.path), rc.id);
            }
        }
    }
    for (const doc of docs) {
        const fromRC = rcByAnchorPath.get(path.basename(doc.path));
        if (!fromRC)
            continue;
        const lines = doc.content.split(/\r?\n/);
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            const refs = Array.from(line.matchAll(/\[([^\]]+)\]\(([^)]+\.md)\)/g));
            for (const ref of refs) {
                const targetBase = path.basename(ref[2]);
                const toRC = rcByAnchorPath.get(targetBase);
                if (!toRC || toRC === fromRC)
                    continue;
                const surrounding = lines.slice(Math.max(0, i - 2), i + 1).join(" ").toLowerCase();
                const confidence = /prerequisit|depends?\s+on|blocked\s+by/.test(surrounding) ? "high" : "low";
                candidates.push({
                    from: toRC,
                    to: fromRC,
                    kind: "depends-on",
                    confidence,
                    reason: `${path.basename(doc.path)} references ${targetBase} (line ${i + 1})`,
                });
            }
        }
    }
    return dedupeCandidates(candidates);
}
function dedupeCandidates(candidates) {
    const byKey = new Map();
    for (const candidate of candidates) {
        const key = `${candidate.from}->${candidate.to}`;
        const existing = byKey.get(key);
        if (!existing || confidenceRank(candidate.confidence) > confidenceRank(existing.confidence)) {
            byKey.set(key, candidate);
        }
    }
    return Array.from(byKey.values());
}
function confidenceRank(confidence) {
    return confidence === "high" ? 3 : confidence === "medium" ? 2 : 1;
}
async function computeDriftSummary(args) {
    const mappedDocPaths = new Set();
    for (const row of args.existingIndex.rcRows) {
        if (row.anchor && row.anchor.toLowerCase().endsWith(".md")) {
            mappedDocPaths.add(row.anchor);
        }
    }
    for (const unmapped of args.existingIndex.unmappedConcepts) {
        mappedDocPaths.add(unmapped.docPath);
    }
    const newConceptsUnmapped = args.conceptDocs
        .filter((doc) => {
        const candidates = [doc.path, path.basename(doc.path)];
        return !candidates.some((candidate) => mappedDocPaths.has(candidate));
    })
        .map((doc) => doc.path);
    const shippedRCs = args.existingIndex.rcRows
        .filter((row) => row.status.toLowerCase() === "shipped")
        .map((row) => `M${row.milestone}_${row.name}`);
    const rcsMissingFromIndex = [];
    for (const row of args.existingIndex.rcRows) {
        const filename = renderRCFilename(args.roadmapConfig.rcNamingScheme, {
            milestone: row.milestone,
            name: row.name,
        });
        const rcAbs = path.join(args.rcDirAbs, filename);
        const exists = await fileExists(rcAbs);
        if (!exists) {
            rcsMissingFromIndex.push(`M${row.milestone}_${row.name}`);
        }
    }
    const cycles = detectCycles(args.dagCandidates.map((c) => ({ from: c.from, to: c.to })));
    return {
        newConceptsUnmapped,
        shippedRCs,
        rcsMissingFromIndex,
        cycles,
    };
}
function buildScopeQuestions(mode, rcs, candidates, marketingWaypoints) {
    const questions = [];
    if (mode === "bootstrap") {
        questions.push({
            id: "thesis",
            theme: "Thesis",
            question: "State (or confirm) the 1.0 thesis for this project. Cite the anchoring doc if there is one.",
            rationale: "Anchors the roadmap to a single statement of intent.",
        });
        questions.push({
            id: "min-play",
            theme: "MIN PLAY",
            question: "At which RC does the core loop become testable end-to-end? Provide the RC id and a one-line criterion.",
            rationale: "Pins the first-playable-loop waypoint.",
            dependsOn: "thesis",
        });
    }
    else {
        questions.push({
            id: "drift-review",
            theme: "Drift",
            question: "Review the drift summary. Confirm which new concepts to map, which RCs to mark Shipped, and any reordering.",
            rationale: "Maintenance interview is scoped to drift, not full re-interview.",
        });
    }
    for (const rc of rcs.slice(0, 8)) {
        questions.push({
            id: `rc-anchor-${rc.id}`,
            theme: `RC ${rc.id}`,
            question: `Confirm anchor and marketing waypoint for ${rc.id}.`,
            rationale: "Every RC needs an anchor source.",
        });
    }
    if (candidates.length > 0) {
        questions.push({
            id: "dag-confirm",
            theme: "Dependency DAG",
            question: "Review the inferred dependency edges. For each, confirm whether it represents 'blocks', 'depends-on', or 'parallel'.",
            rationale: "Inferred edges are low-confidence; the interview confirms direction and kind.",
        });
    }
    if (marketingWaypoints.length > 0) {
        const waypointList = marketingWaypoints.join(", ");
        questions.push({
            id: "waypoints",
            theme: "Marketing waypoints",
            question: `For each marketing waypoint (${waypointList}), state the target RC and a one-line rationale.`,
            rationale: "Marketing waypoints are decoupled from milestone ordering but anchor to specific RCs.",
        });
    }
    return questions;
}
function renderRoadmapIndex(plan, today, config) {
    const lines = [];
    lines.push("# Roadmap");
    lines.push(`Last Updated: ${today}`);
    lines.push("");
    lines.push("## Definition of Done");
    lines.push("- [ ] Every concept doc is mapped to an RC or listed in Unmapped Concepts with a reason.");
    lines.push("- [ ] Every RC has an anchor (Concept / Plan / ADR / Inline thesis).");
    lines.push("- [ ] Every RC has a position in the prerequisite DAG (or marked parallel).");
    lines.push("- [ ] The DAG is acyclic.");
    lines.push("- [ ] Marketing waypoints have target RCs and rationales.");
    lines.push("");
    lines.push("## 1.0 Thesis");
    const thesisText = plan.thesis.text || "(TBD)";
    if (plan.thesis.anchorDoc) {
        lines.push(`${thesisText} — anchor: \`${plan.thesis.anchorDoc}\``);
    }
    else {
        lines.push(thesisText);
    }
    lines.push("");
    lines.push("## MIN PLAY Waypoint");
    lines.push(`RC: ${plan.minPlayWaypoint.rcId}. Criterion: ${plan.minPlayWaypoint.criterion}`);
    lines.push("");
    lines.push("## Release Candidates");
    lines.push("| Milestone | Name | Status | Anchor | Marketing |");
    lines.push("|---|---|---|---|---|");
    const orderedRCs = [...plan.rcs].sort((a, b) => a.milestone - b.milestone);
    for (const rc of orderedRCs) {
        const anchorString = rc.anchors.map((a) => a.path ?? a.kind).join(", ") || "—";
        const marketing = rc.marketingWaypoint ?? "—";
        lines.push(`| M${rc.milestone} | ${rc.name} | ${rc.status} | ${anchorString} | ${marketing} |`);
    }
    lines.push("");
    lines.push("## Prerequisite Chain");
    for (const edge of plan.edges) {
        lines.push(`- ${edge.from} → ${edge.to} (${edge.reason})`);
    }
    lines.push("");
    lines.push("## Marketing Waypoints");
    for (const wp of plan.waypoints) {
        lines.push(`- **${wp.name}**: target at ${wp.targetRC}. Rationale: ${wp.rationale}`);
    }
    if (plan.waypoints.length === 0) {
        lines.push("- (none configured)");
    }
    lines.push("");
    lines.push("## Unmapped Concepts");
    if (plan.unmappedConcepts.length === 0) {
        lines.push("- None.");
    }
    else {
        for (const unmapped of plan.unmappedConcepts) {
            lines.push(`- \`${unmapped.docPath}\` — ${unmapped.reason}`);
        }
    }
    lines.push("");
    void config;
    return lines.join("\n") + "\n";
}
function renderRCStub(rc, today, plan, existing) {
    const lines = [];
    lines.push(`# M${rc.milestone} — ${rc.name}`);
    lines.push(`Status: ${rc.status}`);
    lines.push(`Last Updated: ${today}`);
    lines.push("");
    lines.push("## Definition of Done");
    if (existing?.definitionOfDone?.length) {
        for (const item of existing.definitionOfDone) {
            lines.push(`- [ ] ${item}`);
        }
    }
    else {
        lines.push("- [ ] (Populated by /taskout)");
    }
    lines.push("");
    lines.push("## Theme");
    lines.push(existing?.theme ?? "(populated by /taskout)");
    lines.push("");
    lines.push("## Goals");
    if (existing?.goals?.length) {
        for (const goal of existing.goals) {
            lines.push(`- ${goal}`);
        }
    }
    else {
        lines.push("- (populated by /taskout)");
    }
    lines.push("");
    lines.push("## Targeted");
    if (existing?.targeted?.length) {
        for (const sub of existing.targeted) {
            lines.push(`### ${sub.heading}`);
            for (const item of sub.items) {
                lines.push(`- [${item.checked ? "x" : " "}] ${item.text}`);
            }
            lines.push("");
        }
    }
    else {
        lines.push("(populated by /taskout)");
        lines.push("");
    }
    lines.push("## Blockers & Dependencies");
    const upstream = rc.blockedBy.length
        ? rc.blockedBy.map((id) => `- **Upstream RC**: ${id}`)
        : ["- (none populated yet — run /taskout)"];
    for (const line of upstream)
        lines.push(line);
    lines.push("");
    lines.push("## References");
    for (const anchor of rc.anchors) {
        if (anchor.path)
            lines.push(`- ${anchor.path}`);
    }
    lines.push(`- Top-level index: \`../${plan.thesis.anchorDoc ? "" : ""}roadmap.md\``);
    lines.push("");
    return lines.join("\n") + "\n";
}
function toConceptDocSummary(doc) {
    const headings = [];
    for (const line of doc.content.split(/\r?\n/)) {
        const match = line.match(/^(#{1,6})\s+(.+?)\s*$/);
        if (match)
            headings.push(match[2]);
    }
    const crossRefs = Array.from(doc.content.matchAll(/\[[^\]]+\]\(([^)]+\.md)\)/g)).map((m) => m[1]);
    return {
        path: doc.path,
        title: doc.title,
        anchorSource: doc.anchorSource ?? "Concept",
        headings,
        crossRefs,
    };
}
function resolveDocsExclusions(input) {
    const docsAbs = path.resolve(input.docsDir);
    const dirs = [];
    const files = [];
    const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
    if (isInsideDir(rcDirAbs, docsAbs)) {
        dirs.push(path.relative(docsAbs, rcDirAbs));
    }
    const indexAbs = path.resolve(input.outputDir, input.roadmapConfig.indexFile);
    if (isInsideDir(indexAbs, docsAbs)) {
        files.push(path.relative(docsAbs, indexAbs));
    }
    if (input.roadmapConfig.techDebtFile) {
        const techDebtAbs = path.resolve(input.outputDir, input.roadmapConfig.techDebtFile);
        if (isInsideDir(techDebtAbs, docsAbs)) {
            files.push(path.relative(docsAbs, techDebtAbs));
        }
    }
    return { dirs, files };
}
function isInsideDir(target, base) {
    const rel = path.relative(base, target);
    return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}
function formatIsoDate(date) {
    return date.toISOString().slice(0, 10);
}
function withDraftSuffix(absPath) {
    const dir = path.dirname(absPath);
    const base = path.basename(absPath);
    const replaced = base.replace(/\.md$/i, ".draft.md");
    return path.join(dir, replaced);
}
async function fileExists(target) {
    try {
        const info = await stat(target);
        return info.isFile();
    }
    catch {
        return false;
    }
}
