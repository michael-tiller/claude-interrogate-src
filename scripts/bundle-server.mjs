/**
 * Bundle server.js into a single self-contained file with all dependencies inlined.
 * This eliminates the need for node_modules in the distribution.
 */
import { build } from "esbuild";
import path from "node:path";

const root = process.cwd();

await build({
  entryPoints: [path.join(root, "dist", "server.js")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "esm",
  outfile: path.join(root, "dist", "server.bundle.js"),
  // Keep node builtins external — they're available at runtime
  external: ["node:*", "fs", "path", "os", "crypto", "events", "stream", "util", "buffer", "url", "http", "https", "net", "tls", "child_process", "readline"],
  banner: {
    js: "// claude-interrogate MCP server — self-contained bundle\n"
  },
  minify: false, // Keep readable for debugging
  sourcemap: false,
});

console.log("✓ Bundled dist/server.bundle.js (self-contained, no node_modules needed)");
