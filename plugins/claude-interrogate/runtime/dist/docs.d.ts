import { DocFile, HouseStyle, SectionInfo } from "./types.js";
export declare const DEFAULT_DOC_VERSION = "0.1.0";
export declare function ensureDocsDir(docsDir: string): Promise<void>;
export declare function loadDocs(docsDir: string): Promise<DocFile[]>;
export declare function loadDocFile(filePath: string): Promise<DocFile>;
export declare function detectHouseStyle(docs: DocFile[]): HouseStyle;
export declare function listSections(content: string): SectionInfo[];
export declare function getSectionBody(content: string, heading: string): string | null;
export declare function extractBullets(sectionBody: string): string[];
export declare function summarizeDocs(docs: DocFile[]): string[];
export declare function extractCrossReferences(content: string): string[];
export declare function extractOpenQuestions(content: string, openQuestionsHeading: string): string[];
export declare function replaceOrAppendSection(content: string, heading: string, body: string): string;
export declare function ensureUpdatedDate(content: string, isoDate: string): string;
export declare function ensureCreatedDate(content: string, isoDate: string): string;
export declare function ensureVersionLine(content: string, version: string): string;
export declare function ensureDocumentMetadata(content: string, isoDate: string, version: string): string;
export declare function postEditNormalizeDocument(previousContent: string | undefined, nextContent: string, isoDate: string, options?: {
    crossRefHeading?: string;
    openQuestionsHeading?: string;
}): {
    content: string;
    version: string;
    bump: "major" | "minor" | "patch" | "none";
};
export declare function moveSectionBefore(content: string, heading: string, beforeHeading: string): string;
export declare function removeSection(content: string, heading: string): string;
