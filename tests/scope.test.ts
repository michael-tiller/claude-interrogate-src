import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ROADMAP_CONFIG } from "../src/roadmap-config.js";
import {
  ScopeError,
  analyzeScope,
  detectCycles,
  generateScope,
} from "../src/scope.js";
import { ConfirmedScopePlan, RCMetadata } from "../src/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeProjectDir(): Promise<{ root: string; docsDir: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-scope-"));
  tempDirs.push(root);
  const docsDir = path.join(root, "docs");
  await mkdir(path.join(docsDir, "Concept"), { recursive: true });
  return { root, docsDir };
}

describe("detectCycles", () => {
  it("returns no cycles for a DAG", () => {
    const edges = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
    ];
    expect(detectCycles(edges)).toEqual([]);
  });

  it("detects a simple cycle", () => {
    const edges = [
      { from: "A", to: "B" },
      { from: "B", to: "C" },
      { from: "C", to: "A" },
    ];
    const cycles = detectCycles(edges);
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain("A");
    expect(cycles[0]).toContain("B");
    expect(cycles[0]).toContain("C");
  });
});

describe("analyzeScope", () => {
  it("refuses when no concept docs are present", async () => {
    const { root, docsDir } = await makeProjectDir();
    await expect(
      analyzeScope({
        docsDir,
        outputDir: root,
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
        configBaseDir: root,
      }),
    ).rejects.toThrow(ScopeError);
  });

  it("proposes one RC per concept doc in bootstrap mode", async () => {
    const { root, docsDir } = await makeProjectDir();
    await writeFile(
      path.join(docsDir, "Concept", "core_loop.md"),
      "# Core Loop\n\nThe loop.\n",
      "utf8",
    );
    await writeFile(
      path.join(docsDir, "Concept", "quests.md"),
      "# Quests\n\nQuest design.\n",
      "utf8",
    );

    const result = await analyzeScope({
      docsDir,
      outputDir: root,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      configBaseDir: root,
    });

    expect(result.mode).toBe("bootstrap");
    expect(result.proposedRCs).toHaveLength(2);
    expect(result.proposedRCs.map((r) => r.name)).toEqual(["CORE_LOOP", "QUESTS"]);
  });

  it("flags higher confidence when cross-ref appears near 'prerequisite' wording", async () => {
    const { root, docsDir } = await makeProjectDir();
    await writeFile(
      path.join(docsDir, "Concept", "quests.md"),
      "# Quests\n\nPrerequisites: [Core Loop](./core_loop.md)\n",
      "utf8",
    );
    await writeFile(
      path.join(docsDir, "Concept", "core_loop.md"),
      "# Core Loop\n",
      "utf8",
    );

    const result = await analyzeScope({
      docsDir,
      outputDir: root,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      configBaseDir: root,
    });

    expect(result.dagCandidates.length).toBeGreaterThan(0);
    const edge = result.dagCandidates.find(
      (c) => c.from.includes("CORE_LOOP") && c.to.includes("QUESTS"),
    );
    expect(edge?.confidence).toBe("high");
  });

  it("switches to maintenance mode when roadmap.md exists", async () => {
    const { root, docsDir } = await makeProjectDir();
    await writeFile(
      path.join(docsDir, "Concept", "core_loop.md"),
      "# Core Loop\n",
      "utf8",
    );
    await writeFile(path.join(root, "roadmap.md"), "# Roadmap\n", "utf8");

    const result = await analyzeScope({
      docsDir,
      outputDir: root,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      configBaseDir: root,
    });

    expect(result.mode).toBe("maintenance");
    expect(result.driftSummary).toBeDefined();
  });
});

function buildPlan(rcs: RCMetadata[]): ConfirmedScopePlan {
  return {
    thesis: { text: "Test thesis." },
    minPlayWaypoint: { rcId: rcs[0]?.id ?? "0_2_0_CORE", criterion: "loop testable" },
    rcs,
    edges: [],
    docMappings: [],
    unmappedConcepts: [],
    waypoints: [],
    overrides: [],
  };
}

describe("generateScope", () => {
  it("writes roadmap.md and per-RC stubs in bootstrap mode", async () => {
    const { root } = await makeProjectDir();
    const plan = buildPlan([
      {
        id: "M2_CORE",
        milestone: 2,
        name: "CORE",
        status: "Stub",
        anchors: [{ kind: "Concept", path: "Concept/core_loop.md" }],
        blocks: [],
        blockedBy: [],
      },
    ]);

    const result = await generateScope({
      plan,
      outputDir: root,
      mode: "bootstrap",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: () => new Date("2026-05-28T00:00:00Z"),
    });

    expect(result.paths).toHaveLength(2);
    expect(result.paths[0]).toMatch(/roadmap\.md$/);
    expect(result.paths[1]).toMatch(/M2_CORE\.md$/);

    const index = await readFile(path.join(root, "roadmap.md"), "utf8");
    expect(index).toContain("## Definition of Done");
    expect(index).toContain("## 1.0 Thesis");
    expect(index).toContain("M2");
  });

  it("renders release-candidate RCs with the MRC prefix in filename, id, and roadmap table", async () => {
    const { root } = await makeProjectDir();
    const plan = buildPlan([
      {
        id: "M1_CORE",
        milestone: 1,
        kind: "build",
        name: "CORE",
        status: "Stub",
        anchors: [{ kind: "Concept", path: "Concept/core_loop.md" }],
        blocks: [],
        blockedBy: [],
      },
      {
        id: "MRC1_LAUNCH",
        milestone: 1,
        kind: "release-candidate",
        name: "LAUNCH",
        status: "Stub",
        anchors: [{ kind: "Inline" }],
        blocks: [],
        blockedBy: [],
      },
    ]);

    const result = await generateScope({
      plan,
      outputDir: root,
      mode: "bootstrap",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: () => new Date("2026-05-29T00:00:00Z"),
    });

    // Two RCs → roadmap.md + two stubs.
    expect(result.paths).toHaveLength(3);
    // Build-kind RC uses M prefix in its stub filename.
    expect(result.paths.some((p) => p.endsWith("M1_CORE.md"))).toBe(true);
    // Release-candidate-kind RC uses MRC prefix in its stub filename.
    expect(result.paths.some((p) => p.endsWith("MRC1_LAUNCH.md"))).toBe(true);

    const index = await readFile(path.join(root, "roadmap.md"), "utf8");
    // Roadmap table renders the prefix from kind, not a hardcoded "M".
    expect(index).toContain("| M1 | CORE |");
    expect(index).toContain("| MRC1 | LAUNCH |");

    // The RC stub headers use the prefix too.
    const launchStub = await readFile(
      path.join(root, "Roadmap", "MRC1_LAUNCH.md"),
      "utf8",
    );
    expect(launchStub.startsWith("# MRC1 — LAUNCH")).toBe(true);
  });

  it("writes .draft.md siblings in maintenance mode and never touches originals", async () => {
    const { root } = await makeProjectDir();
    await writeFile(path.join(root, "roadmap.md"), "# Existing roadmap\n", "utf8");
    await mkdir(path.join(root, "Roadmap"));
    await writeFile(
      path.join(root, "Roadmap", "M2_CORE.md"),
      "# Existing CORE\nStatus: Active\n",
      "utf8",
    );

    const plan = buildPlan([
      {
        id: "M2_CORE",
        milestone: 2,
        name: "CORE",
        status: "Active",
        anchors: [{ kind: "Concept", path: "Concept/core_loop.md" }],
        blocks: [],
        blockedBy: [],
      },
    ]);

    const result = await generateScope({
      plan,
      outputDir: root,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: () => new Date("2026-05-28T00:00:00Z"),
    });

    expect(result.paths[0]).toMatch(/roadmap\.draft\.md$/);
    expect(result.paths[1]).toMatch(/M2_CORE\.draft\.md$/);
    const originalIndex = await readFile(path.join(root, "roadmap.md"), "utf8");
    expect(originalIndex).toBe("# Existing roadmap\n");
  });

  it("refuses when the confirmed DAG has a cycle", async () => {
    const { root } = await makeProjectDir();
    const rcs: RCMetadata[] = [
      {
        id: "A",
        milestone: 2,
        name: "A",
        status: "Stub",
        anchors: [{ kind: "Inline" }],
        blocks: [],
        blockedBy: [],
      },
      {
        id: "B",
        milestone: 3,
        name: "B",
        status: "Stub",
        anchors: [{ kind: "Inline" }],
        blocks: [],
        blockedBy: [],
      },
    ];
    const plan: ConfirmedScopePlan = {
      ...buildPlan(rcs),
      edges: [
        { from: "A", to: "B", kind: "blocks", reason: "x" },
        { from: "B", to: "A", kind: "blocks", reason: "y" },
      ],
    };

    await expect(
      generateScope({
        plan,
        outputDir: root,
        mode: "bootstrap",
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toThrow(ScopeError);
  });

  it("enforces shipped-RC lock when changing immutable fields in maintenance", async () => {
    const { root } = await makeProjectDir();
    await writeFile(
      path.join(root, "roadmap.md"),
      [
        "# Existing roadmap",
        "",
        "## Release Candidates",
        "| Milestone | Name | Status | Anchor | Marketing |",
        "|---|---|---|---|---|",
        "| M2 | CORE | Shipped | Concept/core_loop.md | — |",
        "",
      ].join("\n"),
      "utf8",
    );
    await mkdir(path.join(root, "Roadmap"));

    const planChangingShippedAnchor: ConfirmedScopePlan = buildPlan([
      {
        id: "M2_CORE",
        milestone: 2,
        name: "CORE",
        status: "Shipped",
        anchors: [{ kind: "Concept", path: "Concept/other_anchor.md" }],
        blocks: [],
        blockedBy: [],
      },
    ]);

    await expect(
      generateScope({
        plan: planChangingShippedAnchor,
        outputDir: root,
        mode: "maintenance",
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toThrow(/without override/);

    const overridden: ConfirmedScopePlan = {
      ...planChangingShippedAnchor,
      overrides: [
        {
          rcId: "M2_CORE",
          kind: "shipped-lock-bypass",
          changedFields: ["anchors"],
          reason: "anchor doc was renamed; preserving history",
        },
      ],
    };

    const result = await generateScope({
      plan: overridden,
      outputDir: root,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });
    expect(result.paths.some((p) => p.endsWith("roadmap.draft.md"))).toBe(true);
  });
});
