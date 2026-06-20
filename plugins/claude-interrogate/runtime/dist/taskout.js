import { createHash } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadDocsRecursive } from "./docs.js";
import { assertWithinDir, renderRCFilename, validateRCId, } from "./path-safety.js";
import { parseRCFile, parseRoadmapIndex, parseTechDebt } from "./roadmap-parse.js";
export class TaskoutError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = "TaskoutError";
    }
}
export async function analyzeTaskout(input) {
    validateRCId(input.rcId);
    const indexAbs = path.resolve(input.outputDir, input.roadmapConfig.indexFile);
    const indexExists = await fileExists(indexAbs);
    if (!indexExists) {
        throw new TaskoutError("no-roadmap", `No ${input.roadmapConfig.indexFile} at ${indexAbs}. Run /roadmap first to bootstrap the project roadmap.`);
    }
    const parsedIndex = await parseRoadmapIndex(indexAbs);
    if (!parsedIndex) {
        throw new TaskoutError("no-roadmap", `Failed to parse ${indexAbs}.`);
    }
    // Compare numerically so zero-padded ids (M04_CLASSES_SKILLS) match the
    // integer milestone parsed from the index, mirroring exportTaskout's parse.
    const idMatch = input.rcId.match(/^(M|MRC)([0-9]+)_(.+)$/);
    const idKind = idMatch[1] === "MRC" ? "release-candidate" : "build";
    const row = parsedIndex.rcRows.find((r) => r.kind === idKind &&
        r.milestone === Number(idMatch[2]) &&
        r.name === idMatch[3]);
    if (!row) {
        throw new TaskoutError("rc-not-in-index", `RC ${input.rcId} is not declared in ${input.roadmapConfig.indexFile}. Run /roadmap maintenance to add it first.`);
    }
    const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
    const filename = renderRCFilename(input.roadmapConfig.rcNamingScheme, {
        milestone: row.milestone,
        name: row.name,
    });
    const rcAbs = path.resolve(rcDirAbs, filename);
    await assertWithinDir(rcAbs, rcDirAbs);
    const rcFileExists = await fileExists(rcAbs);
    const mode = rcFileExists ? "maintenance" : "bootstrap-rc";
    const existingRC = rcFileExists ? await parseRCFile(rcAbs) : null;
    const rc = {
        id: input.rcId,
        milestone: row.milestone,
        name: row.name,
        status: existingRC?.status ?? row.status,
        anchors: row.anchor && row.anchor !== "—" ? [{ kind: "Concept", path: row.anchor }] : [{ kind: "Inline" }],
        blocks: [],
        blockedBy: [],
        marketingWaypoint: row.marketing && row.marketing !== "—" ? row.marketing : undefined,
    };
    const conceptDocs = await loadDocsRecursive(input.docsDir).catch(() => []);
    const mappedConcepts = pickMappedConcepts(rc, conceptDocs.map((d) => d.path));
    const carriedFromCandidates = await collectCarriedFromCandidates({
        rcDirAbs,
        targetRCId: input.rcId,
    });
    const techDebtBlockers = await collectTechDebtBlockers({
        rcDirAbs,
        outputDir: input.outputDir,
        roadmapConfig: input.roadmapConfig,
        targetRCId: input.rcId,
    });
    const draftSections = existingRC
        ? draftFromExisting(existingRC, techDebtBlockers, carriedFromCandidates)
        : draftEmpty(rc, techDebtBlockers, carriedFromCandidates);
    const questions = buildTaskoutQuestions(rc, mode, techDebtBlockers, carriedFromCandidates);
    return {
        rc,
        outputDir: input.outputDir,
        mode,
        mappedConcepts,
        carriedFromCandidates,
        techDebtBlockers,
        draftSections,
        questions,
    };
}
export async function generateTaskout(input) {
    const plan = normalizeTaskoutPlan(input.plan);
    validateRCId(plan.rc.id);
    const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
    const filename = renderRCFilename(input.roadmapConfig.rcNamingScheme, {
        milestone: plan.rc.milestone,
        name: plan.rc.name,
    });
    const rcAbs = path.resolve(rcDirAbs, filename);
    await assertWithinDir(rcAbs, rcDirAbs);
    const rcFileExists = await fileExists(rcAbs);
    if (input.mode === "maintenance" && !rcFileExists) {
        throw new TaskoutError("mode-mismatch", `Caller said mode='maintenance' but ${rcAbs} does not exist. Use mode='bootstrap-rc' instead.`);
    }
    if (input.mode === "bootstrap-rc" && rcFileExists) {
        throw new TaskoutError("mode-mismatch", `Caller said mode='bootstrap-rc' but ${rcAbs} already exists. Use mode='maintenance' instead.`);
    }
    // Maintenance rebuilds the file from a (keyless) LLM plan, so re-attach each ticket's PERSISTED
    // key BEFORE anything keys the list — keeps identity immutable across reweords, and lets the
    // order gate resolve `- Blocked-by:` tokens (which the human writes against persisted keys).
    const existing = input.mode === "maintenance" ? await parseRCFile(rcAbs) : null;
    if (existing) {
        carryForwardKeys(existing.targeted, plan.targeted);
        await enforceShippedTaskoutLock(existing, plan);
    }
    // Write-path order gate (UNCONDITIONAL — bootstrap-rc is the first-author path that most needs it).
    // The Targeted list order IS the pushed (ClickUp) order, so refuse to write a plan whose declared
    // `- Blocked-by:` edges contradict that order, or that point at a ticket key absent from this RC
    // (a typo / bare digest / stale ref). Fires at authoring — the author fixes it before it lands.
    // Cross-RC upstream deps are ignored; stray prose ordering sections are advisory-only (export
    // surfaces them) and never block a write. Read-path (exportTaskout) stays clean for flay/sync.
    const order = analyzeTaskoutOrder(keyedTargeted(plan.targeted, plan.rc.id), plan.rc.id);
    if (order.blockedByViolations.length > 0 ||
        order.unresolvedBlockedBy.length > 0 ||
        order.phaseSequenceViolations.length > 0) {
        const parts = [
            ...order.blockedByViolations.map((v) => `'${v.item}' is Blocked-by '${v.blocker}', which is listed at or after it — order the Targeted list so blockers come first`),
            ...order.unresolvedBlockedBy.map((u) => `'${u.item}' is Blocked-by '${u.token}', which resolves to no ticket in ${plan.rc.id} — use the full ticket key '<RCID>#<epic-slug>#<digest>'`),
            ...order.phaseSequenceViolations.map((p) => `epic '${p.heading}' ${p.detail}`),
        ];
        throw new TaskoutError("order-violation", `Targeted order is inconsistent (the list order is the ClickUp order):\n- ${parts.join("\n- ")}`);
    }
    const today = formatIsoDate((input.clock ?? (() => new Date()))());
    const target = input.mode === "maintenance" ? withDraftSuffix(rcAbs) : rcAbs;
    const content = renderTaskout(plan, today);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
    return { path: target, content };
}
// confirmed_plan reaches the MCP layer typed only as `{ type: "object" }`, so the LLM
// caller can omit array fields — `overrides` is absent on almost every plan. Default the
// arrays (matching renderTaskout's "(none provided)" handling) and name the offending
// field on a type mismatch. Without this, renderTaskout crashes with an opaque
// "Cannot read properties of undefined (reading 'find')" that points at no field.
function normalizeTaskoutPlan(plan) {
    if (!plan || typeof plan !== "object") {
        throw new TaskoutError("invalid-plan", "confirmed_plan is required and must be an object.");
    }
    if (!plan.rc || typeof plan.rc !== "object") {
        throw new TaskoutError("invalid-plan", "confirmed_plan.rc is required (needs id, milestone, name, status).");
    }
    const arrayFields = [
        "goals",
        "targeted",
        "blockersAndDeps",
        "definitionOfDone",
        "references",
        "overrides",
    ];
    for (const field of arrayFields) {
        const value = plan[field];
        if (value === undefined || value === null) {
            plan[field] = [];
        }
        else if (!Array.isArray(value)) {
            throw new TaskoutError("invalid-plan", `confirmed_plan.${field} must be an array (got ${typeof value}).`);
        }
    }
    return plan;
}
/**
 * Compute the stable export keys (epic + per-ticket) for a Targeted section list. Extracted so the
 * read path ({@link exportTaskout}) and the write-path order gate (`generateTaskout`) derive
 * byte-identical keys.
 *
 * Identity is PERSISTED, not re-derived: an item that carries `item.key` (read back from its inline
 * `<!-- key: … -->` comment, or echoed by the maintenance plan) keeps that key verbatim — so
 * rewording the ticket text or its epic heading does NOT mint a new key (see seam-task-identity.md).
 * Only a brand-new keyless item is minted, by the original algorithm (hash of TEXT + encounter
 * occurrence; sub-bullets never hashed) — so legacy keyless files reproduce today's exact keys, then
 * freeze on the next write. The epic key is taken from the section's first already-keyed item (so it
 * stays coherent with its items across a heading rename) and only falls back to the heading slug for
 * a wholly new epic.
 */
export function keyedTargeted(targeted, rcId) {
    const slugCounts = new Map();
    return targeted.map((sub) => {
        const established = sub.items.find((it) => it.key && it.key.includes("#"))?.key;
        let epicKey;
        if (established) {
            epicKey = established.slice(0, established.lastIndexOf("#"));
        }
        else {
            const baseSlug = slugifyHeading(sub.heading);
            const priorUses = slugCounts.get(baseSlug) ?? 0;
            slugCounts.set(baseSlug, priorUses + 1);
            epicKey =
                priorUses === 0 ? `${rcId}#${baseSlug}` : `${rcId}#${baseSlug}-${priorUses + 1}`;
        }
        // Occurrence counts EVERY item (kept or new) so a freshly minted duplicate can't collide
        // with a kept ticket that already owns the occurrence-0 digest.
        const textOccurrences = new Map();
        const items = sub.items.map((item) => {
            const normalized = normalizeItemText(item.text);
            const occurrence = textOccurrences.get(normalized) ?? 0;
            textOccurrences.set(normalized, occurrence + 1);
            // NUL delimiter prevents concatenation-shape collisions between text and occurrence.
            const digest = createHash("sha1")
                .update(`${normalized}\0${occurrence}`)
                .digest("hex")
                .slice(0, 12);
            // Persisted key wins; mint only when this ticket has never been keyed.
            const key = item.key ?? `${epicKey}#${digest}`;
            // AC / How / Why / Blocked-by / Owner ride along as separate fields — never
            // part of the hashed text, so keys stay stable.
            return {
                text: item.text,
                checked: item.checked,
                key,
                ...(item.dod && item.dod.length > 0 ? { dod: item.dod } : {}),
                ...(item.howToImplement && item.howToImplement.length > 0
                    ? { howToImplement: item.howToImplement }
                    : {}),
                ...(item.designContext && item.designContext.length > 0
                    ? { designContext: item.designContext }
                    : {}),
                ...(item.blockedBy && item.blockedBy.length > 0 ? { blockedBy: item.blockedBy } : {}),
                ...(item.owner ? { owner: item.owner } : {}),
            };
        });
        return { heading: sub.heading, key: epicKey, items };
    });
}
/**
 * Order health of a keyed Targeted list. The list order IS the pushed (ClickUp) order, so:
 *  - a `Blocked-by` edge whose target resolves to a ticket at-or-after the dependent is a
 *    `blockedByViolation` (the pushed order contradicts the dependency);
 *  - a `Blocked-by` token that looks intra-RC (starts with `${rcId}#`, OR contains no `#` at all —
 *    a bare digest / epic letter) but matches no ticket key is `unresolvedBlockedBy` (typo / wrong
 *    digest / stale). A token that DOES contain `#` with a different RC prefix is a legitimate
 *    cross-RC/upstream dep and is ignored.
 * `raw` (when provided, i.e. at export) is scanned for stray prose ordering sections — a divergent
 * second order source. Pure + side-effect-free so both export and generate can call it.
 */
export function analyzeTaskoutOrder(sections, rcId, raw) {
    const indexOf = new Map();
    let flatIndex = 0;
    for (const sub of sections) {
        for (const item of sub.items) {
            if (!indexOf.has(item.key))
                indexOf.set(item.key, flatIndex);
            flatIndex += 1;
        }
    }
    const blockedByViolations = [];
    const unresolvedBlockedBy = [];
    for (const sub of sections) {
        for (const item of sub.items) {
            if (!item.blockedBy)
                continue;
            const depIndex = indexOf.get(item.key);
            for (const token of item.blockedBy) {
                if (indexOf.has(token)) {
                    if (indexOf.get(token) >= depIndex) {
                        blockedByViolations.push({ item: item.key, blocker: token });
                    }
                }
                else if (token.startsWith(`${rcId}#`) || !token.includes("#")) {
                    unresolvedBlockedBy.push({ item: item.key, token });
                }
                // else: cross-RC full key (has '#', different RC) — legitimate upstream dep, ignored.
            }
        }
    }
    const strayOrderingSections = [];
    if (raw) {
        const re = /^#{1,6}\s+(suggested|execution|implementation)\s+(order|sequence)\b.*$/gim;
        let match;
        while ((match = re.exec(raw)) !== null) {
            strayOrderingSections.push({ heading: match[0].replace(/^#+\s+/, "").trim() });
        }
    }
    // Phase-sequence: the human-readable `### Phase N` convention — the number IS the order, so a
    // human reads ClickUp 1→2→3 as the work sequence. Silent unless the RC uses phase labels. Once
    // ANY epic is phase-labeled, ALL must be (a `Phase 1` / `Unnumbered` / `Phase 2` mix defeats the
    // convention); numbers must strictly ascend (gaps from a deferred phase are fine) starting at 0
    // or 1 (Phase 0 = the de-risking pre-work idiom). A space after "Phase" is required.
    const phaseSequenceViolations = [];
    const phaseRe = /^Phase\s+(\d+)\b/i;
    const phased = sections.map((s) => ({ heading: s.heading, n: phaseRe.exec(s.heading)?.[1] }));
    const labeled = phased.filter((p) => p.n !== undefined);
    if (labeled.length > 0) {
        const unlabeled = phased.filter((p) => p.n === undefined);
        if (unlabeled.length > 0) {
            for (const u of unlabeled) {
                phaseSequenceViolations.push({
                    heading: u.heading,
                    kind: "partial-adoption",
                    detail: "is not labeled `Phase N` while sibling epics are — label all Targeted epics as phases, or none",
                });
            }
        }
        else {
            let prev = Number.NEGATIVE_INFINITY;
            labeled.forEach((p, i) => {
                const num = Number(p.n);
                if (i === 0 && num !== 0 && num !== 1) {
                    phaseSequenceViolations.push({
                        heading: p.heading,
                        kind: "bad-start",
                        detail: `first phase is ${num}; phases must start at 0 or 1`,
                    });
                }
                if (num <= prev) {
                    phaseSequenceViolations.push({
                        heading: p.heading,
                        kind: "out-of-order",
                        detail: `phase ${num} does not exceed the preceding phase ${prev} — order epics so phase numbers strictly ascend`,
                    });
                }
                prev = num;
            });
        }
    }
    return { blockedByViolations, unresolvedBlockedBy, strayOrderingSections, phaseSequenceViolations };
}
export async function exportTaskout(input) {
    validateRCId(input.rcId);
    const idMatch = input.rcId.match(/^(M|MRC)([0-9]+)_(.+)$/);
    const kind = idMatch[1] === "MRC" ? "release-candidate" : "build";
    const milestone = Number(idMatch[2]);
    const name = idMatch[3];
    const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
    const filename = renderRCFilename(input.roadmapConfig.rcNamingScheme, {
        milestone,
        name,
        kind,
    });
    const rcAbs = path.resolve(rcDirAbs, filename);
    await assertWithinDir(rcAbs, rcDirAbs);
    if (!(await fileExists(rcAbs))) {
        throw new TaskoutError("rc-file-not-found", `No RC file at ${rcAbs} for ${input.rcId}. Run /taskout to create it first.`);
    }
    const parsed = await parseRCFile(rcAbs);
    if (!parsed) {
        throw new TaskoutError("rc-parse-failed", `Failed to parse ${rcAbs}.`);
    }
    const targeted = keyedTargeted(parsed.targeted, input.rcId);
    // Read path: surface order health as DATA, never throw — flay / clickup-sync / status depend on a
    // clean export and classify stale refs downstream. The write-path gate (generateTaskout) is what
    // refuses. `parsed.raw` feeds the stray-ordering-section lint.
    const orderDiagnostics = analyzeTaskoutOrder(targeted, input.rcId, parsed.raw);
    return {
        rcId: input.rcId,
        path: rcAbs,
        milestone,
        kind,
        name,
        status: parsed.status,
        lastUpdated: parsed.lastUpdated,
        theme: parsed.theme,
        goals: parsed.goals,
        targeted,
        blockersAndDeps: parsed.blockersAndDeps,
        definitionOfDone: parsed.definitionOfDone,
        references: parsed.references,
        orderDiagnostics,
    };
}
function slugifyHeading(heading) {
    const slug = heading
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    return slug.length > 0 ? slug : "section";
}
function normalizeItemText(text) {
    return text.normalize("NFKC").trim().replace(/\s+/g, " ");
}
/**
 * Re-attach persisted ticket keys to a maintenance plan that was rebuilt from a keyless LLM edit,
 * so a ticket's identity survives a reword. Mutates plan items in place, filling `.key` where it is
 * absent, in three safe-by-design layers (it never *guesses* a key onto the wrong ticket):
 *   1. an item that already carries `.key` (the agent echoed it) is left as-is — authoritative;
 *   2. else match the prior keyed item by exact normalized text, consuming duplicates 1:1 in
 *      document order (handles reorder and an agent that dropped keys; robust to heading reweords);
 *   3. else, within a heading-matched epic, if exactly ONE prior keyed item and ONE plan item
 *      remain unmatched, pair them — the common single-ticket reword. Two-or-more leftovers on
 *      either side are ambiguous, so it does NOT guess; those fall through to a fresh mint.
 */
function carryForwardKeys(existing, plan) {
    const byText = new Map();
    for (const sub of existing) {
        for (const it of sub.items) {
            if (!it.key)
                continue;
            const norm = normalizeItemText(it.text);
            const queue = byText.get(norm) ?? [];
            queue.push(it.key);
            byText.set(norm, queue);
        }
    }
    const consumed = new Set();
    for (const sub of plan) {
        for (const it of sub.items) {
            if (it.key) {
                consumed.add(it.key); // layer 1 — agent-echoed key wins
                continue;
            }
            const queue = byText.get(normalizeItemText(it.text)); // layer 2 — exact text
            if (queue && queue.length > 0) {
                const key = queue.shift();
                it.key = key;
                consumed.add(key);
            }
        }
    }
    // layer 3 — unambiguous single-reword, scoped to a heading-matched epic.
    const planByHeading = new Map();
    for (const sub of plan) {
        if (!planByHeading.has(sub.heading))
            planByHeading.set(sub.heading, sub);
    }
    for (const exSub of existing) {
        const planSub = planByHeading.get(exSub.heading);
        if (!planSub)
            continue;
        const priorLeft = exSub.items.filter((it) => it.key && !consumed.has(it.key));
        const planLeft = planSub.items.filter((it) => !it.key);
        if (priorLeft.length === 1 && planLeft.length === 1) {
            planLeft[0].key = priorLeft[0].key;
            consumed.add(priorLeft[0].key);
        }
    }
}
async function enforceShippedTaskoutLock(existing, plan) {
    if (existing.status.toLowerCase() !== "shipped")
        return;
    const changed = [];
    if (existing.theme && existing.theme !== plan.theme)
        changed.push("theme");
    if (!sameArray(existing.goals, plan.goals))
        changed.push("goals");
    if (!sameTargeted(existing.targeted, plan.targeted))
        changed.push("targeted");
    if (!sameArray(existing.definitionOfDone, plan.definitionOfDone)) {
        changed.push("definitionOfDone");
    }
    if (plan.rc.milestone !== existing.milestone)
        changed.push("milestone");
    if (plan.rc.name !== existing.name)
        changed.push("name");
    const removedReferences = existing.references.filter((ref) => !plan.references.includes(ref));
    if (removedReferences.length > 0)
        changed.push("references-removed");
    if (changed.length === 0)
        return;
    const override = plan.overrides.find((o) => o.rcId === plan.rc.id);
    const granted = new Set(override?.changedFields ?? []);
    const ungranted = changed.filter((field) => !granted.has(field));
    if (ungranted.length > 0) {
        throw new TaskoutError("shipped-lock-violation", `Shipped RC ${plan.rc.id} changes immutable fields without override: ${ungranted.join(", ")}`);
    }
    if (!override?.reason) {
        throw new TaskoutError("shipped-lock-missing-reason", `shipped-lock-bypass override for ${plan.rc.id} must include a reason.`);
    }
}
function draftFromExisting(existing, techDebt, carried) {
    const blockers = [];
    for (const upstream of existing.blockersAndDeps.filter((b) => b.kind === "Upstream RC")) {
        blockers.push(upstream);
    }
    for (const debt of techDebt) {
        blockers.push({
            kind: "Tech Debt",
            item: `${debt.item} (\`${debt.sourcePath}:${debt.sourceLine}\`)`,
            sourcePath: debt.sourcePath,
            sourceLine: debt.sourceLine,
        });
    }
    for (const carry of carried) {
        blockers.push({
            kind: "External",
            item: `Carried from ${carry.sourceRC}: ${carry.item}`,
        });
    }
    return {
        theme: existing.theme ?? "",
        goals: existing.goals,
        targeted: existing.targeted,
        blockersAndDeps: blockers,
        definitionOfDone: existing.definitionOfDone,
        references: existing.references,
    };
}
function draftEmpty(rc, techDebt, carried) {
    const blockers = [];
    for (const upstream of rc.blockedBy) {
        blockers.push({ kind: "Upstream RC", item: upstream });
    }
    for (const debt of techDebt) {
        blockers.push({
            kind: "Tech Debt",
            item: `${debt.item} (\`${debt.sourcePath}:${debt.sourceLine}\`)`,
            sourcePath: debt.sourcePath,
            sourceLine: debt.sourceLine,
        });
    }
    for (const carry of carried) {
        blockers.push({
            kind: "External",
            item: `Carried from ${carry.sourceRC}: ${carry.item}`,
        });
    }
    const references = rc.anchors.filter((a) => a.path).map((a) => a.path);
    return {
        theme: "",
        goals: [],
        targeted: [],
        blockersAndDeps: blockers,
        definitionOfDone: [],
        references,
    };
}
function pickMappedConcepts(rc, conceptPaths) {
    const mappedPaths = new Set(rc.anchors.filter((a) => a.path).map((a) => a.path));
    const results = [];
    for (const docPath of conceptPaths) {
        const basename = path.basename(docPath);
        for (const anchorPath of mappedPaths) {
            if (anchorPath === docPath || path.basename(anchorPath) === basename) {
                results.push({ path: docPath, relevantSections: [] });
                break;
            }
        }
    }
    return results;
}
async function collectCarriedFromCandidates(args) {
    const exists = await dirExists(args.rcDirAbs);
    if (!exists)
        return [];
    const entries = await readdir(args.rcDirAbs, { withFileTypes: true });
    const candidates = [];
    for (const entry of entries) {
        if (!entry.isFile())
            continue;
        if (!entry.name.endsWith(".md") || entry.name.endsWith(".draft.md"))
            continue;
        const filePath = path.join(args.rcDirAbs, entry.name);
        const parsed = await parseRCFile(filePath);
        if (!parsed)
            continue;
        if (`${parsed.kind === "release-candidate" ? "MRC" : "M"}${parsed.milestone}_${parsed.name}` === args.targetRCId)
            continue;
        const lines = parsed.raw.split(/\r?\n/);
        let inOutOfScope = false;
        let outOfScopeLevel = 0;
        for (let i = 0; i < lines.length; i += 1) {
            const headingMatch = lines[i].match(/^(#{1,6})\s+(.+?)\s*$/);
            if (headingMatch) {
                const heading = headingMatch[2].toLowerCase().trim();
                const level = headingMatch[1].length;
                if (/^out[- ]?of[- ]?scope$/.test(heading)) {
                    inOutOfScope = true;
                    outOfScopeLevel = level;
                    continue;
                }
                if (inOutOfScope && level <= outOfScopeLevel) {
                    inOutOfScope = false;
                }
            }
            if (!inOutOfScope)
                continue;
            const checkbox = lines[i].match(/^- \[( |x|X)\]\s+(.+)$/);
            if (!checkbox)
                continue;
            const body = checkbox[2];
            const arrowMatch = body.match(/(?:→|->)\s*([A-Z0-9_]+)/);
            if (!arrowMatch || arrowMatch[1] !== args.targetRCId)
                continue;
            const itemText = body.replace(/`[^`]+`/g, "").replace(/(?:→|->)\s*[A-Z0-9_]+\.?/, "").trim();
            candidates.push({
                sourceRC: `${parsed.kind === "release-candidate" ? "MRC" : "M"}${parsed.milestone}_${parsed.name}`,
                item: itemText,
                sourceLine: i + 1,
            });
        }
    }
    return candidates;
}
async function collectTechDebtBlockers(args) {
    if (!args.roadmapConfig.techDebtFile)
        return [];
    const techDebtAbs = path.resolve(args.outputDir, args.roadmapConfig.techDebtFile);
    const parsed = await parseTechDebt(techDebtAbs);
    if (!parsed)
        return [];
    const blockers = [];
    for (const item of parsed.items) {
        if (!item.blocks.includes(args.targetRCId))
            continue;
        blockers.push({
            item: item.text,
            sourcePath: args.roadmapConfig.techDebtFile,
            sourceLine: item.sourceLine,
            severity: item.severity,
        });
    }
    return blockers;
}
function buildTaskoutQuestions(rc, mode, techDebt, carried) {
    const questions = [];
    if (mode === "maintenance") {
        questions.push({
            id: "review-existing",
            theme: "Existing RC",
            question: `Review the existing ${rc.id} contents. Confirm Theme/Goals/Targeted as-is or restate.`,
            rationale: "Maintenance mode preserves prior content unless changes are stated.",
        });
    }
    questions.push({
        id: "theme",
        theme: "Theme",
        question: `In 1-3 lines, state the theme of ${rc.id}.`,
        rationale: "Anchors the RC for readers.",
    });
    questions.push({
        id: "goals",
        theme: "Goals",
        question: "List 3-5 player-facing outcomes that pass when this RC ships.",
        rationale: "Outcomes drive DoD criteria.",
    });
    questions.push({
        id: "targeted",
        theme: "Targeted",
        question: "Group the work into epics (one `### heading` per feature/area). Under each epic, list its tickets — one goal per ticket, sized so the ticket is independently deliverable and testable (INVEST). List tickets in execution order, AND order the epics themselves top-to-bottom in execution order too — this Targeted list IS the order the human reads off ClickUp as the work sequence, so it must match the intended implementation order. Label the epics as sequential 1-indexed phases (`### Phase 1 — <name>`, `### Phase 2 — <name>`, …) so the number IS the order and ClickUp reads coherently 1→2→3; never out-of-sequence letter labels (`E0, A, C, B…`), which read as a jumble (descriptive headings are fine when an RC has no execution sequence). Do NOT author a separate 'Suggested Order' / 'Execution Order' section: it diverges silently and the tooling ignores it (the list is the only order that ships). If a ticket is blocked by another, note it (here or under Blockers). A spike that de-risks an unknown is its own ticket. Cite concept-doc sections inline.",
        rationale: "Agile-correct: epic = a feature, ticket = one INVEST-sized goal, backlog ordered by execution with dependencies explicit. Sub-task breakdowns live in Plan/ docs.",
    });
    questions.push({
        id: "targeted-dods",
        theme: "Acceptance Criteria",
        question: "For each ticket, give 1-3 observable pass/fail acceptance criteria — the spec that says THIS ticket is done (rendered as `- AC:` sub-bullets under the item). If the criteria need an \"and\" across two unrelated checks, the ticket is two tickets — split it. A ticket with no specific criteria inherits the milestone Definition of Done.",
        rationale: "Per-ticket acceptance criteria (distinct from the RC-wide Definition of Done) give flay, verification, and the ClickUp mirror a spec to work against, not just a title. The single-criterion test is also the sizing rule: needing \"and\" means it is two tickets.",
    });
    questions.push({
        id: "targeted-spec",
        theme: "Ticket spec (warm only)",
        question: "Does a code-grounded plan already exist for any of these tickets (a Plan/ doc, prior recon, a settled design)? If so, fill the ticket's spec NOW: `- How:` the concrete implementation path (file:line / seam to touch) and `- Why:` the traps and rationale to carry into execution. Leave a ticket's spec blank only when no such shape exists yet — those stay thin and are spec'd at flay time. Do not invent a path you have not actually traced.",
        rationale: "Warm tickets (shape already exists) get the full spec at taskout so flay and the tracker inherit execution context instead of re-deriving it. Cold tickets defer — lazy-spec-at-flay is correct only when there is no prior shape to lose.",
        dependsOn: "targeted",
    });
    questions.push({
        id: "blockers",
        theme: "Blockers & Dependencies",
        question: techDebt.length || carried.length
            ? "Confirm or edit the surfaced blockers (upstream RCs, scanned tech-debt items, carried-over items), then name any inter-ticket or external dependencies that constrain execution order. Encode every intended ordering — including a soft 'do X before Y' with no hard code-dependency — as a `- Blocked-by:` edge on the dependent ticket so the order is machine-checked. Its value MUST be the dependency's full exported ticket key `<RCID>#<epic-slug>#<digest>`; a bare digest or epic letter is rejected at generate time."
            : "Name the known dependencies that constrain execution order: upstream RCs, inter-ticket blockers within this RC, and external pending decisions (unratified ADRs, vendor calls). Encode every intended ordering — including a soft 'do X before Y' with no hard code-dependency — as a `- Blocked-by:` edge on the dependent ticket so the order is machine-checked. Its value MUST be the dependency's full exported ticket key `<RCID>#<epic-slug>#<digest>`; a bare digest or epic letter is rejected at generate time.",
        rationale: "Known dependencies up front make the ticket order a real execution plan, not a guess.",
    });
    questions.push({
        id: "dod",
        theme: "Definition of Done",
        question: "List 4-8 testable pass/fail assertions that gate ship for the whole RC — the shared bar every ticket also clears, distinct from per-ticket acceptance criteria.",
        rationale: "The RC-wide Definition of Done is the global ship gate, not a wish list; tickets inherit it on top of their own acceptance criteria.",
    });
    return questions;
}
function renderTaskout(plan, today) {
    const lines = [];
    lines.push(`# ${plan.rc.kind === "release-candidate" ? "MRC" : "M"}${plan.rc.milestone} — ${plan.rc.name}`);
    lines.push(`Status: ${plan.rc.status}`);
    lines.push(`Last Updated: ${today}`);
    const override = plan.overrides.find((o) => o.kind === "shipped-lock-bypass");
    if (override) {
        const fields = override.changedFields.join(",");
        const safeReason = override.reason.replace(/[-<>]/g, " ");
        lines.push(`<!-- shipped-override: fields=${fields}; reason=${safeReason}; date=${today} -->`);
    }
    lines.push("");
    lines.push("## Definition of Done");
    if (plan.definitionOfDone.length === 0) {
        lines.push("- [ ] (none provided)");
    }
    else {
        for (const item of plan.definitionOfDone) {
            lines.push(`- [ ] ${item}`);
        }
    }
    lines.push("");
    lines.push("## Theme");
    lines.push(plan.theme || "(TBD)");
    lines.push("");
    lines.push("## Goals");
    if (plan.goals.length === 0) {
        lines.push("- (none provided)");
    }
    else {
        for (const goal of plan.goals) {
            lines.push(`- ${goal}`);
        }
    }
    lines.push("");
    lines.push("## Targeted");
    if (plan.targeted.length === 0) {
        lines.push("(none provided)");
        lines.push("");
    }
    else {
        // Render from the keyed list so every ticket's immutable identity is persisted inline as a
        // trailing `<!-- key: … -->` comment (minted here for any brand-new ticket). On the next read
        // parseTargeted strips it back off the text, so this round-trips byte-identical.
        for (const sub of keyedTargeted(plan.targeted, plan.rc.id)) {
            lines.push(`### ${sub.heading}`);
            for (const item of sub.items) {
                lines.push(`- [${item.checked ? "x" : " "}] ${item.text}  <!-- key: ${item.key} -->`);
                if (item.dod && item.dod.length > 0) {
                    for (const criterion of item.dod) {
                        lines.push(`  - AC: ${criterion}`);
                    }
                }
                if (item.howToImplement && item.howToImplement.length > 0) {
                    for (const step of item.howToImplement) {
                        lines.push(`  - How: ${step}`);
                    }
                }
                if (item.designContext && item.designContext.length > 0) {
                    for (const note of item.designContext) {
                        lines.push(`  - Why: ${note}`);
                    }
                }
                if (item.blockedBy && item.blockedBy.length > 0) {
                    lines.push(`  - Blocked-by: ${item.blockedBy.join(", ")}`);
                }
                if (item.owner) {
                    lines.push(`  - Owner: ${item.owner}`);
                }
            }
            lines.push("");
        }
    }
    lines.push("## Blockers & Dependencies");
    if (plan.blockersAndDeps.length === 0) {
        lines.push("- None identified.");
    }
    else {
        for (const blocker of plan.blockersAndDeps) {
            lines.push(`- **${blocker.kind}**: ${blocker.item}`);
        }
    }
    lines.push("");
    lines.push("## References");
    if (plan.references.length === 0) {
        lines.push("- (none)");
    }
    else {
        for (const ref of plan.references) {
            lines.push(`- ${ref}`);
        }
    }
    lines.push("");
    return lines.join("\n") + "\n";
}
function sameArray(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i].trim() !== b[i].trim())
            return false;
    }
    return true;
}
function sameTargeted(a, b) {
    if (a.length !== b.length)
        return false;
    for (let i = 0; i < a.length; i += 1) {
        if (a[i].heading !== b[i].heading)
            return false;
        if (a[i].items.length !== b[i].items.length)
            return false;
        for (let j = 0; j < a[i].items.length; j += 1) {
            if (a[i].items[j].text.trim() !== b[i].items[j].text.trim())
                return false;
        }
    }
    return true;
}
function formatIsoDate(date) {
    return date.toISOString().slice(0, 10);
}
function withDraftSuffix(absPath) {
    const dir = path.dirname(absPath);
    const base = path.basename(absPath);
    return path.join(dir, base.replace(/\.md$/i, ".draft.md"));
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
async function dirExists(target) {
    try {
        const info = await stat(target);
        return info.isDirectory();
    }
    catch {
        return false;
    }
}
