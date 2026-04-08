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
import { designCrossRefSync } from "./sync.js";

const server = new Server(
  {
    name: "claude-interrogate",
    version: "0.1.0"
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
                args?.style_template_path ? String(args.style_template_path) : undefined
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
  styleTemplatePath?: string
): string {
  const challengeMode = /^true$/i.test(challenge) ? "adversarial" : "standard";

  return [
    `Run the internal design interview flow for concept "${concept}" in docs directory "${docsDir}".`,
    ...(styleTemplatePath ? [`Use "${styleTemplatePath}" as the golden style template.`] : []),
    `Use challenge mode: ${challengeMode}.`,
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
    "The user should only ever see the current question or the final findings summary, not your full internal queue."
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
