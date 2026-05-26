/**
 * Non-Medicare skill loader.
 *
 * Companion to skills-loader.ts (the Medicare loader). Used by the
 * routing layer when sessionState.isOnMedicare === false.
 *
 * Architectural rules:
 * - Loads BASE_CORE_PROMPT only (no MEDICARE_OVERLAY_PROMPT)
 * - Suppresses ALL Medicare-specific skills:
 *     HEALTH_RECORDS_SKILL              (Blue Button = Medicare-only)
 *     DIABETES_PREVENTION_SKILL         (MDPP, DSMT, $35 Part D cap)
 *     OBESITY_PREVENTION_SKILL          (IBT, NCD 100.1, GLP-1 Part D)
 *     MEDICARE_NOTIFICATIONS_SKILL      (EOB tracking)
 *     MEDICARE_TYPE_SKILL               (Original vs Advantage)
 *     MEDICARE_ADVANTAGE_SKILL          (MA deflection)
 *     APPEAL_SKILL                      (LCD/NCD/MAC/CARC)
 *     EOB_EXPLAINER_SKILL               (EOB-specific)
 *     COVERAGE_SKILL                    (LCD/NCD lookup)
 *     REQUIREMENT_VERIFICATION_SKILL    (LCD requirements)
 *     GUIDANCE_SKILL                    (Medicare checklist)
 *     PRIOR_AUTH_SKILL                  (CMS PA Model)
 *     CODE_VALIDATION_SKILL             (Medicare coverage workflow)
 *     PROVIDER_SKILL                    ("accepts Medicare" check)
 *     OUTCOME_PROMPTING_SKILL           (past Medicare appeals)
 *     ONBOARDING_SKILL, SYMPTOM_SKILL,
 *       PROCEDURE_SKILL, SPECIALTY_VALIDATION_SKILL
 *                                       (gates feed into Medicare flow only)
 *     TOOL_RESTRAINT                    (used only inside Medicare gates)
 *     buildFlowStateReminder, buildSessionContext, buildRushModeReminder
 *                                       (Medicare-flow scaffolding)
 *     buildHealthContextForPrompt       (Blue Button data injection)
 * - Loads cohort-agnostic skills:
 *     COUNSELOR_SKILL                   (channel/role)
 *     PROVIDER_PILOT_SKILL              (channel/role)
 *     RED_FLAG_SKILL                    (emergency triage — applies to anyone)
 *     PROMPTING_SKILL                   (suggestion generation)
 * - Will load NON_MEDICARE_ACKNOWLEDGMENT_SKILL when C.6.e ships.
 *
 * Stage 1.C Step C.6.d. NOT yet wired into the routing layer — that's
 * C.6.f. NO behavior change in this commit.
 */

import {
  BASE_CORE_PROMPT,
  NON_MEDICARE_ACKNOWLEDGMENT_SKILL,
  COUNSELOR_SKILL,
  PROVIDER_PILOT_SKILL,
  RED_FLAG_SKILL,
  PROMPTING_SKILL,
} from "@/skills";
import type { SessionState } from "./claude";
import type { SkillTriggers } from "./skills-loader";

export function buildSystemPromptForNonMedicare(
  triggers: SkillTriggers,
  _sessionState?: SessionState,
): string {
  // BASE_CORE_PROMPT always loads — cohort-agnostic identity, tone,
  // and behavioral guidance. No MEDICARE_OVERLAY_PROMPT here.
  const sections: string[] = [BASE_CORE_PROMPT];

  // Non-Medicare acknowledgment — loaded immediately after base-core
  // and before role-based skills so it sets behavioral framing for
  // everything that follows.
  sections.push(NON_MEDICARE_ACKNOWLEDGMENT_SKILL);

  // Channel skills — role-based, cohort-agnostic
  if (triggers.isCounselor) {
    sections.push(COUNSELOR_SKILL);
  }
  if (triggers.isProvider) {
    sections.push(PROVIDER_PILOT_SKILL);
  }

  // Emergency takes priority — applies regardless of cohort.
  // Mirror the early-return pattern from the Medicare loader.
  if (triggers.hasEmergencySymptoms) {
    sections.push(RED_FLAG_SKILL);
    sections.push(PROMPTING_SKILL);
    return sections.join("\n\n---\n\n");
  }

  // Suggestion generation — always loaded so the model emits
  // [SUGGESTIONS] blocks for the UI.
  sections.push(PROMPTING_SKILL);

  return sections.join("\n\n---\n\n");
}

export async function buildSystemPromptForNonMedicareWithLearning(
  triggers: SkillTriggers,
  sessionState?: SessionState,
  _messages?: Array<{ role: string; content: string }>,
): Promise<string> {
  // Non-Medicare path doesn't use the Medicare-specific learning
  // database (denial patterns, coverage paths, flywheel context).
  // Returns the sync version's output unchanged.
  return buildSystemPromptForNonMedicare(triggers, sessionState);
}
