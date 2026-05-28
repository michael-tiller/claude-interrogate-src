import path from "node:path";
import { loadInterrogateConfig } from "./config.js";
import { RoadmapConfig, ReservedSlot } from "./types.js";
import { PathSafetyError, validateNamingScheme, validateRelativePath } from "./path-safety.js";

const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

// Defaults are deliberately generic — interrogate is a general design tool,
// not specific to any project type. Game-dev or other domain-specific defaults
// (Wishlist/Early Access/Launch waypoints, multiple reserved slots for content
// passes, etc.) belong in per-project `claude-interrogate.json` files or in
// future opt-in presets, never as imposed defaults.
export const DEFAULT_ROADMAP_CONFIG: RoadmapConfig = Object.freeze({
  indexFile: "roadmap.md",
  rcDir: "Roadmap",
  rcNamingScheme: "{major}_{minor}_{patch}_{NAME}.md",
  techDebtFile: "Roadmap/TECHNICAL_DEBT.md",
  reservedSlots: [
    { version: "1.0.0", purpose: "First stable release" }
  ] as ReservedSlot[],
  marketingWaypoints: [],
  anchorSources: ["Concept", "Plan", "ADR"]
}) as RoadmapConfig;

export class RoadmapConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoadmapConfigError";
  }
}

export interface LoadedRoadmapConfig {
  config: RoadmapConfig;
  configBaseDir: string;
  configPath: string | null;
}

export function applyRoadmapConfigDefaults(
  partial: Record<string, unknown> | undefined | null
): RoadmapConfig {
  const source = (partial ?? {}) as Partial<RoadmapConfig> & {
    techDebtFile?: string | null;
  };

  const merged: RoadmapConfig = {
    indexFile: source.indexFile ?? DEFAULT_ROADMAP_CONFIG.indexFile,
    rcDir: source.rcDir ?? DEFAULT_ROADMAP_CONFIG.rcDir,
    rcNamingScheme: source.rcNamingScheme ?? DEFAULT_ROADMAP_CONFIG.rcNamingScheme,
    techDebtFile:
      source.techDebtFile === undefined
        ? DEFAULT_ROADMAP_CONFIG.techDebtFile
        : source.techDebtFile,
    reservedSlots: source.reservedSlots ?? [...DEFAULT_ROADMAP_CONFIG.reservedSlots],
    marketingWaypoints:
      source.marketingWaypoints ?? [...DEFAULT_ROADMAP_CONFIG.marketingWaypoints],
    anchorSources: source.anchorSources ?? [...DEFAULT_ROADMAP_CONFIG.anchorSources]
  };

  validateRoadmapConfig(merged);
  return merged;
}

export function validateRoadmapConfig(config: RoadmapConfig): void {
  try {
    validateRelativePath(config.indexFile, "roadmap.indexFile");
    validateRelativePath(config.rcDir, "roadmap.rcDir");
    if (config.techDebtFile !== null) {
      validateRelativePath(config.techDebtFile, "roadmap.techDebtFile");
    }
    validateNamingScheme(config.rcNamingScheme);
  } catch (error) {
    if (error instanceof PathSafetyError) {
      throw new RoadmapConfigError(error.message);
    }
    throw error;
  }

  if (!Array.isArray(config.reservedSlots)) {
    throw new RoadmapConfigError("roadmap.reservedSlots: must be an array");
  }

  const seenVersions = new Set<string>();
  for (const slot of config.reservedSlots) {
    if (!slot || typeof slot !== "object") {
      throw new RoadmapConfigError("roadmap.reservedSlots: each entry must be an object");
    }
    if (typeof slot.version !== "string" || !SEMVER_PATTERN.test(slot.version)) {
      throw new RoadmapConfigError(
        `roadmap.reservedSlots: invalid SemVer version: ${String(slot.version)}`
      );
    }
    if (typeof slot.purpose !== "string" || slot.purpose.length === 0) {
      throw new RoadmapConfigError(
        `roadmap.reservedSlots: purpose must be a non-empty string for version ${slot.version}`
      );
    }
    if (seenVersions.has(slot.version)) {
      throw new RoadmapConfigError(`roadmap.reservedSlots: duplicate version ${slot.version}`);
    }
    seenVersions.add(slot.version);
  }

  if (!Array.isArray(config.marketingWaypoints)) {
    throw new RoadmapConfigError("roadmap.marketingWaypoints: must be an array");
  }
  for (const waypoint of config.marketingWaypoints) {
    if (typeof waypoint !== "string" || waypoint.length === 0) {
      throw new RoadmapConfigError(
        "roadmap.marketingWaypoints: each entry must be a non-empty string"
      );
    }
  }

  if (!Array.isArray(config.anchorSources)) {
    throw new RoadmapConfigError("roadmap.anchorSources: must be an array");
  }
  for (const source of config.anchorSources) {
    if (typeof source !== "string" || source.length === 0) {
      throw new RoadmapConfigError(
        "roadmap.anchorSources: each entry must be a non-empty string"
      );
    }
  }
}

export async function loadRoadmapConfig(cwd: string): Promise<LoadedRoadmapConfig> {
  const { config: raw, path: configPath } = await loadInterrogateConfig(cwd);
  const config = applyRoadmapConfigDefaults(raw.roadmap);
  return {
    config,
    configBaseDir: configPath ? path.dirname(configPath) : cwd,
    configPath
  };
}
