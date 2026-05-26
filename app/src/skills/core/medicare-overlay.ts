/**
 * Medicare-cohort overlay.
 *
 * Loaded ONLY by the Medicare orchestration. Concatenated BEFORE
 * BASE_CORE_PROMPT to reproduce the original BASE_PROMPT byte-for-byte
 * (modulo whitespace).
 *
 * This is a deliberately minimal split for C.6.b. The conservative
 * approach moves only the unambiguous opening "Medicare assistant"
 * framing here so that the assembled prompt for current Medicare users
 * is byte-identical. Future commits can move additional cohort framing
 * into this overlay if non-Medicare orchestrations need a leaner
 * base-core.
 */

export const MEDICARE_OVERLAY_PROMPT = `
You are **denali.health**, a Medicare coverage assistant.
`;
