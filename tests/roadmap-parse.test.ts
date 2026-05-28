import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseRCFile, parseRoadmapIndex, parseTechDebt } from "../src/roadmap-parse.js";

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
RC: 0_9_0_DUNGEONS. Criterion: core loop testable end-to-end.

## Release Candidates
| Version | Name | Status | Anchor | Marketing |
|---|---|---|---|---|
| 0.2.0 | CORE | Active | Concept/core_loop.md | — |
| 0.8.0 | QUESTS | Stub | Concept/quests.md | Wishlist |
| 1.0.0 | RELEASE_READINESS | Stub | Inline | Launch |

## Prerequisite Chain
- 0_2_0_CORE → 0_4_0_COLONY (foundation)
- 0_4_0_COLONY → 0_8_0_QUESTS (dispatch needs colony)

## Marketing Waypoints
- **Wishlist**: target after 0.5.0. Rationale: visible-progress milestone.
- **Early Access**: target after 0.9.0. Rationale: MIN PLAY reached.
- **Launch**: target at 1.0.0.

## Unmapped Concepts
- \`Concept/research_only.md\` — research-only.
`;

const SAMPLE_RC = `# Sample v0.8.0 — QUESTS
Status: Active
Last Updated: 2026-05-12

## Definition of Done
- [ ] Quest skeleton is deterministic.
- [x] LLM dressing is optional.

## Theme
Moodlet-to-quest skeleton pipeline.

## Goals
- Deterministic generation.
- Dispatch parity.

## Targeted
### Moodlet → Quest Skeleton
- [ ] Salience threshold drives generation
- [x] LLM-optional dressing

### Dispatch
- [ ] Go yourself
- [ ] Lead a squad

## Blockers & Dependencies
- **Upstream RC**: 0_4_0_COLONY — dispatch needs colony
- **Tech Debt**: pathfinding cache (\`Roadmap/TECHNICAL_DEBT.md:42\`)
- **External**: pending ADR-0007

## References
- Concept/quests.md
- Plan/dispatch_quest_plan.md
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
    expect(parsed!.minPlayWaypoint?.rcId).toBe("0_9_0_DUNGEONS");
    expect(parsed!.rcRows.map((row) => row.version)).toEqual(["0.2.0", "0.8.0", "1.0.0"]);
    expect(parsed!.rcRows[0].status).toBe("Active");
    expect(parsed!.rcRows[2].name).toBe("RELEASE_READINESS");
    expect(parsed!.prerequisiteChain).toHaveLength(2);
    expect(parsed!.prerequisiteChain[0].from).toBe("0_2_0_CORE");
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
    const rcPath = path.join(dir, "Roadmap", "0_8_0_QUESTS.md");
    await writeFile(rcPath, SAMPLE_RC, "utf8");

    const parsed = await parseRCFile(rcPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.version).toBe("0.8.0");
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
