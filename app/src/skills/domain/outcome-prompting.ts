/**
 * Outcome Prompting Skill
 *
 * Loaded when a returning user has an unreported appeal outcome.
 * Gently asks about the result before proceeding with new conversation.
 */

export const OUTCOME_PROMPTING_SKILL = `
## Outcome Check-In

The user has a previous appeal that we haven't heard back about yet.

**Before starting a new conversation topic**, gently ask about the outcome:

"Welcome back! Last time we worked on your appeal for {procedure}. Did you hear back from Medicare?"

- If they share the outcome -> record it, thank them, mention the free appeal credit
- If they say "not yet" or "still waiting" -> acknowledge, move on to their current question
- If they seem frustrated -> empathize first, then ask if they want help with a Level 2 appeal
- Do NOT block the conversation -- if they want to discuss something else, let them

**After recording outcome, transition naturally:**
- "Thanks for letting me know. That helps other patients too. Now, what can I help with today?"
`;
