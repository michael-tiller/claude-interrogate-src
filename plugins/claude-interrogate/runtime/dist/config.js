import { readFile } from "node:fs/promises";
import path from "node:path";
const CONFIG_CANDIDATES = ["claude-interrogate.json", ".claude-interrogate.json"];
export async function loadInterrogateConfig(cwd) {
    for (const candidate of CONFIG_CANDIDATES) {
        const candidatePath = path.join(cwd, candidate);
        try {
            const raw = await readFile(candidatePath, "utf8");
            const parsed = JSON.parse(raw);
            return {
                path: candidatePath,
                config: parsed && typeof parsed === "object" ? parsed : {}
            };
        }
        catch {
            continue;
        }
    }
    return {
        path: null,
        config: {}
    };
}
export async function resolveDefaultDocsDir(cwd) {
    const { config, path: configPath } = await loadInterrogateConfig(cwd);
    if (config.docsDir?.trim()) {
        const baseDir = configPath ? path.dirname(configPath) : cwd;
        return path.resolve(baseDir, config.docsDir);
    }
    return path.resolve(cwd, "docs");
}
export async function resolveDefaultStyleTemplate(cwd) {
    const { config, path: configPath } = await loadInterrogateConfig(cwd);
    if (!config.styleTemplate?.trim()) {
        return undefined;
    }
    const baseDir = configPath ? path.dirname(configPath) : cwd;
    return path.resolve(baseDir, config.styleTemplate);
}
