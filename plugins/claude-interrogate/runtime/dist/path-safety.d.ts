export declare class PathSafetyError extends Error {
    readonly field: string;
    constructor(field: string, message: string);
}
export declare function validateRelativePath(input: string, field: string): string;
export declare function validateRCId(id: string): void;
export declare function validateRCName(name: string): void;
export declare function validateNamingScheme(template: string): void;
export declare function renderRCName(rawName: string): string;
export declare function renderRCFilename(template: string, meta: {
    milestone: number;
    name: string;
    kind?: "build" | "release-candidate";
}): string;
export declare function assertWithinDir(targetPath: string, allowedBase: string): Promise<void>;
