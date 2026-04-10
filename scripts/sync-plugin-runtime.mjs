import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const distSource = path.join(root, "dist");
const pluginRuntimeRoot = path.join(root, "plugins", "claude-interrogate", "runtime");
const pluginDistDest = path.join(pluginRuntimeRoot, "dist");

await rm(pluginDistDest, { recursive: true, force: true });
await mkdir(pluginRuntimeRoot, { recursive: true });
await cp(distSource, pluginDistDest, { recursive: true });
