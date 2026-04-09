import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { designAudit } from "./audit.js";
import { designDocGenerate } from "./generate.js";
import { designInterviewStart } from "./interview.js";
import { designSummarize } from "./summarize.js";
import { designCrossRefSync } from "./sync.js";

const server = new Server(
  {
    name: "claude-interrogate",
    version: "0.1.1"
  },
  {
    capabilities: {
      tools: {},
      prompts: {}
    }
  }
);

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
              text: interrogatePrompt(
                String(args?.concept ?? ""),
                String(args?.docs_dir ?? ""),
                String(args?.challenge ?? "false"),
                args?.style_template_path ? String(args.style_template_path) : undefined,
                args?.challenge_mode ? String(args.challenge_mode) : undefined,
                args?.depth_mode ? String(args.depth_mode) : undefined
              )
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
              text: auditPrompt(
                String(args?.docs_dir ?? ""),
                args?.style_template_path ? String(args.style_template_path) : undefined
              )
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
              text: syncPrompt(
                String(args?.docs_dir ?? ""),
                args?.style_template_path ? String(args.style_template_path) : undefined
              )
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
              text: reinterrogatePrompt(
                String(args?.doc_path ?? ""),
                String(args?.docs_dir ?? ""),
                String(args?.challenge ?? "false"),
                args?.style_template_path ? String(args.style_template_path) : undefined,
                args?.challenge_mode ? String(args.challenge_mode) : undefined,
                args?.depth_mode ? String(args.depth_mode) : undefined
              )
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
              text: distillPrompt(
                String(args?.concept ?? ""),
                String(args?.docs_dir ?? ""),
                args?.style_template_path ? String(args.style_template_path) : undefined,
                args?.intensity ? String(args.intensity) : undefined
              )
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
              text: extricatePrompt(
                String(args?.concept ?? ""),
                String(args?.docs_dir ?? ""),
                args?.style_template_path ? String(args.style_template_path) : undefined
              )
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
              text: tracePrompt(
                args?.concept ? String(args.concept) : undefined,
                String(args?.docs_dir ?? ""),
                Boolean(args?.index_mode),
                Boolean(args?.write_output),
                args?.style_template_path ? String(args.style_template_path) : undefined
              )
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
              text: convertPrompt(
                String(args?.source ?? ""),
                String(args?.docs_dir ?? ""),
                args?.target_form ? String(args.target_form) : undefined,
                args?.style_template_path ? String(args.style_template_path) : undefined
              )
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
              text: summarizePrompt(
                String(args?.concept ?? ""),
                String(args?.docs_dir ?? ""),
                args?.style_template_path ? String(args.style_template_path) : undefined
              )
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
      const result = await designInterviewStart(
        String(args?.concept ?? ""),
        String(args?.docs_dir ?? ""),
        {
          challenge: Boolean(args?.challenge),
          challengeMode: normalizeChallengeModeArg(args?.challenge_mode, args?.challenge),
          depthMode: normalizeDepthModeArg(args?.depth_mode),
          styleTemplatePath: args?.style_template_path ? String(args.style_template_path) : undefined
        }
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
    case "design_doc_generate": {
      const result = await designDocGenerate(
        {
          concept: String(args?.concept ?? ""),
          docsDir: args?.docs_dir ? String(args.docs_dir) : undefined,
          styleTemplatePath: args?.style_template_path ? String(args.style_template_path) : undefined,
          responses: normalizeResponses(args?.responses)
        },
        String(args?.output_path ?? "")
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
    case "design_audit": {
      const result = await designAudit(
        String(args?.docs_dir ?? ""),
        args?.style_template_path ? String(args.style_template_path) : undefined
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
    case "design_cross_ref_sync": {
      const result = await designCrossRefSync(
        String(args?.docs_dir ?? ""),
        args?.style_template_path ? String(args.style_template_path) : undefined
      );
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
      const result = await designSummarize(
        String(args?.concept ?? ""),
        String(args?.docs_dir ?? ""),
        args?.style_template_path ? String(args.style_template_path) : undefined
      );
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

function normalizeResponses(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, String(entry)])
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});

function interrogatePrompt(
  concept: string,
  docsDir: string,
  challenge: string,
  styleTemplatePath?: string,
  challengeModeArg?: string,
  depthModeArg?: string
): string {
  const challengeMode = challengeModeArg ?? (/^true$/i.test(challenge) ? "adversarial" : "standard");
  const depthMode = depthModeArg ?? "standard";

  return [
    `Run the internal design interview flow for concept "${concept}" in docs directory "${docsDir}".`,
    ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
    `Use challenge mode: ${challengeMode}.`,
    `Use depth mode: ${depthMode}.`,
    "",
    "Required sequence:",
    "1. Call `design_interview_start` with the provided concept, docs_dir, challenge flag, and optional style template.",
    "2. Summarize what the docs already decide before asking anything new.",
    "3. Keep the returned question set as a private working queue. Do not dump the whole queue to the user.",
    "4. Ask exactly one interview question at a time, in dependency order. It is fine to include explicit options or ranked forks inside that single question.",
    "5. After each user answer, update your private notes and decide whether to ask a follow-up on that same topic or advance to the next topic.",
    "6. If an answer is vague, short, or hand-wavy, ask a follow-up. Push on trade-offs and rejected alternatives.",
    "7. When the concept is resolved enough to write, do not write yet. First present a concise findings summary and ask the user to choose: confirm, modify, or deny.",
    "8. If the user confirms, call `design_doc_generate` and write `<concept>.md` inside the docs directory unless the user chooses a different output path.",
    "9. If the user asks to modify, keep the interview open, update the findings, and ask for confirmation again before writing.",
    "10. If the user denies, end the interrogation without calling `design_doc_generate` and make clear that nothing was written.",
    "11. Mention any contradictions that imply sibling docs should change in the same review.",
    "",
    "Do not treat this as brainstorming fluff. Design documentation needs decisions, constraints, and failure modes.",
    "The user should only ever see the current question or the final findings summary, not your full internal queue.",
    "When presenting final findings, prefer concise bullets or short paragraphs per section rather than dense wall-of-text blocks."
  ].join("\n");
}

function auditPrompt(docsDir: string, styleTemplatePath?: string): string {
  return [
    `Audit the design docs in "${docsDir}".`,
    ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
    "Call `design_audit`.",
    "Present findings first, ordered by severity.",
    "Then present the action items.",
    "Keep the focus on contradictions, missing cross-references, stale open questions, and format drift."
  ].join("\n");
}

function syncPrompt(docsDir: string, styleTemplatePath?: string): string {
  return [
    `Normalize cross-reference sections for the design docs in "${docsDir}".`,
    ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
    "Call `design_cross_ref_sync`.",
    "Report which files changed.",
    "State clearly that this sync normalizes sibling link sections but does not yet rewrite resolved open questions into body text."
  ].join("\n");
}

function reinterrogatePrompt(
  docPath: string,
  docsDir: string,
  challenge: string,
  styleTemplatePath?: string,
  challengeModeArg?: string,
  depthModeArg?: string
): string {
  const challengeMode = challengeModeArg ?? (/^true$/i.test(challenge) ? "adversarial" : "standard");
  const depthMode = depthModeArg ?? "standard";

  return [
    `Reinterrogate the existing design doc at "${docPath}" using the current sibling knowledge in "${docsDir}".`,
    ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
    `Use challenge mode: ${challengeMode}.`,
    `Use depth mode: ${depthMode}.`,
    "",
    "Required sequence:",
    "1. Read the target document first and summarize what it currently says.",
    "2. Call `design_interview_start` using the target document's concept and the provided docs_dir, plus the optional style template.",
    "3. Compare the target doc against sibling decisions and identify what is stale, contradictory, missing, or underspecified.",
    "4. Keep the returned question set as a private working queue. Do not dump the whole queue to the user.",
    "5. Ask one reinterrogation question at a time, focusing on deltas: what changed, what should be retained, and what must be rewritten.",
    "6. If an answer is vague or evasive, ask a follow-up.",
    "7. When the rewrite is resolved enough, present consolidated findings and ask the user to choose: confirm, modify, or deny.",
    "8. If the user confirms, call `design_doc_generate` and overwrite the target document path with the modernized version.",
    "9. If the user asks to modify, keep the reinterrogation open and ask for confirmation again before writing.",
    "10. If the user denies, stop without writing anything.",
    "",
    "Do not silently preserve stale assumptions just because they exist in the current file.",
    "Prefer concise bullets or short paragraphs per section rather than dense wall-of-text blocks."
  ].join("\n");
}

function distillPrompt(
  concept: string,
  docsDir: string,
  styleTemplatePath?: string,
  intensity = "balanced"
): string {
  return [
    `Distill the feature "${concept}" against the current sibling knowledge in "${docsDir}".`,
    ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
    `Use distill intensity: ${intensity}.`,
    "",
    "Required sequence:",
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
    "8. Present the distilled findings and ask the user to choose: confirm, modify, or deny.",
    "9. If the user wants it written, write it as a separate doc such as `<concept>-distill.md`, not as a replacement for the canonical spec.",
    "",
    "This mode is for feature exploration, not full production design closure.",
    "Optimize for minimum implementation surface, not completeness."
  ].join("\n");
}

function extricatePrompt(concept: string, docsDir: string, styleTemplatePath?: string): string {
  return [
    `Extricate the feature "${concept}" from the docs in "${docsDir}".`,
    ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
    "",
    "Required sequence:",
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
    "6. Ask the user to choose: confirm, modify, or deny.",
    "7. Do not write anything unless the user explicitly asks you to apply the extrication.",
    "",
    "This is dependency-aware removal, not blind deletion.",
    "Preserve historical clarity when retirement or replacement is more accurate than erasure."
  ].join("\n");
}

function tracePrompt(
  concept: string | undefined,
  docsDir: string,
  indexMode: boolean,
  writeOutput: boolean,
  styleTemplatePath?: string
): string {
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

function convertPrompt(
  source: string,
  docsDir: string,
  targetForm = "canonical-spec",
  styleTemplatePath?: string
): string {
  return [
    `Convert "${source}" into target form "${targetForm}" using the docs in "${docsDir}" as context.`,
    ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
    "",
    "Required sequence:",
    "1. Read the source artifact first.",
    "2. Read any sibling docs needed to understand what the source already assumes.",
    "3. State what is being converted and what target form means in this case.",
    "4. Present a conversion plan before any write, including:",
    "   - what content survives unchanged",
    "   - what content gets reframed or promoted",
    "   - what content is intentionally dropped",
    "   - what output path or artifact should receive the conversion",
    "5. Ask the user to choose: confirm, modify, or deny.",
    "6. Do not write anything until the user confirms.",
    "",
    "Examples of target forms: canonical-spec, distilled-spec, overwrite-existing-doc, summary-brief.",
    "The canonical spec should not be silently narrowed or overwritten just because a derivative artifact exists."
  ].join("\n");
}

function summarizePrompt(concept: string, docsDir: string, styleTemplatePath?: string): string {
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

function normalizeChallengeModeArg(value: unknown, challenge: unknown): "easy" | "standard" | "adversarial" {
  if (value === "easy" || value === "standard" || value === "adversarial") {
    return value;
  }
  return Boolean(challenge) ? "adversarial" : "standard";
}

function normalizeDepthModeArg(value: unknown): "fast" | "standard" {
  return value === "fast" ? "fast" : "standard";
}
