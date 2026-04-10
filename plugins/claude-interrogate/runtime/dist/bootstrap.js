import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
const TODAY = "2026-04-08";
export async function bootstrapDocsSkeleton(docsDir, concept) {
    await mkdir(docsDir, { recursive: true });
    const files = [
        {
            name: "overview.md",
            content: `# Overview
Updated: ${TODAY}

## 1. Purpose

Define the system boundary for the project.

## Cross-References

- [${concept}](./${slugify(concept)}.md)

## Open Questions

- Which assumptions should become constraints for ${concept}?`
        },
        {
            name: `${slugify(concept)}.md`,
            content: `# ${toTitle(concept)}
Updated: ${TODAY}

## 1. Decision

Bootstrap placeholder for ${concept}.

## Cross-References

- [Overview](./overview.md)

## Open Questions

- What should the first real decision for ${concept} be?`
        }
    ];
    await Promise.all(files.map((file) => writeFile(path.join(docsDir, file.name), file.content, "utf8")));
    return files.map((file) => path.join(docsDir, file.name));
}
function slugify(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function toTitle(value) {
    return value
        .split(/[-_\s]+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}
