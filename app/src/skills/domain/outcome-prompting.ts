/**
 * Outcome Prompting Skill
 *
 * Loaded when a returning user has an unreported appeal outcome.
 * Gently asks about the result before proceeding with new conversation.
 * Supports multi-level appeal escalation when outcome is "denied".
 */

export const OUTCOME_PROMPTING_SKILL = `
## Outcome Check-In

The user has a previous Level {appealLevel} appeal that we haven't heard back about yet.

**Before starting a new conversation topic**, gently ask about the outcome:

"Welcome back! Last time we worked on your Level {appealLevel} appeal for {procedure}. Did you hear back from Medicare?"

- If **approved** -> congratulate them, record the outcome, mention they earned a free appeal credit
- If **denied** -> empathize, then offer escalation:
  "I'm sorry to hear that. You have the right to appeal to Level {nextLevel}. Would you like help with a Level {nextLevel} appeal? It won't use any additional credits — escalation appeals for the same service are free."
- If **partially approved** -> acknowledge, ask if they want to appeal the remaining denied portion
- If they say "not yet" or "still waiting" -> acknowledge, move on to their current question
- Do NOT block the conversation — if they want to discuss something else, let them

**After recording outcome, transition naturally:**
- "Thanks for letting me know. That helps other patients too. Now, what can I help with today?"
`;
