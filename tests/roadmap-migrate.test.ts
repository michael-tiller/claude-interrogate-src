import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { renderRCFilename, validateNamingScheme, PathSafetyError } from "../src/path-safety.js";
import { DEFAULT_ROADMAP_CONFIG } from "../src/roadmap-config.js";
import { migrateRoadmap, RoadmapMigrateError } from "../src/roadmap-migrate.js";
import { parseRoadmapIndex } from "../src/roadmap-parse.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-migrate-"));
  tempDirs.push(dir);
  return dir;
}

// Dirigible2D-style RC file: zero-padded name, [~] partial markers, a
// numbered checklist, and a status outside the {Stub, Active, Shipped} set.
const DIRIGIBLE_STYLE_RC = `# M01 — CORE
Status: Complete

## DOD
1. [ ] Numbered item the parser cannot see
2. [~] Another one

## Targeted
### Core Work
- [x] Done thing
- [~] Half-done thing
- [ ] Open thing
`;

const PLAIN_RC = `# M2 — DRAINS
Status: Active

## Targeted
- [ ] Pipe the water
`;

async function seedRoadmapDir(dir: string): Promise<void> {
  await mkdir(path.join(dir, "Roadmap"), { recursive: true });
  await writeFile(path.join(dir, "Roadmap", "M01_CORE.md"), DIRIGIBLE_STYLE_RC, "utf8");
  await writeFile(path.join(dir, "Roadmap", "M02_DRAINS.md"), PLAIN_RC, "utf8");
  await writeFile(path.join(dir, "Roadmap", "TECHNICAL_DEBT.md"), "# Technical Debt\n", "utf8");
  await writeFile(path.join(dir, "Roadmap", "SYSTEMS_INDEX.md"), "# Systems\n", "utf8");
}

describe("zero-padded naming scheme", () => {
  it("renders {milestone:02} with padding and accepts it in validation", () => {
    const scheme = "{prefix}{milestone:02}_{NAME}.md";
    validateNamingScheme(scheme);
    expect(renderRCFilename(scheme, { milestone: 1, name: "CORE" })).toBe("M01_CORE.md");
    expect(renderRCFilename(scheme, { milestone: 19, name: "RELEASE_READINESS" })).toBe(
      "M19_RELEASE_READINESS.md",
    );
    expect(
      renderRCFilename(scheme, { milestone: 1, name: "LAUNCH", kind: "release-candidate" }),
    ).toBe("MRC01_LAUNCH.md");
  });

  it("rejects malformed pad placeholders and still rejects unknown ones", () => {
    expect(() => validateNamingScheme("{prefix}{milestone:0}_{NAME}.md")).toThrow(PathSafetyError);
    expect(() => validateNamingScheme("{prefix}{milestone:2}_{NAME}.md")).toThrow(PathSafetyError);
    expect(() => validateNamingScheme("{prefix}{foo}_{NAME}.md")).toThrow(PathSafetyError);
    expect(() => validateNamingScheme("{prefix}{NAME}.md")).toThrow(/milestone/);
  });
});

describe("migrateRoadmap", () => {
  it("scans RC-shaped files only, detects padding, markers, numbered lists, and odd statuses", async () => {
    const dir = await makeTempDir();
    await seedRoadmapDir(dir);

    const result = await migrateRoadmap({
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: () => new Date("2026-06-11T12:00:00Z"),
    });

    expect(result.mode).toBe("dry-run");
    expect(result.files.map((f) => f.filename)).toEqual(["M01_CORE.md", "M02_DRAINS.md"]);
    expect(result.files[0].rcId).toBe("M1_CORE");
    expect(result.files[0].status).toBe("Complete");
    expect(result.paddingDetected).toBe(true);
    expect(result.suggestedNamingScheme).toBe("{prefix}{milestone:02}_{NAME}.md");
    expect(result.files[0].nonstandardMarkers).toHaveLength(1);
    expect(result.files[0].numberedChecklistLines).toHaveLength(2);
    expect(result.warnings.join("\n")).toMatch(/Complete/);
    expect(result.warnings.join("\n")).toMatch(/numbered checklist/);
    expect(result.warnings.join("\n")).toMatch(/normalize_markers/);
    expect(result.warnings.join("\n")).toMatch(/M02_DRAINS\.md: 1 Targeted checkbox/);
  });

  it("generates an index that round-trips through parseRoadmapIndex", async () => {
    const dir = await makeTempDir();
    await seedRoadmapDir(dir);

    const result = await migrateRoadmap({
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      apply: true,
      clock: () => new Date("2026-06-11T12:00:00Z"),
    });

    expect(result.mode).toBe("applied");
    const parsed = await parseRoadmapIndex(result.indexPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.rcRows.map((r) => r.milestone)).toEqual([1, 2]);
    expect(parsed!.rcRows[0].name).toBe("CORE");
    expect(parsed!.rcRows[0].status).toBe("Complete");
  });

  it("never overwrites an existing index, but still normalizes markers on apply", async () => {
    const dir = await makeTempDir();
    await seedRoadmapDir(dir);
    await writeFile(path.join(dir, "roadmap.md"), "# Existing\n", "utf8");

    const result = await migrateRoadmap({
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      apply: true,
      normalizeMarkers: true,
    });

    expect(await readFile(path.join(dir, "roadmap.md"), "utf8")).toBe("# Existing\n");
    expect(result.warnings.join("\n")).toMatch(/left untouched/);
    expect(result.markersNormalized).toBe(1);
  });

  it("normalizes nonstandard dash markers on apply, leaving x/space and numbered lines alone", async () => {
    const dir = await makeTempDir();
    await seedRoadmapDir(dir);

    const result = await migrateRoadmap({
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      apply: true,
      normalizeMarkers: true,
    });

    expect(result.markersNormalized).toBe(1);
    const rewritten = await readFile(path.join(dir, "Roadmap", "M01_CORE.md"), "utf8");
    expect(rewritten).toContain("- [ ] Half-done thing");
    expect(rewritten).toContain("- [x] Done thing");
    expect(rewritten).toContain("2. [~] Another one");
  });

  it("errors cleanly on a missing RC dir or an empty one", async () => {
    const dir = await makeTempDir();
    await expect(
      migrateRoadmap({ outputDir: dir, roadmapConfig: DEFAULT_ROADMAP_CONFIG }),
    ).rejects.toMatchObject({ code: "no-rc-dir" });

    await mkdir(path.join(dir, "Roadmap"), { recursive: true });
    await expect(
      migrateRoadmap({ outputDir: dir, roadmapConfig: DEFAULT_ROADMAP_CONFIG }),
    ).rejects.toMatchObject({ code: "no-rc-files" });
  });

  it("parses dirigible-style indexes and bold status labels (tolerance pass)", async () => {
    const dir = await makeTempDir();
    const index = `# Dirigible2D Roadmap

## 1.0 Promise

Per [gdd](./Concept/gdd.md): the thesis.

## MIN PLAY definition

RC: M08_DUNGEONS. Criterion: self-sustaining 20-colonist run.

## Milestone Sequence (effort-gated, not time-gated)

| #   | File | Theme | MRC Stage |
|-----|------|-------|-----------|
| M01 | \`Roadmap/M01_CORE.md\` | Foundation | Shipped 2026-05-12 |
| M02 | \`Roadmap/M02_CRAFTING.md\` | Crafting | **Active** |
| — | — | MIN PLAY here | **MVP** |
| M03 | \`Roadmap/M03_COLONY.md\` | Colony | Pre-MVP |
`;
    const indexPath = path.join(dir, "roadmap.md");
    await writeFile(indexPath, index, "utf8");

    const parsed = await parseRoadmapIndex(indexPath);
    expect(parsed).not.toBeNull();
    expect(parsed!.thesis?.anchorDoc).toBe("./Concept/gdd.md");
    expect(parsed!.minPlayWaypoint?.rcId).toBe("M08_DUNGEONS");
    expect(parsed!.rcRows.map((r) => [r.milestone, r.name, r.status])).toEqual([
      [1, "CORE", "Shipped"],
      [2, "CRAFTING", "Active"],
      [3, "COLONY", "Pre-MVP"],
    ]);

    await mkdir(path.join(dir, "Roadmap"), { recursive: true });
    const boldRC = `# Dirigible2D M04 — Classes & Skills

**Status**: Active — M03 closed; this is the current milestone.
**Last Updated**: 2026-06-11

## Targeted
### Work
- [ ] A thing
`;
    await writeFile(path.join(dir, "Roadmap", "M04_CLASSES.md"), boldRC, "utf8");
    const result = await migrateRoadmap({ outputDir: dir, roadmapConfig: DEFAULT_ROADMAP_CONFIG });
    expect(result.files[0].status).toMatch(/^Active — M03 closed/);
  });

  it("export resolves zero-padded filenames once the suggested scheme is configured", async () => {
    const dir = await makeTempDir();
    await seedRoadmapDir(dir);
    const { exportTaskout } = await import("../src/taskout.js");

    const result = await exportTaskout({
      rcId: "M1_CORE",
      outputDir: dir,
      roadmapConfig: {
        ...DEFAULT_ROADMAP_CONFIG,
        rcNamingScheme: "{prefix}{milestone:02}_{NAME}.md",
      },
    });
    expect(result.path.endsWith("M01_CORE.md")).toBe(true);
    expect(result.targeted[0].items.map((i) => i.checked)).toEqual([true, false]);
  });
});
