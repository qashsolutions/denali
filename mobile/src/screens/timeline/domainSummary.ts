/**
 * Curated dashboard-card summary for single-domain rollups (redesign
 * step-2 fix). Replaces the raw latest-value preview, which leaked
 * intake answer text onto the dashboard (e.g. "How much do you usually
 * sleep at night?: 2"). Uses only data already displayed elsewhere:
 * the tracked-row count and the latest row's effective date. The full
 * values remain on the domain detail screen.
 *
 * Pure module (no icon/React imports) so the template is unit-testable
 * in the node vitest environment — displayMapping.ts pulls in
 * lucide-react-native and can't load there.
 */
export function formatDomainSummary(
  count: number,
  updatedDateLabel: string,
): string {
  return `${count} ${count === 1 ? "value" : "values"} tracked · updated ${updatedDateLabel}`;
}
