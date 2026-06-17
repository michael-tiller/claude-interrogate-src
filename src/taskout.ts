import { createHash } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadDocsRecursive } from "./docs.js";
import {
  assertWithinDir,
  renderRCFilename,
  validateRCId,
} from "./path-safety.js";
import { parseRCFile, parseRoadmapIndex, parseTechDebt } from "./roadmap-parse.js";
import {
  BlockerEntry,
  CarriedFromCandidate,
  ConfirmedTaskoutPlan,
  InterviewQuestion,
  MappedConceptSummary,
  ParsedRC,
  RCKind,
  RCMetadata,
  RoadmapConfig,
  ShippedLockChangedField,
  TaskoutDraftSections,
  TaskoutExportResult,
  TaskoutMode,
  TaskoutStartResult,
  TechDebtBlocker,
} from "./types.js";

export class TaskoutError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "TaskoutError";
  }
}

export interface AnalyzeTaskoutInput {
  rcId: string;
  docsDir: string;
  outputDir: string;
  styleTemplatePath?: string;
  roadmapConfig: RoadmapConfig;
  configBaseDir: string;
  clock?: () => Date;
}

export interface GenerateTaskoutInput {
  plan: ConfirmedTaskoutPlan;
  outputDir: string;
  mode: TaskoutMode;
  roadmapConfig: RoadmapConfig;
  clock?: () => Date;
}

export async function analyzeTaskout(
  input: AnalyzeTaskoutInput,
): Promise<TaskoutStartResult> {
  validateRCId(input.rcId);

  const indexAbs = path.resolve(input.outputDir, input.roadmapConfig.indexFile);
  const indexExists = await fileExists(indexAbs);
  if (!indexExists) {
    throw new TaskoutError(
      "no-roadmap",
      `No ${input.roadmapConfig.indexFile} at ${indexAbs}. Run /roadmap first to bootstrap the project roadmap.`,
    );
  }

  const parsedIndex = await parseRoadmapIndex(indexAbs);
  if (!parsedIndex) {
    throw new TaskoutError("no-roadmap", `Failed to parse ${indexAbs}.`);
  }

  // Compare numerically so zero-padded ids (M04_CLASSES_SKILLS) match the
  // integer milestone parsed from the index, mirroring exportTaskout's parse.
  const idMatch = input.rcId.match(/^(M|MRC)([0-9]+)_(.+)$/)!;
  const idKind = idMatch[1] === "MRC" ? "release-candidate" : "build";
  const row = parsedIndex.rcRows.find(
    (r) =>
      r.kind === idKind &&
      r.milestone === Number(idMatch[2]) &&
      r.name === idMatch[3],
  );
  if (!row) {
    throw new TaskoutError(
      "rc-not-in-index",
      `RC ${input.rcId} is not declared in ${input.roadmapConfig.indexFile}. Run /roadmap maintenance to add it first.`,
    );
  }

  const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
  const filename = renderRCFilename(input.roadmapConfig.rcNamingScheme, {
    milestone: row.milestone,
    name: row.name,
  });
  const rcAbs = path.resolve(rcDirAbs, filename);
  await assertWithinDir(rcAbs, rcDirAbs);

  const rcFileExists = await fileExists(rcAbs);
  const mode: TaskoutMode = rcFileExists ? "maintenance" : "bootstrap-rc";

  const existingRC = rcFileExists ? await parseRCFile(rcAbs) : null;

  const rc: RCMetadata = {
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

  const draftSections: TaskoutDraftSections = existingRC
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

export async function generateTaskout(
  input: GenerateTaskoutInput,
): Promise<{ path: string; content: string }> {
  validateRCId(input.plan.rc.id);

  const rcDirAbs = path.resolve(input.outputDir, input.roadmapConfig.rcDir);
  const filename = renderRCFilename(input.roadmapConfig.rcNamingScheme, {
    milestone: input.plan.rc.milestone,
    name: input.plan.rc.name,
  });
  const rcAbs = path.resolve(rcDirAbs, filename);
  await assertWithinDir(rcAbs, rcDirAbs);

  const rcFileExists = await fileExists(rcAbs);

  if (input.mode === "maintenance" && !rcFileExists) {
    throw new TaskoutError(
      "mode-mismatch",
      `Caller said mode='maintenance' but ${rcAbs} does not exist. Use mode='bootstrap-rc' instead.`,
    );
  }
  if (input.mode === "bootstrap-rc" && rcFileExists) {
    throw new TaskoutError(
      "mode-mismatch",
      `Caller said mode='bootstrap-rc' but ${rcAbs} already exists. Use mode='maintenance' instead.`,
    );
  }

  if (input.mode === "maintenance") {
    await enforceShippedTaskoutLock(rcAbs, input.plan);
  }

  const today = formatIsoDate((input.clock ?? (() => new Date()))());
  const target = input.mode === "maintenance" ? withDraftSuffix(rcAbs) : rcAbs;
  const content = renderTaskout(input.plan, today);

  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, "utf8");

  return { path: target, content };
}

export interface ExportTaskoutInput {
  rcId: string;
  outputDir: string;
  roadmapConfig: RoadmapConfig;
}

export async function exportTaskout(
  input: ExportTaskoutInput,
): Promise<TaskoutExportResult> {
  validateRCId(input.rcId);
  const idMatch = input.rcId.match(/^(M|MRC)([0-9]+)_(.+)$/)!;
  const kind: RCKind = idMatch[1] === "MRC" ? "release-candidate" : "build";
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
    throw new TaskoutError(
      "rc-file-not-found",
      `No RC file at ${rcAbs} for ${input.rcId}. Run /taskout to create it first.`,
    );
  }
  const parsed = await parseRCFile(rcAbs);
  if (!parsed) {
    throw new TaskoutError("rc-parse-failed", `Failed to parse ${rcAbs}.`);
  }

  const slugCounts = new Map<string, number>();
  const targeted = parsed.targeted.map((sub) => {
    const baseSlug = slugifyHeading(sub.heading);
    const priorUses = slugCounts.get(baseSlug) ?? 0;
    slugCounts.set(baseSlug, priorUses + 1);
    const epicKey =
      priorUses === 0
        ? `${input.rcId}#${baseSlug}`
        : `${input.rcId}#${baseSlug}-${priorUses + 1}`;

    const textOccurrences = new Map<string, number>();
    const items = sub.items.map((item) => {
      const normalized = normalizeItemText(item.text);
      const occurrence = textOccurrences.get(normalized) ?? 0;
      textOccurrences.set(normalized, occurrence + 1);
      // NUL delimiter prevents concatenation-shape collisions between text and occurrence.
      const digest = createHash("sha1")
        .update(`${normalized}\0${occurrence}`)
        .digest("hex")
        .slice(0, 12);
      // DOD rides along as a separate field — never part of the hashed text, so keys stay stable.
      return {
        text: item.text,
        checked: item.checked,
        key: `${epicKey}#${digest}`,
        ...(item.dod && item.dod.length > 0 ? { dod: item.dod } : {}),
      };
    });

    return { heading: sub.heading, key: epicKey, items };
  });

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
  };
}

function slugifyHeading(heading: string): string {
  const slug = heading
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug.length > 0 ? slug : "section";
}

function normalizeItemText(text: string): string {
  return text.normalize("NFKC").trim().replace(/\s+/g, " ");
}

async function enforceShippedTaskoutLock(
  rcAbs: string,
  plan: ConfirmedTaskoutPlan,
): Promise<void> {
  const existing = await parseRCFile(rcAbs);
  if (!existing) return;
  if (existing.status.toLowerCase() !== "shipped") return;

  const changed: ShippedLockChangedField[] = [];
  if (existing.theme && existing.theme !== plan.theme) changed.push("theme");
  if (!sameArray(existing.goals, plan.goals)) changed.push("goals");
  if (!sameTargeted(existing.targeted, plan.targeted)) changed.push("targeted");
  if (!sameArray(existing.definitionOfDone, plan.definitionOfDone)) {
    changed.push("definitionOfDone");
  }
  if (plan.rc.milestone !== existing.milestone) changed.push("milestone");
  if (plan.rc.name !== existing.name) changed.push("name");
  const removedReferences = existing.references.filter((ref) => !plan.references.includes(ref));
  if (removedReferences.length > 0) changed.push("references-removed");

  if (changed.length === 0) return;

  const override = plan.overrides.find((o) => o.rcId === plan.rc.id);
  const granted = new Set(override?.changedFields ?? []);
  const ungranted = changed.filter((field) => !granted.has(field));
  if (ungranted.length > 0) {
    throw new TaskoutError(
      "shipped-lock-violation",
      `Shipped RC ${plan.rc.id} changes immutable fields without override: ${ungranted.join(", ")}`,
    );
  }
  if (!override?.reason) {
    throw new TaskoutError(
      "shipped-lock-missing-reason",
      `shipped-lock-bypass override for ${plan.rc.id} must include a reason.`,
    );
  }
}

function draftFromExisting(
  existing: ParsedRC,
  techDebt: TechDebtBlocker[],
  carried: CarriedFromCandidate[],
): TaskoutDraftSections {
  const blockers: BlockerEntry[] = [];
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

function draftEmpty(
  rc: RCMetadata,
  techDebt: TechDebtBlocker[],
  carried: CarriedFromCandidate[],
): TaskoutDraftSections {
  const blockers: BlockerEntry[] = [];
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
  const references = rc.anchors.filter((a) => a.path).map((a) => a.path!);
  return {
    theme: "",
    goals: [],
    targeted: [],
    blockersAndDeps: blockers,
    definitionOfDone: [],
    references,
  };
}

function pickMappedConcepts(
  rc: RCMetadata,
  conceptPaths: string[],
): MappedConceptSummary[] {
  const mappedPaths = new Set(rc.anchors.filter((a) => a.path).map((a) => a.path!));
  const results: MappedConceptSummary[] = [];
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

async function collectCarriedFromCandidates(args: {
  rcDirAbs: string;
  targetRCId: string;
}): Promise<CarriedFromCandidate[]> {
  const exists = await dirExists(args.rcDirAbs);
  if (!exists) return [];

  const entries = await readdir(args.rcDirAbs, { withFileTypes: true });
  const candidates: CarriedFromCandidate[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".md") || entry.name.endsWith(".draft.md")) continue;
    const filePath = path.join(args.rcDirAbs, entry.name);
    const parsed = await parseRCFile(filePath);
    if (!parsed) continue;
    if (`${parsed.kind === "release-candidate" ? "MRC" : "M"}${parsed.milestone}_${parsed.name}` === args.targetRCId) continue;

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
      if (!inOutOfScope) continue;
      const checkbox = lines[i].match(/^- \[( |x|X)\]\s+(.+)$/);
      if (!checkbox) continue;
      const body = checkbox[2];
      const arrowMatch = body.match(/(?:→|->)\s*([A-Z0-9_]+)/);
      if (!arrowMatch || arrowMatch[1] !== args.targetRCId) continue;

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

async function collectTechDebtBlockers(args: {
  rcDirAbs: string;
  outputDir: string;
  roadmapConfig: RoadmapConfig;
  targetRCId: string;
}): Promise<TechDebtBlocker[]> {
  if (!args.roadmapConfig.techDebtFile) return [];
  const techDebtAbs = path.resolve(args.outputDir, args.roadmapConfig.techDebtFile);
  const parsed = await parseTechDebt(techDebtAbs);
  if (!parsed) return [];

  const blockers: TechDebtBlocker[] = [];
  for (const item of parsed.items) {
    if (!item.blocks.includes(args.targetRCId)) continue;
    blockers.push({
      item: item.text,
      sourcePath: args.roadmapConfig.techDebtFile,
      sourceLine: item.sourceLine,
      severity: item.severity,
    });
  }
  return blockers;
}

function buildTaskoutQuestions(
  rc: RCMetadata,
  mode: TaskoutMode,
  techDebt: TechDebtBlocker[],
  carried: CarriedFromCandidate[],
): InterviewQuestion[] {
  const questions: InterviewQuestion[] = [];
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
    question:
      "Group the work into epics (one `### heading` per feature/area). Under each epic, list its tickets — one goal per ticket, sized so the ticket is independently deliverable and testable (INVEST). List tickets in execution order; that order is the priority. If a ticket is blocked by another, note it (here or under Blockers). A spike that de-risks an unknown is its own ticket. Cite concept-doc sections inline.",
    rationale:
      "Agile-correct: epic = a feature, ticket = one INVEST-sized goal, backlog ordered by execution with dependencies explicit. Sub-task breakdowns live in Plan/ docs.",
  });
  questions.push({
    id: "targeted-dods",
    theme: "Acceptance Criteria",
    question:
      "For each ticket, give 1-3 observable pass/fail acceptance criteria — the spec that says THIS ticket is done (rendered as `- AC:` sub-bullets under the item). If the criteria need an \"and\" across two unrelated checks, the ticket is two tickets — split it. A ticket with no specific criteria inherits the milestone Definition of Done.",
    rationale:
      "Per-ticket acceptance criteria (distinct from the RC-wide Definition of Done) give flay, verification, and the ClickUp mirror a spec to work against, not just a title. The single-criterion test is also the sizing rule: needing \"and\" means it is two tickets.",
  });
  questions.push({
    id: "blockers",
    theme: "Blockers & Dependencies",
    question:
      techDebt.length || carried.length
        ? "Confirm or edit the surfaced blockers (upstream RCs, scanned tech-debt items, carried-over items), then name any inter-ticket or external dependencies that constrain execution order."
        : "Name the known dependencies that constrain execution order: upstream RCs, inter-ticket blockers within this RC, and external pending decisions (unratified ADRs, vendor calls).",
    rationale: "Known dependencies up front make the ticket order a real execution plan, not a guess.",
  });
  questions.push({
    id: "dod",
    theme: "Definition of Done",
    question:
      "List 4-8 testable pass/fail assertions that gate ship for the whole RC — the shared bar every ticket also clears, distinct from per-ticket acceptance criteria.",
    rationale:
      "The RC-wide Definition of Done is the global ship gate, not a wish list; tickets inherit it on top of their own acceptance criteria.",
  });
  return questions;
}

function renderTaskout(plan: ConfirmedTaskoutPlan, today: string): string {
  const lines: string[] = [];
  const status =
    plan.overrides.find((o) => o.changedFields.includes("status-downgrade"))
      ? plan.rc.status
      : plan.rc.status;

  lines.push(`# ${plan.rc.kind === "release-candidate" ? "MRC" : "M"}${plan.rc.milestone} — ${plan.rc.name}`);
  lines.push(`Status: ${status}`);
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
  } else {
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
  } else {
    for (const goal of plan.goals) {
      lines.push(`- ${goal}`);
    }
  }
  lines.push("");
  lines.push("## Targeted");
  if (plan.targeted.length === 0) {
    lines.push("(none provided)");
    lines.push("");
  } else {
    for (const sub of plan.targeted) {
      lines.push(`### ${sub.heading}`);
      for (const item of sub.items) {
        lines.push(`- [${item.checked ? "x" : " "}] ${item.text}`);
        if (item.dod && item.dod.length > 0) {
          for (const criterion of item.dod) {
            lines.push(`  - AC: ${criterion}`);
          }
        }
      }
      lines.push("");
    }
  }
  lines.push("## Blockers & Dependencies");
  if (plan.blockersAndDeps.length === 0) {
    lines.push("- None identified.");
  } else {
    for (const blocker of plan.blockersAndDeps) {
      lines.push(`- **${blocker.kind}**: ${blocker.item}`);
    }
  }
  lines.push("");
  lines.push("## References");
  if (plan.references.length === 0) {
    lines.push("- (none)");
  } else {
    for (const ref of plan.references) {
      lines.push(`- ${ref}`);
    }
  }
  lines.push("");
  return lines.join("\n") + "\n";
}

function sameArray(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].trim() !== b[i].trim()) return false;
  }
  return true;
}

function sameTargeted(
  a: ConfirmedTaskoutPlan["targeted"],
  b: ConfirmedTaskoutPlan["targeted"],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i].heading !== b[i].heading) return false;
    if (a[i].items.length !== b[i].items.length) return false;
    for (let j = 0; j < a[i].items.length; j += 1) {
      if (a[i].items[j].text.trim() !== b[i].items[j].text.trim()) return false;
    }
  }
  return true;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function withDraftSuffix(absPath: string): string {
  const dir = path.dirname(absPath);
  const base = path.basename(absPath);
  return path.join(dir, base.replace(/\.md$/i, ".draft.md"));
}

async function fileExists(target: string): Promise<boolean> {
  try {
    const info = await stat(target);
    return info.isFile();
  } catch {
    return false;
  }
}

async function dirExists(target: string): Promise<boolean> {
  try {
    const info = await stat(target);
    return info.isDirectory();
  } catch {
    return false;
  }
}
