import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const runtimeRoot = path.join(root, "runtime-dist");
const pluginSource = path.join(root, "plugins", "claude-interrogate");
const pluginDest = path.join(runtimeRoot, "plugins", "claude-interrogate");
const distSource = path.join(root, "dist");
const distDest = path.join(runtimeRoot, "runtime", "dist");
const marketplaceSource = path.join(root, ".agents", "plugins", "marketplace.json");
const marketplaceDest = path.join(runtimeRoot, ".agents", "plugins", "marketplace.json");

await rm(runtimeRoot, { recursive: true, force: true });
await mkdir(path.dirname(marketplaceDest), { recursive: true });
await mkdir(path.dirname(distDest), { recursive: true });

await cp(pluginSource, pluginDest, { recursive: true });
await cp(distSource, distDest, { recursive: true });

const pluginMcpPath = path.join(pluginDest, ".mcp.json");
const pluginMcp = JSON.parse(await readFile(pluginMcpPath, "utf8"));
pluginMcp.mcpServers["claude-interrogate"].args = ["../../runtime/dist/server.js"];
await writeFile(pluginMcpPath, JSON.stringify(pluginMcp, null, 2) + "\n", "utf8");

const marketplace = JSON.parse(await readFile(marketplaceSource, "utf8"));
marketplace.name = "claude-interrogate-runtime";
marketplace.interface.displayName = "Claude Interrogate";
await writeFile(marketplaceDest, JSON.stringify(marketplace, null, 2) + "\n", "utf8");

const runtimeReadme = `# Claude Interrogate Runtime
Updated: 2026-04-08

This directory is the distribution payload for the installable Claude Code plugin.

Contents:

- \`plugins/claude-interrogate/\` installable plugin payload
- \`runtime/dist/\` built MCP server runtime
- \`.agents/plugins/marketplace.json\` marketplace metadata

Install flow:

1. Publish this folder to the distribution repository root.
2. In Claude Code, add that repository as a marketplace.
3. Install:

\`\`\`text
/plugin marketplace add <distribution-repo>
/plugin install claude-interrogate-runtime@claude-interrogate
\`\`\`
`;

await writeFile(path.join(runtimeRoot, "README.md"), runtimeReadme, "utf8");
