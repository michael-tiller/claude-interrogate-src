import { ConfirmedScopePlan, RoadmapConfig, ScopeStartResult } from "./types.js";
export declare class ScopeError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface AnalyzeScopeInput {
    docsDir: string;
    outputDir: string;
    styleTemplatePath?: string;
    roadmapConfig: RoadmapConfig;
    configBaseDir: string;
    clock?: () => Date;
}
export interface GenerateScopeInput {
    plan: ConfirmedScopePlan;
    outputDir: string;
    mode: "bootstrap" | "maintenance";
    roadmapConfig: RoadmapConfig;
    clock?: () => Date;
}
export declare function analyzeScope(input: AnalyzeScopeInput): Promise<ScopeStartResult>;
export declare function generateScope(input: GenerateScopeInput): Promise<{
    paths: string[];
    content: {
        indexPath: string;
        indexContent: string;
        rcs: {
            path: string;
            content: string;
        }[];
    };
}>;
export declare function detectCycles(edges: {
    from: string;
    to: string;
}[]): string[][];
