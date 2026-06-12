import { RCKind, RoadmapConfig } from "./types.js";
export declare class RoadmapMigrateError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface MigrateRoadmapInput {
    outputDir: string;
    roadmapConfig: RoadmapConfig;
    apply?: boolean;
    normalizeMarkers?: boolean;
    clock?: () => Date;
}
export interface ScannedRCFile {
    filename: string;
    rcId: string;
    milestoneDigits: string;
    milestone: number;
    kind: RCKind;
    name: string;
    status: string;
    zeroPadded: boolean;
    nonstandardMarkers: {
        line: number;
        marker: string;
    }[];
    numberedChecklistLines: number[];
    flatTargetedLines: number[];
}
export interface MigrateRoadmapResult {
    mode: "dry-run" | "applied";
    indexPath: string;
    files: ScannedRCFile[];
    paddingDetected: boolean;
    suggestedNamingScheme: string;
    proposedIndex: string;
    markersNormalized: number;
    warnings: string[];
}
export declare function migrateRoadmap(input: MigrateRoadmapInput): Promise<MigrateRoadmapResult>;
