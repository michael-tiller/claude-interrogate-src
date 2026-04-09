import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distributionRoot = path.join(root, "distribution-repo");
const distributionGitDir = path.join(distributionRoot, ".git");
const sourcePluginManifestPath = path.join(
  root,
  "plugins",
  "claude-interrogate",
  ".codex-plugin",
  "plugin.json",
);
const distributionPluginManifestPath = path.join(
  distributionRoot,
  "plugin",
  ".codex-plugin",
  "plugin.json",
);
const distributionMarketplacePath = path.join(distributionRoot, ".claude-plugin", "marketplace.json");
const distributionRepoPluginManifestPath = path.join(
  distributionRoot,
  ".claude-plugin",
  "plugin.json",
);

const expectedRepoUrl = "https://github.com/michael-tiller/claude-interrogate";
const expectedDeveloperName = "Michael Tiller";

await assertExists(distributionRoot, "distribution-repo/ is missing. Clone or restore the distro repo checkout.");
await assertExists(distributionGitDir, "distribution-repo/.git is missing. The distro repo must remain a real checkout.");
await assertExists(
  distributionMarketplacePath,
  "distribution-repo/.claude-plugin/marketplace.json is missing. Claude Code marketplace add expects the public marketplace manifest there.",
);
await assertExists(
  distributionRepoPluginManifestPath,
  "distribution-repo/.claude-plugin/plugin.json is missing.",
);

const sourceManifest = await readManifest(sourcePluginManifestPath);
const distributionManifest = await readManifest(distributionPluginManifestPath);
const distributionMarketplace = await readManifest(distributionMarketplacePath);

assertPublicMetadata(sourceManifest, `Source plugin manifest ${sourcePluginManifestPath}`);
assertPublicMetadata(distributionManifest, `Distribution plugin manifest ${distributionPluginManifestPath}`);
assertMarketplaceMetadata(distributionMarketplace, distributionMarketplacePath);

console.log("Release readiness checks passed.");

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

function assertPublicMetadata(manifest, label) {
  const failures = [];

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
