import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, GetPromptRequestSchema, ListPromptsRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { designAudit } from "./audit.js";
import { designDocGenerate } from "./generate.js";
import { designInterviewStart } from "./interview.js";
import { designSummarize } from "./summarize.js";
import { designCrossRefSync } from "./sync.js";
const server = new Server({
    name: "claude-interrogate",
    version: "0.1.1"
}, {
    capabilities: {
        tools: {},
        prompts: {}
    }
});
server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
        {
            name: "design_interview_start",
            description: "Read existing design docs and generate grounded interview questions.",
            inputSchema: {
                type: "object",
                properties: {
                    concept: { type: "string" },
                    docs_dir: { type: "string" },
                    style_template_path: { type: "string" },
                    challenge_mode: { type: "string", enum: ["easy", "standard", "adversarial"] },
                    depth_mode: { type: "string", enum: ["fast", "standard"] },
                    challenge: { type: "boolean" }
                },
                required: ["concept", "docs_dir"]
            }
        },
        {
            name: "design_doc_generate",
            description: "Generate a design doc in the detected house style.",
            inputSchema: {
                type: "object",
                properties: {
                    concept: { type: "string" },
                    docs_dir: { type: "string" },
                    style_template_path: { type: "string" },
                    challenge_mode: { type: "string", enum: ["easy", "standard", "adversarial"] },
                    depth_mode: { type: "string", enum: ["fast", "standard"] },
                    responses: {
                        type: "object",
                        additionalProperties: { type: "string" }
                    },
                    output_path: { type: "string" }
                },
                required: ["concept", "responses", "output_path"]
            }
        },
        {
            name: "design_audit",
            description: "Audit a docs directory for gaps, contradictions, and stale questions.",
            inputSchema: {
                type: "object",
                properties: {
                    docs_dir: { type: "string" },
                    style_template_path: { type: "string" }
                },
                required: ["docs_dir"]
            }
        },
        {
            name: "design_cross_ref_sync",
            description: "Placeholder for v2 cross-reference sync behavior.",
            inputSchema: {
                type: "object",
                properties: {
                    docs_dir: { type: "string" },
                    style_template_path: { type: "string" }
                },
                required: ["docs_dir"]
            }
        },
        {
            name: "design_summarize",
            description: "Summarize what the docs already establish about a feature without interrogating or writing.",
            inputSchema: {
                type: "object",
                properties: {
                    concept: { type: "string" },
                    docs_dir: { type: "string" },
                    style_template_path: { type: "string" }
                },
                required: ["concept", "docs_dir"]
            }
        }
    ]
}));
server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
        {
            name: "interrogate",
            description: "Run the design interview flow for a concept in a docs directory.",
            arguments: [
                {
                    name: "concept",
                    description: "Concept or feature name to interrogate",
                    required: true
                },
                {
                    name: "docs_dir",
                    description: "Docs directory to read and update",
                    required: true
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                },
                {
                    name: "challenge_mode",
                    description: "Interview pressure: easy, standard, or adversarial",
                    required: false
                },
                {
                    name: "depth_mode",
                    description: "Interview depth: fast or standard",
                    required: false
                },
                {
                    name: "challenge",
                    description: "Set to true to push harder on weak decisions",
                    required: false
                }
            ]
        },
        {
            name: "audit",
            description: "Audit a docs directory for gaps, contradictions, and stale questions.",
            arguments: [
                {
                    name: "docs_dir",
                    description: "Docs directory to audit",
                    required: true
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                },
                {
                    name: "challenge_mode",
                    description: "Interview pressure: easy, standard, or adversarial",
                    required: false
                },
                {
                    name: "depth_mode",
                    description: "Interview depth: fast or standard",
                    required: false
                }
            ]
        },
        {
            name: "sync",
            description: "Normalize cross-reference sections across a docs directory.",
            arguments: [
                {
                    name: "docs_dir",
                    description: "Docs directory to sync",
                    required: true
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "reinterrogate",
            description: "Reinterrogate an existing design doc against newer sibling knowledge.",
            arguments: [
                {
                    name: "doc_path",
                    description: "Existing document path to modernize",
                    required: true
                },
                {
                    name: "docs_dir",
                    description: "Docs directory to read for current sibling knowledge",
                    required: true
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                },
                {
                    name: "challenge_mode",
                    description: "Interview pressure: easy, standard, or adversarial",
                    required: false
                },
                {
                    name: "depth_mode",
                    description: "Interview depth: fast or standard",
                    required: false
                },
                {
                    name: "challenge",
                    description: "Set to true to push harder on stale assumptions",
                    required: false
                }
            ]
        },
        {
            name: "distill",
            description: "Derive a reduced exploratory spec from the canonical design without replacing it.",
            arguments: [
                {
                    name: "concept",
                    description: "Concept or feature name to scope",
                    required: true
                },
                {
                    name: "docs_dir",
                    description: "Docs directory to read for sibling context",
                    required: true
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                },
                {
                    name: "intensity",
                    description: "How aggressively to strip scope: light, balanced, or aggressive",
                    required: false
                }
            ]
        },
        {
            name: "extricate",
            description: "Carefully remove, retire, or replace a feature across the docs set.",
            arguments: [
                {
                    name: "concept",
                    description: "Concept or feature name to extricate",
                    required: true
                },
                {
                    name: "docs_dir",
                    description: "Docs directory to read for sibling context",
                    required: true
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "trace",
            description: "Trace where a concept lives, which docs define it, and where drift or contradictions cluster.",
            arguments: [
                {
                    name: "concept",
                    description: "Concept or feature name to trace",
                    required: false
                },
                {
                    name: "docs_dir",
                    description: "Docs directory to read for sibling context",
                    required: true
                },
                {
                    name: "index_mode",
                    description: "Set to true to generate or refresh a top-level map.md index instead of tracing one concept",
                    required: false
                },
                {
                    name: "write_output",
                    description: "Set to true to write the trace output to disk instead of keeping it read-only in chat",
                    required: false
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "convert",
            description: "Convert one design artifact into another form without silently overwriting the canonical spec.",
            arguments: [
                {
                    name: "source",
                    description: "Source concept, doc path, or artifact to convert",
                    required: true
                },
                {
                    name: "docs_dir",
                    description: "Docs directory to read for sibling context",
                    required: true
                },
                {
                    name: "target_form",
                    description: "Target form such as canonical-spec, distilled-spec, overwrite-existing-doc, or summary-brief",
                    required: false
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "summarize",
            description: "List what the docs already establish about a feature without interrogating.",
            arguments: [
                {
                    name: "concept",
                    description: "Concept or feature name to summarize",
                    required: true
                },
                {
                    name: "docs_dir",
                    description: "Docs directory to read for sibling context",
                    required: true
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "glossary",
            description: "Build a glossary of common domain terms used across the docs set.",
            arguments: [
                {
                    name: "docs_dir",
                    description: "Docs directory to read for domain terms and definitions",
                    required: true
                },
                {
                    name: "output_path",
                    description: "Optional output path for the glossary file; default is <docs-dir>/glossary.md",
                    required: false
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "expose",
            description: "Expose gaps, undefined seams, and underspecified decisions across the docs set.",
            arguments: [
                {
                    name: "docs_dir",
                    description: "Docs directory to inspect for gaps and unresolved seams",
                    required: true
                },
                {
                    name: "output_path",
                    description: "Optional output path for the gaps report; default is <docs-dir>/expose.md",
                    required: false
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "reveal",
            description: "Reveal remaining open questions across the docs set or for one specific topic.",
            arguments: [
                {
                    name: "docs_dir",
                    description: "Docs directory to inspect for unresolved questions",
                    required: true
                },
                {
                    name: "topic",
                    description: "Optional topic or concept to narrow the reveal report",
                    required: false
                },
                {
                    name: "output_path",
                    description: "Optional output path for the open-questions report; default is <docs-dir>/reveal.md or <topic>-reveal.md",
                    required: false
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "refresh",
            description: "Find potentially out-of-date elements and force an interview-driven update pass.",
            arguments: [
                {
                    name: "docs_dir",
                    description: "Docs directory to inspect for stale or outdated design elements",
                    required: true
                },
                {
                    name: "topic",
                    description: "Optional topic or concept to narrow the refresh pass",
                    required: false
                },
                {
                    name: "output_path",
                    description: "Optional output path for the refresh report; default is <docs-dir>/refresh.md or <topic>-refresh.md",
                    required: false
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        },
        {
            name: "redress",
            description: "Bring an existing file up to contemporary house style without silently changing its intent.",
            arguments: [
                {
                    name: "doc_path",
                    description: "Existing document path to redress",
                    required: true
                },
                {
                    name: "docs_dir",
                    description: "Docs directory to use as the current house-style reference",
                    required: true
                },
                {
                    name: "style_template_path",
                    description: "Optional golden document template to use as the primary style reference",
                    required: false
                }
            ]
        }
    ]
}));
server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case "interrogate":
            return {
                description: "Run the design interview and write the resulting spec.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: interrogatePrompt(String(args?.concept ?? ""), String(args?.docs_dir ?? ""), String(args?.challenge ?? "false"), args?.style_template_path ? String(args.style_template_path) : undefined, args?.challenge_mode ? String(args.challenge_mode) : undefined, args?.depth_mode ? String(args.depth_mode) : undefined)
                        }
                    }
                ]
            };
        case "audit":
            return {
                description: "Audit the current design docs set.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: auditPrompt(String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "sync":
            return {
                description: "Sync cross-reference sections across the docs set.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: syncPrompt(String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "reinterrogate":
            return {
                description: "Reinterrogate an existing doc against current sibling knowledge.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: reinterrogatePrompt(String(args?.doc_path ?? ""), String(args?.docs_dir ?? ""), String(args?.challenge ?? "false"), args?.style_template_path ? String(args.style_template_path) : undefined, args?.challenge_mode ? String(args.challenge_mode) : undefined, args?.depth_mode ? String(args.depth_mode) : undefined)
                        }
                    }
                ]
            };
        case "distill":
            return {
                description: "Derive a reduced exploratory spec from the canonical design.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: distillPrompt(String(args?.concept ?? ""), String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined, args?.intensity ? String(args.intensity) : undefined)
                        }
                    }
                ]
            };
        case "extricate":
            return {
                description: "Plan and confirm careful feature removal, retirement, or replacement across docs.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: extricatePrompt(String(args?.concept ?? ""), String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "trace":
            return {
                description: "Trace a concept through the docs set and surface authority, dependencies, and drift.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: tracePrompt(args?.concept ? String(args.concept) : undefined, String(args?.docs_dir ?? ""), Boolean(args?.index_mode), Boolean(args?.write_output), args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "convert":
            return {
                description: "Convert one design artifact into another form with explicit confirmation before write.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: convertPrompt(String(args?.source ?? ""), String(args?.docs_dir ?? ""), args?.target_form ? String(args.target_form) : undefined, args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "summarize":
            return {
                description: "Summarize current grounded knowledge for a feature without interrogating.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: summarizePrompt(String(args?.concept ?? ""), String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "glossary":
            return {
                description: "Compile a glossary of common design-space terms and write it after confirmation.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: glossaryPrompt(String(args?.docs_dir ?? ""), args?.output_path ? String(args.output_path) : undefined, args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "expose":
            return {
                description: "Expose missing decisions, undefined seams, and risky ambiguities, then write a report after confirmation.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: exposePrompt(String(args?.docs_dir ?? ""), args?.output_path ? String(args.output_path) : undefined, args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "reveal":
            return {
                description: "Reveal remaining open questions holistically or for a specific topic, then write a report after confirmation.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: revealPrompt(String(args?.docs_dir ?? ""), args?.topic ? String(args.topic) : undefined, args?.output_path ? String(args.output_path) : undefined, args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "refresh":
            return {
                description: "Find stale elements, force a reinterrogation plan, and write the refresh report after confirmation.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: refreshPrompt(String(args?.docs_dir ?? ""), args?.topic ? String(args.topic) : undefined, args?.output_path ? String(args.output_path) : undefined, args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        case "redress":
            return {
                description: "Bring one file up to the current house style and write it after confirmation.",
                messages: [
                    {
                        role: "user",
                        content: {
                            type: "text",
                            text: redressPrompt(String(args?.doc_path ?? ""), String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined)
                        }
                    }
                ]
            };
        default:
            throw new Error(`Unknown prompt: ${name}`);
    }
});
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    switch (name) {
        case "design_interview_start": {
            const result = await designInterviewStart(String(args?.concept ?? ""), String(args?.docs_dir ?? ""), {
                challenge: Boolean(args?.challenge),
                challengeMode: normalizeChallengeModeArg(args?.challenge_mode, args?.challenge),
                depthMode: normalizeDepthModeArg(args?.depth_mode),
                styleTemplatePath: args?.style_template_path ? String(args.style_template_path) : undefined
            });
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        }
        case "design_doc_generate": {
            const result = await designDocGenerate({
                concept: String(args?.concept ?? ""),
                docsDir: args?.docs_dir ? String(args.docs_dir) : undefined,
                styleTemplatePath: args?.style_template_path ? String(args.style_template_path) : undefined,
                responses: normalizeResponses(args?.responses)
            }, String(args?.output_path ?? ""));
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        }
        case "design_audit": {
            const result = await designAudit(String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        }
        case "design_cross_ref_sync": {
            const result = await designCrossRefSync(String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        }
        case "design_summarize": {
            const result = await designSummarize(String(args?.concept ?? ""), String(args?.docs_dir ?? ""), args?.style_template_path ? String(args.style_template_path) : undefined);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
});
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
function normalizeResponses(value) {
    if (!value || typeof value !== "object") {
        return {};
    }
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry)]));
}
main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
function interrogatePrompt(concept, docsDir, challenge, styleTemplatePath, challengeModeArg, depthModeArg) {
    const challengeMode = challengeModeArg ?? (/^true$/i.test(challenge) ? "adversarial" : "standard");
    const depthMode = depthModeArg ?? "standard";
    return [
        `Run the internal design interview flow for concept "${concept}" in docs directory "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        `Use challenge mode: ${challengeMode}.`,
        `Use depth mode: ${depthMode}.`,
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old task immediately, state that it was abandoned without writing, and continue only with the new task.",
        "1. Call `design_interview_start` with the provided concept, docs_dir, challenge flag, and optional style template.",
        "2. Summarize what the docs already decide before asking anything new.",
        "3. Keep the returned question set as a private working queue. Do not dump the whole queue to the user.",
        "4. Ask exactly one interview question at a time, in dependency order. It is fine to include explicit options or ranked forks inside that single question.",
        "5. After each user answer, update your private notes and decide whether to ask a follow-up on that same topic or advance to the next topic.",
        "6. If an answer is vague, short, or hand-wavy, ask a follow-up. Push on trade-offs and rejected alternatives.",
        "7. When the concept is resolved enough to write, do not write yet. First present a concise findings summary and ask the user to choose: confirm, modify, deny, or cancel.",
        "8. If the user confirms, call `design_doc_generate` and write `<concept>.md` inside the docs directory unless the user chooses a different output path.",
        "9. If the user asks to modify, keep the interview open, update the findings, and ask for confirmation again before writing.",
        "10. If the user denies, end the interrogation without calling `design_doc_generate` and make clear that nothing was written.",
        "11. If the user cancels, abandon the current file task entirely, ask no further task questions, and make clear that nothing was written and the task was abandoned.",
        "12. Mention any contradictions that imply sibling docs should change in the same review.",
        "",
        "Do not treat this as brainstorming fluff. Design documentation needs decisions, constraints, and failure modes.",
        "The user should only ever see the current question or the final findings summary, not your full internal queue.",
        "When presenting final findings, prefer concise bullets or short paragraphs per section rather than dense wall-of-text blocks."
    ].join("\n");
}
function auditPrompt(docsDir, styleTemplatePath) {
    return [
        `Audit the design docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        "Call `design_audit`.",
        "Present findings first, ordered by severity.",
        "Then present the action items.",
        "Keep the focus on contradictions, missing cross-references, stale open questions, and format drift."
    ].join("\n");
}
function syncPrompt(docsDir, styleTemplatePath) {
    return [
        `Normalize cross-reference sections for the design docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        "Call `design_cross_ref_sync`.",
        "Report which files changed.",
        "State clearly that this sync normalizes sibling link sections but does not yet rewrite resolved open questions into body text."
    ].join("\n");
}
function reinterrogatePrompt(docPath, docsDir, challenge, styleTemplatePath, challengeModeArg, depthModeArg) {
    const challengeMode = challengeModeArg ?? (/^true$/i.test(challenge) ? "adversarial" : "standard");
    const depthMode = depthModeArg ?? "standard";
    return [
        `Reinterrogate the existing design doc at "${docPath}" using the current sibling knowledge in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        `Use challenge mode: ${challengeMode}.`,
        `Use depth mode: ${depthMode}.`,
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old target-file task immediately, state that it was abandoned without writing, and continue only with the new task.",
        "1. Read the target document first and summarize what it currently says.",
        "2. Call `design_interview_start` using the target document's concept and the provided docs_dir, plus the optional style template.",
        "3. Compare the target doc against sibling decisions and identify what is stale, contradictory, missing, or underspecified.",
        "4. Keep the returned question set as a private working queue. Do not dump the whole queue to the user.",
        "5. Ask one reinterrogation question at a time, focusing on deltas: what changed, what should be retained, and what must be rewritten.",
        "6. If an answer is vague or evasive, ask a follow-up.",
        "7. When the rewrite is resolved enough, present consolidated findings and ask the user to choose: confirm, modify, deny, or cancel.",
        "8. If the user confirms, call `design_doc_generate` and overwrite the target document path with the modernized version.",
        "9. If the user asks to modify, keep the reinterrogation open and ask for confirmation again before writing.",
        "10. If the user denies, stop without writing anything.",
        "11. If the user cancels, abandon the current target-file task, ask no further reinterrogation questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "Do not silently preserve stale assumptions just because they exist in the current file.",
        "Prefer concise bullets or short paragraphs per section rather than dense wall-of-text blocks."
    ].join("\n");
}
function distillPrompt(concept, docsDir, styleTemplatePath, intensity = "balanced") {
    return [
        `Distill the feature "${concept}" against the current sibling knowledge in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        `Use distill intensity: ${intensity}.`,
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old task immediately, state that it was abandoned without writing, and continue only with the new task.",
        "1. Call `design_interview_start` with the provided concept and docs_dir, using `challenge_mode=\"easy\"` and `depth_mode=\"fast\"`.",
        "2. Summarize what the docs already decide before proposing any scope.",
        "3. Ask only the minimum number of questions needed to define an exploratory implementation slice.",
        "4. Treat the distilled spec as a separate living artifact derived from the real spec. Do not narrow, overwrite, or simplify the canonical spec itself.",
        "5. Produce a distilled exploration surface with these sections:",
        "   - Core loop or core interaction",
        "   - Must-build systems",
        "   - Explicitly stubbed or faked systems",
        "   - Explicit out-of-scope items",
        "   - Validation goal: what this MVP is trying to learn",
        "6. Intensity guidance:",
        "   - light: preserve more supporting systems and defer fewer dependencies",
        "   - balanced: keep only what is needed to explore the feature honestly",
        "   - aggressive: cut to the narrowest believable implementation surface, maximizing stubs and explicit out-of-scope decisions",
        "7. Keep the question queue private and ask one question at a time.",
        "8. Present the distilled findings and ask the user to choose: confirm, modify, deny, or cancel.",
        "9. If the user wants it written, write it as a separate doc such as `<concept>-distill.md`, not as a replacement for the canonical spec.",
        "10. If the user cancels, abandon the current file task entirely, ask no further distillation questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "This mode is for feature exploration, not full production design closure.",
        "Optimize for minimum implementation surface, not completeness."
    ].join("\n");
}
function extricatePrompt(concept, docsDir, styleTemplatePath) {
    return [
        `Extricate the feature "${concept}" from the docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old task immediately, state that it was abandoned without writing, and continue only with the new task.",
        "1. Call `design_summarize` for the feature to identify where it currently appears.",
        "2. Summarize the current role of the feature and the docs it touches.",
        "3. Ask the user whether this is a full removal, a retirement/deprecation, or a replacement/rename.",
        "4. Ask only the minimum follow-up questions needed to understand what breaks if the feature is removed.",
        "5. Present an extrication plan with:",
        "   - impacted docs",
        "   - references to remove",
        "   - references to rewrite",
        "   - contradictions or gaps that removal would create",
        "   - any replacement wording if applicable",
        "6. Ask the user to choose: confirm, modify, deny, or cancel.",
        "7. Do not write anything unless the user explicitly asks you to apply the extrication.",
        "8. If the user cancels, abandon the current file task entirely, ask no further extrication questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "This is dependency-aware removal, not blind deletion.",
        "Preserve historical clarity when retirement or replacement is more accurate than erasure."
    ].join("\n");
}
function tracePrompt(concept, docsDir, indexMode, writeOutput, styleTemplatePath) {
    const featureMode = !indexMode;
    return [
        featureMode
            ? `Trace the concept "${concept ?? ""}" through the docs in "${docsDir}".`
            : `Generate or refresh a top-level map for the docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        `Index mode: ${indexMode ? "true" : "false"}.`,
        `Write output: ${writeOutput ? "true" : "false"}.`,
        "",
        "Required sequence:",
        ...(featureMode
            ? [
                "1. Call `design_summarize` with the provided concept and docs_dir.",
                "2. Read any directly relevant docs needed to map the concept accurately.",
                "3. Present a trace report with these sections:",
                "   - authoritative docs: where the concept is actually defined",
                "   - dependent docs: where the concept is consumed or assumed",
                "   - drift or contradiction zones: where language or assumptions diverge",
                "   - open seams: what is still underspecified",
                ...(writeOutput
                    ? [
                        "4. Ask for final confirmation, then write the result as `<concept>-trace.md` inside the docs directory unless the user chooses a different output path."
                    ]
                    : ["4. Keep this read-only unless the user explicitly asks for edits."])
            ]
            : [
                "1. Read the docs directory structure and the most central docs needed to understand the current topology.",
                "2. Build a structural index, not a wall-of-text summary.",
                "3. Present a map with these sections:",
                "   - start here: the docs a new reader should open first",
                "   - core pillars: major concept areas and their canonical docs",
                "   - derivative docs: specialized or subordinate specs",
                "   - stale or risky zones: docs with known drift, contradictions, or unresolved seams",
                "   - notable cross-links: the strongest dependencies across pillars",
                ...(writeOutput
                    ? ["4. Ask for final confirmation, then write or refresh `map.md` in the docs directory."]
                    : ["4. Keep this read-only unless the user explicitly asks for edits."])
            ]),
        "",
        "This is structural mapping, not interrogation and not broad rewriting.",
        "Favor concrete file references and dependency statements over general summary prose."
    ].join("\n");
}
function convertPrompt(source, docsDir, targetForm = "canonical-spec", styleTemplatePath) {
    return [
        `Convert "${source}" into target form "${targetForm}" using the docs in "${docsDir}" as context.`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old target-file task immediately, state that it was abandoned without writing, and continue only with the new task.",
        "1. Read the source artifact first.",
        "2. Read any sibling docs needed to understand what the source already assumes.",
        "3. State what is being converted and what target form means in this case.",
        "4. Present a conversion plan before any write, including:",
        "   - what content survives unchanged",
        "   - what content gets reframed or promoted",
        "   - what content is intentionally dropped",
        "   - what output path or artifact should receive the conversion",
        "5. Ask the user to choose: confirm, modify, deny, or cancel.",
        "6. Do not write anything until the user confirms.",
        "7. If the user cancels, abandon the current target-file task entirely, ask no further conversion questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "Examples of target forms: canonical-spec, distilled-spec, overwrite-existing-doc, summary-brief.",
        "The canonical spec should not be silently narrowed or overwritten just because a derivative artifact exists."
    ].join("\n");
}
function summarizePrompt(concept, docsDir, styleTemplatePath) {
    return [
        `Summarize what the docs in "${docsDir}" already establish about "${concept}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        "",
        "Required sequence:",
        "1. Call `design_summarize` with the provided concept and docs_dir.",
        "2. Present only what is grounded in the docs set.",
        "3. Do not interrogate the user.",
        "4. Do not propose new decisions.",
        "5. Clearly separate learned facts from unresolved areas."
    ].join("\n");
}
function glossaryPrompt(docsDir, outputPath, styleTemplatePath) {
    const resolvedOutputPath = outputPath ?? `${docsDir.replace(/[\\/]$/, "")}/glossary.md`;
    return [
        `Build a glossary of common design-space terms from the docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        `Default output path: "${resolvedOutputPath}".`,
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old glossary task immediately, state that it was abandoned without writing, and continue only with the new task.",
        "1. Read the docs set directly and identify repeated terms, role names, workflow labels, object names, and domain jargon that are central to the design space.",
        "2. Prefer terms that recur across multiple docs or act as authority-bearing vocabulary. Do not pad the glossary with obvious generic software words.",
        "3. For each candidate term, derive a definition grounded in the docs. If a term is ambiguous or overloaded, say so explicitly instead of inventing certainty.",
        "4. Present a glossary plan before any write, including:",
        "   - the terms you plan to include",
        "   - any aliases or conflicting usages",
        "   - the proposed output path",
        "5. Ask the user to choose: confirm, modify, deny, or cancel.",
        "6. Only write after explicit confirmation.",
        "7. If the user confirms, write a glossary file at the chosen output path.",
        "8. If the user denies, stop without writing anything.",
        "9. If the user cancels, abandon the glossary task entirely, ask no further glossary questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "Suggested output shape:",
        "- Title",
        "- Short scope note explaining that definitions are grounded in the current docs set",
        "- Alphabetized term entries",
        "- For each entry: term, concise definition, optional aliases, and file references where the term is used authoritatively",
        "",
        "Keep definitions concrete and local to this docs set. Do not turn the glossary into a generic textbook."
    ].join("\n");
}
function exposePrompt(docsDir, outputPath, styleTemplatePath) {
    const resolvedOutputPath = outputPath ?? `${docsDir.replace(/[\\/]$/, "")}/expose.md`;
    return [
        `Expose design gaps and underspecified seams from the docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        `Default output path: "${resolvedOutputPath}".`,
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old expose task immediately, state that it was abandoned without writing, and continue only with the new task.",
        "1. Read the docs set directly and identify where the design space is vague, contradictory, hand-wavy, or structurally incomplete.",
        "2. Focus on missing decisions, undefined ownership, fuzzy boundaries, unstated dependencies, unclear lifecycle transitions, and terms that are used without being pinned down.",
        "3. Separate grounded findings from your inferences. When the docs imply a likely gap rather than stating it directly, say that it is an inference.",
        "4. Present an expose plan before any write, including:",
        "   - the highest-risk gaps you plan to include",
        "   - the files or concepts each gap touches",
        "   - the proposed output path",
        "5. Ask the user to choose: confirm, modify, deny, or cancel.",
        "6. Only write after explicit confirmation.",
        "7. If the user confirms, write the report at the chosen output path.",
        "8. If the user denies, stop without writing anything.",
        "9. If the user cancels, abandon the expose task entirely, ask no further expose questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "Suggested output shape:",
        "- Title",
        "- Short scope note explaining that the report highlights unresolved or weakly specified areas in the current docs set",
        "- Findings ordered by severity",
        "- For each finding: gap statement, why it matters, affected files or concepts, and the concrete decision or clarification still missing",
        "",
        "Do not turn this into a rewrite. The point is to expose the weak seams, not to silently fill them in."
    ].join("\n");
}
function revealPrompt(docsDir, topic, outputPath, styleTemplatePath) {
    const defaultName = topic
        ? `${topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "topic"}-reveal.md`
        : "reveal.md";
    const resolvedOutputPath = outputPath ?? `${docsDir.replace(/[\\/]$/, "")}/${defaultName}`;
    return [
        topic
            ? `Reveal the remaining open questions about "${topic}" from the docs in "${docsDir}".`
            : `Reveal the remaining open questions across the docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        `Default output path: "${resolvedOutputPath}".`,
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old reveal task immediately, state that it was abandoned without writing, and continue only with the new task.",
        ...(topic
            ? [
                "1. Read the docs directly and focus on unresolved questions, assumptions, contradictions, and incomplete edges related to the requested topic.",
                "2. Distinguish between questions that are explicitly open in the docs and questions that remain open by inference because the docs never pin them down."
            ]
            : [
                "1. Read the docs directly and identify the most important unresolved questions across the full design space.",
                "2. Distinguish between questions that are explicitly open in the docs and questions that remain open by inference because the docs never pin them down."
            ]),
        "3. Group questions by theme, subsystem, or decision boundary rather than producing an undifferentiated list.",
        "4. For each question, explain why it is still open, what files or concepts it touches, and what concrete answer would close it.",
        "5. Present a reveal plan before any write, including:",
        "   - the question groups you plan to include",
        "   - whether each question is explicit or inferred",
        "   - the proposed output path",
        "6. Ask the user to choose: confirm, modify, deny, or cancel.",
        "7. Only write after explicit confirmation.",
        "8. If the user confirms, write the report at the chosen output path.",
        "9. If the user denies, stop without writing anything.",
        "10. If the user cancels, abandon the reveal task entirely, ask no further reveal questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "Suggested output shape:",
        "- Title",
        "- Scope note saying whether this is holistic or topic-specific",
        "- Question groups ordered by severity or blocking impact",
        "- For each question: open question, status (`explicit` or `inferred`), affected files or concepts, and what decision is still missing",
        "",
        "Do not answer the questions for the user. The point is to surface what remains unresolved."
    ].join("\n");
}
function refreshPrompt(docsDir, topic, outputPath, styleTemplatePath) {
    const defaultName = topic
        ? `${topic.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "topic"}-refresh.md`
        : "refresh.md";
    const resolvedOutputPath = outputPath ?? `${docsDir.replace(/[\\/]$/, "")}/${defaultName}`;
    return [
        topic
            ? `Refresh potentially out-of-date design elements about "${topic}" from the docs in "${docsDir}".`
            : `Refresh potentially out-of-date design elements across the docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        `Default output path: "${resolvedOutputPath}".`,
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old refresh task immediately, state that it was abandoned without writing, and continue only with the new task.",
        ...(topic
            ? [
                "1. Read the docs directly and identify where the requested topic appears stale, contradicted, superseded by newer sibling knowledge, or mismatched to surrounding assumptions.",
                "2. Focus on elements that likely require a forced reinterrogation rather than a cosmetic edit."
            ]
            : [
                "1. Read the docs directly and identify design elements that appear stale, contradicted, superseded by newer sibling knowledge, or mismatched to surrounding assumptions.",
                "2. Focus on elements that likely require a forced reinterrogation rather than a cosmetic edit."
            ]),
        "3. For each candidate stale element, explain why it appears out of date and which file or concept should be reinterrogated to resolve it.",
        "4. Build a forced-refresh plan before any write, including:",
        "   - the stale elements you plan to include",
        "   - the target docs or concepts that should be reinterrogated",
        "   - the specific question areas that must be reopened",
        "   - the proposed output path",
        "5. Ask the user to choose: confirm, modify, deny, or cancel.",
        "6. Only write after explicit confirmation.",
        "7. If the user confirms, write the report at the chosen output path.",
        "8. If the user denies, stop without writing anything.",
        "9. If the user cancels, abandon the refresh task entirely, ask no further refresh questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "Suggested output shape:",
        "- Title",
        "- Scope note saying whether this is holistic or topic-specific",
        "- Findings ordered by severity or update urgency",
        "- For each finding: stale element, why it looks outdated, affected files or concepts, and the forced interview areas required to update it",
        "",
        "Do not silently rewrite the docs during this step. The goal is to surface what needs a forced update interview, not to patch over drift without review."
    ].join("\n");
}
function redressPrompt(docPath, docsDir, styleTemplatePath) {
    return [
        `Redress the existing document at "${docPath}" using the current house style implied by the docs in "${docsDir}".`,
        ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
        "",
        "Required sequence:",
        "0. If the user starts a different file-writing task while this one is still open, treat that new task as superseding this one. Cancel the old redress task immediately, state that it was abandoned without writing, and continue only with the new task.",
        "1. Read the target document first.",
        "2. Read sibling docs or the style template to infer the contemporary local house style.",
        "3. Distinguish style drift from content drift. This command is for structure, headers, section ordering, metadata, version history shape, and other house-style alignment work.",
        "4. Preserve the document's intent and substantive decisions unless a style fix cannot be separated from a content clarification. If that happens, call it out explicitly before writing.",
        "5. Present a redress plan before any write, including:",
        "   - what structural or stylistic elements will change",
        "   - what substantive content will stay the same",
        "   - any places where style repair may force a small wording clarification",
        "6. Ask the user to choose: confirm, modify, deny, or cancel.",
        "7. Only write after explicit confirmation.",
        "8. If the user confirms, overwrite the target document path with the redressed version.",
        "9. If the user denies, stop without writing anything.",
        "10. If the user cancels, abandon the redress task entirely, ask no further redress questions, and make clear that nothing was written and the task was abandoned.",
        "",
        "Focus on bringing the file up to the current local house style, not on reopening every design decision."
    ].join("\n");
}
function normalizeChallengeModeArg(value, challenge) {
    if (value === "easy" || value === "standard" || value === "adversarial") {
        return value;
    }
    return Boolean(challenge) ? "adversarial" : "standard";
}
function normalizeDepthModeArg(value) {
    return value === "fast" ? "fast" : "standard";
}
