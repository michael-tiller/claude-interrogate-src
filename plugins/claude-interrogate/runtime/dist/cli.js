#!/usr/bin/env node
import { access } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { bootstrapDocsSkeleton } from "./bootstrap.js";
import { designAudit } from "./audit.js";
import { resolveDefaultDocsDir, resolveDefaultStyleTemplate } from "./config.js";
import { formatAudit, formatInterviewStart, formatSummary, formatSync } from "./format.js";
import { designDocGenerate } from "./generate.js";
import { designInterviewStart } from "./interview.js";
import { designSummarize } from "./summarize.js";
import { designCrossRefSync } from "./sync.js";
async function main() {
    const args = process.argv.slice(2);
    if (args.includes("--help") || args.length === 0) {
        printHelp();
        return;
    }
    if (args.includes("--audit")) {
        const docsDir = path.resolve(valueAfter(args, "--docs") ?? await resolveDefaultDocsDir(process.cwd()));
        const styleTemplatePath = valueAfter(args, "--style") ?? await resolveDefaultStyleTemplate(process.cwd());
        const report = await designAudit(docsDir, styleTemplatePath);
        console.log(formatAudit(report));
        return;
    }
    if (args.includes("--sync")) {
        const docsDir = path.resolve(valueAfter(args, "--docs") ?? await resolveDefaultDocsDir(process.cwd()));
        const styleTemplatePath = valueAfter(args, "--style") ?? await resolveDefaultStyleTemplate(process.cwd());
        const report = await designCrossRefSync(docsDir, styleTemplatePath);
        console.log(formatSync(report));
        return;
    }
    if (args.includes("--summarize")) {
        const concept = valueAfter(args, "--summarize");
        if (!concept) {
            printHelp();
            process.exitCode = 1;
            return;
        }
        const docsDir = path.resolve(valueAfter(args, "--docs") ?? await resolveDefaultDocsDir(process.cwd()));
        const styleTemplatePath = valueAfter(args, "--style") ?? await resolveDefaultStyleTemplate(process.cwd());
        const report = await designSummarize(concept, docsDir, styleTemplatePath);
        console.log(formatSummary(report));
        return;
    }
    const concept = args[0];
    if (!concept || concept.startsWith("-")) {
        printHelp();
        process.exitCode = 1;
        return;
    }
    const docsDir = path.resolve(valueAfter(args, "--docs") ?? await resolveDefaultDocsDir(process.cwd()));
    const styleTemplatePath = valueAfter(args, "--style") ?? await resolveDefaultStyleTemplate(process.cwd());
    const outputPath = valueAfter(args, "--out") ?? path.join(docsDir, `${slugify(concept)}.md`);
    if (!(await pathExists(docsDir))) {
        await bootstrapDocsSkeleton(docsDir, concept);
    }
    const challenge = args.includes("--challenge");
    const challengeMode = args.includes("--easy")
        ? "easy"
        : challenge
            ? "adversarial"
            : "standard";
    const depthMode = args.includes("--fast") ? "fast" : "standard";
    const interview = await designInterviewStart(concept, docsDir, {
        challenge,
        challengeMode,
        depthMode,
        styleTemplatePath
    });
    console.log(formatInterviewStart(interview));
    let responses = collectResponseFlags(args);
    if (Object.keys(responses).length === 0 && process.stdin.isTTY && process.stdout.isTTY) {
        responses = await runInteractiveInterview(interview.questions, challengeMode);
    }
    if (Object.keys(responses).length === 0) {
        console.log("");
        console.log("No responses were provided, so the CLI stopped after generating the question set.");
        console.log("Run in a TTY for the interactive interview or pass response flags on the command line.");
        return;
    }
    const result = await designDocGenerate({
        concept,
        docsDir,
        styleTemplatePath,
        responses
    }, path.resolve(outputPath));
    console.log("");
    console.log(`Wrote ${result.outputPath}`);
}
async function pathExists(target) {
    try {
        await access(target);
        return true;
    }
    catch {
        return false;
    }
}
function collectResponseFlags(args) {
    const keys = ["problem", "success", "shape", "inspirations", "constraints", "edges", "contradictions"];
    return Object.fromEntries(keys
        .map((key) => [key, valueAfter(args, `--${key}`) ?? ""])
        .filter(([, value]) => value.length > 0));
}
function valueAfter(args, flag) {
    const index = args.indexOf(flag);
    if (index === -1) {
        return undefined;
    }
    return args[index + 1];
}
function slugify(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function printHelp() {
    console.log(`interrogate <concept> [--docs DIR] [--easy|--challenge] [--fast] [--out FILE]
interrogate --audit [--docs DIR]
interrogate --sync [--docs DIR]
interrogate --summarize CONCEPT [--docs DIR]

Optional response flags:
  --style FILE
  --easy
  --challenge
  --fast
  --problem TEXT
  --success TEXT
  --shape TEXT
  --inspirations TEXT
  --constraints TEXT
  --edges TEXT
  --contradictions TEXT`);
}
async function runInteractiveInterview(questions, challengeMode) {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    const responses = {};
    try {
        console.log("");
        console.log("Interactive interview:");
        for (const question of questions) {
            const answer = (await rl.question(`${question.question}\n> `)).trim();
            responses[question.id] = answer;
            if (needsFollowUp(question.id, answer)) {
                const followUp = await rl.question(`${followUpPrompt(question.id, challengeMode)}\n> `);
                responses[question.id] = `${answer}\n\nFollow-up: ${followUp.trim()}`.trim();
            }
        }
    }
    finally {
        rl.close();
    }
    return responses;
}
function needsFollowUp(questionId, answer) {
    const normalized = answer.trim();
    if (questionId === "inspirations" && !hasMeaningfulInspirations(normalized)) {
        return false;
    }
    return normalized.length > 0 && normalized.length < 48;
}
function hasMeaningfulInspirations(value) {
    return !/^(none|n\/a|na|no meaningful references?|no inspirations?)\.?$/i.test(value.trim());
}
function followUpPrompt(questionId, challengeMode) {
    const challengeSuffix = challengeMode === "adversarial"
        ? " Name the rejected alternative or failure mode explicitly."
        : challengeMode === "easy"
            ? " Keep the answer concrete, but a short answer is fine."
            : "";
    switch (questionId) {
        case "problem":
            return `That is still thin. What concrete ambiguity or downstream failure are you preventing?${challengeSuffix}`;
        case "success":
            return `What observable evidence would prove this is good enough to ship?${challengeSuffix}`;
        case "shape":
            return `Which alternative did you reject, and why does it lose?${challengeSuffix}`;
        case "inspirations":
            return `Which specific pattern, structure, or interaction are you borrowing, and why does it fit this problem instead of just sounding familiar?${challengeSuffix}`;
        case "constraints":
            return `Which existing doc or prior decision would this violate if you got it wrong?${challengeSuffix}`;
        case "edges":
            return `What is the most expensive edge case to discover late?${challengeSuffix}`;
        case "contradictions":
            return `Which existing assumption changes, and what file must be updated with it?${challengeSuffix}`;
        default:
            return `Add the specific trade-off you are making here.${challengeSuffix}`;
    }
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
