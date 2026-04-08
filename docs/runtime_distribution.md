# Runtime Distribution
Updated: 2026-04-08

This repository is the internal source repo. It now also generates a publishable runtime payload for a separate installation repo.

## Build The Runtime Payload

Run:

```bash
npm install
npm run prepare:runtime-dist
```

That creates:

- [runtime-dist/README.md](E:/Personal/claude-interrogate/runtime-dist/README.md)
- [runtime-dist/plugins/claude-interrogate](E:/Personal/claude-interrogate/runtime-dist/plugins/claude-interrogate)
- [runtime-dist/runtime/dist](E:/Personal/claude-interrogate/runtime-dist/runtime/dist)
- [runtime-dist/.agents/plugins/marketplace.json](E:/Personal/claude-interrogate/runtime-dist/.agents/plugins/marketplace.json)

## Intended Split

- Internal repo:
  - TypeScript source
  - docs
  - sample fixtures
  - plugin/source scaffolding
  - release preparation scripts

- Runtime repo:
  - contents of `runtime-dist/`
  - no source-only scaffolding required for end users

## Install UX Target

In the runtime repo:

```text
/plugin marketplace add <runtime-repo>
/plugin install claude-interrogate-runtime@claude-interrogate
```

After install, users should get:

- `/claude-interrogate:interrogate`
- `/claude-interrogate:interrogate-hard`
- `/claude-interrogate:audit-docs`
- `/claude-interrogate:sync-docs`

## Current Limitation

This repo now prepares the runtime payload, but it does not yet automate pushing `runtime-dist/` to a separate repository. That release/publish step is still manual.
