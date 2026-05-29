/**
 * The filename / id prefix for an RC of the given kind.
 * - `"build"` (or undefined) → `"M"` — a regular work milestone.
 * - `"release-candidate"` → `"MRC"` — a pop-corks-moment milestone, the design-side
 *   marker for a release-readiness checkpoint. Versions remain orthogonal (SemVer is
 *   process; milestones are design).
 */
export function rcPrefix(kind) {
    return kind === "release-candidate" ? "MRC" : "M";
}
