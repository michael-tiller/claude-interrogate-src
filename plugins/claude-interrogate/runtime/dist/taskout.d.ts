import { ConfirmedTaskoutPlan, RoadmapConfig, TaskoutMode, TaskoutStartResult } from "./types.js";
export declare class TaskoutError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export interface AnalyzeTaskoutInput {
    rcId: string;
    docsDir: string;
    outputDir: string;
    styleTemplatePath?: string;
    roadmapConfig: RoadmapConfig;
    configBaseDir: string;
    clock?: () => Date;
}
export interface GenerateTaskoutInput {
    plan: ConfirmedTaskoutPlan;
    outputDir: string;
    mode: TaskoutMode;
    roadmapConfig: RoadmapConfig;
    clock?: () => Date;
}
export declare function analyzeTaskout(input: AnalyzeTaskoutInput): Promise<TaskoutStartResult>;
export declare function generateTaskout(input: GenerateTaskoutInput): Promise<{
    path: string;
    content: string;
}>;
