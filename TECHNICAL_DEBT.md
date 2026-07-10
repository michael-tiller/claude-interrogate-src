# Technical Debt

## FIXED (2026-07-09): `design_taskout_start`/`design_taskout_generate`: DOD checked-state and nested subsections didn't round-trip

**Found**: 2026-07-09, working `M04_CLASSES_SKILLS` in dirigible2D.

**Fixed**: same day, in this repo (`src/types.ts`, `src/roadmap-parse.ts`, `src/taskout.ts`,
`src/scope.ts` + test coverage in `tests/renderer-roundtrip.test.ts` and friends). The real bug
was broader than first diagnosed: `definitionOfDone` was typed `string[]`, so `renderTaskout`
unconditionally wrote every DOD item as `- [ ]` on regenerate — **every RC's DOD checkbox state
was silently reset to unchecked on every maintenance pass**, not just RCs with a nested
sub-track. `DoDItem` (`{ text, checked, subheading? }`) now carries checked state end-to-end, and
`parseDoDItems` walks the section body tracking `### <subheading>` transitions so a nested
checklist round-trips as its own grouped section instead of collapsing into the flat list.
`npm run check` + `npx vitest run` both green (144/144) after the fix.

**Not yet done**: this fix lives in the dev source tree
(`E:/Personal/claude-interrogate-src`) and has not been built/released/reinstalled into the
plugin cache the live session actually calls (`~/.claude/plugins/cache/.../claude-interrogate/0.1.23`)
— that copy still has the bug until a release + reinstall happens. Treat as a separate,
explicit publish decision, not implied by this fix landing in source.

Original write-up follows, kept for context on the failure mode and its discovery.

---

`design_taskout_start` (`src/taskout.ts`) parses `## Definition of Done` as a flat
list of top-level bullets. It doesn't know about a nested `### <heading>` checklist
living inside that section — e.g. dirigible2D's RC file has a
`### Accelerated VG-foundation track DOD` subsection with its own `- [x]`/`- [ ]`
items, added after the main 12-item DOD list to track a separate accelerated track.

Because the parser flattens `definitionOfDone` to `string[]` with no subsection
model, that structure never reaches `draftSections` — so a maintenance-mode caller
who round-trips `design_taskout_start` → (edit) → `design_taskout_generate` without
independently re-authoring that subsection will have `generate` silently drop it
from the regenerated file. On the dirigible2D file this was a real ~2-item-per-side
checkbox loss (56→47 checked, 9 `###` headings → 8) caught only by diffing the
`.draft.md` output against the live file before promoting it.

**Impact**: any RC file with more than one checklist under `## Definition of Done`
(a "sub-DOD" for an accelerated/parallel track, in this case) is unsafe to run
through a normal maintenance pass — the tool will regenerate a plausible-looking
file that has quietly lost tracked checkbox state. No error, no warning.

**Fix options**:
1. Extend the DOD parser/model to capture `### `-nested subsections under
   `## Definition of Done` (mirroring how `## Targeted` already nests epics), and
   round-trip them through `draftSections`/`ConfirmedTaskoutPlan`/`generate`.
2. Short of a full model change, at minimum have `generate` (or a pre-write coverage
   check) detect and refuse when the existing file has `### ` subsections under
   `## Definition of Done` that aren't represented in the confirmed plan — fail loud
   instead of silently dropping.

**Workaround used**: don't run `design_taskout_generate` in maintenance mode on an
RC file with this shape. Hand-edit the markdown directly instead (see
dirigible2D's `Roadmap/M04_CLASSES_SKILLS.md`, ticket
`carried-from-m02-crafting#e9474968fb2f` and its new blocker sibling, added by hand
2026-07-09).
