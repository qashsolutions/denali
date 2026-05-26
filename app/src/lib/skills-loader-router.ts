/**
 * Routing layer above skill loaders.
 *
 * Branches on sessionState.isOnMedicare to determine which skill
 * orchestration to use:
 *
 * - true / undefined / null → Medicare orchestration
 *   (buildSystemPrompt / buildSystemPromptWithLearning in
 *   skills-loader.ts). Default-safe: existing users who haven't
 *   toggled the Settings switch keep current behavior.
 *
 * - false → non-Medicare orchestration
 *   (buildSystemPromptForNonMedicare /
 *   buildSystemPromptForNonMedicareWithLearning in
 *   skills-loader-non-medicare.ts). Activated by Stage 1.C C.6.f.
 *
 * Stage 1.C Step C.6.c (initial scaffolding) → C.6.f (false branch
 * wired to non-Medicare loader; behavior change for users with
 * isOnMedicare === false).
 */

import {
  buildSystemPrompt,
  buildSystemPromptWithLearning,
  type SkillTriggers,
} from "./skills-loader";
import {
  buildSystemPromptForNonMedicare,
  buildSystemPromptForNonMedicareWithLearning,
} from "./skills-loader-non-medicare";
import type { SessionState } from "./claude";

export function buildSystemPromptForUser(
  triggers: SkillTriggers,
  sessionState?: SessionState,
): string {
  if (sessionState?.isOnMedicare === false) {
    return buildSystemPromptForNonMedicare(triggers, sessionState);
  }
  return buildSystemPrompt(triggers, sessionState);
}

export async function buildSystemPromptForUserWithLearning(
  triggers: SkillTriggers,
  sessionState?: SessionState,
  messages?: Array<{ role: string; content: string }>,
): Promise<string> {
  if (sessionState?.isOnMedicare === false) {
    return buildSystemPromptForNonMedicareWithLearning(
      triggers,
      sessionState,
      messages,
    );
  }
  return buildSystemPromptWithLearning(triggers, sessionState, messages);
}
