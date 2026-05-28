import { mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  PathSafetyError,
  assertWithinDir,
  renderRCFilename,
  renderRCName,
  validateNamingScheme,
  validateRCId,
  validateRCName,
  validateRelativePath,
} from "../src/path-safety.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function makeTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "claude-interrogate-pathsafety-"));
  tempDirs.push(dir);
  return dir;
}

describe("validateRelativePath", () => {
  it("accepts a clean relative path", () => {
    expect(validateRelativePath("Roadmap/0_2_0_CORE.md", "field")).toBe("Roadmap/0_2_0_CORE.md");
  });

  it("rejects parent traversal", () => {
    expect(() => validateRelativePath("../etc/passwd", "field")).toThrow(PathSafetyError);
  });

  it("rejects parent traversal in the middle of the path", () => {
    expect(() => validateRelativePath("Roadmap/../etc/passwd", "field")).toThrow(PathSafetyError);
  });

  it("rejects absolute POSIX paths", () => {
    expect(() => validateRelativePath("/etc/passwd", "field")).toThrow(PathSafetyError);
  });

  it("rejects Windows drive letters", () => {
    expect(() => validateRelativePath("C:/Users/x", "field")).toThrow(PathSafetyError);
    expect(() => validateRelativePath("C:\\Users\\x", "field")).toThrow(PathSafetyError);
  });

  it("rejects empty input", () => {
    expect(() => validateRelativePath("", "field")).toThrow(PathSafetyError);
  });

  it("rejects current-dir segments", () => {
    expect(() => validateRelativePath("./roadmap.md", "field")).toThrow(PathSafetyError);
  });
});

describe("validateRCId", () => {
  it("accepts well-shaped ids", () => {
    expect(() => validateRCId("M8_QUESTS")).not.toThrow();
    expect(() => validateRCId("M10_RELEASE_READINESS")).not.toThrow();
    expect(() => validateRCId("M95_SHOWCASE")).not.toThrow();
  });

  it("rejects ids with path separators", () => {
    expect(() => validateRCId("0_8_0/QUESTS")).toThrow(PathSafetyError);
    expect(() => validateRCId("0_8_0\\QUESTS")).toThrow(PathSafetyError);
  });

  it("rejects ids with parent traversal", () => {
    expect(() => validateRCId("../QUESTS")).toThrow(PathSafetyError);
  });

  it("rejects ids with whitespace", () => {
    expect(() => validateRCId("0_8_0 QUESTS")).toThrow(PathSafetyError);
  });

  it("rejects lowercase name", () => {
    expect(() => validateRCId("0_8_0_quests")).toThrow(PathSafetyError);
  });

  it("rejects missing semver prefix", () => {
    expect(() => validateRCId("QUESTS")).toThrow(PathSafetyError);
  });
});

describe("validateRCName", () => {
  it("accepts uppercase names", () => {
    expect(() => validateRCName("QUESTS")).not.toThrow();
    expect(() => validateRCName("RELEASE_READINESS")).not.toThrow();
  });

  it("rejects lowercase", () => {
    expect(() => validateRCName("quests")).toThrow(PathSafetyError);
  });

  it("rejects leading digit", () => {
    expect(() => validateRCName("9LIVES")).toThrow(PathSafetyError);
  });
});

describe("validateNamingScheme", () => {
  it("accepts the default template", () => {
    expect(() => validateNamingScheme("M{milestone}_{NAME}.md")).not.toThrow();
  });

  it("rejects templates missing a required placeholder", () => {
    expect(() => validateNamingScheme("M{milestone}.md")).toThrow(PathSafetyError);
  });

  it("rejects unknown placeholders", () => {
    expect(() => validateNamingScheme("M{milestone}_{NAME}_{epoch}.md")).toThrow(
      PathSafetyError,
    );
  });

  it("rejects templates without .md suffix", () => {
    expect(() => validateNamingScheme("M{milestone}_{NAME}")).toThrow(PathSafetyError);
  });

  it("rejects path separators in literal segments", () => {
    expect(() => validateNamingScheme("Roadmap/M{milestone}_{NAME}.md")).toThrow(
      PathSafetyError,
    );
  });

  it("rejects parent traversal in literal segments", () => {
    expect(() => validateNamingScheme("..M{milestone}_{NAME}.md")).toThrow(
      PathSafetyError,
    );
  });
});

describe("renderRCFilename", () => {
  it("renders default template", () => {
    expect(
      renderRCFilename("M{milestone}_{NAME}.md", { milestone: 8, name: "QUESTS" }),
    ).toBe("M8_QUESTS.md");
  });

  it("rejects non-integer milestones", () => {
    expect(() =>
      renderRCFilename("M{milestone}_{NAME}.md", { milestone: 0.5 as unknown as number, name: "QUESTS" }),
    ).toThrow(PathSafetyError);
  });

  it("rejects invalid RC name during render", () => {
    expect(() =>
      renderRCFilename("M{milestone}_{NAME}.md", {
        milestone: 8,
        name: "quests",
      }),
    ).toThrow(PathSafetyError);
  });
});

describe("renderRCName", () => {
  it("uppercases and underscore-joins multi-word names", () => {
    expect(renderRCName("Quests and Dispatch")).toBe("QUESTS_AND_DISPATCH");
  });

  it("strips non-alphanumeric characters", () => {
    expect(renderRCName("Quests & Dispatch!")).toBe("QUESTS_DISPATCH");
  });
});

describe("assertWithinDir", () => {
  it("accepts a child path", async () => {
    const base = await makeTempDir();
    await mkdir(path.join(base, "Roadmap"));
    await expect(
      assertWithinDir(path.join(base, "Roadmap", "0_2_0_CORE.md"), path.join(base, "Roadmap")),
    ).resolves.toBeUndefined();
  });

  it("accepts the base itself", async () => {
    const base = await makeTempDir();
    await expect(assertWithinDir(base, base)).resolves.toBeUndefined();
  });

  it("rejects a sibling-prefix trap (Roadmap2 under Roadmap)", async () => {
    const base = await makeTempDir();
    await mkdir(path.join(base, "Roadmap"));
    await mkdir(path.join(base, "Roadmap2"));
    await expect(
      assertWithinDir(path.join(base, "Roadmap2", "file.md"), path.join(base, "Roadmap")),
    ).rejects.toThrow(PathSafetyError);
  });

  it("rejects an explicit parent traversal", async () => {
    const base = await makeTempDir();
    await mkdir(path.join(base, "Roadmap"));
    await expect(
      assertWithinDir(path.join(base, "Roadmap", "..", "escaped.md"), path.join(base, "Roadmap")),
    ).rejects.toThrow(PathSafetyError);
  });
});
