import { GenerateDocInput } from "./types.js";
export declare function designDocGenerate(input: GenerateDocInput, outputPath: string): Promise<{
    outputPath: string;
    content: string;
}>;
