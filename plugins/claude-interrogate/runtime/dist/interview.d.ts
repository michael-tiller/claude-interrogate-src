import { InterviewStartResult } from "./types.js";
export declare function designInterviewStart(concept: string, docsDir: string, options?: {
    challenge?: boolean;
    challengeMode?: "easy" | "standard" | "adversarial";
    depthMode?: "fast" | "standard";
    styleTemplatePath?: string;
}): Promise<InterviewStartResult>;
