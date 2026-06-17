import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ROADMAP_CONFIG } from "../src/roadmap-config.js";
import {
  TaskoutError,
  analyzeTaskout,
  generateTaskout,
} from "../src/taskout.js";
import { ConfirmedTaskoutPlan, RCMetadata } from "../src/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

interface Project {
  root: string;
  docsDir: string;
}

async function makeProject(): Promise<Project> {
  const root = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-taskout-"));
  tempDirs.push(root);
  const docsDir = path.join(root, "docs");
  await mkdir(path.join(docsDir, "Concept"), { recursive: true });
  await mkdir(path.join(root, "Roadmap"));
  return { root, docsDir };
}

async function writeIndex(root: string, rows: string[]): Promise<void> {
  const content = [
    "# Project Roadmap",
    "",
    "## Release Candidates",
    "| Milestone | Name | Status | Anchor | Marketing |",
    "|---|---|---|---|---|",
    ...rows,
    "",
  ].join("\n");
  await writeFile(path.join(root, "roadmap.md"), content, "utf8");
}

describe("analyzeTaskout — mode detection", () => {
  it("refuses when roadmap.md is absent", async () => {
    const { root, docsDir } = await makeProject();
    await expect(
      analyzeTaskout({
        rcId: "M8_QUESTS",
        docsDir,
        outputDir: root,
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
        configBaseDir: root,
      }),
    ).rejects.toThrow(/no-roadmap|No roadmap.md/i);
  });

  it("refuses when RC is not in the index", async () => {
    const { root, docsDir } = await makeProject();
    await writeIndex(root, ["| M2 | CORE | Active | Concept/core.md | — |"]);
    await expect(
      analyzeTaskout({
        rcId: "M8_QUESTS",
        docsDir,
        outputDir: root,
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
        configBaseDir: root,
      }),
    ).rejects.toThrow(/rc-not-in-index|not declared/i);
  });

  it("returns bootstrap-rc mode when index has the RC but file is missing", async () => {
    const { root, docsDir } = await makeProject();
    await writeIndex(root, ["| M8 | QUESTS | Stub | Concept/quests.md | — |"]);
    const result = await analyzeTaskout({
      rcId: "M8_QUESTS",
      docsDir,
      outputDir: root,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      configBaseDir: root,
    });
    expect(result.mode).toBe("bootstrap-rc");
  });

  it("returns maintenance mode when both index and file exist", async () => {
    const { root, docsDir } = await makeProject();
    await writeIndex(root, ["| M8 | QUESTS | Active | Concept/quests.md | — |"]);
    await writeFile(
      path.join(root, "Roadmap", "M8_QUESTS.md"),
      "# M8 — QUESTS\nStatus: Active\n\n## Theme\nT\n",
      "utf8",
    );
    const result = await analyzeTaskout({
      rcId: "M8_QUESTS",
      docsDir,
      outputDir: root,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      configBaseDir: root,
    });
    expect(result.mode).toBe("maintenance");
  });

  it("matches zero-padded rcIds against the index (M04 == M4)", async () => {
    const { root, docsDir } = await makeProject();
    await writeIndex(root, ["| M04 | CLASSES_SKILLS | Active | Concept/classes.md | — |"]);
    await writeFile(
      path.join(root, "Roadmap", "M04_CLASSES_SKILLS.md"),
      "# M04 — CLASSES_SKILLS\nStatus: Active\n\n## Theme\nT\n",
      "utf8",
    );
    const result = await analyzeTaskout({
      rcId: "M04_CLASSES_SKILLS",
      docsDir,
      outputDir: root,
      roadmapConfig: {
        ...DEFAULT_ROADMAP_CONFIG,
        rcNamingScheme: "{prefix}{milestone:02}_{NAME}.md",
      },
      configBaseDir: root,
    });
    expect(result.mode).toBe("maintenance");
    expect(result.rc.milestone).toBe(4);
    expect(result.rc.name).toBe("CLASSES_SKILLS");
  });
});

describe("analyzeTaskout — tech-debt blockers", () => {
  it("picks up items with the target RC in their blocks tag", async () => {
    const { root, docsDir } = await makeProject();
    await writeIndex(root, ["| M8 | QUESTS | Stub | Concept/quests.md | — |"]);
    await writeFile(
      path.join(root, "Roadmap", "TECHNICAL_DEBT.md"),
      [
        "# Tech Debt",
        "- [ ] Item A. `blocks: M8_QUESTS`.",
        "- [ ] Item B. `blocks: M10_RELEASE_READINESS, M8_QUESTS`.",
        "- [ ] Item C. `blocks: M7_COMBAT`.",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await analyzeTaskout({
      rcId: "M8_QUESTS",
      docsDir,
      outputDir: root,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      configBaseDir: root,
    });

    expect(result.techDebtBlockers).toHaveLength(2);
    const sourceLines = result.techDebtBlockers.map((b) => b.sourceLine).sort();
    expect(sourceLines).toEqual([2, 3]);
  });
});

describe("analyzeTaskout — carried-from candidates", () => {
  it("picks up Out-of-Scope items targeting this RC from sibling RCs", async () => {
    const { root, docsDir } = await makeProject();
    await writeIndex(root, [
      "| M7 | COMBAT | Active | Concept/combat.md | — |",
      "| M8 | QUESTS | Stub | Concept/quests.md | — |",
    ]);
    await writeFile(
      path.join(root, "Roadmap", "M7_COMBAT.md"),
      [
        "# M7 — COMBAT",
        "Status: Active",
        "",
        "## Out of Scope",
        "- [ ] Brigandine squad UI. `→ M8_QUESTS`. Pure polish.",
        "- [ ] Possession swap. `→ M8_QUESTS`.",
        "",
      ].join("\n"),
      "utf8",
    );

    const result = await analyzeTaskout({
      rcId: "M8_QUESTS",
      docsDir,
      outputDir: root,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      configBaseDir: root,
    });

    expect(result.carriedFromCandidates).toHaveLength(2);
    expect(result.carriedFromCandidates[0].sourceRC).toBe("M7_COMBAT");
  });
});

function buildTaskoutPlan(rc: RCMetadata): ConfirmedTaskoutPlan {
  return {
    rc,
    theme: "A theme.",
    goals: ["Goal 1.", "Goal 2."],
    targeted: [
      {
        heading: "Area One",
        items: [{ text: "Item A", checked: false }],
      },
    ],
    blockersAndDeps: [],
    definitionOfDone: ["Criterion 1.", "Criterion 2."],
    references: ["Concept/quests.md"],
    overrides: [],
  };
}

describe("generateTaskout — mode mismatch and writes", () => {
  it("refuses when caller says maintenance but RC file does not exist", async () => {
    const { root } = await makeProject();
    const plan = buildTaskoutPlan({
      id: "M8_QUESTS",
      milestone: 8,
      name: "QUESTS",
      status: "Stub",
      anchors: [{ kind: "Concept", path: "Concept/quests.md" }],
      blocks: [],
      blockedBy: [],
    });
    await expect(
      generateTaskout({
        plan,
        outputDir: root,
        mode: "maintenance",
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toThrow(/Caller said mode='maintenance'/);
  });

  it("writes the RC file directly in bootstrap-rc mode", async () => {
    const { root } = await makeProject();
    const plan = buildTaskoutPlan({
      id: "M8_QUESTS",
      milestone: 8,
      name: "QUESTS",
      status: "Stub",
      anchors: [{ kind: "Concept", path: "Concept/quests.md" }],
      blocks: [],
      blockedBy: [],
    });
    plan.targeted[0].items[0].dod = ["renders as an AC bullet"];
    plan.targeted[0].items[0].howToImplement = ["touch src/foo.ts:42, reuse the bar seam"];
    plan.targeted[0].items[0].designContext = ["the cache is stale on first call — prime it"];
    const result = await generateTaskout({
      plan,
      outputDir: root,
      mode: "bootstrap-rc",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: () => new Date("2026-05-28T00:00:00Z"),
    });

    expect(result.path).toMatch(/M8_QUESTS\.md$/);
    expect(result.path).not.toMatch(/draft/);
    const written = await readFile(result.path, "utf8");
    expect(written).toContain("# M8 — QUESTS");
    expect(written).toContain("Last Updated: 2026-05-28");
    // Acceptance criteria render under the new `- AC:` token, not legacy `- DOD:`.
    expect(written).toContain("  - AC: renders as an AC bullet");
    expect(written).not.toContain("  - DOD:");
    // Warm-ticket spec renders under `- How:` / `- Why:` after the AC bullets.
    expect(written).toContain("  - How: touch src/foo.ts:42, reuse the bar seam");
    expect(written).toContain("  - Why: the cache is stale on first call — prime it");
  });

  it("tolerates a plan that omits the optional overrides array", async () => {
    const { root } = await makeProject();
    const plan = buildTaskoutPlan({
      id: "M8_QUESTS",
      milestone: 8,
      name: "QUESTS",
      status: "Stub",
      anchors: [{ kind: "Concept", path: "Concept/quests.md" }],
      blocks: [],
      blockedBy: [],
    });
    // The MCP caller hands us `{ type: "object" }` — overrides is absent on most plans.
    delete (plan as { overrides?: unknown }).overrides;
    const result = await generateTaskout({
      plan,
      outputDir: root,
      mode: "bootstrap-rc",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });
    const written = await readFile(result.path, "utf8");
    expect(written).toContain("# M8 — QUESTS");
  });

  it("names the offending field when a plan array is the wrong type", async () => {
    const { root } = await makeProject();
    const plan = buildTaskoutPlan({
      id: "M8_QUESTS",
      milestone: 8,
      name: "QUESTS",
      status: "Stub",
      anchors: [{ kind: "Concept", path: "Concept/quests.md" }],
      blocks: [],
      blockedBy: [],
    });
    (plan as { goals: unknown }).goals = "Goal 1.";
    await expect(
      generateTaskout({
        plan,
        outputDir: root,
        mode: "bootstrap-rc",
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toThrow(/confirmed_plan\.goals must be an array/);
  });

  it("writes a .draft.md sibling in maintenance mode", async () => {
    const { root } = await makeProject();
    await writeFile(
      path.join(root, "Roadmap", "M8_QUESTS.md"),
      "# M8 — QUESTS\nStatus: Active\n\n## Theme\nOld theme.\n",
      "utf8",
    );
    const plan = buildTaskoutPlan({
      id: "M8_QUESTS",
      milestone: 8,
      name: "QUESTS",
      status: "Active",
      anchors: [{ kind: "Concept", path: "Concept/quests.md" }],
      blocks: [],
      blockedBy: [],
    });
    const result = await generateTaskout({
      plan,
      outputDir: root,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });
    expect(result.path).toMatch(/M8_QUESTS\.draft\.md$/);
    const original = await readFile(
      path.join(root, "Roadmap", "M8_QUESTS.md"),
      "utf8",
    );
    expect(original).toContain("Old theme.");
  });
});

describe("generateTaskout — Shipped diff enforcement", () => {
  async function setupShippedRC(): Promise<Project> {
    const project = await makeProject();
    await writeFile(
      path.join(project.root, "Roadmap", "M2_CORE.md"),
      [
        "# M2 — CORE",
        "Status: Shipped",
        "Last Updated: 2026-04-01",
        "",
        "## Definition of Done",
        "- [x] Original DoD A",
        "- [x] Original DoD B",
        "",
        "## Theme",
        "Original theme.",
        "",
        "## Goals",
        "- Original goal A",
        "- Original goal B",
        "",
        "## Targeted",
        "### Area One",
        "- [x] Original item",
        "",
        "## Blockers & Dependencies",
        "- None.",
        "",
        "## References",
        "- Concept/core.md",
        "",
      ].join("\n"),
      "utf8",
    );
    return project;
  }

  it("passes when no immutable fields change", async () => {
    const { root } = await setupShippedRC();
    const plan: ConfirmedTaskoutPlan = {
      rc: {
        id: "M2_CORE",
        milestone: 2,
        name: "CORE",
        status: "Shipped",
        anchors: [{ kind: "Concept", path: "Concept/core.md" }],
        blocks: [],
        blockedBy: [],
      },
      theme: "Original theme.",
      goals: ["Original goal A", "Original goal B"],
      targeted: [
        {
          heading: "Area One",
          items: [{ text: "Original item", checked: true }],
        },
      ],
      blockersAndDeps: [],
      definitionOfDone: ["Original DoD A", "Original DoD B"],
      references: ["Concept/core.md", "Plan/post_ship_followups.md"],
      overrides: [],
    };
    const result = await generateTaskout({
      plan,
      outputDir: root,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });
    expect(result.path).toMatch(/draft\.md$/);
  });

  it("refuses when DoD changes without an override", async () => {
    const { root } = await setupShippedRC();
    const plan: ConfirmedTaskoutPlan = {
      rc: {
        id: "M2_CORE",
        milestone: 2,
        name: "CORE",
        status: "Shipped",
        anchors: [{ kind: "Concept", path: "Concept/core.md" }],
        blocks: [],
        blockedBy: [],
      },
      theme: "Original theme.",
      goals: ["Original goal A", "Original goal B"],
      targeted: [
        {
          heading: "Area One",
          items: [{ text: "Original item", checked: true }],
        },
      ],
      blockersAndDeps: [],
      definitionOfDone: ["Restated DoD A", "Original DoD B"],
      references: ["Concept/core.md"],
      overrides: [],
    };
    await expect(
      generateTaskout({
        plan,
        outputDir: root,
        mode: "maintenance",
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toThrow(/immutable fields without override/);
  });

  it("passes with a correctly-scoped override and writes the audit comment", async () => {
    const { root } = await setupShippedRC();
    const plan: ConfirmedTaskoutPlan = {
      rc: {
        id: "M2_CORE",
        milestone: 2,
        name: "CORE",
        status: "Shipped",
        anchors: [{ kind: "Concept", path: "Concept/core.md" }],
        blocks: [],
        blockedBy: [],
      },
      theme: "Original theme.",
      goals: ["Original goal A", "Original goal B"],
      targeted: [
        {
          heading: "Area One",
          items: [{ text: "Original item", checked: true }],
        },
      ],
      blockersAndDeps: [],
      definitionOfDone: ["Restated DoD A", "Original DoD B"],
      references: ["Concept/core.md"],
      overrides: [
        {
          kind: "shipped-lock-bypass",
          rcId: "M2_CORE",
          changedFields: ["definitionOfDone"],
          reason: "restating DoD for clarity after ship-time audit",
        },
      ],
    };
    const result = await generateTaskout({
      plan,
      outputDir: root,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: () => new Date("2026-05-28T00:00:00Z"),
    });
    const written = await readFile(result.path, "utf8");
    expect(written).toContain("<!-- shipped-override:");
    expect(written).toContain("definitionOfDone");
  });
});
