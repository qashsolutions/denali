/**
 * 988 safety helpers — pure.
 *
 * `shouldShow988(responses)` returns true when the PHQ-9 item-9 response
 * is strictly greater than 0 (any answer other than "Not at all").
 *
 * Per the agent spec and the hard rule in `.claude/agents/mobile-onboarding-builder.md`:
 *
 *   "PHQ-9 item 9 (self-harm) requires safety surface — Any response > 0
 *    MUST immediately surface the 988 Suicide & Crisis Lifeline... The
 *    item-9 response is still recorded as an observation AFTER the user
 *    acknowledges the safety surface, not silently in the background."
 *
 * Item 9 is at index 8 (0-based) in the PHQ-9 response array.
 */

export const PHQ9_ITEM_9_INDEX = 8;

/**
 * Returns true when the PHQ-9 item-9 (index 8) response is > 0.
 * Returns false for `null` / `undefined` / 0.
 */
export function shouldShow988(responses: ReadonlyArray<number | null>): boolean {
  const v = responses[PHQ9_ITEM_9_INDEX];
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/** Verbatim copy for the 988 modal — do not modify without crisis-counselor review. */
export const CRISIS_988_COPY = {
  title: "We're here for you",
  body:
    "If you're having thoughts of suicide or self-harm, you're not alone. " +
    "Call or text 988 to reach the Suicide & Crisis Lifeline (24/7, free, confidential).",
  callLabel: "Call 988",
  textLabel: "Text 988",
  acknowledge: "I understand",
  callUrl: "tel:988",
  textUrl: "sms:988",
} as const;
