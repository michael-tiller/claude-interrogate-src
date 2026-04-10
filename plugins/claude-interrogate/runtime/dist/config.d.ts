export interface InterrogateConfig {
    docsDir?: string;
    styleTemplate?: string;
}
export declare function loadInterrogateConfig(cwd: string): Promise<{
    path: string | null;
    config: InterrogateConfig;
}>;
export declare function resolveDefaultDocsDir(cwd: string): Promise<string>;
export declare function resolveDefaultStyleTemplate(cwd: string): Promise<string | undefined>;
