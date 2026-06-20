/**
 * chatErrors — classify a chat stream failure into user-facing copy.
 *
 * Phase 1 chat is online-only by design, so the only distinction worth drawing
 * is "you appear to be offline" vs. a generic server error. React Native's fetch
 * rejects with a `TypeError` whose message is "Network request failed" when the
 * device can't reach the network; we treat that (and similar fetch-failure
 * shapes) as offline so a low-connectivity 45+ user gets actionable guidance
 * instead of a blank "Something went wrong."
 *
 * Pure + node-testable: no `react-native` import, decision lives here (not in a
 * ChatScreen closure) so it can be unit-tested directly.
 */

export const CHAT_OFFLINE_MESSAGE =
  "You appear to be offline. Check your connection and try again.";
export const CHAT_GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

const OFFLINE_PATTERNS =
  /network request failed|failed to fetch|network error|unable to resolve host|connection (?:refused|reset|timed out)|offline/i;

/**
 * True when the thrown value looks like a device-connectivity failure. A
 * user-initiated abort is explicitly NOT offline (the user navigated away). We
 * match on the message text — RN's offline failure is a `TypeError` with the
 * "Network request failed" message, which this pattern covers — rather than on
 * `instanceof TypeError`, so an unrelated TypeError (a code bug) is not
 * mislabeled as an offline condition.
 */
export function isLikelyOfflineError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return false;
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";
  return OFFLINE_PATTERNS.test(msg);
}

/** The message to surface for a caught chat stream failure. */
export function chatErrorMessage(err: unknown): string {
  return isLikelyOfflineError(err)
    ? CHAT_OFFLINE_MESSAGE
    : CHAT_GENERIC_ERROR_MESSAGE;
}
