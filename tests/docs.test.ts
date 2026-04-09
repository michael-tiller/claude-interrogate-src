import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOC_VERSION,
  ensureDocumentMetadata,
  extractOpenQuestions,
  replaceOrAppendSection,
} from "../src/docs.js";

describe("ensureDocumentMetadata", () => {
  it("adds created, updated, and version lines without dropping the body", () => {
    const content = "# Gateway Events\n\n## 1. Decision\n\nUse a shared event envelope.\n";

    const result = ensureDocumentMetadata(content, "2026-04-08", DEFAULT_DOC_VERSION);

    expect(result).toContain("Created: 2026-04-08");
    expect(result).toContain("Updated: 2026-04-08");
    expect(result).toContain(`Version: ${DEFAULT_DOC_VERSION}`);
    expect(result).toContain("## 1. Decision");
    expect(result).toContain("Use a shared event envelope.");
  });
});

describe("replaceOrAppendSection", () => {
  it("replaces an existing section body in place", () => {
    const content = [
      "# Gateway Events",
      "Updated: 2026-04-08",
      "",
      "## Cross-References",
      "",
      "- [Overview](./overview.md)",
      "",
      "## Open Questions",
      "",
      "- Which consumers depend on event order?",
      "",
    ].join("\n");

    expect(
      replaceOrAppendSection(content, "Cross-References", "- [Routing Spec](./routing-spec.md)"),
    ).toContain("## Cross-References\n\n- [Routing Spec](./routing-spec.md)");
  });
});

describe("extractOpenQuestions", () => {
  it("filters out placeholder none values", () => {
    const content = [
      "# Gateway Events",
      "",
      "## Open Questions",
      "",
      "- None.",
      "- Which retries are caller-visible?",
      "",
    ].join("\n");

    expect(extractOpenQuestions(content, "Open Questions")).toEqual([
      "Which retries are caller-visible?",
    ]);
  });
});
