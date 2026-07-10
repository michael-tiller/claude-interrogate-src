import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseRCFile, parseRoadmapIndex, parseTechDebt } from "../src/roadmap-parse.js";
import { SAMPLE_RC } from "./fixtures.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-roadmap-parse-"));
  tempDirs.push(dir);
  return dir;
}

const SAMPLE_INDEX = `# Sample Project Roadmap

## Definition of Done
- [ ] Every concept doc is mapped.

## 1.0 Thesis
The project anchors on [core_loop.md](./Concept/core_loop.md).

## MIN PLAY Waypoint
RC: M9_DUNGEONS. Criterion: core loop testable end-to-end.

## Release Candidates
| Milestone | Name | Status | Anchor | Marketing |
|---|---|---|---|---|
| M2 | CORE | Active | Concept/core_loop.md | — |
| M8 | QUESTS | Stub | Concept/quests.md | Wishlist |
| M10 | RELEASE_READINESS | Stub | Inline | Launch |

## Prerequisite Chain
- M2_CORE → M4_COLONY (foundation)
- M4_COLONY → M8_QUESTS (dispatch needs colony)

## Marketing Waypoints
- **Wishlist**: target at M5. Rationale: visible-progress milestone.
- **Early Access**: target at M9. Rationale: MIN PLAY reached.
- **Launch**: target at M10.

## Unmapped Concepts
- \`Concept/research_only.md\` — research-only.
`;

const SAMPLE_TECH_DEBT = `# Technical Debt

- [ ] Pathfinding cache invalidation on chunk unload. \`blocks: 0_7_0_COMBAT\`. \`severity: high\`.
- [ ] Save-format truncation wiring. \`blocks: 1_0_0_RELEASE_READINESS, 0_8_0_QUESTS\`.
- [ ] Untagged item with no blocks tag.
`;

describe("parseRoadmapIndex", () => {
  it("returns null when the file does not exist", async () => {
    const dir = await makeTempDir();
    const result = await parseRoadmapIndex(path.join(dir, "roadmap.md"));
    expect(result).toBeNull();
  });

  it("extracts thesis, MIN PLAY, RC rows, prerequisites, waypoints, and unmapped concepts", async () => {
    const dir = await makeTempDir();
    const indexPath = path.join(dir, "roadmap.md");
    await writeFile(indexPath, SAMPLE_INDEX, "utf8");

    const parsed = await parseRoadmapIndex(indexPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.thesis?.anchorDoc).toBe("./Concept/core_loop.md");
    expect(parsed!.minPlayWaypoint?.rcId).toBe("M9_DUNGEONS");
    expect(parsed!.rcRows.map((row) => row.milestone)).toEqual([2, 8, 10]);
    expect(parsed!.rcRows[0].status).toBe("Active");
    expect(parsed!.rcRows[2].name).toBe("RELEASE_READINESS");
    expect(parsed!.prerequisiteChain).toHaveLength(2);
    expect(parsed!.prerequisiteChain[0].from).toBe("M2_CORE");
    expect(parsed!.marketingWaypoints.map((w) => w.name)).toEqual([
      "Wishlist",
      "Early Access",
      "Launch",
    ]);
    expect(parsed!.unmappedConcepts).toEqual([
      { docPath: "Concept/research_only.md", reason: "research-only." },
    ]);
  });

  it("is tolerant of missing sections", async () => {
    const dir = await makeTempDir();
    const indexPath = path.join(dir, "roadmap.md");
    await writeFile(indexPath, "# Empty Roadmap\n\nNothing here.\n", "utf8");

    const parsed = await parseRoadmapIndex(indexPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.thesis).toBeNull();
    expect(parsed!.minPlayWaypoint).toBeNull();
    expect(parsed!.rcRows).toEqual([]);
  });
});

describe("parseRCFile", () => {
  it("extracts status, DoD, targeted (with checkbox state), blockers, references", async () => {
    const dir = await makeTempDir();
    await mkdir(path.join(dir, "Roadmap"));
    const rcPath = path.join(dir, "Roadmap", "M8_QUESTS.md");
    await writeFile(rcPath, SAMPLE_RC, "utf8");

    const parsed = await parseRCFile(rcPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.milestone).toBe(8);
    expect(parsed!.name).toBe("QUESTS");
    expect(parsed!.status).toBe("Active");
    expect(parsed!.lastUpdated).toBe("2026-05-12");
    expect(parsed!.definitionOfDone).toHaveLength(2);
    expect(parsed!.goals).toEqual(["Deterministic generation.", "Dispatch parity."]);
    expect(parsed!.targeted).toHaveLength(2);
    expect(parsed!.targeted[0].items[1].checked).toBe(true);
    expect(parsed!.blockersAndDeps).toHaveLength(3);
    const techDebtBlocker = parsed!.blockersAndDeps.find((b) => b.kind === "Tech Debt");
    expect(techDebtBlocker?.sourcePath).toBe("Roadmap/TECHNICAL_DEBT.md");
    expect(techDebtBlocker?.sourceLine).toBe(42);
    expect(parsed!.references).toContain("Concept/quests.md");
  });
});

describe("parseRCFile per-item Blocked-by / Owner", () => {
  // Blocked-by + Owner are Targeted-only sub-bullets: they only parse under a
  // Targeted checkbox item (the only caller of ITEM_SUBSPEC_PATTERN). DoD-list and
  // tech-debt parsing never read them.
  const RC_WITH_BLOCKED = `# M3 — BLOCKTEST
Status: Active

## Definition of Done
- [ ] Ships.

## Theme
Per-ticket blocked-by + owner round-trip.

## Goals
- Capture blockers.

## Targeted
### Dispatch
- [ ] Wire the dispatcher
  - AC: a colonist accepts a dispatched job
  - Blocked-by: M3_BLOCKTEST#dispatch#aaaaaaaaaaaa, M3_BLOCKTEST#dispatch#bbbbbbbbbbbb
  - Owner: Alice
- [ ] Plain item with no blockers

## Blockers & Dependencies
- None identified.

## References
- (none)
`;

  it("comma-splits Blocked-by into a list and keeps Owner a single string, Targeted-only", async () => {
    const dir = await makeTempDir();
    await mkdir(path.join(dir, "Roadmap"));
    const rcPath = path.join(dir, "Roadmap", "M3_BLOCKTEST.md");
    await writeFile(rcPath, RC_WITH_BLOCKED, "utf8");

    const parsed = await parseRCFile(rcPath);
    expect(parsed).not.toBeNull();
    const items = parsed!.targeted[0].items;

    // Blocked-by comma-splits into a list, in author order.
    expect(items[0].blockedBy).toEqual([
      "M3_BLOCKTEST#dispatch#aaaaaaaaaaaa",
      "M3_BLOCKTEST#dispatch#bbbbbbbbbbbb",
    ]);
    // Owner is a single string, not a list.
    expect(items[0].owner).toBe("Alice");

    // No blockers authored → both fields absent (not empty).
    expect(items[1].blockedBy).toBeUndefined();
    expect(items[1].owner).toBeUndefined();

    // The DoD list parser (definitionOfDone) never reads these sub-bullets.
    expect(parsed!.definitionOfDone).toEqual([{ text: "Ships.", checked: false }]);
  });

  it("does not fold Blocked-by / Owner into the hashed item text", async () => {
    const dir = await makeTempDir();
    await mkdir(path.join(dir, "Roadmap"));
    const rcPath = path.join(dir, "Roadmap", "M3_BLOCKTEST.md");
    await writeFile(rcPath, RC_WITH_BLOCKED, "utf8");

    const parsed = await parseRCFile(rcPath);
    // Item text stays the bare checkbox line — sub-bullets live in their own fields.
    expect(parsed!.targeted[0].items[0].text).toBe("Wire the dispatcher");
  });
});

describe("parseTechDebt", () => {
  it("extracts items with blocks tags and preserves source line numbers", async () => {
    const dir = await makeTempDir();
    const debtPath = path.join(dir, "TECHNICAL_DEBT.md");
    await writeFile(debtPath, SAMPLE_TECH_DEBT, "utf8");

    const parsed = await parseTechDebt(debtPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.items).toHaveLength(3);

    const pathfinding = parsed!.items[0];
    expect(pathfinding.blocks).toEqual(["0_7_0_COMBAT"]);
    expect(pathfinding.severity).toBe("high");
    expect(pathfinding.sourceLine).toBe(3);

    const saveFormat = parsed!.items[1];
    expect(saveFormat.blocks).toEqual(["1_0_0_RELEASE_READINESS", "0_8_0_QUESTS"]);

    const untagged = parsed!.items[2];
    expect(untagged.blocks).toEqual([]);
  });
});
