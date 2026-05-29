import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  BlockerEntry,
  ParsedRC,
  ParsedRoadmapIndex,
  ParsedRoadmapRCRow,
  ParsedTechDebt,
  ParsedTechDebtItem,
  TargetedSubsection,
} from "./types.js";

const SECTION_ALIASES: Record<string, string[]> = {
  thesis: ["1.0 thesis", "thesis"],
  minPlay: ["min play waypoint", "min play"],
  releaseCandidates: ["release candidates", "rcs"],
  prerequisiteChain: ["prerequisite chain", "prerequisites", "dependency chain"],
  marketingWaypoints: ["marketing waypoints", "waypoints"],
  unmappedConcepts: ["unmapped concepts", "unmapped"],
  definitionOfDone: ["definition of done", "dod"],
  theme: ["theme"],
  goals: ["goals"],
  targeted: ["targeted"],
  blockers: ["blockers & dependencies", "blockers and dependencies", "blockers"],
  references: ["references"],
  outOfScope: ["out of scope", "out-of-scope", "outofscope"],
};

const HEADING_PATTERN = /^(#{1,6})\s+(.+?)\s*$/;
const CHECKBOX_PATTERN = /^- \[( |x|X)\]\s+(.+)$/;
const BULLET_PATTERN = /^- (.+)$/;
const STATUS_PATTERN = /^Status:\s+(.+)$/m;
const LAST_UPDATED_PATTERN = /^Last Updated:\s+(\S.+)$/m;
// Captures the prefix (MRC for release-candidate, M for build) so the parsed RC
// reports the correct kind. MRC is checked first because it's a strict prefix of M.
const RC_HEADER_PATTERN = /^#\s+.*\b(MRC|M)(\d+)\s+—\s+(.+?)\s*$/m;
const BLOCKS_TAG_PATTERN = /`blocks:\s*([^`]+)`/i;
const SEVERITY_TAG_PATTERN = /`severity:\s*([a-z\-]+)`/i;
const TABLE_DIVIDER_PATTERN = /^\s*\|?\s*:?-{2,}.*$/;

export async function parseRoadmapIndex(
  absolutePath: string
): Promise<ParsedRoadmapIndex | null> {
  if (!(await fileExists(absolutePath))) {
    return null;
  }
  const raw = await readFile(absolutePath, "utf8");
  const sections = collectSections(raw);

  return {
    thesis: parseThesis(sections),
    minPlayWaypoint: parseMinPlay(sections),
    rcRows: parseReleaseCandidates(sections),
    prerequisiteChain: parsePrerequisiteChain(sections),
    marketingWaypoints: parseMarketingWaypoints(sections),
    unmappedConcepts: parseUnmappedConcepts(sections),
    raw,
  };
}

export async function parseRCFile(absolutePath: string): Promise<ParsedRC | null> {
  if (!(await fileExists(absolutePath))) {
    return null;
  }
  const raw = await readFile(absolutePath, "utf8");
  const sections = collectSections(raw);

  const headerMatch = raw.match(RC_HEADER_PATTERN);
  const prefix = headerMatch?.[1];
  const milestone = headerMatch?.[2] ? Number.parseInt(headerMatch[2], 10) : 0;
  const rawName = headerMatch?.[3] ?? path.basename(absolutePath, ".md");
  const name = normalizeRCNameFromHeader(rawName);
  const kind: "build" | "release-candidate" =
    prefix === "MRC" ? "release-candidate" : "build";

  const status = raw.match(STATUS_PATTERN)?.[1]?.trim() ?? "Stub";
  const lastUpdated = raw.match(LAST_UPDATED_PATTERN)?.[1]?.trim();

  return {
    path: absolutePath,
    milestone,
    kind,
    name,
    status,
    lastUpdated,
    theme: getSectionBody(sections, "theme")?.trim() || undefined,
    goals: collectBullets(getSectionBody(sections, "goals")),
    targeted: parseTargeted(sections),
    blockersAndDeps: parseBlockers(getSectionBody(sections, "blockers")),
    definitionOfDone: collectChecklistItems(getSectionBody(sections, "definitionOfDone")),
    references: collectBullets(getSectionBody(sections, "references")),
    raw,
  };
}

export async function parseTechDebt(absolutePath: string): Promise<ParsedTechDebt | null> {
  if (!(await fileExists(absolutePath))) {
    return null;
  }
  const raw = await readFile(absolutePath, "utf8");
  const lines = raw.split(/\r?\n/);
  const items: ParsedTechDebtItem[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const checkbox = line.match(CHECKBOX_PATTERN);
    if (!checkbox) {
      continue;
    }

    const body = checkbox[2];
    const blocksMatch = body.match(BLOCKS_TAG_PATTERN);
    const severityMatch = body.match(SEVERITY_TAG_PATTERN);
    const blocks = blocksMatch
      ? blocksMatch[1]
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    items.push({
      text: body.trim(),
      blocks,
      severity: severityMatch?.[1],
      sourceLine: i + 1,
    });
  }

  return { path: absolutePath, items };
}

interface SectionMap {
  byKey: Map<string, string>;
  raw: string;
}

function collectSections(raw: string): SectionMap {
  const lines = raw.split(/\r?\n/);
  const byKey = new Map<string, string>();

  let currentKey: string | null = null;
  let currentLevel = 0;
  let buffer: string[] = [];

  const flush = (): void => {
    if (currentKey !== null) {
      byKey.set(currentKey, buffer.join("\n").trim());
    }
    buffer = [];
  };

  for (const line of lines) {
    const headingMatch = line.match(HEADING_PATTERN);
    if (headingMatch) {
      const level = headingMatch[1].length;

      if (level === 1) {
        flush();
        currentKey = null;
        currentLevel = 0;
        continue;
      }

      if (currentKey === null || level <= currentLevel) {
        flush();
        currentKey = resolveSectionKey(headingMatch[2]);
        currentLevel = level;
        continue;
      }
      buffer.push(line);
      continue;
    }
    if (currentKey !== null) {
      buffer.push(line);
    }
  }
  flush();

  return { byKey, raw };
}

function resolveSectionKey(heading: string): string {
  const normalized = heading.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(SECTION_ALIASES)) {
    if (aliases.includes(normalized)) {
      return key;
    }
  }
  return `__${normalized}`;
}

function getSectionBody(sections: SectionMap, key: string): string | undefined {
  return sections.byKey.get(key);
}

function parseThesis(sections: SectionMap): ParsedRoadmapIndex["thesis"] {
  const body = getSectionBody(sections, "thesis");
  if (!body) {
    return null;
  }
  const anchorMatch = body.match(/\[([^\]]+)\]\(([^)]+\.md)\)/);
  return { text: body.trim(), anchorDoc: anchorMatch?.[2] };
}

function parseMinPlay(sections: SectionMap): ParsedRoadmapIndex["minPlayWaypoint"] {
  const body = getSectionBody(sections, "minPlay");
  if (!body) {
    return null;
  }
  const rcMatch = body.match(/RC:\s*([A-Z0-9_]+)/i);
  const criterionMatch = body.match(/Criterion:\s*(.+)/i);
  if (!rcMatch) {
    return null;
  }
  return { rcId: rcMatch[1], criterion: criterionMatch?.[1]?.trim() ?? "" };
}

function parseReleaseCandidates(sections: SectionMap): ParsedRoadmapRCRow[] {
  const body = getSectionBody(sections, "releaseCandidates");
  if (!body) {
    return [];
  }
  const rows: ParsedRoadmapRCRow[] = [];
  const lines = body.split(/\r?\n/);
  let inTable = false;
  let columnIndex: Record<string, number> = {};

  for (const line of lines) {
    if (!line.trim().startsWith("|")) {
      inTable = false;
      continue;
    }
    if (TABLE_DIVIDER_PATTERN.test(line)) {
      inTable = true;
      continue;
    }
    const cells = parseTableRow(line);
    if (!inTable) {
      cells.forEach((cell, idx) => {
        columnIndex[cell.toLowerCase()] = idx;
      });
      continue;
    }
    const milestoneCell = cells[columnIndex.milestone] ?? "";
    // Match MRC (release-candidate kind) before M (build kind) since MRC is a
    // strict prefix of M. The bare-digit fallback exists for forward-compat with
    // any roadmap that omits the prefix; treats it as build.
    const milestoneMatch = milestoneCell.match(/^(MRC|M)?(\d+)$/);
    if (!milestoneMatch) {
      continue;
    }
    const milestoneKind: "build" | "release-candidate" =
      milestoneMatch[1] === "MRC" ? "release-candidate" : "build";
    rows.push({
      milestone: Number.parseInt(milestoneMatch[2], 10),
      kind: milestoneKind,
      name: cells[columnIndex.name] ?? "",
      status: cells[columnIndex.status] ?? "",
      anchor: cells[columnIndex.anchor],
      marketing: cells[columnIndex.marketing],
    });
  }

  return rows;
}

function parseTableRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function parsePrerequisiteChain(
  sections: SectionMap
): { from: string; to: string; reason?: string }[] {
  const body = getSectionBody(sections, "prerequisiteChain");
  if (!body) {
    return [];
  }
  const edges: { from: string; to: string; reason?: string }[] = [];
  for (const line of body.split(/\r?\n/)) {
    const bullet = line.match(BULLET_PATTERN);
    if (!bullet) {
      continue;
    }
    const arrow = bullet[1].match(/^([A-Za-z0-9_]+)\s*(?:→|->)\s*([A-Za-z0-9_]+)\s*(?:\((.+)\))?/);
    if (arrow) {
      edges.push({ from: arrow[1], to: arrow[2], reason: arrow[3]?.trim() });
    }
  }
  return edges;
}

function parseMarketingWaypoints(
  sections: SectionMap
): { name: string; targetRC?: string; rationale?: string }[] {
  const body = getSectionBody(sections, "marketingWaypoints");
  if (!body) {
    return [];
  }
  const waypoints: { name: string; targetRC?: string; rationale?: string }[] = [];
  for (const line of body.split(/\r?\n/)) {
    const bullet = line.match(/^- \*\*([^*]+)\*\*:\s*(.+)$/);
    if (!bullet) {
      continue;
    }
    const name = bullet[1].trim();
    const rest = bullet[2].trim();
    const rcMatch = rest.match(/(?:after|at|target(?:\s+at)?)\s+([A-Za-z0-9_\.]+)/i);
    const rationaleMatch = rest.match(/Rationale:\s*(.+)$/i);
    waypoints.push({
      name,
      targetRC: rcMatch?.[1],
      rationale: rationaleMatch?.[1]?.trim(),
    });
  }
  return waypoints;
}

function parseUnmappedConcepts(
  sections: SectionMap
): { docPath: string; reason?: string }[] {
  const body = getSectionBody(sections, "unmappedConcepts");
  if (!body) {
    return [];
  }
  const items: { docPath: string; reason?: string }[] = [];
  for (const line of body.split(/\r?\n/)) {
    const bullet = line.match(/^- `([^`]+)`(?:\s*—\s*(.+))?$/);
    if (!bullet) {
      continue;
    }
    items.push({ docPath: bullet[1], reason: bullet[2]?.trim() });
  }
  return items;
}

function normalizeRCNameFromHeader(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_]/g, "");
}

function collectBullets(body: string | undefined): string[] {
  if (!body) {
    return [];
  }
  const bullets: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^- (.+)$/);
    if (match) {
      bullets.push(match[1].trim());
    }
  }
  return bullets;
}

function collectChecklistItems(body: string | undefined): string[] {
  if (!body) {
    return [];
  }
  const items: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(CHECKBOX_PATTERN);
    if (match) {
      items.push(match[2].trim());
    }
  }
  return items;
}

function parseTargeted(sections: SectionMap): TargetedSubsection[] {
  const body = getSectionBody(sections, "targeted");
  if (!body) {
    return [];
  }
  const lines = body.split(/\r?\n/);
  const subsections: TargetedSubsection[] = [];
  let current: TargetedSubsection | null = null;

  for (const line of lines) {
    const heading = line.match(/^###\s+(.+?)\s*$/);
    if (heading) {
      if (current) {
        subsections.push(current);
      }
      current = { heading: heading[1].trim(), items: [] };
      continue;
    }
    const checkbox = line.match(CHECKBOX_PATTERN);
    if (checkbox && current) {
      const checked = checkbox[1].toLowerCase() === "x";
      current.items.push({ text: checkbox[2].trim(), checked });
    }
  }
  if (current) {
    subsections.push(current);
  }
  return subsections;
}

function parseBlockers(body: string | undefined): BlockerEntry[] {
  if (!body) {
    return [];
  }
  const entries: BlockerEntry[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^- \*\*([^*]+)\*\*:\s*(.+)$/);
    if (!match) {
      continue;
    }
    const kindRaw = match[1].trim();
    const item = match[2].trim();
    const kind = normalizeBlockerKind(kindRaw);
    if (!kind) {
      continue;
    }
    const sourceMatch = item.match(/`([^`]+):(\d+)`/);
    entries.push({
      kind,
      item,
      sourcePath: sourceMatch?.[1],
      sourceLine: sourceMatch ? Number(sourceMatch[2]) : undefined,
    });
  }
  return entries;
}

function normalizeBlockerKind(raw: string): BlockerEntry["kind"] | null {
  const lower = raw.toLowerCase();
  if (lower === "upstream rc" || lower === "upstream") return "Upstream RC";
  if (lower === "tech debt" || lower === "technical debt") return "Tech Debt";
  if (lower === "external") return "External";
  return null;
}

async function fileExists(target: string): Promise<boolean> {
  try {
    const info = await stat(target);
    return info.isFile();
  } catch {
    return false;
  }
}
