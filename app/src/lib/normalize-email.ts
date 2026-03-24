/**
 * Normalize email to prevent duplicate accounts via Gmail plus addressing.
 *
 * Gmail ignores everything after '+' in the local part:
 *   user+tag@gmail.com → user@gmail.com
 *
 * Only applies to Gmail/Googlemail domains. Non-Gmail addresses pass through unchanged.
 * Does NOT strip dots — some non-Gmail providers treat dots as significant.
 */
export function normalizeEmail(email: string): string {
  const atIndex = email.lastIndexOf("@");
  if (atIndex === -1) return email;

  const localPart = email.substring(0, atIndex);
  const domain = email.substring(atIndex + 1).toLowerCase();

  if (domain === "gmail.com" || domain === "googlemail.com") {
    const plusIndex = localPart.indexOf("+");
    const cleaned = plusIndex !== -1 ? localPart.substring(0, plusIndex) : localPart;
    return `${cleaned}@${domain}`;
  }

  return email;
}
