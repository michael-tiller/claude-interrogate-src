import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runtimeRoot = path.join(root, "runtime-dist");
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

const sourceManifest = await readManifest(sourcePluginManifestPath);
const runtimeManifest = await readManifest(runtimePluginManifestPath);
const runtimeMarketplace = await readManifest(runtimeMarketplacePath);
const runtimeMcpConfig = await readManifest(runtimeMcpConfigPath);
const sourcePluginMcpConfig = await readManifest(sourcePluginMcpConfigPath);
const runtimePluginMcpConfig = await readManifest(runtimePluginMcpConfigPath);

assertPublicMetadata(sourceManifest, `Source plugin manifest ${sourcePluginManifestPath}`);
assertPublicMetadata(runtimeManifest, `Runtime plugin manifest ${runtimePluginManifestPath}`);
assertMarketplaceMetadata(runtimeMarketplace, runtimeMarketplacePath);
assertMcpConfig(runtimeMcpConfig, runtimeMcpConfigPath);
assertPluginMcpConfig(sourcePluginMcpConfig, sourcePluginMcpConfigPath);
assertPluginMcpConfig(runtimePluginMcpConfig, runtimePluginMcpConfigPath);

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
        failures.push(
          'mcpServers["claude-interrogate"].args[2] must be a script that loads ./runtime/dist/server.js',
        );
      } else {
        const requiredTokens = [
          "CLAUDE_PLUGIN_ROOT",
          "CODEX_PLUGIN_ROOT",
          "PLUGIN_ROOT",
          "INIT_CWD",
          "PWD",
          "runtime",
          "dist",
          "server.js",
          "claude-interrogate MCP server",
        ];
        const missingTokens = requiredTokens.filter(
          (token) => !server.args[2].includes(token),
        );
        if (missingTokens.length > 0) {
          failures.push(
            `mcpServers["claude-interrogate"].args[2] must be a script that loads ./runtime/dist/server.js (missing: ${missingTokens.join(", ")})`,
          );
        }
      }
    }
  }

  if (failures.length > 0) {
    throw new Error(`${label} failed plugin MCP config checks:\n- ${failures.join("\n- ")}`);
  }
}
