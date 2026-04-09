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
  "plugins",
  "claude-interrogate",
  ".codex-plugin",
  "plugin.json",
);
const distributionMarketplacePath = path.join(distributionRoot, "marketplace.json");

const expectedRepoUrl = "https://github.com/michael-tiller/claude-interrogate";
const expectedDeveloperName = "Michael Tiller";

await assertExists(distributionRoot, "distribution-repo/ is missing. Clone or restore the distro repo checkout.");
await assertExists(distributionGitDir, "distribution-repo/.git is missing. The distro repo must remain a real checkout.");
await assertExists(
  distributionMarketplacePath,
  "distribution-repo/marketplace.json is missing. Claude Code marketplace add expects a root marketplace.json.",
);

const sourceManifest = await readManifest(sourcePluginManifestPath);
const distributionManifest = await readManifest(distributionPluginManifestPath);

assertPublicMetadata(sourceManifest, `Source plugin manifest ${sourcePluginManifestPath}`);
assertPublicMetadata(distributionManifest, `Distribution plugin manifest ${distributionPluginManifestPath}`);

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
