import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { DocFile, HouseStyle, SectionInfo } from "./types.js";

export const DEFAULT_DOC_VERSION = "0.1.0";

const DEFAULT_STYLE: HouseStyle = {
  sectionNumbering: "## 1.",
  crossRefHeading: "Cross-References",
  openQuestionsHeading: "Open Questions",
  toneCues: ["terse", "decision-oriented", "cross-linked"]
};

const SECTION_MARKER = /^(#{1,6}\s+|(?:§|Â§)\d+)/;

export async function ensureDocsDir(docsDir: string): Promise<void> {
  const info = await stat(docsDir);
  if (!info.isDirectory()) {
    throw new Error(`Docs path is not a directory: ${docsDir}`);
  }
}

export async function loadDocs(docsDir: string): Promise<DocFile[]> {
  await ensureDocsDir(docsDir);
  const entries = await readdir(docsDir, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.name.localeCompare(b.name));

  return Promise.all(
    files.map(async (file) => {
      const filePath = path.join(docsDir, file.name);
      const content = await readFile(filePath, "utf8");
      return {
        path: filePath,
        name: file.name,
        title: extractTitle(file.name, content),
        content
      } satisfies DocFile;
    })
  );
}

export async function loadDocFile(filePath: string): Promise<DocFile> {
  const content = await readFile(filePath, "utf8");
  return {
    path: filePath,
    name: path.basename(filePath),
    title: extractTitle(path.basename(filePath), content),
    content
  };
}

export function detectHouseStyle(docs: DocFile[]): HouseStyle {
  if (docs.length === 0) {
    return DEFAULT_STYLE;
  }

  let sectionNumbering = DEFAULT_STYLE.sectionNumbering;
  let crossRefHeading = DEFAULT_STYLE.crossRefHeading;
  let openQuestionsHeading = DEFAULT_STYLE.openQuestionsHeading;

  for (const doc of docs) {
    if (sectionNumbering === DEFAULT_STYLE.sectionNumbering) {
      const numberingMatch = doc.content.match(/^((?:§|Â§)\d+|##\s+\d+\.|#\s+\d+\.)/m);
      if (numberingMatch) {
        sectionNumbering = numberingMatch[1];
      }
    }

    const crossRefMatch = findHeading(doc.content, /(cross[- ]references?|related docs?)/i);
    if (crossRefMatch) {
      crossRefHeading = crossRefMatch;
    }

    const openQuestionsMatch = findHeading(doc.content, /open questions?/i);
    if (openQuestionsMatch) {
      openQuestionsHeading = openQuestionsMatch;
    }
  }

  return {
    sectionNumbering,
    crossRefHeading,
    openQuestionsHeading,
    toneCues: inferToneCues(docs)
  };
}

export function listSections(content: string): SectionInfo[] {
  const lines = content.split(/\r?\n/);
  const sections: SectionInfo[] = [];
  let currentHeading = "Preamble";
  let buffer: string[] = [];

  const flush = () => {
    sections.push({ heading: currentHeading, body: buffer.join("\n").trim() });
    buffer = [];
  };

  for (const line of lines) {
    if (SECTION_MARKER.test(line)) {
      flush();
      currentHeading = normalizeHeading(line);
      continue;
    }
    buffer.push(line);
  }
  flush();

  return sections.filter((section) => section.body.length > 0);
}

export function getSectionBody(content: string, heading: string): string | null {
  const normalizedHeading = heading.toLowerCase();
  const section = listSections(content).find(
    (entry) => entry.heading.toLowerCase() === normalizedHeading
  );
  return section?.body ?? null;
}

export function extractBullets(sectionBody: string): string[] {
  return sectionBody
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ""));
}

export function summarizeDocs(docs: DocFile[]): string[] {
  return docs.flatMap((doc) =>
    listSections(doc.content)
      .slice(0, 6)
      .map((section) => `${doc.title}: ${section.heading} -> ${compact(section.body)}`)
  );
}

export function extractCrossReferences(content: string): string[] {
  return Array.from(content.matchAll(/\[([^\]]+)\]\(([^)]+\.md)\)/g)).map((match) => match[2]);
}

export function extractOpenQuestions(content: string, openQuestionsHeading: string): string[] {
  const sections = listSections(content);
  const section = sections.find((entry) =>
    entry.heading.toLowerCase().includes(openQuestionsHeading.toLowerCase())
  );
  if (!section) {
    return [];
  }
  return extractBullets(section.body).filter((item) => !/^none\.?$/i.test(item));
}

export function replaceOrAppendSection(content: string, heading: string, body: string): string {
  const lines = content.split(/\r?\n/);
  const sectionHeader = `## ${heading}`;
  const startIndex = lines.findIndex((line) => normalizeHeading(line).toLowerCase() === heading.toLowerCase());

  if (startIndex === -1) {
    return `${content.trimEnd()}\n\n${sectionHeader}\n\n${body.trim()}\n`;
  }

  let endIndex = lines.length;
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (SECTION_MARKER.test(lines[index])) {
      endIndex = index;
      break;
    }
  }

  const prefix = lines.slice(0, startIndex).join("\n").replace(/\s+$/, "");
  const suffix = lines.slice(endIndex).join("\n").replace(/^\s+/, "");
  const middle = `${sectionHeader}\n\n${body.trim()}`;

  return [prefix, middle, suffix].filter((part) => part.length > 0).join("\n\n").trimEnd() + "\n";
}

export function ensureUpdatedDate(content: string, isoDate: string): string {
  const lines = content.split(/\r?\n/);
  const updatedLine = `Updated: ${isoDate}`;
  const existingIndex = lines.findIndex((line) => /^Updated:\s+\d{4}-\d{2}-\d{2}$/.test(line));

  if (existingIndex !== -1) {
    lines[existingIndex] = updatedLine;
    return `${lines.join("\n").trimEnd()}\n`;
  }

  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex !== -1) {
    lines.splice(titleIndex + 1, 0, updatedLine, "");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  return `${updatedLine}\n\n${content.trimStart()}`;
}

export function ensureCreatedDate(content: string, isoDate: string): string {
  const lines = content.split(/\r?\n/);
  const createdLine = `Created: ${isoDate}`;
  const existingIndex = lines.findIndex((line) => /^Created:\s+\d{4}-\d{2}-\d{2}$/.test(line));

  if (existingIndex !== -1) {
    return `${lines.join("\n").trimEnd()}\n`;
  }

  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex !== -1) {
    lines.splice(titleIndex + 1, 0, createdLine, "");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  return `${createdLine}\n\n${content.trimStart()}`;
}

export function ensureVersionLine(content: string, version: string): string {
  const lines = content.split(/\r?\n/);
  const versionLine = `Version: ${version}`;
  const existingIndex = lines.findIndex((line) => /^Version:\s+\S.*$/.test(line));

  if (existingIndex !== -1) {
    lines[existingIndex] = versionLine;
    return `${lines.join("\n").trimEnd()}\n`;
  }

  const updatedIndex = lines.findIndex((line) => /^Updated:\s+\d{4}-\d{2}-\d{2}$/.test(line));
  if (updatedIndex !== -1) {
    lines.splice(updatedIndex + 1, 0, versionLine);
    return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
  }

  const titleIndex = lines.findIndex((line) => /^#\s+/.test(line));
  if (titleIndex !== -1) {
    lines.splice(titleIndex + 1, 0, versionLine, "");
    return `${lines.join("\n").trimEnd()}\n`;
  }

  return `${versionLine}\n\n${content.trimStart()}`;
}

export function ensureDocumentMetadata(content: string, isoDate: string, version: string): string {
  return ensureVersionLine(ensureUpdatedDate(ensureCreatedDate(content, isoDate), isoDate), version);
}

export function moveSectionBefore(content: string, heading: string, beforeHeading: string): string {
  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex(
    (line) => normalizeHeading(line).toLowerCase() === heading.toLowerCase()
  );
  const beforeIndex = lines.findIndex(
    (line) => normalizeHeading(line).toLowerCase() === beforeHeading.toLowerCase()
  );

  if (startIndex === -1 || beforeIndex === -1 || startIndex < beforeIndex) {
    return `${content.trimEnd()}\n`;
  }

  const endIndex = findSectionEnd(lines, startIndex);
  const sectionLines = lines.slice(startIndex, endIndex);
  const withoutSection = [...lines.slice(0, startIndex), ...lines.slice(endIndex)];
  const insertionIndex = withoutSection.findIndex(
    (line) => normalizeHeading(line).toLowerCase() === beforeHeading.toLowerCase()
  );

  if (insertionIndex === -1) {
    return `${content.trimEnd()}\n`;
  }

  const rebuilt = [
    ...withoutSection.slice(0, insertionIndex),
    ...sectionLines,
    "",
    ...withoutSection.slice(insertionIndex)
  ];

  return `${rebuilt.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

export function removeSection(content: string, heading: string): string {
  const lines = content.split(/\r?\n/);
  const startIndex = lines.findIndex(
    (line) => normalizeHeading(line).toLowerCase() === heading.toLowerCase()
  );

  if (startIndex === -1) {
    return `${content.trimEnd()}\n`;
  }

  const endIndex = findSectionEnd(lines, startIndex);
  const rebuilt = [...lines.slice(0, startIndex), ...lines.slice(endIndex)];
  return `${rebuilt.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function extractTitle(fileName: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1];
  if (heading) {
    return heading.trim();
  }
  return fileName.replace(/\.md$/i, "");
}

function compact(value: string): string {
  return value.replace(/\s+/g, " ").slice(0, 140);
}

function findHeading(content: string, pattern: RegExp): string | null {
  for (const line of content.split(/\r?\n/)) {
    if (!SECTION_MARKER.test(line.trim())) {
      continue;
    }
    const normalized = normalizeHeading(line);
    if (pattern.test(normalized)) {
      return normalized;
    }
  }
  return null;
}

function normalizeHeading(line: string): string {
  return line.replace(/^(#+\s*|(?:§|Â§)\d+\s*)/, "").trim();
}

function findSectionEnd(lines: string[], startIndex: number): number {
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    if (SECTION_MARKER.test(lines[index])) {
      return index;
    }
  }
  return lines.length;
}

function inferToneCues(docs: DocFile[]): string[] {
  const corpus = docs.map((doc) => doc.content).join("\n");
  const toneCues = ["decision-oriented"];

  if (/\([^)]{10,}\)/.test(corpus)) {
    toneCues.push("parenthetical clarifications");
  }
  if (/inspiration/i.test(corpus)) {
    toneCues.push("inspirations callouts");
  }
  if (/\bmust\b/i.test(corpus)) {
    toneCues.push("normative");
  }

  return toneCues;
}
