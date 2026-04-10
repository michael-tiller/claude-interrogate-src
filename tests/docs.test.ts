import { describe, expect, it } from "vitest";
import {
  DEFAULT_DOC_VERSION,
  ensureDocumentMetadata,
  extractOpenQuestions,
  postEditNormalizeDocument,
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

describe("postEditNormalizeDocument", () => {
  it("bumps patch when only managed metadata sections change", () => {
    const previous = [
      "# Gateway Events",
      "Created: 2026-04-01",
      "",
      "Updated: 2026-04-07",
      "Version: 0.1.0",
      "",
      "## 1. Decision",
      "",
      "Use a shared event envelope.",
      "",
      "## Cross-References",
      "",
      "- [Overview](./overview.md)",
      "",
      "## Resolved Decisions",
      "",
      "- No resolved decisions captured yet.",
      "",
      "## Open Questions",
      "",
      "- None.",
      "",
      "## Version History",
      "",
      "- 0.1.0 (2026-04-07): Initial documented draft.",
      "",
    ].join("\n");

    const next = previous.replace(
      "- [Overview](./overview.md)",
      "- [Overview](./overview.md)\n- [Routing Spec](./routing-spec.md)"
    );

    const result = postEditNormalizeDocument(previous, next, "2026-04-08", {
      crossRefHeading: "Cross-References",
      openQuestionsHeading: "Open Questions",
    });

    expect(result.bump).toBe("patch");
    expect(result.version).toBe("0.1.1");
    expect(result.content).toContain("Version: 0.1.1");
    expect(result.content).toContain("- 0.1.1 (2026-04-08): Metadata, linkage, or narrow doc maintenance update.");
  });

  it("bumps minor when a core section changes", () => {
    const previous = [
      "# Gateway Events",
      "Created: 2026-04-01",
      "",
      "Updated: 2026-04-07",
      "Version: 0.1.1",
      "",
      "## 1. Decision",
      "",
      "Use a shared event envelope.",
      "",
      "## Cross-References",
      "",
      "- [Overview](./overview.md)",
      "",
      "## Resolved Decisions",
      "",
      "- No resolved decisions captured yet.",
      "",
      "## Open Questions",
      "",
      "- None.",
      "",
      "## Version History",
      "",
      "- 0.1.1 (2026-04-07): Metadata, linkage, or narrow doc maintenance update.",
      "",
    ].join("\n");

    const next = previous.replace(
      "Use a shared event envelope.",
      "Use a shared event envelope with explicit source attribution and replay guarantees."
    );

    const result = postEditNormalizeDocument(previous, next, "2026-04-08", {
      crossRefHeading: "Cross-References",
      openQuestionsHeading: "Open Questions",
    });

    expect(result.bump).toBe("minor");
    expect(result.version).toBe("0.2.0");
    expect(result.content).toContain("- 0.2.0 (2026-04-08): Substantive design update.");
  });

  it("bumps major when multiple core sections shift", () => {
    const previous = [
      "# Gateway Events",
      "Created: 2026-04-01",
      "",
      "Updated: 2026-04-07",
      "Version: 0.2.0",
      "",
      "## 1. Decision",
      "",
      "Use a shared event envelope.",
      "",
      "## 2. Release Bar",
      "",
      "A reviewer can verify the schema is stable.",
      "",
      "## 3. Chosen Shape",
      "",
      "Route all producers through the same contract.",
      "",
      "## Cross-References",
      "",
      "- [Overview](./overview.md)",
      "",
      "## Resolved Decisions",
      "",
      "- No resolved decisions captured yet.",
      "",
      "## Open Questions",
      "",
      "- None.",
      "",
      "## Version History",
      "",
      "- 0.2.0 (2026-04-07): Substantive design update.",
      "",
    ].join("\n");

    const next = previous
      .replace("Use a shared event envelope.", "Split ingestion and delivery contracts into separate envelopes.")
      .replace("Route all producers through the same contract.", "Use separate producer classes with distinct lifecycle boundaries.");

    const result = postEditNormalizeDocument(previous, next, "2026-04-08", {
      crossRefHeading: "Cross-References",
      openQuestionsHeading: "Open Questions",
    });

    expect(result.bump).toBe("major");
    expect(result.version).toBe("1.0.0");
    expect(result.content).toContain("- 1.0.0 (2026-04-08): Major design revision or contract shift.");
  });

  it("adds missing managed sections during post-edit normalization", () => {
    const previous = [
      "# Gateway Events",
      "",
      "## 1. Decision",
      "",
      "Use a shared event envelope.",
      "",
    ].join("\n");

    const result = postEditNormalizeDocument(previous, previous, "2026-04-08", {
      crossRefHeading: "Cross-References",
      openQuestionsHeading: "Open Questions",
    });

    expect(result.content).toContain("Created: 2026-04-08");
    expect(result.content).toContain("Updated: 2026-04-08");
    expect(result.content).toContain("## Cross-References");
    expect(result.content).toContain("## Resolved Decisions");
    expect(result.content).toContain("## Open Questions");
    expect(result.content).toContain("## Version History");
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
