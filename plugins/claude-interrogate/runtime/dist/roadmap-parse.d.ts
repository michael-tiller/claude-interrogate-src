import { ParsedRC, ParsedRoadmapIndex, ParsedTechDebt } from "./types.js";
export declare function parseRoadmapIndex(absolutePath: string): Promise<ParsedRoadmapIndex | null>;
export declare function parseRCFile(absolutePath: string): Promise<ParsedRC | null>;
export declare function parseTechDebt(absolutePath: string): Promise<ParsedTechDebt | null>;
