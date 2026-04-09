import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveDefaultDocsDir } from "../src/config.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-config-"));
  tempDirs.push(dir);
  return dir;
}

describe("resolveDefaultDocsDir", () => {
  it("prefers docsDir from local config", async () => {
    const cwd = await makeTempDir();
    await writeFile(
      path.join(cwd, ".claude-interrogate.json"),
      JSON.stringify({ docsDir: "./Documentation" }, null, 2),
      "utf8",
    );

    await expect(resolveDefaultDocsDir(cwd)).resolves.toBe(path.join(cwd, "Documentation"));
  });

  it("falls back to ./docs when no config exists", async () => {
    const cwd = await makeTempDir();
    await mkdir(path.join(cwd, "docs"));

    await expect(resolveDefaultDocsDir(cwd)).resolves.toBe(path.join(cwd, "docs"));
  });
});
