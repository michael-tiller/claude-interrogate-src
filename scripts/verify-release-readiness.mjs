import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runtimeRoot = path.join(root, "runtime-dist");
const distributionRoot = path.join(root, "distribution-repo");

// Subdirectories and files that ship as part of the published artifact.
// `.git`, `.gitignore`, and similar repo-local files are deliberately excluded
// because they differ between runtime-dist (no git) and distribution-repo
// (has git history) without affecting what users install.
const SHIPPED_PAYLOAD_ENTRIES = [
  ".claude-plugin",
  "plugin",
  "runtime",
  "README.md",
  "LICENSE.md",
  ".mcp.json",
];
const sourcePluginManifestPath = path.join(
  root,
  "plugins",
  "claude-interrogate",
  ".codex-plugin",
  "plugin.json",
);
const runtimePluginManifestPath = path.join(
  runtimeRoot,
  "plugin",
  ".codex-plugin",
  "plugin.json",
);
const runtimeMarketplacePath = path.join(runtimeRoot, ".claude-plugin", "marketplace.json");
const runtimeMcpConfigPath = path.join(runtimeRoot, ".mcp.json");
const runtimeRepoPluginManifestPath = path.join(
  runtimeRoot,
  ".claude-plugin",
  "plugin.json",
);
const sourcePluginMcpConfigPath = path.join(root, "plugins", "claude-interrogate", ".mcp.json");
const runtimePluginMcpConfigPath = path.join(runtimeRoot, "plugin", ".mcp.json");
const sourcePluginRuntimeServerPath = path.join(
  root,
  "plugins",
  "claude-interrogate",
  "runtime",
  "dist",
  "server.js",
);
const runtimePluginRuntimeServerPath = path.join(
  runtimeRoot,
  "plugin",
  "runtime",
  "dist",
  "server.js",
);
const sourcePluginSkillsPath = path.join(root, "plugins", "claude-interrogate", "skills");
const runtimePluginSkillsPath = path.join(runtimeRoot, "plugin", "skills");

const expectedRepoUrl = "https://github.com/michael-tiller/claude-interrogate";
const expectedDeveloperName = "Michael Tiller";

await assertExists(
  runtimeRoot,
  "runtime-dist/ is missing. Run `npm run prepare:runtime-dist` before `npm run check:release`.",
);
await assertExists(
  runtimeMarketplacePath,
  "runtime-dist/.claude-plugin/marketplace.json is missing. Rebuild the runtime payload before running release checks.",
);
await assertExists(
  runtimeMcpConfigPath,
  "runtime-dist/.mcp.json is missing. Codex manual MCP attachment expects the runtime config there.",
);
await assertExists(
  runtimeRepoPluginManifestPath,
  "runtime-dist/.claude-plugin/plugin.json is missing.",
);
await assertExists(
  sourcePluginMcpConfigPath,
  "plugins/claude-interrogate/.mcp.json is missing.",
);
await assertExists(
  runtimePluginMcpConfigPath,
  "runtime-dist/plugin/.mcp.json is missing.",
);
await assertExists(
  sourcePluginRuntimeServerPath,
  "plugins/claude-interrogate/runtime/dist/server.js is missing. Run `npm run build` before release checks.",
);
await assertExists(
  runtimePluginRuntimeServerPath,
  "runtime-dist/plugin/runtime/dist/server.js is missing. Rebuild the runtime payload before running release checks.",
);
await assertExists(
  sourcePluginSkillsPath,
  "plugins/claude-interrogate/skills is missing.",
);
await assertExists(
  runtimePluginSkillsPath,
  "runtime-dist/plugin/skills is missing. Rebuild the runtime payload before running release checks.",
);

const newCommandsAndSkills = [
  {
    sourcePath: path.join(root, "plugins", "claude-interrogate", "commands", "roadmap.md"),
    runtimePath: path.join(runtimeRoot, "plugin", "commands", "roadmap.md"),
    label: "/roadmap command",
  },
  {
    sourcePath: path.join(root, "plugins", "claude-interrogate", "commands", "taskout.md"),
    runtimePath: path.join(runtimeRoot, "plugin", "commands", "taskout.md"),
    label: "/taskout command",
  },
  {
    sourcePath: path.join(
      root,
      "plugins",
      "claude-interrogate",
      "skills",
      "claude-interrogate-roadmap",
      "SKILL.md",
    ),
    runtimePath: path.join(
      runtimeRoot,
      "plugin",
      "skills",
      "claude-interrogate-roadmap",
      "SKILL.md",
    ),
    label: "Codex roadmap skill",
  },
  {
    sourcePath: path.join(
      root,
      "plugins",
      "claude-interrogate",
      "skills",
      "claude-interrogate-taskout",
      "SKILL.md",
    ),
    runtimePath: path.join(
      runtimeRoot,
      "plugin",
      "skills",
      "claude-interrogate-taskout",
      "SKILL.md",
    ),
    label: "Codex taskout skill",
  },
];

for (const entry of newCommandsAndSkills) {
  await assertExists(
    entry.sourcePath,
    `${entry.label} source is missing at ${entry.sourcePath}.`,
  );
  await assertExists(
    entry.runtimePath,
    `${entry.label} runtime payload is missing at ${entry.runtimePath}. Rebuild the runtime payload.`,
  );
}

const runtimeReadmePath = path.join(runtimeRoot, "README.md");
await assertExists(
  runtimeReadmePath,
  "runtime-dist/README.md is missing. Rebuild the runtime payload before running release checks.",
);
const runtimeReadme = await readFile(runtimeReadmePath, "utf8");
const readmeTokens = [
  "/claude-interrogate:roadmap",
  "/claude-interrogate:taskout",
  "claude-interrogate-roadmap",
  "claude-interrogate-taskout",
];
for (const token of readmeTokens) {
  if (!runtimeReadme.includes(token)) {
    throw new Error(
      `runtime-dist/README.md must mention "${token}". Update scripts/prepare-runtime-dist.mjs.`,
    );
  }
}

const sourceManifest = await readManifest(sourcePluginManifestPath);
const runtimeManifest = await readManifest(runtimePluginManifestPath);
const runtimeMarketplace = await readManifest(runtimeMarketplacePath);
const runtimeMcpConfig = await readManifest(runtimeMcpConfigPath);
const sourcePluginMcpConfig = await readManifest(sourcePluginMcpConfigPath);
const runtimePluginMcpConfig = await readManifest(runtimePluginMcpConfigPath);

const expectedSkillsPath = sourceManifest.skills;
if (typeof expectedSkillsPath !== "string" || !expectedSkillsPath.startsWith("./")) {
  throw new Error(
    `Source plugin manifest ${sourcePluginManifestPath} must include a relative skills path (found: ${String(expectedSkillsPath)})`,
  );
}

assertPublicMetadata(sourceManifest, `Source plugin manifest ${sourcePluginManifestPath}`, {
  expectedSkillsPath,
});
assertPublicMetadata(runtimeManifest, `Runtime plugin manifest ${runtimePluginManifestPath}`, {
  expectedSkillsPath,
});
assertMarketplaceMetadata(runtimeMarketplace, runtimeMarketplacePath);
assertMcpConfig(runtimeMcpConfig, runtimeMcpConfigPath);
assertPluginMcpConfig(sourcePluginMcpConfig, sourcePluginMcpConfigPath);
assertPluginMcpConfig(runtimePluginMcpConfig, runtimePluginMcpConfigPath);

await verifyDistributionInSync();

console.log("Release readiness checks passed.");

async function verifyDistributionInSync() {
  // When the script runs from `prepare:distribution-repo`, distribution-repo is
  // guaranteed to exist (prepare-runtime-dist.mjs throws if --sync-distribution-repo
  // was passed without it). When the script runs from `prepare:runtime-dist`
  // standalone (a runtime-only dev flow), distribution-repo may not be cloned at
  // all, and there's nothing to check. We log the decision either way so the
  // action is visible — never silent.
  const distributionExists = await pathExists(distributionRoot);
  if (!distributionExists) {
    console.log(
      "Distribution sync check: skipped (distribution-repo/ not present — runtime-only flow).",
    );
    return;
  }

  console.log("Distribution sync check: comparing runtime-dist/ against distribution-repo/...");

  const drift = [];

  for (const entry of SHIPPED_PAYLOAD_ENTRIES) {
    const runtimePath = path.join(runtimeRoot, entry);
    const distributionPath = path.join(distributionRoot, entry);

    const runtimeHasEntry = await pathExists(runtimePath);
    const distributionHasEntry = await pathExists(distributionPath);

    if (!runtimeHasEntry && !distributionHasEntry) continue;
    if (!runtimeHasEntry) {
      drift.push(`distribution-repo has "${entry}" but runtime-dist does not`);
      continue;
    }
    if (!distributionHasEntry) {
      drift.push(`runtime-dist has "${entry}" but distribution-repo does not`);
      continue;
    }

    const entryDrift = await diffEntry(runtimePath, distributionPath, entry);
    drift.push(...entryDrift);
  }

  if (drift.length > 0) {
    throw new Error(
      [
        "distribution-repo/ is out of sync with runtime-dist/.",
        "This is the failure mode that caused v0.1.3 to ship without the new flows.",
        "Run `npm run prepare:distribution-repo` to regenerate distribution-repo before releasing.",
        "Drift:",
        ...drift.map((d) => `  - ${d}`),
      ].join("\n"),
    );
  }

  console.log("Distribution sync check: passed.");
}

async function diffEntry(runtimePath, distributionPath, relativeLabel) {
  const runtimeStat = await stat(runtimePath);
  const distributionStat = await stat(distributionPath);

  if (runtimeStat.isDirectory() !== distributionStat.isDirectory()) {
    return [
      `"${relativeLabel}" is a ${runtimeStat.isDirectory() ? "directory" : "file"} in runtime-dist but a ${
        distributionStat.isDirectory() ? "directory" : "file"
      } in distribution-repo`,
    ];
  }

  if (runtimeStat.isDirectory()) {
    return diffDirectory(runtimePath, distributionPath, relativeLabel);
  }

  return diffFile(runtimePath, distributionPath, relativeLabel);
}

async function diffDirectory(runtimePath, distributionPath, relativeLabel) {
  const drift = [];
  const runtimeEntries = new Set(await readdir(runtimePath));
  const distributionEntries = new Set(await readdir(distributionPath));

  const all = new Set([...runtimeEntries, ...distributionEntries]);

  for (const child of all) {
    const childLabel = `${relativeLabel}/${child}`;
    const inRuntime = runtimeEntries.has(child);
    const inDistribution = distributionEntries.has(child);

    if (inRuntime && !inDistribution) {
      drift.push(`"${childLabel}" exists in runtime-dist but not distribution-repo`);
      continue;
    }
    if (!inRuntime && inDistribution) {
      drift.push(`"${childLabel}" exists in distribution-repo but not runtime-dist`);
      continue;
    }

    const childRuntime = path.join(runtimePath, child);
    const childDistribution = path.join(distributionPath, child);
    drift.push(...(await diffEntry(childRuntime, childDistribution, childLabel)));
  }

  return drift;
}

async function diffFile(runtimePath, distributionPath, relativeLabel) {
  const runtimeBytes = await readFile(runtimePath);
  const distributionBytes = await readFile(distributionPath);

  if (runtimeBytes.equals(distributionBytes)) return [];
  return [`"${relativeLabel}" content differs between runtime-dist and distribution-repo`];
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function assertExists(targetPath, message) {
  try {
    await access(targetPath);
  } catch {
    throw new Error(message);
  }
}

async function readManifest(manifestPath) {
  return JSON.parse(await readFile(manifestPath, "utf8"));
}

function assertPublicMetadata(manifest, label, options = {}) {
  const failures = [];

  if (options.expectedSkillsPath && manifest.skills !== options.expectedSkillsPath) {
    failures.push(`skills must be "${options.expectedSkillsPath}"`);
  }

  if (manifest.author?.name !== expectedDeveloperName) {
    failures.push(`author.name must be "${expectedDeveloperName}"`);
  }

  if (manifest.author?.url !== expectedRepoUrl) {
    failures.push(`author.url must be "${expectedRepoUrl}"`);
  }

  if (manifest.homepage !== expectedRepoUrl) {
    failures.push(`homepage must be "${expectedRepoUrl}"`);
  }

  if (manifest.repository !== expectedRepoUrl) {
    failures.push(`repository must be "${expectedRepoUrl}"`);
  }

  if (manifest.interface?.developerName !== expectedDeveloperName) {
    failures.push(`interface.developerName must be "${expectedDeveloperName}"`);
  }

  if (manifest.interface?.websiteURL !== expectedRepoUrl) {
    failures.push(`interface.websiteURL must be "${expectedRepoUrl}"`);
  }

  if (manifest.interface?.privacyPolicyURL !== expectedRepoUrl) {
    failures.push(`interface.privacyPolicyURL must be "${expectedRepoUrl}"`);
  }

  if (manifest.interface?.termsOfServiceURL !== expectedRepoUrl) {
    failures.push(`interface.termsOfServiceURL must be "${expectedRepoUrl}"`);
  }

  if (typeof manifest.description === "string" && /\binternal\b/i.test(manifest.description)) {
    failures.push('description must not contain "internal"');
  }

  if (
    typeof manifest.interface?.longDescription === "string" &&
    /\binternal\b/i.test(manifest.interface.longDescription)
  ) {
    failures.push('interface.longDescription must not contain "internal"');
  }

  if (failures.length > 0) {
    throw new Error(`${label} failed release-readiness checks:\n- ${failures.join("\n- ")}`);
  }
}

function assertMarketplaceMetadata(marketplace, label) {
  const failures = [];

  if (marketplace.name !== "michael-tiller") {
    failures.push('name must be "michael-tiller"');
  }

  if (marketplace.owner?.name !== expectedDeveloperName) {
    failures.push(`owner.name must be "${expectedDeveloperName}"`);
  }

  if (marketplace.metadata?.homepage !== expectedRepoUrl) {
    failures.push(`metadata.homepage must be "${expectedRepoUrl}"`);
  }

  if (!Array.isArray(marketplace.plugins) || marketplace.plugins.length !== 1) {
    failures.push("plugins must contain exactly one public plugin entry");
  } else {
    const plugin = marketplace.plugins[0];
    if (plugin.name !== "claude-interrogate") {
      failures.push('plugins[0].name must be "claude-interrogate"');
    }
    if (plugin.source !== "./plugin") {
      failures.push('plugins[0].source must be "./plugin"');
    }
  }

  if (failures.length > 0) {
    throw new Error(`${label} failed marketplace checks:\n- ${failures.join("\n- ")}`);
  }
}

function assertMcpConfig(config, label) {
  const failures = [];

  const server = config?.mcpServers?.["claude-interrogate"];
  if (!server) {
    failures.push('mcpServers["claude-interrogate"] must exist');
  } else {
    if (server.command !== "node") {
      failures.push('mcpServers["claude-interrogate"].command must be "node"');
    }
    if (!Array.isArray(server.args) || server.args.length !== 1) {
      failures.push('mcpServers["claude-interrogate"].args must contain exactly one runtime path');
    } else if (server.args[0] !== "./runtime/dist/server.js") {
      failures.push('mcpServers["claude-interrogate"].args[0] must be "./runtime/dist/server.js"');
    }
  }

  if (failures.length > 0) {
    throw new Error(`${label} failed MCP config checks:\n- ${failures.join("\n- ")}`);
  }
}

function assertPluginMcpConfig(config, label) {
  const failures = [];

  const server = config?.mcpServers?.["claude-interrogate"];
  if (!server) {
    failures.push('mcpServers["claude-interrogate"] must exist');
  } else {
    if (server.command !== "node") {
      failures.push('mcpServers["claude-interrogate"].command must be "node"');
    }

    if (!Array.isArray(server.args) || server.args.length !== 3) {
      failures.push(
        'mcpServers["claude-interrogate"].args must contain ["--input-type=commonjs", "-e", "<script>"]',
      );
    } else {
      if (server.args[0] !== "--input-type=commonjs") {
        failures.push(
          'mcpServers["claude-interrogate"].args[0] must be "--input-type=commonjs"',
        );
      }

      if (server.args[1] !== "-e") {
        failures.push('mcpServers["claude-interrogate"].args[1] must be "-e"');
      }

      if (typeof server.args[2] !== "string") {
        failures.push('mcpServers["claude-interrogate"].args[2] must be a script');
      } else {
        const requiredTokens = [
          "claude-interrogate",
          "runtime",
          "dist",
          "server.js",
          ".codex",
          "plugins",
          "cache",
          "claude-interrogate MCP server",
        ];

        for (const token of requiredTokens) {
          if (!server.args[2].includes(token)) {
            failures.push(
              `mcpServers["claude-interrogate"].args[2] must include "${token}"`,
            );
          }
        }
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`${label} failed plugin MCP config checks:\n- ${failures.join("\n- ")}`);
  }
}
