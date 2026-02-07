/**
 * Skills Loader
 *
 * ARCHITECTURE: BASE_PROMPT + CONDITIONAL_SKILLS
 *
 * BASE_PROMPT (always loaded):
 * - Identity & mission
 * - Conversation style rules (one question, short responses, etc.)
 * - Error handling guidelines
 * - Progressive disclosure
 *
 * CONDITIONAL_SKILLS (loaded by trigger detection):
 * - ONBOARDING: when !hasUserName || !hasUserZip
 * - SYMPTOM_GATHERING: when hasProblem && missing duration/treatments
 * - PROCEDURE_CLARIFICATION: when hasProcedure || needsClarification
 * - PROVIDER_VERIFICATION: when hasProviderName && !hasProviderConfirmed
 * - CODE_VALIDATION: when hasProcedure (ICD-10 to CPT mapping)
 * - COVERAGE_LOOKUP: when ready for coverage check
 * - REQUIREMENT_VERIFICATION: when hasCoverage && !verificationComplete
 * - GUIDANCE_DELIVERY: when all info gathered
 * - RED_FLAG_CHECK: when symptoms suggest emergency
 * - APPEAL_GENERATION: when isAppeal
 */

import type { SessionState } from "./claude";
import {
  getLearningContext,
  buildLearningPromptInjection,
  extractEntities,
  type ExtractedEntities,
} from "./learning";
import {
  validateSpecialtyMatch,
  type SpecialtyMatchResult,
} from "./specialty-match";

// Import all skill modules
import {
  BASE_PROMPT,
  TOOL_RESTRAINT,
  ONBOARDING_SKILL,
  MEDICARE_TYPE_SKILL,
  MEDICARE_ADVANTAGE_SKILL,
  PROMPTING_SKILL,
  SYMPTOM_SKILL,
  PROCEDURE_SKILL,
  PROVIDER_SKILL,
  PRIOR_AUTH_SKILL,
  CODE_VALIDATION_SKILL,
  COVERAGE_SKILL,
  REQUIREMENT_VERIFICATION_SKILL,
  GUIDANCE_SKILL,
  RED_FLAG_SKILL,
  SPECIALTY_VALIDATION_SKILL,
  APPEAL_SKILL,
} from "@/skills";

// =============================================================================
// SKILL CONSTANTS - Now imported from modular files
// =============================================================================

// All skill constants are now imported from @/skills barrel export
// Individual modules located in:
// - Core skills: src/skills/core/
// - Domain skills: src/skills/domain/

// =============================================================================
// SKILL TRIGGERS
// =============================================================================

export interface SkillTriggers {
  // Onboarding
  hasUserName: boolean;
  hasUserZip: boolean;
  hasProblem: boolean;
  // Symptoms
  hasSymptoms: boolean;
  hasDuration: boolean;
  hasPriorTreatments: boolean;
  // Procedure
  hasProcedure: boolean;
  needsClarification: boolean;
  // Rush mode (user asked for coverage multiple times)
  isRushMode: boolean; // User repeatedly asking for coverage - give basic info
  // Provider
  hasProviderName: boolean;
  hasProviderConfirmed: boolean;
  providerSkipped: boolean; // User said "not yet" or "show coverage first"
  // Coverage
  hasCoverage: boolean;
  hasGuidance: boolean;
  // Appeal
  isAppeal: boolean;
  // Verification
  hasRequirementsToVerify: boolean;
  verificationComplete: boolean;
  meetsAllRequirements: boolean;
  // Specialty
  hasSpecialtyMismatch: boolean;
  // Emergency
  hasEmergencySymptoms: boolean;
  // Medicare type
  hasMedicareType: boolean;
  isMedicareAdvantage: boolean;
  // Prior auth query
  isPriorAuthQuery: boolean;
}

// Emergency symptom patterns
const EMERGENCY_PATTERNS = /chest pain.*(breath|short)|sudden.*(headache|numb|weak)|can't (move|feel)|worst headache|one side.*(numb|weak)/i;

export function detectTriggers(
  messages: Array<{ role: string; content: string }>,
  sessionState?: SessionState
): SkillTriggers {
  // IMPORTANT: Only look at USER messages for content-based triggers
  // Otherwise Claude's questions ("Have you tried any treatments?") trigger false positives
  const userMessages = messages.filter((m) => m.role === "user");
  const userContent = userMessages.map((m) => m.content.toLowerCase()).join(" ");
  const lastUserMessage = userMessages.length > 0 ? userMessages[userMessages.length - 1].content.toLowerCase() : "";

  return {
    // Onboarding
    hasUserName: sessionState?.userName != null && sessionState.userName.length > 0,
    hasUserZip: sessionState?.userZip != null && sessionState.userZip.length > 0,
    hasProblem: userMessages.length > 1 || /mri|ct|scan|surgery|pain|hurt|denied|appeal|approval/.test(userContent),

    // Symptoms - ONLY from sessionState or user's actual statements
    hasSymptoms:
      (sessionState?.symptoms?.length ?? 0) > 0 ||
      /my.*(pain|hurt|ache|numb)|pain in|hurts when|been having|suffering from/.test(userContent),
    hasDuration:
      sessionState?.duration != null ||
      /\d+\s*(week|month|year|day)s?|few (weeks|months)|long time|a while|since/.test(userContent),
    hasPriorTreatments:
      (sessionState?.priorTreatments?.length ?? 0) > 0 ||
      /i('ve| have) tried|been doing|taking|did pt|physical therapy|on medication/.test(userContent),

    // Procedure
    hasProcedure:
      sessionState?.procedureNeeded != null ||
      /mri|ct scan|surgery|replacement|x-ray|ultrasound|need.*(scan|test)/.test(userContent),
    needsClarification: /which|what kind|what type/.test(lastUserMessage),

    // Rush mode - user asked about coverage 2+ times without answering questions
    isRushMode: (() => {
      const coverageRequests = userMessages.filter(m =>
        /check.*coverage|ask.*coverage|coverage.*check|just.*coverage|want.*coverage/i.test(m.content)
      );
      return coverageRequests.length >= 2;
    })(),

    // Provider - only if user mentions a specific doctor
    hasProviderName:
      sessionState?.providerName != null ||
      /dr\.\s*\w+|doctor\s+\w+|my doctor|my physician/.test(userContent),
    hasProviderConfirmed:
      sessionState?.provider != null && sessionState.provider.npi != null,
    providerSkipped:
      /don't have a doctor|no doctor yet|not yet|show coverage first|find.*specialist|skip/i.test(lastUserMessage),

    // Coverage
    hasCoverage: (sessionState?.coverageCriteria?.length ?? 0) > 0,
    hasGuidance: sessionState?.guidanceGenerated || false,

    // Appeal
    isAppeal:
      sessionState?.isAppeal ||
      /denied|denial|appeal|rejected|refused/.test(userContent),

    // Verification
    hasRequirementsToVerify: (sessionState?.requirementsToVerify?.length ?? 0) > 0,
    verificationComplete: sessionState?.verificationComplete || false,
    meetsAllRequirements: sessionState?.meetsAllRequirements === true,

    // Specialty
    hasSpecialtyMismatch: (() => {
      const matchResult = checkProviderSpecialtyMatch(sessionState);
      return matchResult !== null && !matchResult.isMatch;
    })(),

    // Emergency
    hasEmergencySymptoms: EMERGENCY_PATTERNS.test(userContent),

    // Medicare type
    hasMedicareType: sessionState?.medicareType != null,
    isMedicareAdvantage: sessionState?.medicareType === "advantage",

    // Prior auth query
    isPriorAuthQuery: /prior auth|pre-?approv|pre-?authoriz|need approval first/i.test(userContent),
  };
}

// =============================================================================
// SPECIALTY MATCH HELPER
// =============================================================================

export function checkProviderSpecialtyMatch(
  sessionState?: SessionState
): SpecialtyMatchResult | null {
  if (!sessionState?.provider?.specialty || !sessionState?.procedureNeeded) {
    return null;
  }
  return validateSpecialtyMatch(
    sessionState.procedureNeeded,
    sessionState.provider.specialty
  );
}

// =============================================================================
// BUILD SYSTEM PROMPT
// =============================================================================

export function buildSystemPrompt(
  triggers: SkillTriggers,
  sessionState?: SessionState
): string {
  // BASE_PROMPT is ALWAYS loaded (conversation style, error handling, etc.)
  const sections: string[] = [BASE_PROMPT];

  // ─────────────────────────────────────────────────────────────────────────
  // EMERGENCY CHECK - Highest priority, even before onboarding
  // ─────────────────────────────────────────────────────────────────────────
  if (triggers.hasEmergencySymptoms) {
    sections.push(RED_FLAG_SKILL);
    sections.push(PROMPTING_SKILL);
    sections.push(buildFlowStateReminder(triggers, sessionState));
    return sections.join("\n\n---\n\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ONBOARDING GATE - Must complete before ANY other skills load
  // ─────────────────────────────────────────────────────────────────────────
  if (!triggers.hasUserName || !triggers.hasUserZip) {
    sections.push(TOOL_RESTRAINT);
    sections.push(ONBOARDING_SKILL);
    sections.push(PROMPTING_SKILL);
    if (sessionState) {
      sections.push(buildSessionContext(sessionState));
    }
    sections.push(buildFlowStateReminder(triggers, sessionState));
    // RETURN EARLY - Don't load any other skills until onboarding complete
    return sections.join("\n\n---\n\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // MEDICARE TYPE GATE - Must determine Medicare type before coverage check
  // ─────────────────────────────────────────────────────────────────────────
  // After onboarding, ask if they have Original Medicare or Advantage.
  // Appeals skip this gate (appeal process is similar for both).
  if (!triggers.hasMedicareType && triggers.hasProblem && !triggers.isAppeal) {
    sections.push(TOOL_RESTRAINT);
    sections.push(MEDICARE_TYPE_SKILL);
    sections.push(PROMPTING_SKILL);
    if (sessionState) {
      sections.push(buildSessionContext(sessionState));
    }
    sections.push(buildFlowStateReminder(triggers, sessionState));
    return sections.join("\n\n---\n\n");
  }

  // Medicare Advantage deflection (non-appeal)
  if (triggers.isMedicareAdvantage && !triggers.isAppeal) {
    sections.push(MEDICARE_ADVANTAGE_SKILL);
    sections.push(PROMPTING_SKILL);
    if (sessionState) {
      sections.push(buildSessionContext(sessionState));
    }
    sections.push(buildFlowStateReminder(triggers, sessionState));
    return sections.join("\n\n---\n\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SYMPTOM GATHERING GATE - Prefer gathering symptoms before coverage check
  // ─────────────────────────────────────────────────────────────────────────
  // If we have a procedure but haven't gathered symptoms/duration/treatments,
  // try to gather them first. BUT if user is in rush mode (asked 2+ times),
  // provide basic coverage while offering to personalize.
  const needsSymptomGathering = triggers.hasProcedure &&
    (!triggers.hasSymptoms || !triggers.hasDuration || !triggers.hasPriorTreatments);

  if (needsSymptomGathering && !triggers.isAppeal) {
    // Rush mode: User asked for coverage 2+ times - give basic info but offer better
    if (triggers.isRushMode) {
      sections.push(SYMPTOM_SKILL); // Contains rush mode instructions
      sections.push(COVERAGE_SKILL);
      sections.push(PROMPTING_SKILL);
      if (sessionState) {
        sections.push(buildSessionContext(sessionState));
      }
      sections.push(buildRushModeReminder(triggers, sessionState));
      return sections.join("\n\n---\n\n");
    }

    // Normal flow: Ask for symptoms first
    sections.push(TOOL_RESTRAINT);
    sections.push(SYMPTOM_SKILL);
    sections.push(PROCEDURE_SKILL); // Keep for clarification if needed
    sections.push(PROMPTING_SKILL);
    if (sessionState) {
      sections.push(buildSessionContext(sessionState));
    }
    sections.push(buildFlowStateReminder(triggers, sessionState));
    // RETURN EARLY - Don't load coverage skills until symptoms gathered
    return sections.join("\n\n---\n\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PROVIDER GATE - Must ask about doctor before coverage check
  // ─────────────────────────────────────────────────────────────────────────
  // After gathering symptoms, we need to know about their doctor:
  // 1. Do they have a doctor for this?
  // 2. Who is the doctor? (NPI lookup)
  // 3. Does the doctor accept Medicare?
  // Only then can we provide coverage guidance
  // (Unless user explicitly skips - "show coverage first" / "not yet")

  const hasAllSymptomInfo = triggers.hasProcedure && triggers.hasSymptoms &&
    triggers.hasDuration && triggers.hasPriorTreatments;
  const providerResolved = triggers.hasProviderConfirmed || triggers.providerSkipped;
  const needsProviderInfo = hasAllSymptomInfo && !providerResolved && !triggers.isAppeal;

  if (needsProviderInfo) {
    // Provider gate: allow NPI lookup only, no coverage/ICD tools yet
    sections.push(`
## CRITICAL: Only NPI Tools Allowed Right Now

You are asking about the user's doctor. You may use the NPI Registry to look up providers.
Do NOT call any other tools or MCP servers:
- ✅ NPI search is OK (to verify the doctor)
- ❌ No ICD-10 lookups
- ❌ No NCD/LCD searches
- ❌ No PubMed searches
- ❌ No CPT lookups

Coverage tools come AFTER the provider is confirmed.
`);
    sections.push(PROVIDER_SKILL);
    sections.push(PROMPTING_SKILL);
    if (sessionState) {
      sections.push(buildSessionContext(sessionState));
    }
    sections.push(buildFlowStateReminder(triggers, sessionState));
    // RETURN EARLY - Don't load coverage skills until provider verified
    return sections.join("\n\n---\n\n");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CONDITIONAL SKILLS - Only loaded AFTER provider verified (or skipped)
  // ─────────────────────────────────────────────────────────────────────────

  // Procedure clarification (only when ambiguous)
  if (triggers.needsClarification) {
    sections.push(PROCEDURE_SKILL);
  }

  // Code validation - load when procedure identified or checking coverage
  if (triggers.hasProcedure || triggers.hasCoverage || triggers.isAppeal) {
    sections.push(CODE_VALIDATION_SKILL);
  }

  // Appeal skill - denial code lookup, strategy, and letter generation
  // Also loads for quick denial code lookups (user mentions a code)
  if (triggers.isAppeal) {
    sections.push(APPEAL_SKILL);
  }

  // Prior auth quick check (standalone query before full coverage)
  if (triggers.isPriorAuthQuery && !triggers.hasCoverage) {
    sections.push(PRIOR_AUTH_SKILL);
  }

  // Coverage lookup - only after symptoms gathered
  if (triggers.hasProcedure && triggers.hasDuration && triggers.hasPriorTreatments) {
    sections.push(COVERAGE_SKILL);
  }

  // Requirement verification - before showing guidance
  if (triggers.hasCoverage && !triggers.verificationComplete) {
    sections.push(REQUIREMENT_VERIFICATION_SKILL);
  }

  // Specialty validation
  if (triggers.hasSpecialtyMismatch) {
    sections.push(SPECIALTY_VALIDATION_SKILL);
  }

  // Guidance delivery - only after verification complete
  if (
    (triggers.hasCoverage && triggers.verificationComplete) ||
    (triggers.hasCoverage && !triggers.hasRequirementsToVerify) ||
    triggers.hasGuidance
  ) {
    sections.push(GUIDANCE_SKILL);
  }

  // Prompting skill - always loaded for suggestions
  sections.push(PROMPTING_SKILL);

  // Session context
  if (sessionState) {
    sections.push(buildSessionContext(sessionState));
  }

  // Flow state reminder
  sections.push(buildFlowStateReminder(triggers, sessionState));

  return sections.join("\n\n---\n\n");
}

// =============================================================================
// SESSION CONTEXT
// =============================================================================

function buildSessionContext(state: SessionState): string {
  const context: string[] = ["## Current Session State (USE THIS DATA — NO PLACEHOLDERS)"];

  // Onboarding
  if (state.userName) {
    context.push(`**User's name:** ${state.userName} ← Address them by name!`);
  }
  if (state.userZip) {
    context.push(`**User's ZIP:** ${state.userZip} ← Use for NPI search & regional LCD`);
  }
  if (state.medicareType) {
    const typeLabel = state.medicareType === "original" ? "Original Medicare (Parts A & B)"
      : state.medicareType === "advantage" ? "Medicare Advantage (Part C)"
      : "Original Medicare with Supplement";
    context.push(`**Medicare type:** ${typeLabel}`);
  }

  // Symptoms — MUST use in checklist
  if (state.symptoms?.length > 0) {
    context.push(`**Symptoms:** ${state.symptoms.join(", ")} ← Include in checklist as "✓ Symptoms: ${state.symptoms.join(", ")}"`);
  }
  if (state.duration) {
    context.push(`**Duration:** ${state.duration} ← Include in checklist as "✓ Duration: ${state.duration}"`);
  }
  if (state.priorTreatments?.length > 0) {
    context.push(`**Prior treatments:** ${state.priorTreatments.join(", ")} ← Include in checklist as "✓ Treatments tried: ${state.priorTreatments.join(", ")}"`);
  }

  // Procedure
  if (state.procedureNeeded) {
    context.push(`**Procedure:** ${state.procedureNeeded}`);
  }

  // Provider
  if (state.providerName) {
    context.push(`**Doctor mentioned:** ${state.providerName}`);
  }
  if (state.providerSearchAttempts > 0) {
    context.push(`**Search attempts:** ${state.providerSearchAttempts}/3`);
  }
  if (state.provider?.npi) {
    context.push(`**Provider confirmed:** ${state.provider.name} (NPI: ${state.provider.npi})`);
    context.push(`  Specialty: ${state.provider.specialty || "Unknown"}`);
  }

  // Internal codes (never show to user)
  if (state.diagnosisCodes?.length > 0) {
    context.push(`**[Internal] ICD-10:** ${state.diagnosisCodes.join(", ")}`);
  }
  if (state.procedureCodes?.length > 0) {
    context.push(`**[Internal] CPT:** ${state.procedureCodes.join(", ")}`);
  }

  // Red flags
  if (state.redFlagsPresent?.length > 0) {
    context.push(`**⚠️ Red flags (expedites approval):** ${state.redFlagsPresent.join(", ")}`);
  }

  // Prior imaging
  if (state.priorImagingDone !== null) {
    context.push(`**Prior imaging:** ${state.priorImagingDone ? `Yes (${state.priorImagingType})` : "Not yet"}`);
  }

  // Verification
  if (state.requirementsToVerify?.length > 0) {
    context.push("**Requirements to verify:**");
    for (const req of state.requirementsToVerify) {
      const answer = state.requirementAnswers[req];
      const status = answer === undefined ? "? Unverified" : answer ? "✓ Met" : "✗ Not met";
      context.push(`  ${status}: ${req}`);
    }
    if (state.verificationComplete) {
      context.push(`**Verification:** Complete — ${state.meetsAllRequirements === true ? "All met" : state.meetsAllRequirements === false ? "Some missing" : "Skipped by user"}`);
    }
  } else if (state.verificationComplete) {
    context.push(`**Requirements verified:** ${state.meetsAllRequirements ? "All met ✓" : "Some missing"}`);
  }

  // Specialty mismatch
  const specialtyMatch = checkProviderSpecialtyMatch(state);
  if (specialtyMatch && !specialtyMatch.isMatch) {
    context.push(`**⚠️ Specialty mismatch:** ${specialtyMatch.warning}`);
  }

  // Policy references
  if (state.policyReferences?.length > 0) {
    context.push(`**Policy references:** ${state.policyReferences.join(", ")} ← Include these in guidance!`);
  }

  // Prior authorization
  if (state.priorAuthRequired === true) {
    const sourceLabel = state.priorAuthSource === "lcd" ? " (from LCD policy)"
      : state.priorAuthSource === "cms_model" ? " (CMS PA Model)"
      : state.priorAuthSource === "hardcoded_list" ? " (common list)"
      : "";
    context.push(`**⚠️ Prior authorization:** REQUIRED${sourceLabel} — Include this in checklist!`);
  } else if (state.priorAuthRequired === false) {
    context.push(`**Prior authorization:** Not required`);
  }

  // Coverage
  if (state.coverageCriteria?.length > 0) {
    context.push(`**Coverage checked:** Yes ← Include LCD/NCD number in guidance!`);
  }

  // Mode
  if (state.isAppeal) {
    context.push(`**Mode:** Appeal assistance`);
  }

  // Denial info
  if (state.denialCodes?.length > 0) {
    context.push(`**[Internal] Denial codes (CARC):** ${state.denialCodes.join(", ")}`);
  }
  if (state.denialDate) {
    context.push(`**Denial date:** ${state.denialDate}`);
  }
  if (state.guidanceGenerated) {
    context.push(`**Guidance:** Already delivered`);
  }

  context.push("");
  context.push("**REMINDER:** Use ALL the above data in your response. NO generic placeholders like [X weeks] — use their actual values!");

  return context.join("\n");
}

// =============================================================================
// RUSH MODE REMINDER
// =============================================================================

function buildRushModeReminder(triggers: SkillTriggers, sessionState?: SessionState): string {
  const userName = sessionState?.userName || "there";
  const procedure = sessionState?.procedureNeeded || "this procedure";

  return `## RUSH MODE - User Asked for Coverage Multiple Times

**THEY'RE IN A HURRY.** Don't keep blocking them. Provide basic coverage BUT offer to do better.

**YOUR RESPONSE FORMAT:**

"Got it, ${userName} — here's what I found:

**Quick Answer:** Medicare does cover ${procedure} when medically necessary.

**From the policy (LCD [number]):**
[Look up and show the basic coverage requirements]

---

**Here's the thing though:** I can give you a MUCH more useful checklist — one tailored to YOUR specific situation — that helps prevent denials.

It just takes 2-3 quick questions:
• What symptoms are you having?
• How long has this been going on?
• Have you tried any treatments?

Plus I can check if your doctor accepts Medicare.

Want me to personalize this for you, or is the basic info enough?"

[SUGGESTIONS]
Yes, personalize it
Basic info is fine
[/SUGGESTIONS]

**IF THEY SAY "personalize it":** Go back to symptom questions
**IF THEY SAY "basic is fine":** Wish them luck, offer to help later`;
}

// =============================================================================
// FLOW STATE REMINDER
// =============================================================================

function buildFlowStateReminder(triggers: SkillTriggers, sessionState?: SessionState): string {
  const reminder: string[] = ["## YOUR NEXT ACTION"];
  const userName = sessionState?.userName;
  const userZip = sessionState?.userZip;

  // Emergency takes priority
  if (triggers.hasEmergencySymptoms) {
    reminder.push("**⚠️ EMERGENCY SYMPTOMS DETECTED**");
    reminder.push("**SAY:** 'If this is happening RIGHT NOW, please call 911. Once safe, I can help with coverage.'");
    return reminder.join("\n");
  }

  // Step 1: Get name
  if (!triggers.hasUserName) {
    reminder.push("**ASK:** 'Happy to help! What's your name?'");
    reminder.push("**KEEP IT SHORT** — one line only");
    return reminder.join("\n");
  }

  // Step 2: Get ZIP
  if (!triggers.hasUserZip) {
    reminder.push(`**ASK:** 'Great, ${userName}! What's your ZIP?\\n*Coverage rules vary by region.*'`);
    return reminder.join("\n");
  }

  // Step 3: Get problem
  if (!triggers.hasProblem) {
    reminder.push(`**ASK:** 'What do you need help with?'`);
    return reminder.join("\n");
  }

  // Step 3a: Medicare type
  if (!triggers.hasMedicareType && !triggers.isAppeal) {
    reminder.push("**ASK:** 'Do you have Original Medicare or a Medicare Advantage plan?'");
    reminder.push("*Our guidance is built for Original Medicare.*");
    return reminder.join("\n");
  }

  // Step 3b: Medicare Advantage deflection
  if (triggers.isMedicareAdvantage && !triggers.isAppeal) {
    reminder.push("**DEFLECT:** Explain we focus on Original Medicare");
    reminder.push("**OFFER:** Help with appeals, or 'check anyway' to proceed with caveats");
    return reminder.join("\n");
  }

  // Step 4: Get symptoms
  if (triggers.hasProcedure && !triggers.hasSymptoms) {
    reminder.push("**ASK:** 'What's going on — pain, numbness, something else?\\n*Helps match you to the right coverage policy.*'");
    return reminder.join("\n");
  }

  // Step 5: Get duration
  if (triggers.hasProcedure && !triggers.hasDuration) {
    reminder.push("**ASK:** 'How long has this been going on?\\n*Medicare needs a minimum duration for most approvals.*'");
    return reminder.join("\n");
  }

  // Step 6: Get prior treatments
  if (triggers.hasDuration && !triggers.hasPriorTreatments) {
    reminder.push("**ASK:** 'Tried any treatments — PT, meds?\\n*Medicare usually requires this before approving imaging.*'");
    return reminder.join("\n");
  }

  // Step 7: Get doctor
  const hasAllSymptomInfo = triggers.hasProcedure && triggers.hasSymptoms &&
    triggers.hasDuration && triggers.hasPriorTreatments;
  const providerResolved = triggers.hasProviderConfirmed || triggers.providerSkipped;

  if (hasAllSymptomInfo && !providerResolved && !triggers.isAppeal) {
    reminder.push("**ASK:** 'Have a doctor for this? (I can check if they take Medicare.)'");
    reminder.push("**ONE LINE ONLY**");
    return reminder.join("\n");
  }

  // Step 8: Verify provider
  if (triggers.hasProviderName && !triggers.hasProviderConfirmed) {
    reminder.push("**STEP:** Verify provider NPI");
    reminder.push(`**ACTION:** Search for provider by name in ZIP ${userZip}`);
    reminder.push("**THEN:** Show matches as numbered table");
    return reminder.join("\n");
  }

  // Step 9: Check coverage (NOW we have enough info - provider resolved)
  const providerResolvedForCoverage = triggers.hasProviderConfirmed || triggers.providerSkipped;
  if (!triggers.hasCoverage && triggers.hasProcedure && triggers.hasDuration && triggers.hasPriorTreatments && providerResolvedForCoverage) {
    reminder.push("**STEP:** Check Medicare coverage (provider step complete ✓)");
    reminder.push("**ACTION:** Look up NCD/LCD for procedure + diagnosis (use ZIP for regional LCD)");
    reminder.push("**ALSO:** Check if prior authorization is required for this procedure");
    reminder.push("**SAVE:** The LCD/NCD policy number (e.g., L35936) — REQUIRED for guidance");
    reminder.push("**THEN:** IMMEDIATELY provide PERSONALIZED checklist using THEIR data:");
    reminder.push(`  - Name: ${userName}`);
    if (sessionState?.symptoms?.length) {
      reminder.push(`  - Symptoms: ${sessionState.symptoms.join(", ")}`);
    }
    if (sessionState?.duration) {
      reminder.push(`  - Duration: ${sessionState.duration}`);
    }
    if (sessionState?.priorTreatments?.length) {
      reminder.push(`  - Treatments: ${sessionState.priorTreatments.join(", ")}`);
    }
    reminder.push("**POLICY:** Pass through LCD/NCD requirements AS-IS (we're not the doctor)");
    return reminder.join("\n");
  }

  // Step 9a: Prior auth warning (if check_prior_auth was used and PA is required)
  if (sessionState?.priorAuthRequired === true && triggers.hasCoverage) {
    const sourceLabel = sessionState.priorAuthSource === "lcd" ? "from LCD policy"
      : sessionState.priorAuthSource === "cms_model" ? "CMS PA Model"
      : "common list";
    reminder.push(`**⚠️ PRIOR AUTH REQUIRED (${sourceLabel})** — Include this prominently in guidance!`);
    reminder.push("**TELL USER:** 'Your doctor needs to get pre-approval before scheduling this procedure.'");
  }

  // Step 10: Verify requirements
  if (triggers.hasCoverage && !triggers.verificationComplete && triggers.hasRequirementsToVerify) {
    const total = sessionState?.requirementsToVerify?.length ?? 0;
    const answered = Object.keys(sessionState?.requirementAnswers ?? {}).length;
    const nextUnverified = sessionState?.requirementsToVerify?.find(
      (r) => (sessionState?.requirementAnswers ?? {})[r] === undefined
    );
    reminder.push(`**STEP:** Verify requirements (${answered}/${total} done)`);
    if (nextUnverified) {
      reminder.push(`**ASK NEXT:** "${nextUnverified}"`);
    }
    reminder.push("**ASK:** One verification question at a time");
    reminder.push("**EMIT:** [VERIFIED]requirement text|true/false[/VERIFIED] after each answer");
    return reminder.join("\n");
  }

  // Step 11: Specialty mismatch warning
  if (triggers.hasSpecialtyMismatch) {
    reminder.push("**STEP:** Warn about specialty mismatch");
    reminder.push("**EXPLAIN:** Provider specialty may not match procedure");
    reminder.push("**OFFER:** Continue anyway OR find specialist");
    return reminder.join("\n");
  }

  // Step 12: Generate guidance (BE PROACTIVE)
  if (triggers.hasCoverage && (triggers.verificationComplete || !triggers.hasRequirementsToVerify) && !triggers.hasGuidance) {
    reminder.push("**STEP:** Deliver guidance (PROACTIVELY — don't ask if they want it)");
    reminder.push("**FIRST:** High-level answer (covered? yes/no) personalized to their situation");
    reminder.push("**THEN:** IMMEDIATELY show the full checklist (don't offer, just provide it)");
    reminder.push("**INCLUDE:**");
    reminder.push("  - LCD/NCD policy number (e.g., L35936)");
    reminder.push("  - Policy requirements AS-IS (pass through, don't interpret)");
    reminder.push(`  - ${userName}'s specific data with ✓/☐ checkmarks`);
    if (sessionState?.provider?.name) {
      reminder.push(`  - Provider: ${sessionState.provider.name} (${sessionState.provider.specialty})`);
    }
    reminder.push("**NO PLACEHOLDERS:** Replace [brackets] with actual data");
    return reminder.join("\n");
  }

  // Done
  reminder.push("**STEP:** Complete");
  reminder.push("**OFFER:** Print checklist / Email / New question");
  return reminder.join("\n");
}

// DEAD CODE — No external consumers. Commented out 2026-02-06.
// export function buildInitialSystemPrompt(): string {
//   const triggers: SkillTriggers = {
//     hasUserName: false, hasUserZip: false, hasProblem: false,
//     hasSymptoms: false, hasDuration: false, hasPriorTreatments: false,
//     hasProcedure: false, needsClarification: false, isRushMode: false,
//     hasProviderName: false, hasProviderConfirmed: false, providerSkipped: false,
//     hasCoverage: false, hasGuidance: false, isAppeal: false,
//     hasRequirementsToVerify: false, verificationComplete: false,
//     meetsAllRequirements: false, hasSpecialtyMismatch: false,
//     hasEmergencySymptoms: false, hasMedicareType: false,
//     isMedicareAdvantage: false, isPriorAuthQuery: false,
//   };
//   return buildSystemPrompt(triggers);
// }

// =============================================================================
// LEARNING INTEGRATION
// =============================================================================

export function extractEntitiesFromMessages(
  messages: Array<{ role: string; content: string }>
): ExtractedEntities {
  const allContent = messages.map((m) => m.content).join(" ");
  return extractEntities(allContent);
}

export async function buildSystemPromptWithLearning(
  triggers: SkillTriggers,
  sessionState?: SessionState,
  messages?: Array<{ role: string; content: string }>
): Promise<string> {
  let systemPrompt = buildSystemPrompt(triggers, sessionState);

  if (messages && messages.length > 0) {
    const entities = extractEntitiesFromMessages(messages);
    const symptoms = entities.symptoms.map((s) => s.phrase);
    const procedures = entities.procedures.map((p) => p.phrase);

    if (symptoms.length > 0 || procedures.length > 0) {
      try {
        const learningContext = await getLearningContext(symptoms, procedures);
        const learningInjection = buildLearningPromptInjection(learningContext);

        if (learningInjection) {
          systemPrompt += learningInjection;
        }
      } catch (error) {
        console.warn("Failed to get learning context:", error);
      }
    }
  }

  return systemPrompt;
}

// DEAD CODE — Stale re-exports with no external consumers. route.ts imports
// these directly from @/config and @/lib/learning. Commented out 2026-02-06.
// export { getTimeBasedGreeting } from "@/config";
// export { extractEntities, getLearningContext, buildLearningPromptInjection };
// export type { ExtractedEntities, LearningContext };
