import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ROADMAP_CONFIG } from "../src/roadmap-config.js";
import { exportTaskout, TaskoutError } from "../src/taskout.js";
import { SAMPLE_RC } from "./fixtures.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-taskout-export-"));
  tempDirs.push(dir);
  return dir;
}

async function writeRC(dir: string, filename: string, content: string): Promise<string> {
  await mkdir(path.join(dir, "Roadmap"), { recursive: true });
  const rcPath = path.join(dir, "Roadmap", filename);
  await writeFile(rcPath, content, "utf8");
  return rcPath;
}

describe("exportTaskout", () => {
  it("exports all sections with stable keys and no raw field", async () => {
    const dir = await makeTempDir();
    await writeRC(dir, "M8_QUESTS.md", SAMPLE_RC);

    const result = await exportTaskout({
      rcId: "M8_QUESTS",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    expect(result.rcId).toBe("M8_QUESTS");
    expect(result.milestone).toBe(8);
    expect(result.kind).toBe("build");
    expect(result.name).toBe("QUESTS");
    expect(result.status).toBe("Active");
    expect(result.lastUpdated).toBe("2026-05-12");
    expect(result.theme).toBe("Moodlet-to-quest skeleton pipeline.");
    expect(result.goals).toEqual(["Deterministic generation.", "Dispatch parity."]);
    expect(result.definitionOfDone).toHaveLength(2);
    expect(result.blockersAndDeps).toHaveLength(3);
    expect(result.references).toContain("Concept/quests.md");
    expect((result as Record<string, unknown>).raw).toBeUndefined();

    expect(result.targeted).toHaveLength(2);
    expect(result.targeted[0].key).toBe("M8_QUESTS#moodlet-quest-skeleton");
    expect(result.targeted[1].key).toBe("M8_QUESTS#dispatch");
    expect(result.targeted[0].items[1].checked).toBe(true);
    for (const section of result.targeted) {
      for (const item of section.items) {
        expect(item.key).toMatch(/^M8_QUESTS#[a-z0-9-]+#[0-9a-f]{12}$/);
      }
    }
  });

  it("resolves release-candidate filenames from MRC-prefixed ids", async () => {
    const dir = await makeTempDir();
    await writeRC(dir, "MRC1_LAUNCH.md", SAMPLE_RC.replace("# Sample M8 — QUESTS", "# MRC1 — LAUNCH"));

    const result = await exportTaskout({
      rcId: "MRC1_LAUNCH",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    expect(result.kind).toBe("release-candidate");
    expect(result.milestone).toBe(1);
    expect(result.name).toBe("LAUNCH");
    expect(result.path.endsWith("MRC1_LAUNCH.md")).toBe(true);
  });

  it("rejects invalid rc ids", async () => {
    const dir = await makeTempDir();
    await expect(
      exportTaskout({
        rcId: "0_8_0_QUESTS",
        outputDir: dir,
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toThrow();
  });

  it("throws rc-file-not-found for a missing RC file", async () => {
    const dir = await makeTempDir();
    await mkdir(path.join(dir, "Roadmap"), { recursive: true });
    await expect(
      exportTaskout({
        rcId: "M9_NOPE",
        outputDir: dir,
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toMatchObject({ code: "rc-file-not-found" });
  });

  it("derives identical item keys regardless of whitespace shape", async () => {
    const dir = await makeTempDir();
    await writeRC(dir, "M8_QUESTS.md", SAMPLE_RC);
    const first = await exportTaskout({
      rcId: "M8_QUESTS",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    await writeRC(
      dir,
      "M8_QUESTS.md",
      SAMPLE_RC.replace(
        "- [ ] Salience threshold drives generation",
        "- [ ] Salience   threshold  drives generation",
      ),
    );
    const second = await exportTaskout({
      rcId: "M8_QUESTS",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    expect(second.targeted[0].items[0].key).toBe(first.targeted[0].items[0].key);
    expect(second.targeted[0].items[0].text).not.toBe(first.targeted[0].items[0].text);
  });

  it("disambiguates duplicate headings, duplicate items, and empty slugs deterministically", async () => {
    const dir = await makeTempDir();
    const rc = `# M3 — DUPES
Status: Active

## Definition of Done
- [ ] Ships.

## Theme
Duplicates everywhere.

## Goals
- Survive duplication.

## Targeted
### Dispatch
- [ ] Refactor the thing
- [ ] Refactor the thing
- [x] Refactor the thing

### Dispatch
- [ ] Other work

### ???
- [ ] Punctuation-only heading

## Blockers & Dependencies
- None identified.

## References
- (none)
`;
    await writeRC(dir, "M3_DUPES.md", rc);

    const exportOnce = () =>
      exportTaskout({ rcId: "M3_DUPES", outputDir: dir, roadmapConfig: DEFAULT_ROADMAP_CONFIG });
    const first = await exportOnce();
    const second = await exportOnce();

    expect(first.targeted.map((t) => t.key)).toEqual([
      "M3_DUPES#dispatch",
      "M3_DUPES#dispatch-2",
      "M3_DUPES#section",
    ]);

    const dupKeys = first.targeted[0].items.map((i) => i.key);
    expect(new Set(dupKeys).size).toBe(3);
    expect(second.targeted.map((t) => t.items.map((i) => i.key))).toEqual(
      first.targeted.map((t) => t.items.map((i) => i.key)),
    );
  });

  it("honors a custom rcNamingScheme", async () => {
    const dir = await makeTempDir();
    await writeRC(dir, "M8-QUESTS.md", SAMPLE_RC);

    const result = await exportTaskout({
      rcId: "M8_QUESTS",
      outputDir: dir,
      roadmapConfig: { ...DEFAULT_ROADMAP_CONFIG, rcNamingScheme: "{prefix}{milestone}-{NAME}.md" },
    });

    expect(result.path.endsWith("M8-QUESTS.md")).toBe(true);
    expect(result.status).toBe("Active");
  });

  it("is a TaskoutError with a stable code on parse-level failures", async () => {
    const dir = await makeTempDir();
    await mkdir(path.join(dir, "Roadmap"), { recursive: true });
    try {
      await exportTaskout({
        rcId: "M9_NOPE",
        outputDir: dir,
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(TaskoutError);
    }
  });
});

describe("exportTaskout per-item DOD", () => {
  const RC_WITH_DOD = `# M3 — DODTEST
Status: Active

## Definition of Done
- [ ] Ships.

## Theme
Per-item DOD round-trip.

## Goals
- Capture DOD.

## Targeted
### Dispatch
- [ ] Wire the dispatcher
  - DOD: a colonist accepts a dispatched job
  - DOD: the job completes and is logged
- [ ] Plain item with no DOD

## Blockers & Dependencies
- None identified.

## References
- (none)
`;

  it("attaches DOD sub-bullets to their item, omits dod when none, and keeps keys stable", async () => {
    const dir = await makeTempDir();
    await writeRC(dir, "M3_DODTEST.md", RC_WITH_DOD);

    const result = await exportTaskout({
      rcId: "M3_DODTEST",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    const items = result.targeted[0].items;
    // The `- DOD:` sub-bullets attach to the item they sit under, in order.
    expect(items[0].dod).toEqual([
      "a colonist accepts a dispatched job",
      "the job completes and is logged",
    ]);
    // No DOD authored → the field is absent entirely (not an empty array).
    expect(items[1].dod).toBeUndefined();

    // DOD is a SEPARATE field, never part of the hashed text: stripping the DOD
    // sub-bullets must leave the item's key byte-identical, or the mirror orphans.
    const keyWithDod = items[0].key;
    await writeRC(
      dir,
      "M3_DODTEST.md",
      RC_WITH_DOD.replace("  - DOD: a colonist accepts a dispatched job\n", "").replace(
        "  - DOD: the job completes and is logged\n",
        "",
      ),
    );
    const stripped = await exportTaskout({
      rcId: "M3_DODTEST",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });
    expect(stripped.targeted[0].items[0].dod).toBeUndefined();
    expect(stripped.targeted[0].items[0].key).toBe(keyWithDod);
  });

  it("parses the new `- AC:` token identically to legacy `- DOD:` (dual-parse)", async () => {
    const dir = await makeTempDir();
    // Same fixture as RC_WITH_DOD but authored with the new acceptance-criteria token.
    await writeRC(dir, "M3_ACTEST.md", RC_WITH_DOD.replace(/- DOD:/g, "- AC:"));

    const result = await exportTaskout({
      rcId: "M3_ACTEST",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    // `- AC:` lands in the same `dod` field, in order — proving the parser accepts both.
    expect(result.targeted[0].items[0].dod).toEqual([
      "a colonist accepts a dispatched job",
      "the job completes and is logged",
    ]);
    expect(result.targeted[0].items[1].dod).toBeUndefined();
  });
});
