import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ROADMAP_CONFIG,
  RoadmapConfigError,
  applyRoadmapConfigDefaults,
  loadRoadmapConfig,
  validateRoadmapConfig,
} from "../src/roadmap-config.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-roadmap-config-"));
  tempDirs.push(dir);
  return dir;
}

describe("applyRoadmapConfigDefaults", () => {
  it("returns the generic default when no overrides are provided", () => {
    const config = applyRoadmapConfigDefaults(undefined);
    expect(config.indexFile).toBe(DEFAULT_ROADMAP_CONFIG.indexFile);
    expect(config.rcDir).toBe(DEFAULT_ROADMAP_CONFIG.rcDir);
    expect(config.reservedSlots).toEqual([]);
    expect(config.marketingWaypoints).toEqual([]);
  });

  it("merges partial overrides on top of defaults", () => {
    const config = applyRoadmapConfigDefaults({ indexFile: "ROADMAP.md" });
    expect(config.indexFile).toBe("ROADMAP.md");
    expect(config.rcDir).toBe(DEFAULT_ROADMAP_CONFIG.rcDir);
  });

  it("allows techDebtFile to be explicitly nulled out", () => {
    const config = applyRoadmapConfigDefaults({ techDebtFile: null });
    expect(config.techDebtFile).toBeNull();
  });
});

describe("validateRoadmapConfig", () => {
  it("rejects a non-integer reserved-slot milestone", () => {
    expect(() =>
      validateRoadmapConfig({
        ...DEFAULT_ROADMAP_CONFIG,
        reservedSlots: [{ milestone: 1.5 as unknown as number, purpose: "broken" }],
      }),
    ).toThrow(RoadmapConfigError);
  });

  it("rejects duplicate reserved-slot milestones", () => {
    expect(() =>
      validateRoadmapConfig({
        ...DEFAULT_ROADMAP_CONFIG,
        reservedSlots: [
          { milestone: 99, purpose: "first" },
          { milestone: 99, purpose: "second" },
        ],
      }),
    ).toThrow(RoadmapConfigError);
  });

  it("rejects a naming scheme missing {NAME}", () => {
    expect(() =>
      validateRoadmapConfig({
        ...DEFAULT_ROADMAP_CONFIG,
        rcNamingScheme: "M{milestone}.md",
      }),
    ).toThrow(RoadmapConfigError);
  });

  it("rejects a naming scheme not ending in .md", () => {
    expect(() =>
      validateRoadmapConfig({
        ...DEFAULT_ROADMAP_CONFIG,
        rcNamingScheme: "M{milestone}_{NAME}",
      }),
    ).toThrow(RoadmapConfigError);
  });

  it("rejects an absolute indexFile", () => {
    expect(() =>
      validateRoadmapConfig({
        ...DEFAULT_ROADMAP_CONFIG,
        indexFile: "/roadmap.md",
      }),
    ).toThrow(RoadmapConfigError);
  });

  it("rejects an rcDir with parent traversal", () => {
    expect(() =>
      validateRoadmapConfig({
        ...DEFAULT_ROADMAP_CONFIG,
        rcDir: "../Roadmap",
      }),
    ).toThrow(RoadmapConfigError);
  });
});

describe("loadRoadmapConfig", () => {
  it("returns defaults when no config exists", async () => {
    const cwd = await makeTempDir();
    const loaded = await loadRoadmapConfig(cwd);
    expect(loaded.config.indexFile).toBe(DEFAULT_ROADMAP_CONFIG.indexFile);
    expect(loaded.configBaseDir).toBe(cwd);
    expect(loaded.configPath).toBeNull();
  });

  it("reads and validates the roadmap block when present", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      path.join(cwd, "claude-interrogate.json"),
      JSON.stringify(
        {
          docsDir: "./Documentation",
          roadmap: {
            indexFile: "ROADMAP.md",
            techDebtFile: null,
          },
        },
        null,
        2,
      ),
      "utf8",
    );

    const loaded = await loadRoadmapConfig(cwd);
    expect(loaded.config.indexFile).toBe("ROADMAP.md");
    expect(loaded.config.techDebtFile).toBeNull();
    expect(loaded.config.rcDir).toBe(DEFAULT_ROADMAP_CONFIG.rcDir);
    expect(loaded.configBaseDir).toBe(cwd);
  });

  it("throws when the roadmap block is invalid", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      path.join(cwd, "claude-interrogate.json"),
      JSON.stringify({ roadmap: { indexFile: "/etc/passwd" } }, null, 2),
      "utf8",
    );

    await expect(loadRoadmapConfig(cwd)).rejects.toThrow(RoadmapConfigError);
  });
});
