import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ROADMAP_CONFIG } from "../src/roadmap-config.js";
import {
  analyzeTaskoutOrder,
  exportTaskout,
  generateTaskout,
  keyedTargeted,
} from "../src/taskout.js";
import { ConfirmedTaskoutPlan, RCMetadata, TargetedSubsection } from "../src/types.js";

// The Targeted list order IS the pushed (ClickUp) order, so a `- Blocked-by:` edge that points
// forward (at/after the dependent) or at a non-existent ticket means the order lies. These tests
// pin: the analyzer's classification, the clean (never-throw) read path, and the write-path refusal.

const RC = "M9_ORDER";

function targetedFixture(): TargetedSubsection[] {
  return [
    {
      heading: "Alpha",
      items: [
        { text: "first ticket", checked: false },
        { text: "second ticket", checked: false },
      ],
    },
    { heading: "Beta", items: [{ text: "third ticket", checked: false }] },
  ];
}

// Keys are hashed from item text only (sub-bullets ride along), so they are stable whether or not
// a `blockedBy` edge is present — compute them once from the bare fixture and reference by role.
const KEYS = keyedTargeted(targetedFixture(), RC);
const FIRST = KEYS[0].items[0].key; // Alpha / first  — flat index 0
const SECOND = KEYS[0].items[1].key; // Alpha / second — flat index 1
const THIRD = KEYS[1].items[0].key; // Beta / third   — flat index 2

function keyedWith(mut: (t: TargetedSubsection[]) => void) {
  const t = targetedFixture();
  mut(t);
  return keyedTargeted(t, RC);
}

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});
async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-order-"));
  tempDirs.push(dir);
  return dir;
}
async function writeRC(dir: string, filename: string, content: string): Promise<void> {
  await mkdir(path.join(dir, "Roadmap"), { recursive: true });
  await writeFile(path.join(dir, "Roadmap", filename), content, "utf8");
}
function buildPlan(targeted: TargetedSubsection[]): ConfirmedTaskoutPlan {
  const rc: RCMetadata = {
    id: RC,
    milestone: 9,
    name: "ORDER",
    status: "Active",
    anchors: [],
    blocks: [],
    blockedBy: [],
  };
  return {
    rc,
    theme: "Order gate.",
    goals: ["Ship in order."],
    targeted,
    blockersAndDeps: [],
    definitionOfDone: [{ text: "Ships ordered.", checked: false }],
    references: [],
    overrides: [],
  };
}

describe("analyzeTaskoutOrder", () => {
  it("is clean when a Blocked-by points backward (blocker listed before dependent)", () => {
    const keyed = keyedWith((t) => {
      t[0].items[1].blockedBy = [FIRST]; // second blocked-by first
    });
    const d = analyzeTaskoutOrder(keyed, RC);
    expect(d.blockedByViolations).toEqual([]);
    expect(d.unresolvedBlockedBy).toEqual([]);
  });

  it("flags a forward Blocked-by (blocker listed at/after the dependent)", () => {
    const keyed = keyedWith((t) => {
      t[0].items[0].blockedBy = [SECOND]; // first blocked-by second
    });
    expect(analyzeTaskoutOrder(keyed, RC).blockedByViolations).toEqual([
      { item: FIRST, blocker: SECOND },
    ]);
  });

  it("flags a self Blocked-by", () => {
    const keyed = keyedWith((t) => {
      t[0].items[0].blockedBy = [FIRST];
    });
    expect(analyzeTaskoutOrder(keyed, RC).blockedByViolations).toEqual([
      { item: FIRST, blocker: FIRST },
    ]);
  });

  it("flags an intra-RC token (right RC prefix, wrong digest) as unresolved", () => {
    const bad = `${RC}#alpha#deadbeefdead`;
    const keyed = keyedWith((t) => {
      t[0].items[1].blockedBy = [bad];
    });
    expect(analyzeTaskoutOrder(keyed, RC).unresolvedBlockedBy).toEqual([{ item: SECOND, token: bad }]);
  });

  it("flags a bare digest / epic letter (no '#') as unresolved — closes the typo hole", () => {
    const keyed = keyedWith((t) => {
      t[0].items[1].blockedBy = ["deadbeefdead", "A3"];
    });
    expect(analyzeTaskoutOrder(keyed, RC).unresolvedBlockedBy).toEqual([
      { item: SECOND, token: "deadbeefdead" },
      { item: SECOND, token: "A3" },
    ]);
  });

  it("ignores a legitimate cross-RC full key (different RC prefix, has '#')", () => {
    const keyed = keyedWith((t) => {
      t[0].items[1].blockedBy = ["M8_UPSTREAM#core#abc123abc123"];
    });
    const d = analyzeTaskoutOrder(keyed, RC);
    expect(d.unresolvedBlockedBy).toEqual([]);
    expect(d.blockedByViolations).toEqual([]);
  });

  it("detects stray prose ordering sections in raw (advisory)", () => {
    const keyed = keyedTargeted(targetedFixture(), RC);
    const raw = "# M9 — ORDER\n\n## Suggested Order\nE0 → A → B\n\n## Execution Sequence\nfoo\n";
    expect(analyzeTaskoutOrder(keyed, RC, raw).strayOrderingSections.map((s) => s.heading)).toEqual([
      "Suggested Order",
      "Execution Sequence",
    ]);
  });

  it("does not flag normal sections (Out of Scope, an 'Order of operations' note) as stray", () => {
    const keyed = keyedTargeted(targetedFixture(), RC);
    const raw = "## Theme\n## Goals\n## Targeted\n## Out of Scope\n## Order of operations\n";
    expect(analyzeTaskoutOrder(keyed, RC, raw).strayOrderingSections).toEqual([]);
  });
});

describe("exportTaskout order diagnostics (read path — never throws)", () => {
  const rc = (targetedBody: string, extra = ""): string =>
    `# M9 — ORDER
Status: Active

## Definition of Done
- [ ] Ships.

## Theme
Order gate.

## Goals
- Ship in order.
${extra}
## Targeted
${targetedBody}

## Blockers & Dependencies
- None identified.

## References
- (none)
`;

  it("surfaces a forward Blocked-by in orderDiagnostics WITHOUT throwing", async () => {
    const dir = await makeTempDir();
    await writeRC(
      dir,
      "M9_ORDER.md",
      rc(`### Alpha
- [ ] first ticket
- [ ] second ticket
  - Blocked-by: ${THIRD}

### Beta
- [ ] third ticket`),
    );
    const result = await exportTaskout({ rcId: RC, outputDir: dir, roadmapConfig: DEFAULT_ROADMAP_CONFIG });
    expect(result.orderDiagnostics.blockedByViolations).toEqual([{ item: SECOND, blocker: THIRD }]);
    expect((result as Record<string, unknown>).raw).toBeUndefined();
  });

  it("surfaces a stray ## Suggested Order section without throwing", async () => {
    const dir = await makeTempDir();
    await writeRC(
      dir,
      "M9_ORDER.md",
      rc(
        `### Alpha
- [ ] first ticket
- [ ] second ticket

### Beta
- [ ] third ticket`,
        "\n## Suggested Order\nE0 → A → B\n",
      ),
    );
    const result = await exportTaskout({ rcId: RC, outputDir: dir, roadmapConfig: DEFAULT_ROADMAP_CONFIG });
    expect(result.orderDiagnostics.strayOrderingSections.map((s) => s.heading)).toEqual([
      "Suggested Order",
    ]);
    expect(result.orderDiagnostics.blockedByViolations).toEqual([]);
  });

  it("is all-clean for a correctly-ordered RC", async () => {
    const dir = await makeTempDir();
    await writeRC(
      dir,
      "M9_ORDER.md",
      rc(`### Alpha
- [ ] first ticket
- [ ] second ticket
  - Blocked-by: ${FIRST}

### Beta
- [ ] third ticket`),
    );
    const { orderDiagnostics } = await exportTaskout({
      rcId: RC,
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });
    expect(orderDiagnostics.blockedByViolations).toEqual([]);
    expect(orderDiagnostics.unresolvedBlockedBy).toEqual([]);
    expect(orderDiagnostics.strayOrderingSections).toEqual([]);
  });
});

describe("generateTaskout order gate (write path — refuses)", () => {
  it("throws order-violation on a forward Blocked-by edge", async () => {
    const t = targetedFixture();
    t[0].items[1].blockedBy = [THIRD]; // second blocked-by third (forward)
    await expect(
      generateTaskout({
        plan: buildPlan(t),
        outputDir: await makeTempDir(),
        mode: "bootstrap-rc",
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toMatchObject({ code: "order-violation" });
  });

  it("throws order-violation on a bare-digit Blocked-by (typo hole closed)", async () => {
    const t = targetedFixture();
    t[0].items[1].blockedBy = ["deadbeefdead"];
    await expect(
      generateTaskout({
        plan: buildPlan(t),
        outputDir: await makeTempDir(),
        mode: "bootstrap-rc",
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toMatchObject({ code: "order-violation" });
  });

  it("writes a backward-ordered plan (blocker first)", async () => {
    const t = targetedFixture();
    t[0].items[1].blockedBy = [FIRST]; // second blocked-by first (backward) — fine
    const res = await generateTaskout({
      plan: buildPlan(t),
      outputDir: await makeTempDir(),
      mode: "bootstrap-rc",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });
    expect(res.path).toMatch(/M9_ORDER\.md$/);
  });
});

// --- Phase-N sequential-epic convention (the number IS the order) ---

function phaseSections(...headings: string[]) {
  const targeted: TargetedSubsection[] = headings.map((h, i) => ({
    heading: h,
    items: [{ text: `ticket ${i}`, checked: false }],
  }));
  return keyedTargeted(targeted, RC);
}
function phasePlan(headings: string[]): ConfirmedTaskoutPlan {
  const targeted: TargetedSubsection[] = headings.map((h, i) => ({
    heading: h,
    items: [{ text: `ticket ${i}`, checked: false }],
  }));
  return buildPlan(targeted);
}

describe("analyzeTaskoutOrder phase-sequence", () => {
  const phaseViol = (...h: string[]) => analyzeTaskoutOrder(phaseSections(...h), RC).phaseSequenceViolations;

  it("clean: monotonic Phase 1,2,3", () => {
    expect(phaseViol("Phase 1 — a", "Phase 2 — b", "Phase 3 — c")).toEqual([]);
  });
  it("clean: Phase 0 pre-work start (0,1,2)", () => {
    expect(phaseViol("Phase 0 — a", "Phase 1 — b", "Phase 2 — c")).toEqual([]);
  });
  it("clean: a gap from a deferred phase (1,2,4)", () => {
    expect(phaseViol("Phase 1 — a", "Phase 2 — b", "Phase 4 — c")).toEqual([]);
  });
  it("clean: Phase 1 then Phase 10 (no greedy-digit pitfall — 10 parses as 10, not 1)", () => {
    // If "Phase 10" mis-parsed as 1, this would be 1,1 → out-of-order. Clean proves it reads as 10.
    expect(phaseViol("Phase 1 — a", "Phase 10 — b")).toEqual([]);
  });
  it("clean: all-descriptive headings (convention not in use)", () => {
    expect(phaseViol("Alpha", "Beta")).toEqual([]);
  });
  it("flags out-of-order (1,3,2) on the offending epic", () => {
    const v = phaseViol("Phase 1 — a", "Phase 3 — b", "Phase 2 — c");
    expect(v.map((x) => x.kind)).toContain("out-of-order");
    expect(v.some((x) => x.heading === "Phase 2 — c")).toBe(true);
  });
  it("flags a bad start (Phase 2,3 — start ∉ {0,1})", () => {
    expect(phaseViol("Phase 2 — a", "Phase 3 — b").map((x) => x.kind)).toContain("bad-start");
  });
  it("flags partial adoption (Phase 1, Descriptive, Phase 2), naming the unlabeled epic", () => {
    expect(phaseViol("Phase 1 — a", "Middleware", "Phase 2 — c")).toEqual([
      { heading: "Middleware", kind: "partial-adoption", detail: expect.stringContaining("Phase N") },
    ]);
  });
});

describe("generateTaskout phase gate + exportTaskout surfacing", () => {
  it("throws order-violation on a non-monotonic phase sequence", async () => {
    await expect(
      generateTaskout({
        plan: phasePlan(["Phase 1 — a", "Phase 3 — b", "Phase 2 — c"]),
        outputDir: await makeTempDir(),
        mode: "bootstrap-rc",
        roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      }),
    ).rejects.toMatchObject({ code: "order-violation" });
  });

  it("writes a monotonic phase sequence", async () => {
    const res = await generateTaskout({
      plan: phasePlan(["Phase 1 — a", "Phase 2 — b"]),
      outputDir: await makeTempDir(),
      mode: "bootstrap-rc",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });
    expect(res.path).toMatch(/M9_ORDER\.md$/);
  });

  it("surfaces a phase-sequence violation at export WITHOUT throwing", async () => {
    const dir = await makeTempDir();
    await writeRC(
      dir,
      "M9_ORDER.md",
      `# M9 — ORDER
Status: Active

## Definition of Done
- [ ] Ships.

## Theme
Phase gate.

## Goals
- Ship in order.

## Targeted
### Phase 1 — a
- [ ] x
### Phase 3 — b
- [ ] y
### Phase 2 — c
- [ ] z

## Blockers & Dependencies
- None identified.

## References
- (none)
`,
    );
    const r = await exportTaskout({ rcId: RC, outputDir: dir, roadmapConfig: DEFAULT_ROADMAP_CONFIG });
    expect(r.orderDiagnostics.phaseSequenceViolations.map((v) => v.kind)).toContain("out-of-order");
  });
});
