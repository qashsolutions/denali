/**
 * LikertInput provisional-mark logic (pure, node-safe, testable).
 *
 * The clinical-boundary rule (D40) is: Denali-authored calibration `helperText`
 * added on top of a validated instrument is provisional until a NAMED clinician
 * signs off, and the render MUST surface that — a ‡ after the hint plus a group
 * "‡ Wording pending clinical review." footnote. Those two decisions used to
 * live inline in `LikertInput`'s JSX, where vitest can't reach them (a render
 * concern, not a node-testable unit). Extracting them here lets a unit test pin
 * that the footnote/‡ ACTUALLY fire for an instrument that carries provisional
 * copy (e.g. MRS) — closing the gap between "the data is flagged provisional"
 * (helperTextGovernance.test.ts) and "the render shows the ‡".
 *
 * Render output is unchanged: `LikertInput` imports these so the JSX and the
 * test agree on one source of truth instead of duplicating the predicate.
 */

/** Minimal structural shape — matches both `LikertOption` and `ResponseOption`. */
export interface ProvisionalHelper {
  helperText?: string | null;
  helperTextProvisional?: boolean;
}

/** The ‡ marker (with its leading space) appended to a provisional hint. */
export const PROVISIONAL_MARK = " ‡";

/** The group-level footnote shown once when any hint is provisional. */
export const PROVISIONAL_FOOTNOTE = "‡ Wording pending clinical review.";

/**
 * The suffix appended after an option's `helperText`: the ‡ marker when the
 * hint is BOTH present and provisional, otherwise empty. A provisional flag
 * with no helperText yields nothing — there is no hint to mark.
 */
export function helperSuffix(opt: ProvisionalHelper): string {
  return opt.helperText != null && opt.helperTextProvisional === true
    ? PROVISIONAL_MARK
    : "";
}

/**
 * Whether the group footnote should render: true when ANY option carries a
 * provisional `helperText`. Mirrors `helperSuffix`'s gate so the per-option ‡
 * and the footnote can never disagree.
 */
export function shouldShowProvisionalFootnote(
  options: ReadonlyArray<ProvisionalHelper>,
): boolean {
  return options.some(
    (o) => o.helperText != null && o.helperTextProvisional === true,
  );
}
