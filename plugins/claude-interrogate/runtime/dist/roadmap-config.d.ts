import { RoadmapConfig } from "./types.js";
export declare const DEFAULT_ROADMAP_CONFIG: RoadmapConfig;
export declare class RoadmapConfigError extends Error {
    constructor(message: string);
}
export interface LoadedRoadmapConfig {
    config: RoadmapConfig;
    configBaseDir: string;
    configPath: string | null;
}
export declare function applyRoadmapConfigDefaults(partial: Record<string, unknown> | undefined | null): RoadmapConfig;
export declare function validateRoadmapConfig(config: RoadmapConfig): void;
export declare function loadRoadmapConfig(cwd: string): Promise<LoadedRoadmapConfig>;
