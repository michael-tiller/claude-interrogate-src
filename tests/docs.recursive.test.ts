import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadDocsRecursive } from "../src/docs.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeDocsTree(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-recursive-"));
  tempDirs.push(root);

  await mkdir(path.join(root, "Concept"), { recursive: true });
  await mkdir(path.join(root, "Plan"), { recursive: true });
  await mkdir(path.join(root, "ADR"), { recursive: true });
  await mkdir(path.join(root, "Roadmap"), { recursive: true });

  await writeFile(path.join(root, "Concept", "core_loop.md"), "# Core Loop\n", "utf8");
  await writeFile(path.join(root, "Concept", "roadmap.md"), "# Concept Roadmap Doc\n", "utf8");
  await writeFile(path.join(root, "Plan", "ingest_plan.md"), "# Ingest Plan\n", "utf8");
  await writeFile(path.join(root, "ADR", "0001_envelope.md"), "# ADR 0001\n", "utf8");
  await writeFile(path.join(root, "Roadmap", "0_2_0_CORE.md"), "# Core RC\n", "utf8");
  await writeFile(
    path.join(root, "Roadmap", "TECHNICAL_DEBT.md"),
    "# Tech Debt\n",
    "utf8",
  );
  await writeFile(path.join(root, "roadmap.md"), "# Top Roadmap\n", "utf8");
  await writeFile(path.join(root, "draft_doc.draft.md"), "# Draft\n", "utf8");

  return root;
}

describe("loadDocsRecursive", () => {
  it("excludes the configured rcDir as a subtree", async () => {
    const root = await makeDocsTree();
    const docs = await loadDocsRecursive(root, { excludeDirs: ["Roadmap"] });
    const paths = docs.map((d) => path.relative(root, d.path).replace(/\\/g, "/"));
    expect(paths).not.toContain("Roadmap/0_2_0_CORE.md");
    expect(paths).not.toContain("Roadmap/TECHNICAL_DEBT.md");
  });

  it("excludes only the configured indexFile under docsDir, not basename matches", async () => {
    const root = await makeDocsTree();
    const docs = await loadDocsRecursive(root, {
      excludeFiles: ["roadmap.md"],
      excludeDirs: ["Roadmap"],
    });
    const paths = docs.map((d) => path.relative(root, d.path).replace(/\\/g, "/"));
    expect(paths).not.toContain("roadmap.md");
    expect(paths).toContain("Concept/roadmap.md");
  });

  it("always excludes *.draft.md files", async () => {
    const root = await makeDocsTree();
    const docs = await loadDocsRecursive(root);
    const paths = docs.map((d) => path.relative(root, d.path).replace(/\\/g, "/"));
    expect(paths).not.toContain("draft_doc.draft.md");
  });

  it("tags anchor source by first path segment under docsDir", async () => {
    const root = await makeDocsTree();
    const docs = await loadDocsRecursive(root, { excludeDirs: ["Roadmap"] });
    const concept = docs.find((d) => d.name === "core_loop.md");
    const plan = docs.find((d) => d.name === "ingest_plan.md");
    const adr = docs.find((d) => d.name === "0001_envelope.md");
    expect(concept?.anchorSource).toBe("Concept");
    expect(plan?.anchorSource).toBe("Plan");
    expect(adr?.anchorSource).toBe("ADR");
  });

  it("accepts a custom anchor-source tagger", async () => {
    const root = await makeDocsTree();
    const docs = await loadDocsRecursive(root, {
      excludeDirs: ["Roadmap"],
      tagAnchorSource: () => "Custom",
    });
    expect(docs.every((d) => d.anchorSource === "Custom")).toBe(true);
  });
});
