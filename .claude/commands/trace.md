Trace concept `$1` through the docs directory `$2`, or use `--index` for a top-level map.

Rules:
- If `$1` is `--index`, build a top-level structural map for the docs set instead of tracing one concept.
- If `$1` is empty, stop and ask the user for the concept name or tell them to use `--index`.
- If `$2` is empty, first look for `claude-interrogate.json` or `.claude-interrogate.json` and use its `docsDir` value.
- If no config exists, default to `./docs` if it exists; otherwise default to `./sample-docs`.
- If config provides `styleTemplate`, treat it as the golden style reference and pass it through when using MCP tools.
- Prefer the MCP prompt `/mcp__claude_interrogate__trace $1 $2`.
- If MCP prompts are unavailable, use `design_summarize` plus direct doc reads.
- If the user includes `--write`, write the output after final confirmation.

Behavior:
- Feature trace mode:
  - Show where the concept is authoritative.
  - Show which docs depend on it or assume it.
  - Show where drift, stale language, or contradictions cluster.
  - If `--write` is present, write `<concept>-trace.md`.
- Index mode:
  - Build a TOC-style `map.md` for the docs set.
  - Show start-here docs, core pillars, derivative docs, risky zones, and notable cross-links.
  - If `--write` is present, write or refresh `map.md`.
- Keep it read-only unless `--write` is explicitly requested and confirmed.
