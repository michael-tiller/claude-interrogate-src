import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runtimeRoot = path.join(root, "runtime-dist");
const distributionRoot = path.join(root, "distribution-repo");
const licenseSource = path.join(root, "LICENSE.md");
const licenseDest = path.join(runtimeRoot, "LICENSE.md");
const pluginSource = path.join(root, "plugins", "claude-interrogate");
const pluginDest = path.join(runtimeRoot, "plugin");
const distSource = path.join(root, "dist");
const distDest = path.join(runtimeRoot, "runtime", "dist");
const repoPluginManifestDest = path.join(runtimeRoot, ".claude-plugin", "plugin.json");
const marketplaceDest = path.join(runtimeRoot, ".claude-plugin", "marketplace.json");
const syncDistributionRepo = process.argv.includes("--sync-distribution-repo");

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function clearDirectory(targetDir, preservedNames = []) {
  const entries = await readdir(targetDir, { withFileTypes: true });
  for (const entry of entries) {
    if (preservedNames.includes(entry.name)) {
      continue;
    }

    await rm(path.join(targetDir, entry.name), { recursive: true, force: true });
  }
}

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(path.dirname(marketplaceDest), { recursive: true });
await mkdir(path.dirname(distDest), { recursive: true });

await cp(pluginSource, pluginDest, { recursive: true });
await cp(distSource, distDest, { recursive: true });
await cp(licenseSource, licenseDest);

const pluginMcpPath = path.join(pluginDest, ".mcp.json");
const pluginMcp = JSON.parse(await readFile(pluginMcpPath, "utf8"));
pluginMcp.mcpServers["claude-interrogate"].args = ["../runtime/dist/server.js"];
await writeFile(pluginMcpPath, JSON.stringify(pluginMcp, null, 2) + "\n", "utf8");

const pluginManifest = JSON.parse(
  await readFile(path.join(pluginSource, ".codex-plugin", "plugin.json"), "utf8"),
);

const marketplace = {
  name: "michael-tiller",
  owner: {
    name: "Michael Tiller",
  },
  metadata: {
    description: "Installable Claude Code plugin for Claude Interrogate.",
    homepage: "https://github.com/michael-tiller/claude-interrogate",
  },
  plugins: [
    {
      name: "claude-interrogate",
      version: pluginManifest.version,
      source: "./plugin",
      description:
        "Adversarial design-doc skillset for interrogating, auditing, and syncing design docs.",
    },
  ],
};

const repoPluginManifest = {
  name: "claude-interrogate",
  version: pluginManifest.version,
  description:
    "Installable Claude Code plugin for Claude Interrogate, an adversarial design-doc skillset.",
  author: {
    name: "Michael Tiller",
  },
  repository: "https://github.com/michael-tiller/claude-interrogate",
  license: "MIT",
  keywords: ["design-docs", "claude-code", "mcp", "architecture", "interview"],
};

await writeFile(marketplaceDest, JSON.stringify(marketplace, null, 2) + "\n", "utf8");
await writeFile(repoPluginManifestDest, JSON.stringify(repoPluginManifest, null, 2) + "\n", "utf8");

const runtimeReadme = `# Claude Interrogate Runtime
Updated: 2026-04-08

This directory is the distribution payload for the installable Claude Code plugin.

Contents:

- \`.claude-plugin/marketplace.json\` Claude Code marketplace metadata
- \`plugin/\` installable plugin payload
- \`runtime/dist/\` built MCP server runtime

Current command surface:

- \`/claude-interrogate:interrogate <concept> [docs-dir]\`
- \`/claude-interrogate:interrogate-easy <concept> [docs-dir]\`
- \`/claude-interrogate:interrogate-fast <concept> [docs-dir]\`
- \`/claude-interrogate:interrogate-hard <concept> [docs-dir]\`
- \`/claude-interrogate:reinterrogate <doc-path> [docs-dir]\`
- \`/claude-interrogate:distill <concept> [docs-dir]\`
- \`/claude-interrogate:distill-hard <concept> [docs-dir]\`
- \`/claude-interrogate:extricate <concept> [docs-dir]\`
- \`/claude-interrogate:trace <concept> [docs-dir]\`
- \`/claude-interrogate:convert <source> [docs-dir]\`
- \`/claude-interrogate:summarize <concept> [docs-dir]\`
- \`/claude-interrogate:audit-docs [docs-dir]\`
- \`/claude-interrogate:sync-docs [docs-dir]\`

Install from the plugin marketplace inside Claude Code:

\`\`\`text
/plugin marketplace add michael-tiller/claude-interrogate
/plugin install claude-interrogate
\`\`\`

Repository:

- https://github.com/michael-tiller/claude-interrogate

Notes:

- \`summarize\` is read-only and does not interrogate or write.
- \`trace\` is read-only structural mapping of authority, dependencies, and drift.
- \`distill\` writes a separate exploratory artifact only when explicitly requested; it does not replace the canonical spec.
- \`convert\` is for controlled promotion or transformation between doc forms.
- \`extricate\` is for dependency-aware removal, retirement, or replacement planning.
- \`reinterrogate\` is for modernizing an existing spec against newer sibling knowledge.
`;

await writeFile(path.join(runtimeRoot, "README.md"), runtimeReadme, "utf8");
await writeFile(path.join(runtimeRoot, ".gitignore"), ".DS_Store\nThumbs.db\n.vscode/\n", "utf8");

if (syncDistributionRepo) {
  if (!(await pathExists(distributionRoot))) {
    throw new Error(
      "distribution-repo/ does not exist. Clone or create the distribution repo before using --sync-distribution-repo.",
    );
  }

  await clearDirectory(distributionRoot, [".git"]);
  await cp(runtimeRoot, distributionRoot, { recursive: true });
}
