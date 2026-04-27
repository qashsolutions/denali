/**
 * Routing layer above skill loaders.
 *
 * Branches on sessionState.isOnMedicare to determine which skill
 * orchestration to use:
 *
 * - true / undefined / null → Medicare orchestration (existing
 *   buildSystemPrompt / buildSystemPromptWithLearning).
 *   Default-safe: existing users who haven't toggled the new
 *   Settings switch keep current behavior.
 *
 * - false → non-Medicare orchestration. Currently routes to the
 *   Medicare loader because the non-Medicare loader doesn't exist
 *   yet (lands in C.6.d). When C.6.d ships, only the false branch
 *   changes.
 *
 * Stage 1.C Step C.6.c. NO behavior change in this commit — both
 * branches produce identical output because both call the Medicare
 * loader.
 */

import {
  buildSystemPrompt,
  buildSystemPromptWithLearning,
  type SkillTriggers,
} from "./skills-loader";
import type { SessionState } from "./claude";

export function buildSystemPromptForUser(
  triggers: SkillTriggers,
  sessionState?: SessionState,
): string {
  if (sessionState?.isOnMedicare === false) {
    // TODO C.6.f: replace with buildSystemPromptForNonMedicare(triggers, sessionState)
    return buildSystemPrompt(triggers, sessionState);
  }
  return buildSystemPrompt(triggers, sessionState);
}

export async function buildSystemPromptForUserWithLearning(
  triggers: SkillTriggers,
  sessionState?: SessionState,
  messages?: Array<{ role: string; content: string }>,
): Promise<string> {
  if (sessionState?.isOnMedicare === false) {
    // TODO C.6.f: replace with buildSystemPromptForNonMedicareWithLearning(...)
    return buildSystemPromptWithLearning(triggers, sessionState, messages);
  }
  return buildSystemPromptWithLearning(triggers, sessionState, messages);
}
