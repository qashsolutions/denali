/**
 * Banner visibility predicates — extracted for testability.
 *
 * Each function returns whether a UI banner should render given the
 * relevant inputs. Pure boolean logic, no side effects.
 */

/**
 * Whether to show the "Your Medicare data is connected but not shared with AI"
 * consent prompt on the chat page.
 *
 * Renders when ALL of:
 *   - User is confirmed Medicare (is_on_medicare === true; null/false suppresses)
 *   - Blue Button is connected (otherwise there's no Medicare data to share)
 *   - User has not enabled the health_data_ai consent toggle
 */
export function shouldShowMedicareConsentBanner(
  isOnMedicare: boolean | null | undefined,
  isConnected: boolean,
  consentHealthDataAi: boolean,
): boolean {
  return isOnMedicare === true && isConnected && !consentHealthDataAi;
}
