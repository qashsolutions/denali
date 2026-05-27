/**
 * User-Facing Messages
 *
 * Centralized message strings for API responses and UI display.
 * All messages must be plain English at an 8th-grade reading level.
 * No technical jargon, HTTP status codes, field names, or developer terms.
 *
 * Rules:
 * - Say what happened and what the user should do
 * - Never expose internal field names (camelCase), status codes, or system concepts
 * - Use "sign in" not "authenticate", "try again" not "retry"
 * - Be warm and reassuring for elderly Medicare patients
 */

// =============================================================================
// AUTH — sign-in, session, verification
// =============================================================================

export const AUTH = {
  /** Generic sign-in required (replaces "Not authenticated", "Unauthorized", "Authentication required") */
  SIGN_IN_REQUIRED: "Please sign in to continue.",
  /** Specific sign-in prompts */
  SIGN_IN_TO_SEND_EMAIL: "Please sign in to send emails.",
  SIGN_IN_TO_SUBMIT_FEEDBACK: "Please sign in to submit feedback.",
  SIGN_IN_TO_TRACK: "Please sign in to continue.",
  /** Admin-only routes (replaces "Forbidden") */
  ADMIN_ONLY: "You don't have permission to do this.",
  /** Session expired */
  SESSION_EXPIRED: "Your session has ended. Please sign in again.",
  /** OTP-specific */
  OTP_SEND_FAILED: "We couldn't send your code. Please try again.",
  OTP_EXPIRED: "Your code has expired. Please request a new one.",
  OTP_INVALID: "That code didn't work. Please check it and try again.",
  OTP_NOT_FOUND: "We don't have a code on file. Please request a new one.",
  OTP_RATE_LIMIT_EMAIL: "Too many code requests. Please wait 15 minutes.",
  OTP_RATE_LIMIT_IP: "Too many requests from your location. Please wait 15 minutes.",
  OTP_VERIFY_RATE_LIMIT: "Too many attempts. Please request a new code.",
  /** Cognito auth failure (replaces "Authentication failed") */
  SIGN_IN_FAILED: "We couldn't sign you in. Please request a new code.",
  SIGN_IN_ERROR: "Something went wrong signing you in. Please try again.",
  /** MFA-specific */
  MFA_CODE_REQUIRED: "Please enter a 6-digit code.",
  MFA_NOT_ENROLLED: "Please set up your authenticator in Settings first.",
  MFA_NO_PENDING: "No pending setup found. Please start again.",
  MFA_SETUP_FAILED: "We couldn't set up your authenticator. Please try again.",
  MFA_REMOVE_FAILED: "We couldn't remove your authenticator. Please try again.",
  MFA_CONFIRM_FAILED: "We couldn't confirm your authenticator. Please try again.",
  /** ID.me */
  IDME_UNAVAILABLE: "Identity verification is temporarily unavailable. Please try again later.",
  IDME_FAILED: "We couldn't start identity verification. Please try again.",
} as const;

// =============================================================================
// VALIDATION — input errors shown when data is missing or wrong
// =============================================================================

export const VALIDATION = {
  /** Generic (replaces "Invalid request body", "Invalid JSON body") */
  INVALID_INPUT: "Something wasn't right with your request. Please try again.",
  /** Email */
  EMAIL_REQUIRED: "Please enter your email address.",
  EMAIL_INVALID: "That doesn't look like a valid email address.",
  /** OTP */
  CODE_REQUIRED: "Please enter your email and the 6-digit code.",
  CODE_FORMAT: "The code should be 6 digits.",
  /** Consent (replaces "Invalid consent type", "granted must be a boolean") */
  INVALID_PREFERENCE: "We couldn't update that setting. Please try again.",
  /** Topics (replaces "topics must be an array") */
  INVALID_TOPICS: "Please select valid topics.",
  TOPICS_MAX: (max: number) => `You can choose up to ${max} topics.`,
  INVALID_TOPIC: (topic: string) => `"${topic}" isn't a valid topic option.`,
  /** Feedback (replaces "messageId and rating (up|down) required") */
  FEEDBACK_REQUIRED: "We need both a message and a rating to save your feedback.",
  /** Diabetes log (replaces "Invalid entry_type", "Invalid glucose_context", etc.) */
  INVALID_LOG_TYPE: "Please select a valid entry type.",
  INVALID_GLUCOSE_CONTEXT: "Please select when this reading was taken.",
  ACTIVITY_POSITIVE: "Activity time must be a positive number.",
  MISSING_ENTRY_ID: "We couldn't find that entry. Please try again.",
  /** Chat (replaces "Messages array is required and must not be empty") */
  MESSAGES_REQUIRED: "Please type a message to get started.",
  /** Plan (replaces "Invalid plan type") */
  INVALID_PLAN: "Please select a valid plan.",
  /** Appeal outcome */
  APPEAL_ID_REQUIRED: "We need to know which appeal this is for.",
  OUTCOME_REQUIRED: "Please select what happened with your appeal (approved, denied, or partially approved).",
  /** Admin CMS */
  INVALID_TABLE: "That content section doesn't exist.",
  INVALID_COLUMNS: (cols: string[]) => `These fields can't be updated: ${cols.join(", ")}`,
  /** Checklist email */
  CHECKLIST_REQUIRED: "We need your email and the checklist to send.",
  /** Health report email */
  REPORT_EMAIL_REQUIRED: "Please provide the report and email address.",
  /** Conversation */
  CONVERSATION_ID_REQUIRED: "We couldn't find that conversation.",
  /** Outcome report token */
  TOKEN_REQUIRED: "This link seems incomplete. Please use the link from your email.",
  TOKEN_INVALID: "This link is no longer valid. Please check your email for a newer one.",
  /** Alerts */
  INVALID_ALERT_TYPE: "That alert type isn't available.",
  ALERT_TOGGLE_INVALID: "Please select on or off for this alert.",
  /** Admin policy change */
  POLICY_DATE_REQUIRED: "Please provide an effective date.",
  POLICY_SUMMARY_REQUIRED: "Please provide a summary.",
  POLICY_CHANGES_REQUIRED: "Please list at least one change.",
  /** Counselor */
  CASE_FIELDS_REQUIRED: "Please provide the case and outcome.",
  /** Files */
  FILE_TYPE_UNSUPPORTED: "Only PDF, PNG, and JPEG files are supported.",
  FILE_READ_FAILED: "We couldn't read that file. Please try uploading it again.",
  FILE_TOO_LARGE: (limit: string) => `That file is too large. Your plan allows up to ${limit}.`,
} as const;

// =============================================================================
// RATE LIMITS — usage caps, trial, weekly/daily limits
// =============================================================================

export const RATE_LIMITS = {
  TRIAL_REQUIRED: "Sign up for a free trial to start chatting with Denali.",
  TRIAL_EXPIRED: "Your free trial has ended. Upgrade to keep using Denali.",
  WEEKLY_LIMIT: (days: number) =>
    `You've used your chat day${days !== 1 ? "s" : ""} for this week. You can chat again next week, or upgrade for more access.`,
  DAILY_LIMIT: (limit: number) =>
    `You've reached your daily limit of ${limit} messages. You can continue tomorrow, or upgrade for more access.`,
  NON_MEDICARE_DAILY_LIMIT:
    "You've used your 3 messages for today. Come back tomorrow.",
} as const;

// =============================================================================
// SYSTEM ERRORS — generic failures, timeouts, server issues
// =============================================================================

export const SYSTEM = {
  /** Generic server error (replaces raw error.message in SSE, "An error occurred") */
  GENERIC_ERROR: "Something went wrong. Please try again.",
  /** Chat-specific (replaces raw error.message in SSE stream) */
  CHAT_ERROR: "Something went wrong on our end. Please try again in a few minutes.",
  CHAT_ERROR_RETRY: "Something went wrong. Please try again — it usually works on the second try.",
  CHAT_TIMEOUT: "This is taking longer than usual. Please try again — it usually works on the second try.",
  CHAT_OFFLINE: "I'm having trouble connecting right now. Please try again in a moment.",
  /** Data loading failures */
  LOAD_HEALTH_DATA: "We couldn't load your health information. Please refresh the page.",
  LOAD_HEALTH_DATA_OFFLINE: "We couldn't load your health information. Please check your connection and try again.",
  LOAD_PREFERENCES: "We couldn't load your settings. Please refresh the page.",
  LOAD_CONVERSATION: "We couldn't load this conversation. Please try again.",
  LOAD_LAB_HISTORY: "We couldn't load your lab history. Please try again.",
  LOAD_REPORT: "We couldn't load your health report. Please try again.",
  LOAD_STATS: "We couldn't load the data. Please try again.",
  /** Save failures */
  SAVE_PREFERENCE: "We couldn't save that setting. Please try again.",
  SAVE_FEEDBACK: "We couldn't save your feedback. Please try again.",
  SAVE_OUTCOME: "We couldn't save your appeal outcome. Please try again.",
  SAVE_LOG: "Something went wrong. Please try again.",
  /** Email failures */
  EMAIL_FAILED: "We couldn't send the email. Please try again or use the print option.",
  /** Account */
  DELETE_FAILED: "We couldn't delete your account. Please contact support.",
  ADMIN_DELETE_BLOCKED: "Admin accounts cannot be deleted through the app.",
  SESSION_INVALID: "Your sign-in has expired. Please sign in again.",
  /** Service temporarily unavailable (Cognito, RDS, etc.) */
  SERVICE_UNAVAILABLE: "We're having a temporary issue. Please try again in a moment.",
  /** Payment */
  PAYMENT_NOT_CONFIGURED: "Payments aren't available right now. Please try again later.",
  CHECKOUT_FAILED: "We couldn't start checkout. Please try again or contact support.",
  /** Medicare connection */
  MEDICARE_CONNECT_FAILED: "We couldn't connect to Medicare right now. Please try again in a few minutes.",
  MEDICARE_CONNECT_UNAVAILABLE: "Medicare connection is temporarily unavailable. Please try again later.",
  MEDICARE_DISCONNECT_FAILED: "We couldn't disconnect Medicare right now. Please try again.",
  /** Health data consent */
  HEALTH_CONSENT_REQUIRED: "Please enable health data sharing in Settings to use this feature.",
  /** Report generation */
  REPORT_GENERATION_FAILED: "We couldn't generate your report. Please try again.",
  REPORT_NOT_FOUND: "We couldn't find that report.",
  /** Trial */
  TRIAL_CHECK_FAILED: "We couldn't check your trial status. Please try again.",
  TRIAL_START_FAILED: "We couldn't start your trial. Please try again.",
  TRIAL_ALREADY_USED: "Your trial has already been used.",
  ACTIVE_SUBSCRIPTION: "You already have an active plan.",
  ACTIVE_SUBSCRIPTION_CHANGE_PLAN:
    "You have an active subscription. To switch plans, click Manage Subscription to cancel your current plan first. You'll be able to choose a new plan at the end of your current billing cycle.",
  /** PDF */
  PDF_FAILED: "We couldn't generate the PDF. Please try again.",
  /** No health data */
  NO_HEALTH_DATA: "No health data available. Please connect Medicare first.",
  /** Insights */
  INSIGHT_FAILED: "We couldn't generate your health insights. Please try again.",
  /** Alerts */
  ALERT_PROCESS_FAILED: "We couldn't process your alerts. Please try again.",
  /** Topics */
  TOPICS_LOAD_FAILED: "We couldn't load your content preferences. Please try again.",
  TOPICS_SAVE_FAILED: "We couldn't save your content preferences. Please try again.",
} as const;

// =============================================================================
// MEDICARE — Blue Button OAuth error mapping
// =============================================================================

export const MEDICARE_ERRORS: Record<string, string> = {
  denied: "You chose not to connect. You can try again anytime.",
  missing_params: "Something went wrong with the connection. Please try again.",
  invalid_state: "The connection request expired. Please try again.",
  not_authenticated: "Please sign in first, then connect Medicare.",
  token_exchange: "The Medicare connection didn't go through. Please try again.",
  save_failed: "We couldn't save the connection. Please try again.",
  config: "Medicare connection isn't available right now. Please contact support.",
  default: "Something went wrong. Please try again.",
};

// =============================================================================
// WEBHOOK — Stripe (never shown to users, but kept clean for logs)
// =============================================================================

export const WEBHOOK = {
  NOT_CONFIGURED: "Webhook not configured",
  MISSING_SIGNATURE: "Missing signature",
  INVALID_SIGNATURE: "Invalid signature",
} as const;
