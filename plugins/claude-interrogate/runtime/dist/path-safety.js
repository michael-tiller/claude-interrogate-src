import path from "node:path";
import { realpath } from "node:fs/promises";
const RC_ID_PATTERN = /^M[0-9]+_[A-Z][A-Z0-9_]*$/;
const RC_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const REQUIRED_PLACEHOLDERS = ["{milestone}", "{NAME}"];
const KNOWN_PLACEHOLDERS = new Set(["{milestone}", "{NAME}"]);
const PLACEHOLDER_PATTERN = /\{[^}]+\}/g;
export class PathSafetyError extends Error {
    field;
    constructor(field, message) {
        super(`${field}: ${message}`);
        this.field = field;
        this.name = "PathSafetyError";
    }
}
export function validateRelativePath(input, field) {
    if (typeof input !== "string" || input.length === 0) {
        throw new PathSafetyError(field, "must be a non-empty string");
    }
    if (path.isAbsolute(input)) {
        throw new PathSafetyError(field, `must be relative, got absolute path: ${input}`);
    }
    if (/^[A-Za-z]:[\\/]/.test(input)) {
        throw new PathSafetyError(field, `must not contain a drive letter: ${input}`);
    }
    const normalized = input.replace(/\\/g, "/");
    const segments = normalized.split("/").filter((segment) => segment.length > 0);
    if (segments.length === 0) {
        throw new PathSafetyError(field, "must contain at least one path segment");
    }
    for (const segment of segments) {
        if (segment === "..") {
            throw new PathSafetyError(field, `must not contain parent traversal (..): ${input}`);
        }
        if (segment === ".") {
            throw new PathSafetyError(field, `must not contain current-dir segments (.): ${input}`);
        }
    }
    return segments.join("/");
}
export function validateRCId(id) {
    if (typeof id !== "string" || !RC_ID_PATTERN.test(id)) {
        throw new PathSafetyError("rc.id", `must match ^M[0-9]+_[A-Z][A-Z0-9_]*$ (e.g. M8_QUESTS), got: ${id}`);
    }
}
export function validateRCName(name) {
    if (typeof name !== "string" || !RC_NAME_PATTERN.test(name)) {
        throw new PathSafetyError("rc.name", `must match ^[A-Z][A-Z0-9_]*$ (uppercase letters/digits/underscore, leading letter), got: ${name}`);
    }
}
export function validateNamingScheme(template) {
    if (typeof template !== "string" || template.length === 0) {
        throw new PathSafetyError("roadmap.rcNamingScheme", "must be a non-empty string");
    }
    for (const required of REQUIRED_PLACEHOLDERS) {
        if (!template.includes(required)) {
            throw new PathSafetyError("roadmap.rcNamingScheme", `must contain required placeholder ${required}, got: ${template}`);
        }
    }
    const found = template.match(PLACEHOLDER_PATTERN) ?? [];
    for (const placeholder of found) {
        if (!KNOWN_PLACEHOLDERS.has(placeholder)) {
            throw new PathSafetyError("roadmap.rcNamingScheme", `unknown placeholder ${placeholder} (allowed: ${[...KNOWN_PLACEHOLDERS].join(", ")})`);
        }
    }
    if (!template.endsWith(".md")) {
        throw new PathSafetyError("roadmap.rcNamingScheme", `must end in .md, got: ${template}`);
    }
    const withoutPlaceholders = template.replace(PLACEHOLDER_PATTERN, "X");
    if (/[\\/]/.test(withoutPlaceholders)) {
        throw new PathSafetyError("roadmap.rcNamingScheme", `literal text must not contain path separators, got: ${template}`);
    }
    if (withoutPlaceholders.startsWith(".")) {
        throw new PathSafetyError("roadmap.rcNamingScheme", `literal text must not begin with '.', got: ${template}`);
    }
    if (withoutPlaceholders.includes("..")) {
        throw new PathSafetyError("roadmap.rcNamingScheme", `literal text must not contain '..', got: ${template}`);
    }
}
export function renderRCName(rawName) {
    return rawName
        .normalize("NFKD")
        .replace(/[^A-Za-z0-9\s_]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .toUpperCase();
}
export function renderRCFilename(template, meta) {
    validateNamingScheme(template);
    if (!Number.isInteger(meta.milestone) || meta.milestone < 0) {
        throw new PathSafetyError("rc.milestone", `must be a non-negative integer, got: ${meta.milestone}`);
    }
    validateRCName(meta.name);
    const rendered = template
        .replace(/\{milestone\}/g, String(meta.milestone))
        .replace(/\{NAME\}/g, meta.name);
    validateRelativePath(rendered, "renderedRCFilename");
    if (/[\\/]/.test(rendered)) {
        throw new PathSafetyError("renderedRCFilename", `rendered filename must not contain path separators, got: ${rendered}`);
    }
    return rendered;
}
async function canonicalize(target) {
    try {
        return await realpath(target);
    }
    catch {
        const parent = path.dirname(target);
        if (parent === target) {
            return path.resolve(target);
        }
        try {
            const realParent = await realpath(parent);
            return path.resolve(realParent, path.basename(target));
        }
        catch {
            return path.resolve(target);
        }
    }
}
export async function assertWithinDir(targetPath, allowedBase) {
    const resolvedBase = await canonicalize(path.resolve(allowedBase));
    const resolvedTarget = await canonicalize(path.resolve(targetPath));
    const rel = path.relative(resolvedBase, resolvedTarget);
    if (rel === "") {
        return;
    }
    if (path.isAbsolute(rel)) {
        throw new PathSafetyError("outputPath", `target escapes allowed base (different root): base=${resolvedBase} target=${resolvedTarget}`);
    }
    const firstSegment = rel.split(/[\\/]/, 1)[0];
    if (firstSegment === "..") {
        throw new PathSafetyError("outputPath", `target escapes allowed base: base=${resolvedBase} target=${resolvedTarget}`);
    }
}
