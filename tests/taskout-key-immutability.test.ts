import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_ROADMAP_CONFIG } from "../src/roadmap-config.js";
import { exportTaskout, generateTaskout } from "../src/taskout.js";
import { parseRCFile } from "../src/roadmap-parse.js";
import { ConfirmedTaskoutPlan, RCMetadata } from "../src/types.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-key-immut-"));
  tempDirs.push(dir);
  return dir;
}

async function writeRC(dir: string, filename: string, content: string): Promise<string> {
  await mkdir(path.join(dir, "Roadmap"), { recursive: true });
  const rcPath = path.join(dir, "Roadmap", filename);
  await writeFile(rcPath, content, "utf8");
  return rcPath;
}

// An RC carrying one Targeted ticket whose immutable key is already persisted inline.
const KEYED_KEY = "M8_QUESTS#dispatch#abc123abc123";
function keyedRC(itemText: string, heading = "Dispatch"): string {
  return `# M8 — QUESTS
Status: Active
Last Updated: 2026-05-12

## Definition of Done
- [ ] Ships clean.

## Theme
Identity.

## Goals
- Stable keys.

## Targeted
### ${heading}
- [ ] ${itemText}  <!-- key: ${KEYED_KEY} -->

## Blockers & Dependencies
- None identified.

## References
- (none)
`;
}

const FIXED_CLOCK = () => new Date("2026-06-20T00:00:00Z");

function buildPlan(targetedItems: ConfirmedTaskoutPlan["targeted"]): ConfirmedTaskoutPlan {
  const rc: RCMetadata = {
    id: "M8_QUESTS",
    milestone: 8,
    name: "QUESTS",
    status: "Active",
    anchors: [{ kind: "Inline" }],
    blocks: [],
    blockedBy: [],
  };
  return {
    rc,
    theme: "Identity.",
    goals: ["Stable keys."],
    targeted: targetedItems,
    blockersAndDeps: [],
    definitionOfDone: [{ text: "Ships clean.", checked: false }],
    references: [],
    overrides: [],
  };
}

describe("persisted ticket-key immutability", () => {
  it("parse + export honor an inline `<!-- key: … -->`, keeping text clean", async () => {
    const dir = await makeTempDir();
    await writeRC(dir, "M8_QUESTS.md", keyedRC("Dispatch background jobs"));

    const result = await exportTaskout({
      rcId: "M8_QUESTS",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    const item = result.targeted[0].items[0];
    expect(item.key).toBe(KEYED_KEY);
    expect(item.text).toBe("Dispatch background jobs"); // comment stripped off the text
    // Epic key derives from the item's persisted prefix, not a fresh slug of the heading.
    expect(result.targeted[0].key).toBe("M8_QUESTS#dispatch");
  });

  it("keeps the key when a ticket is reworded in place (comment rides along)", async () => {
    const dir = await makeTempDir();
    // Same persisted key, different ticket text — i.e. a rename done as a direct file edit.
    await writeRC(dir, "M8_QUESTS.md", keyedRC("Dispatch background jobs AND retries"));

    const result = await exportTaskout({
      rcId: "M8_QUESTS",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    expect(result.targeted[0].items[0].key).toBe(KEYED_KEY);
    expect(result.targeted[0].items[0].text).toBe("Dispatch background jobs AND retries");
  });

  it("keeps item keys when the epic heading is reworded", async () => {
    const dir = await makeTempDir();
    await writeRC(dir, "M8_QUESTS.md", keyedRC("Dispatch background jobs", "Quest Dispatch"));

    const result = await exportTaskout({
      rcId: "M8_QUESTS",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    });

    // Heading is now "Quest Dispatch" (slug would be quest-dispatch) but the item key — and the
    // section key derived from it — keep the original `dispatch` prefix.
    expect(result.targeted[0].heading).toBe("Quest Dispatch");
    expect(result.targeted[0].items[0].key).toBe(KEYED_KEY);
    expect(result.targeted[0].key).toBe("M8_QUESTS#dispatch");
  });

  it("bootstrap mints + persists a key, and maintenance reword keeps it", async () => {
    const dir = await makeTempDir();

    // Bootstrap: no keys in the plan → minted and written inline.
    const boot = await generateTaskout({
      plan: buildPlan([{ heading: "Dispatch", items: [{ text: "Wire the dispatcher", checked: false }] }]),
      outputDir: dir,
      mode: "bootstrap-rc",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: FIXED_CLOCK,
    });
    const bootMd = await readFile(boot.path, "utf8");
    expect(bootMd).toContain("<!-- key: M8_QUESTS#dispatch#");

    const minted = (await exportTaskout({
      rcId: "M8_QUESTS",
      outputDir: dir,
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
    })).targeted[0].items[0].key;
    expect(minted).toMatch(/^M8_QUESTS#dispatch#[0-9a-f]{12}$/);

    // Maintenance: the LLM plan reweords the ticket and drops the key (worst case). The
    // unambiguous single-reword carry-forward must preserve the minted key in the draft.
    const draft = await generateTaskout({
      plan: buildPlan([{ heading: "Dispatch", items: [{ text: "Wire the dispatcher properly", checked: false }] }]),
      outputDir: dir,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: FIXED_CLOCK,
    });
    expect(draft.path).toMatch(/M8_QUESTS\.draft\.md$/);
    const parsedDraft = await parseRCFile(draft.path);
    const draftItem = parsedDraft!.targeted[0].items[0];
    expect(draftItem.text).toBe("Wire the dispatcher properly");
    expect(draftItem.key).toBe(minted); // key did NOT move on reword
  });

  it("preserves an agent-echoed key verbatim through maintenance", async () => {
    const dir = await makeTempDir();
    await writeRC(dir, "M8_QUESTS.md", keyedRC("Dispatch background jobs"));

    // The plan echoes the persisted key alongside reworded text — layer 1, authoritative.
    const draft = await generateTaskout({
      plan: buildPlan([
        { heading: "Dispatch", items: [{ text: "Totally different wording", checked: false, key: KEYED_KEY }] },
      ]),
      outputDir: dir,
      mode: "maintenance",
      roadmapConfig: DEFAULT_ROADMAP_CONFIG,
      clock: FIXED_CLOCK,
    });
    const parsedDraft = await parseRCFile(draft.path);
    expect(parsedDraft!.targeted[0].items[0].key).toBe(KEYED_KEY);
  });
});
