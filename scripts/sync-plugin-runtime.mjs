import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distSource = path.join(root, "dist");
const pluginRuntimeRoot = path.join(root, "plugins", "claude-interrogate", "runtime");
const pluginDistDest = path.join(pluginRuntimeRoot, "dist");

await rm(pluginDistDest, { recursive: true, force: true });
await mkdir(pluginRuntimeRoot, { recursive: true });
await cp(distSource, pluginDistDest, { recursive: true });

// Overwrite server.js with the self-contained bundle if available
const bundlePath = path.join(distSource, "server.bundle.js");
try {
  await stat(bundlePath);
  await cp(bundlePath, path.join(pluginDistDest, "server.js"));
} catch {
  // Bundle not yet built — the unbundled server.js remains (needs node_modules)
}
