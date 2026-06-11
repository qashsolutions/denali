/**
 * Free-text crisis detection for the chat surface.
 *
 * Deterministic, on-device, high-recall detection of self-harm / suicidal
 * ideation in a user's chat message. When it fires, ChatScreen surfaces the
 * Crisis988Modal — the SAME byte-identical 988 surface the PHQ-9 item-9 path
 * uses (`onboarding/Crisis988Modal`) — and does NOT send the message to the
 * model: the crisis resource IS the response (decision 2026-06-11).
 *
 * This is the DETERMINISTIC layer. The backend (Sonnet 4.6 + the prompt
 * safety carve-out) is the secondary, model-dependent layer — belt and
 * braces.
 *
 * Tuning philosophy: recall over precision for UNAMBIGUOUS ideation, tightly
 * guarded against idioms ("dying to know", "killing me", "dead tired") which
 * must NOT fire. `CRISIS_PATTERNS` plus the adversarial corpus in
 * `__tests__/crisisDetection.test.ts` are the durable, privacy-safe way to
 * improve this over time — there is intentionally NO logging of crisis
 * messages or events (Phase-1 invariant 1: crisis content never leaves the
 * device and is never recorded).
 *
 * Reviewed by clinical-boundary-reviewer (2026-06-11), then expanded per its
 * recall-gap findings: overdose-with-intent, "ready to die", "tired of
 * living", "can't go on living/anymore", "don't want to exist", "no reason
 * to be alive". Deliberately deferred to the dedicated clinical pass (they
 * overlap benign phrasing): bare "overdose", "take all my pills", "ending
 * it", "disappear", and a precision refinement for "tired of living" — it
 * currently over-fires on locative use ("tired of living IN this city"), an
 * accepted over-trigger under recall-over-precision; the clinical pass should
 * decide whether a negative lookahead is warranted. Any change to
 * CRISIS_PATTERNS requires a re-review.
 */

const CRISIS_PATTERNS: readonly RegExp[] = [
  // Direct self-killing.
  /\bkill(ing)?\s+(myself|my\s?self)\b/i,
  /\b(hurt(ing)?|harm(ing)?|cut(ting)?)\s+(myself|my\s?self)\b/i,
  /\bself[\s-]?harm/i,
  // Overdose with explicit intent. Bare "overdose" is excluded (it's often
  // an informational med-safety question); "take all my pills" is deferred
  // to the dedicated clinical pass because it overlaps adherence phrasing.
  /\b(want(ed)?|going|trying|tried|plan(ning)?)\s+to\s+overdos/i,
  // Ending one's life.
  /\bend(ing)?\s+(my|this)\s+life\b/i,
  /\bend(ing)?\s+it\s+all\b/i,
  /\btak(e|ing)\s+my\s+(own\s+)?life\b/i,
  // Wanting to die / be dead.
  /\bwant(ed)?\s+to\s+die\b/i,
  /\bwanna\s+die\b/i,
  /\bready\s+to\s+die\b/i,
  /\b(want(ed)?|wish(ing)?)\s+(to\s+be|i\s+(was|were))\s+dead\b/i,
  /\bbetter\s+off\s+dead\b/i,
  /\bwish\s+i\s+(wasn'?t|weren'?t)\s+(here|alive)\b/i,
  // Hopeless ideation phrasing.
  /\bno\s+(reason|point)\s+(to|in)\s+(live|living|be\s+here|be\s+alive)\b/i,
  /\bnothing\s+to\s+live\s+for\b/i,
  /\bdon'?t\s+want\s+to\s+(live|exist|be\s+(here|alive))\b/i,
  /\btired\s+of\s+(living|being\s+alive)\b/i,
  /\bcan'?t\s+go\s+on\s+(living|anymore)\b/i,
  // Suicide with intent context (bare "suicide" deliberately excluded to
  // avoid "suicide prevention/squad" false positives; "suicidal" kept).
  /\b(thoughts?\s+of|thinking\s+(about|of)|commit(ting)?|attempt(ing|ed)?)\s+suicid/i,
  /\bsuicidal\b/i,
];

/**
 * Returns true when the message contains unambiguous self-harm / suicidal
 * ideation. Pure + side-effect-free; never logs the input.
 */
export function detectCrisisLanguage(text: string): boolean {
  if (!text) return false;
  return CRISIS_PATTERNS.some((re) => re.test(text));
}
