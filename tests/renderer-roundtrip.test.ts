import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ROADMAP_CONFIG } from "../src/roadmap-config.js";
import { generateScope } from "../src/scope.js";
import { generateTaskout } from "../src/taskout.js";
import { parseRCFile } from "../src/roadmap-parse.js";
import {
  ConfirmedScopePlan,
  ConfirmedTaskoutPlan,
  RCMetadata,
  TargetedSubsection,
} from "../src/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeProjectDir(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-roundtrip-"));
  tempDirs.push(root);
  return root;
}

const FIXED_CLOCK = () => new Date("2026-06-18T00:00:00Z");

// A Targeted block exercising every per-ticket sub-bullet, including the new
// Blocked-by / Owner. Shared by both renderer round-trips so each is proven against
// the SAME authored shape.
const TARGETED_WITH_FULL_SPEC: TargetedSubsection[] = [
  {
    heading: "Dispatch",
    items: [
      {
        text: "Wire the dispatcher",
        checked: false,
        dod: ["a colonist accepts a dispatched job", "the job completes and is logged"],
        howToImplement: ["src/dispatch.ts — reuse the JobQueue.Enqueue seam"],
        designContext: ["the queue drains lazily — enqueue before the first tick"],
        blockedBy: ["M3_ROUNDTRIP#dispatch#aaaaaaaaaaaa", "M3_ROUNDTRIP#dispatch#bbbbbbbbbbbb"],
        owner: "Alice",
      },
      { text: "Plain ticket with no spec", checked: true },
    ],
  },
];

function buildTaskoutPlan(): ConfirmedTaskoutPlan {
  const rc: RCMetadata = {
    id: "M3_ROUNDTRIP",
    milestone: 3,
    name: "ROUNDTRIP",
    status: "Active",
    anchors: [{ kind: "Concept", path: "Concept/roundtrip.md" }],
    blocks: [],
    blockedBy: [],
  };
  return {
    rc,
    theme: "Per-renderer round-trip.",
    goals: ["Goal one.", "Goal two."],
    // Deep-clone so each test mutates nothing shared.
    targeted: JSON.parse(JSON.stringify(TARGETED_WITH_FULL_SPEC)),
    blockersAndDeps: [],
    definitionOfDone: ["Ships clean.", "Round-trips byte-identical.", "Keys never move."],
    references: ["Concept/roundtrip.md"],
    overrides: [],
  };
}

function buildScopePlan(rc: RCMetadata): ConfirmedScopePlan {
  return {
    thesis: { text: "Round-trip thesis." },
    minPlayWaypoint: { rcId: rc.id, criterion: "loop testable" },
    rcs: [rc],
    edges: [],
    docMappings: [],
    unmappedConcepts: [],
    waypoints: [],
    overrides: [],
  };
}

// Each renderer is byte-stable against ITS OWN output shape — they are NOT mutually
// byte-equal (renderRCStub adds Status / Last Updated / index lines renderTaskout
// does not). So each test renders, parses, re-renders, and asserts the SECOND render
// equals the first.

describe("renderTaskout round-trip", () => {
  it("parse → render → parse is byte-identical for the full sub-bullet set", async () => {
    const root = await makeProjectDir();
    const plan = buildTaskoutPlan();

    // First render (bootstrap writes the original RC file).
    const first = await generateTaskout({
      plan,
      outputDir: root,
      mode: "bootstrap-rc",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: FIXED_CLOCK,
    });
    const firstMd = await readFile(first.path, "utf8");

    // The full sub-bullet set rendered, including the new tokens.
    expect(firstMd).toContain("  - AC: a colonist accepts a dispatched job");
    expect(firstMd).toContain("  - How: src/dispatch.ts — reuse the JobQueue.Enqueue seam");
    expect(firstMd).toContain("  - Why: the queue drains lazily — enqueue before the first tick");
    expect(firstMd).toContain(
      "  - Blocked-by: M3_ROUNDTRIP#dispatch#aaaaaaaaaaaa, M3_ROUNDTRIP#dispatch#bbbbbbbbbbbb",
    );
    expect(firstMd).toContain("  - Owner: Alice");

    // Parse the rendered file back into a plan, then re-render through the SAME path
    // into a clean dir (bootstrap refuses to overwrite, so a fresh dir keeps the
    // second pass byte-comparable to the first).
    const parsed = await parseRCFile(first.path);
    expect(parsed).not.toBeNull();
    const replan: ConfirmedTaskoutPlan = {
      ...plan,
      theme: parsed!.theme ?? "",
      goals: parsed!.goals,
      targeted: parsed!.targeted,
      blockersAndDeps: parsed!.blockersAndDeps,
      definitionOfDone: parsed!.definitionOfDone,
      references: parsed!.references,
    };
    const secondRoot = await makeProjectDir();
    const second = await generateTaskout({
      plan: replan,
      outputDir: secondRoot,
      mode: "bootstrap-rc",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: FIXED_CLOCK,
    });
    const secondMd = await readFile(second.path, "utf8");

    // Byte-identical markdown across the two renders.
    expect(secondMd).toBe(firstMd);

    // And the structural parse is preserved — Blocked-by stayed a list, Owner a string.
    const reparsed = await parseRCFile(second.path);
    expect(reparsed!.targeted[0].items[0].blockedBy).toEqual([
      "M3_ROUNDTRIP#dispatch#aaaaaaaaaaaa",
      "M3_ROUNDTRIP#dispatch#bbbbbbbbbbbb",
    ]);
    expect(reparsed!.targeted[0].items[0].owner).toBe("Alice");
    expect(reparsed!.targeted[0].items[0].dod).toEqual(parsed!.targeted[0].items[0].dod);
  });
});

describe("renderRCStub round-trip", () => {
  it("parse → render → parse is byte-identical and preserves ALL sub-bullets", async () => {
    const root = await makeProjectDir();
    await mkdir(path.join(root, "Roadmap"), { recursive: true });
    await writeFile(path.join(root, "roadmap.md"), "# Existing roadmap\n", "utf8");

    // Author an RC file carrying the full per-ticket sub-bullet set.
    const authored = `# M3 — ROUNDTRIP
Status: Active
Last Updated: 2026-06-18

## Definition of Done
- [ ] Ships clean.

## Theme
Per-renderer round-trip.

## Goals
- Goal one.

## Targeted
### Dispatch
- [ ] Wire the dispatcher
  - AC: a colonist accepts a dispatched job
  - How: src/dispatch.ts — reuse the JobQueue.Enqueue seam
  - Why: the queue drains lazily — enqueue before the first tick
  - Blocked-by: M3_ROUNDTRIP#dispatch#aaaaaaaaaaaa, M3_ROUNDTRIP#dispatch#bbbbbbbbbbbb
  - Owner: Alice
- [x] Plain ticket with no spec

## Blockers & Dependencies
- **Upstream RC**: M2_CORE — needs the core loop

## References
- Concept/roundtrip.md
`;
    const rcAbs = path.join(root, "Roadmap", "M3_ROUNDTRIP.md");
    await writeFile(rcAbs, authored, "utf8");

    const rc: RCMetadata = {
      id: "M3_ROUNDTRIP",
      milestone: 3,
      name: "ROUNDTRIP",
      status: "Active",
      anchors: [{ kind: "Concept", path: "Concept/roundtrip.md" }],
      blocks: [],
      blockedBy: ["M2_CORE"],
    };

    // Maintenance mode reads the authored RC as `existing` and re-renders it to a
    // .draft.md stub via renderRCStub — the first render under test.
    const first = await generateScope({
      plan: buildScopePlan(rc),
      outputDir: root,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: FIXED_CLOCK,
    });
    const draftPath = first.content.rcs[0].path;
    expect(draftPath).toMatch(/M3_ROUNDTRIP\.draft\.md$/);
    const firstMd = await readFile(draftPath, "utf8");

    // renderRCStub no longer drops sub-bullets — the full set survives the rewrite.
    expect(firstMd).toContain("  - AC: a colonist accepts a dispatched job");
    expect(firstMd).toContain("  - How: src/dispatch.ts — reuse the JobQueue.Enqueue seam");
    expect(firstMd).toContain("  - Why: the queue drains lazily — enqueue before the first tick");
    expect(firstMd).toContain(
      "  - Blocked-by: M3_ROUNDTRIP#dispatch#aaaaaaaaaaaa, M3_ROUNDTRIP#dispatch#bbbbbbbbbbbb",
    );
    expect(firstMd).toContain("  - Owner: Alice");

    // Promote the draft over the original, then re-render: the stub of its own output
    // must be byte-identical (the per-renderer fixed point).
    await writeFile(rcAbs, firstMd, "utf8");
    const second = await generateScope({
      plan: buildScopePlan(rc),
      outputDir: root,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: FIXED_CLOCK,
    });
    const secondMd = await readFile(second.content.rcs[0].path, "utf8");
    expect(secondMd).toBe(firstMd);

    // Structural parse of the stub preserves the per-ticket fields.
    const parsedStub = await parseRCFile(draftPath);
    const item = parsedStub!.targeted[0].items[0];
    expect(item.blockedBy).toEqual([
      "M3_ROUNDTRIP#dispatch#aaaaaaaaaaaa",
      "M3_ROUNDTRIP#dispatch#bbbbbbbbbbbb",
    ]);
    expect(item.owner).toBe("Alice");
    expect(item.dod).toEqual(["a colonist accepts a dispatched job"]);
    expect(parsedStub!.targeted[0].items[1].checked).toBe(true);
  });
});
