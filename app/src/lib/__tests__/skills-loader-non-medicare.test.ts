/**
 * Unit tests for skills-loader-non-medicare.ts
 *
 * Pins the behavioral contract of the non-Medicare skill loader:
 *   1. 19 Medicare-specific skills are suppressed (absent from output)
 *   2. 4 cohort-agnostic skills are included (present when triggered)
 *   3. NON_MEDICARE_ACKNOWLEDGMENT_SKILL is always present and immediately
 *      follows BASE_CORE_PROMPT in the assembled prompt
 *   4. Return type is `string` — parity with the Medicare loader (buildSystemPrompt)
 *   5. Medicare-flow scaffolding (MEDICARE_OVERLAY_PROMPT, TOOL_RESTRAINT,
 *      and the helpers called only by the Medicare loader) produces no output
 *
 * Cohorts fixture decision: NOT imported. app/e2e/fixtures/cohorts.ts contains
 * ProfileOverrides for the /api/profile E2E shape. This loader accepts
 * SkillTriggers + SessionState — different types entirely. Importing E2E
 * fixtures into a server-side unit test would be a cross-tree smell. Minimal
 * inline objects are used instead (mirrors the pattern in skills-loader-router.test.ts).
 *
 * Mocking strategy: NONE for skill content. Per the agent's Hard Rule §2:
 * "do not mock the barrel — exercise the real skill content." The @/skills
 * barrel is imported live so that a refactor breaking the barrel is caught
 * as a real production gap, not a test problem.
 *
 * Suppression-list export: The production file does NOT export the suppression
 * list as a named constant. The list below (SUPPRESSED_SKILL_SIGNATURES) is
 * maintained locally and mirrors the docblock at lines 9–28 of
 * skills-loader-non-medicare.ts. If you change one, change both.
 */

import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Subject under test — live production code, no mocks
// ---------------------------------------------------------------------------

import {
  buildSystemPromptForNonMedicare,
  buildSystemPromptForNonMedicareWithLearning,
} from "@/lib/skills-loader-non-medicare";

// ---------------------------------------------------------------------------
// Real skill content — imported directly to derive stable signature snippets.
// We never assert full-string equality; only that a stable snippet is present
// or absent. Snippets are the first markdown header (## ...) of each skill.
// ---------------------------------------------------------------------------

import {
  BASE_CORE_PROMPT,
  NON_MEDICARE_ACKNOWLEDGMENT_SKILL,
  COUNSELOR_SKILL,
  PROVIDER_PILOT_SKILL,
  RED_FLAG_SKILL,
  PROMPTING_SKILL,
  // Medicare-specific skills — imported ONLY to extract their stable
  // signature snippet for the suppression assertions. Never used for
  // anything else in this test.
  HEALTH_RECORDS_SKILL,
  DIABETES_PREVENTION_SKILL,
  OBESITY_PREVENTION_SKILL,
  MEDICARE_NOTIFICATIONS_SKILL,
  MEDICARE_OVERLAY_PROMPT,
  TOOL_RESTRAINT,
} from "@/skills";

import {
  MEDICARE_TYPE_SKILL,
  MEDICARE_ADVANTAGE_SKILL,
  APPEAL_SKILL,
  EOB_EXPLAINER_SKILL,
  COVERAGE_SKILL,
  REQUIREMENT_VERIFICATION_SKILL,
  GUIDANCE_SKILL,
  PRIOR_AUTH_SKILL,
  CODE_VALIDATION_SKILL,
  PROVIDER_SKILL,
  OUTCOME_PROMPTING_SKILL,
  ONBOARDING_SKILL,
  SYMPTOM_SKILL,
  PROCEDURE_SKILL,
  SPECIALTY_VALIDATION_SKILL,
} from "@/skills";

// ---------------------------------------------------------------------------
// Helper: extract a stable signature snippet from a skill string.
// Prefers the first "## …" header (most stable — section identity).
// Falls back to the first non-empty line when the skill has no ## header
// (e.g., MEDICARE_OVERLAY_PROMPT which opens with a prose sentence).
// ---------------------------------------------------------------------------

function firstHeader(skill: string): string {
  // Prefer the first level-2 markdown header
  const headerMatch = skill.match(/^##[^\n]+/m);
  if (headerMatch) return headerMatch[0];

  // Fall back to the first non-empty, non-backtick line
  const lineMatch = skill.match(/^[^\n`][^\n]{4,}/m);
  if (lineMatch) return lineMatch[0].trim().slice(0, 80);

  throw new Error(
    `Skill does not contain a usable signature. Snippet: ${skill.slice(0, 120)}`,
  );
}

// ---------------------------------------------------------------------------
// Fixture builders — inline minimal types, NOT importing the E2E cohorts fixture
// ---------------------------------------------------------------------------

import type { SkillTriggers } from "@/lib/skills-loader";
import type { SessionState } from "@/lib/claude";

/** All-false SkillTriggers — baseline for suppression tests. */
function makeTriggers(overrides: Partial<SkillTriggers> = {}): SkillTriggers {
  const base: SkillTriggers = {
    hasUserName: false,
    hasUserZip: false,
    hasProblem: false,
    hasSymptoms: false,
    hasDuration: false,
    hasPriorTreatments: false,
    hasProcedure: false,
    needsClarification: false,
    isRushMode: false,
    hasProviderName: false,
    hasProviderConfirmed: false,
    providerSkipped: false,
    hasCoverage: false,
    hasGuidance: false,
    isAppeal: false,
    hasRequirementsToVerify: false,
    verificationComplete: false,
    meetsAllRequirements: false,
    hasSpecialtyMismatch: false,
    hasEmergencySymptoms: false,
    hasMedicareType: false,
    isMedicareAdvantage: false,
    isPriorAuthQuery: false,
    hasUnreportedOutcome: false,
    isCounselor: false,
    isProvider: false,
    hasHealthData: false,
    hasRecentDenials: false,
    hasRecentChanges: false,
    hasDiabetesContext: false,
    hasObesityContext: false,
    hasEOBQuestion: false,
  };
  return { ...base, ...overrides };
}

/** Minimal SessionState — non-Medicare cohort. */
function makeSession(overrides: Partial<SessionState> = {}): SessionState {
  return {
    userName: null,
    userZip: null,
    medicareType: null,
    symptoms: [],
    duration: null,
    severity: null,
    priorTreatments: [],
    procedureNeeded: null,
    providerName: null,
    providerSearchAttempts: 0,
    provider: null,
    diagnosisCodes: [],
    procedureCodes: [],
    coverageCriteria: [],
    policyReferences: [],
    guidanceGenerated: false,
    isAppeal: false,
    denialDate: null,
    priorAuthRequired: null,
    priorAuthSource: null,
    requirementsToVerify: [],
    requirementAnswers: {},
    verificationComplete: false,
    meetsAllRequirements: null,
    redFlagsPresent: [],
    redFlagsChecked: false,
    priorImagingDone: null,
    priorImagingType: null,
    priorImagingDate: null,
    specialtyMismatchWarning: null,
    denialCodes: [],
    appealLevel: null,
    previousAppealOutcome: null,
    priorAppealId: null,
    isOnMedicare: false,
    ...overrides,
  } as SessionState;
}

// ---------------------------------------------------------------------------
// Derived stable signature snippets
// ---------------------------------------------------------------------------

/**
 * 19 Medicare-specific skills that must NEVER appear in the non-Medicare
 * prompt. Mirrors the suppression list in the docblock at lines 9–27 of
 * skills-loader-non-medicare.ts. If you change one, change both.
 *
 * Each entry: [skillName, stableSignatureSnippet]
 */
const SUPPRESSED_SKILL_SIGNATURES: [string, string][] = [
  ["HEALTH_RECORDS_SKILL", firstHeader(HEALTH_RECORDS_SKILL)],
  ["DIABETES_PREVENTION_SKILL", firstHeader(DIABETES_PREVENTION_SKILL)],
  ["OBESITY_PREVENTION_SKILL", firstHeader(OBESITY_PREVENTION_SKILL)],
  ["MEDICARE_NOTIFICATIONS_SKILL", firstHeader(MEDICARE_NOTIFICATIONS_SKILL)],
  ["MEDICARE_TYPE_SKILL", firstHeader(MEDICARE_TYPE_SKILL)],
  ["MEDICARE_ADVANTAGE_SKILL", firstHeader(MEDICARE_ADVANTAGE_SKILL)],
  ["APPEAL_SKILL", firstHeader(APPEAL_SKILL)],
  ["EOB_EXPLAINER_SKILL", firstHeader(EOB_EXPLAINER_SKILL)],
  ["COVERAGE_SKILL", firstHeader(COVERAGE_SKILL)],
  ["REQUIREMENT_VERIFICATION_SKILL", firstHeader(REQUIREMENT_VERIFICATION_SKILL)],
  ["GUIDANCE_SKILL", firstHeader(GUIDANCE_SKILL)],
  ["PRIOR_AUTH_SKILL", firstHeader(PRIOR_AUTH_SKILL)],
  ["CODE_VALIDATION_SKILL", firstHeader(CODE_VALIDATION_SKILL)],
  ["PROVIDER_SKILL", firstHeader(PROVIDER_SKILL)],
  ["OUTCOME_PROMPTING_SKILL", firstHeader(OUTCOME_PROMPTING_SKILL)],
  ["ONBOARDING_SKILL", firstHeader(ONBOARDING_SKILL)],
  ["SYMPTOM_SKILL", firstHeader(SYMPTOM_SKILL)],
  ["PROCEDURE_SKILL", firstHeader(PROCEDURE_SKILL)],
  ["SPECIALTY_VALIDATION_SKILL", firstHeader(SPECIALTY_VALIDATION_SKILL)],
];

/**
 * Medicare-flow scaffolding helpers that must also be absent from the
 * non-Medicare prompt. Tested separately from the 19-skill list because
 * they are not "skills" in the SkillTriggers sense but rather inline
 * helper output injected by the Medicare loader.
 * TOOL_RESTRAINT is included here (per the docblock, not in the 19-skill list).
 */
const SCAFFOLDING_SIGNATURES: [string, string][] = [
  ["MEDICARE_OVERLAY_PROMPT", firstHeader(MEDICARE_OVERLAY_PROMPT)],
  ["TOOL_RESTRAINT", firstHeader(TOOL_RESTRAINT)],
];

// ---------------------------------------------------------------------------
// 1. Suppression tests — 19 Medicare-specific skills must NOT appear
// ---------------------------------------------------------------------------

describe("buildSystemPromptForNonMedicare — Medicare skill suppression", () => {
  it.each(SUPPRESSED_SKILL_SIGNATURES)(
    "suppresses %s (signature not found in output)",
    (_skillName, signature) => {
      const prompt = buildSystemPromptForNonMedicare(makeTriggers());
      expect(prompt).not.toContain(signature);
    },
  );
});

// ---------------------------------------------------------------------------
// 2. Scaffolding suppression — MEDICARE_OVERLAY_PROMPT + TOOL_RESTRAINT
// ---------------------------------------------------------------------------

describe("buildSystemPromptForNonMedicare — Medicare scaffolding suppression", () => {
  it.each(SCAFFOLDING_SIGNATURES)(
    "suppresses %s (scaffolding signature not found in output)",
    (_name, signature) => {
      const prompt = buildSystemPromptForNonMedicare(makeTriggers());
      expect(prompt).not.toContain(signature);
    },
  );
});

// ---------------------------------------------------------------------------
// 3. Base content — BASE_CORE_PROMPT is always present
// ---------------------------------------------------------------------------

describe("buildSystemPromptForNonMedicare — BASE_CORE_PROMPT always present", () => {
  it("includes BASE_CORE_PROMPT signature in the default (all-false triggers) output", () => {
    const prompt = buildSystemPromptForNonMedicare(makeTriggers());
    expect(prompt).toContain(firstHeader(BASE_CORE_PROMPT));
  });

  it("includes BASE_CORE_PROMPT when all triggers are enabled", () => {
    const allOn = makeTriggers({
      isCounselor: true,
      isProvider: true,
      hasEmergencySymptoms: true,
    });
    const prompt = buildSystemPromptForNonMedicare(allOn);
    expect(prompt).toContain(firstHeader(BASE_CORE_PROMPT));
  });
});

// ---------------------------------------------------------------------------
// 4. Acknowledgment overlay — NON_MEDICARE_ACKNOWLEDGMENT_SKILL
// ---------------------------------------------------------------------------

describe("buildSystemPromptForNonMedicare — NON_MEDICARE_ACKNOWLEDGMENT_SKILL", () => {
  it("includes the acknowledgment overlay signature in the default output", () => {
    const prompt = buildSystemPromptForNonMedicare(makeTriggers());
    expect(prompt).toContain(firstHeader(NON_MEDICARE_ACKNOWLEDGMENT_SKILL));
  });

  it("places the acknowledgment overlay immediately after BASE_CORE_PROMPT", () => {
    const prompt = buildSystemPromptForNonMedicare(makeTriggers());
    const baseCorePos = prompt.indexOf(firstHeader(BASE_CORE_PROMPT));
    const ackPos = prompt.indexOf(firstHeader(NON_MEDICARE_ACKNOWLEDGMENT_SKILL));

    // Both must be present
    expect(baseCorePos).toBeGreaterThanOrEqual(0);
    expect(ackPos).toBeGreaterThanOrEqual(0);

    // Acknowledgment must follow BASE_CORE_PROMPT
    expect(ackPos).toBeGreaterThan(baseCorePos);

    // No other skill header appears between BASE_CORE_PROMPT and the acknowledgment.
    // We assert this by checking that the text slice between the two headers
    // does not contain any ## header that is NOT part of BASE_CORE_PROMPT's
    // own internal structure. Specifically, none of the 4 cohort-agnostic skill
    // headers (which all start with "## ") should appear between them.
    const slice = prompt.slice(baseCorePos, ackPos);
    expect(slice).not.toContain(firstHeader(COUNSELOR_SKILL));
    expect(slice).not.toContain(firstHeader(PROVIDER_PILOT_SKILL));
    expect(slice).not.toContain(firstHeader(RED_FLAG_SKILL));
    expect(slice).not.toContain(firstHeader(PROMPTING_SKILL));
  });
});

// ---------------------------------------------------------------------------
// 5. Cohort-agnostic skill inclusion — trigger-gated
// ---------------------------------------------------------------------------

describe("buildSystemPromptForNonMedicare — cohort-agnostic skill inclusion", () => {
  // ── COUNSELOR_SKILL: isCounselor === true ────────────────────────────────

  it("includes COUNSELOR_SKILL when isCounselor is true", () => {
    const prompt = buildSystemPromptForNonMedicare(
      makeTriggers({ isCounselor: true }),
    );
    expect(prompt).toContain(firstHeader(COUNSELOR_SKILL));
  });

  it("excludes COUNSELOR_SKILL when isCounselor is false", () => {
    const prompt = buildSystemPromptForNonMedicare(
      makeTriggers({ isCounselor: false }),
    );
    expect(prompt).not.toContain(firstHeader(COUNSELOR_SKILL));
  });

  // ── PROVIDER_PILOT_SKILL: isProvider === true ───────────────────────────

  it("includes PROVIDER_PILOT_SKILL when isProvider is true", () => {
    const prompt = buildSystemPromptForNonMedicare(
      makeTriggers({ isProvider: true }),
    );
    expect(prompt).toContain(firstHeader(PROVIDER_PILOT_SKILL));
  });

  it("excludes PROVIDER_PILOT_SKILL when isProvider is false", () => {
    const prompt = buildSystemPromptForNonMedicare(
      makeTriggers({ isProvider: false }),
    );
    expect(prompt).not.toContain(firstHeader(PROVIDER_PILOT_SKILL));
  });

  // ── RED_FLAG_SKILL: hasEmergencySymptoms === true ───────────────────────

  it("includes RED_FLAG_SKILL when hasEmergencySymptoms is true", () => {
    const prompt = buildSystemPromptForNonMedicare(
      makeTriggers({ hasEmergencySymptoms: true }),
    );
    expect(prompt).toContain(firstHeader(RED_FLAG_SKILL));
  });

  it("excludes RED_FLAG_SKILL when hasEmergencySymptoms is false", () => {
    const prompt = buildSystemPromptForNonMedicare(
      makeTriggers({ hasEmergencySymptoms: false }),
    );
    expect(prompt).not.toContain(firstHeader(RED_FLAG_SKILL));
  });

  // ── PROMPTING_SKILL: always present ─────────────────────────────────────

  it("includes PROMPTING_SKILL with all-false triggers (always on)", () => {
    const prompt = buildSystemPromptForNonMedicare(makeTriggers());
    expect(prompt).toContain(firstHeader(PROMPTING_SKILL));
  });

  it("includes PROMPTING_SKILL even when hasEmergencySymptoms short-circuits", () => {
    // The loader has an early-return path for emergencies; PROMPTING_SKILL
    // must still appear on that path.
    const prompt = buildSystemPromptForNonMedicare(
      makeTriggers({ hasEmergencySymptoms: true }),
    );
    expect(prompt).toContain(firstHeader(PROMPTING_SKILL));
  });
});

// ---------------------------------------------------------------------------
// 6. Cohort-agnostic parameterized: when ALL cohort-agnostic triggers are on,
//    all 4 skills appear. This is the "positive matrix" counterpart to §1.
// ---------------------------------------------------------------------------

const COHORT_AGNOSTIC_SKILLS: [string, string, Partial<SkillTriggers>][] = [
  [
    "COUNSELOR_SKILL",
    firstHeader(COUNSELOR_SKILL),
    { isCounselor: true },
  ],
  [
    "PROVIDER_PILOT_SKILL",
    firstHeader(PROVIDER_PILOT_SKILL),
    { isProvider: true },
  ],
  [
    "RED_FLAG_SKILL",
    firstHeader(RED_FLAG_SKILL),
    { hasEmergencySymptoms: true },
  ],
  [
    "PROMPTING_SKILL",
    firstHeader(PROMPTING_SKILL),
    {}, // no trigger required — always on
  ],
];

describe("buildSystemPromptForNonMedicare — all 4 cohort-agnostic skills present when triggered", () => {
  it.each(COHORT_AGNOSTIC_SKILLS)(
    "includes %s when its trigger is set",
    (_skillName, signature, triggerOverride) => {
      const prompt = buildSystemPromptForNonMedicare(
        makeTriggers(triggerOverride),
      );
      expect(prompt).toContain(signature);
    },
  );
});

// ---------------------------------------------------------------------------
// 7. Return-shape parity with skills-loader.ts (Medicare loader)
// ---------------------------------------------------------------------------

describe("buildSystemPromptForNonMedicare — return shape parity with Medicare loader", () => {
  it("returns a string (same primitive type as buildSystemPrompt)", () => {
    const result = buildSystemPromptForNonMedicare(makeTriggers());
    expect(typeof result).toBe("string");
  });

  it("returns a non-empty string", () => {
    const result = buildSystemPromptForNonMedicare(makeTriggers());
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8. Async entrypoint — buildSystemPromptForNonMedicareWithLearning
// ---------------------------------------------------------------------------

describe("buildSystemPromptForNonMedicareWithLearning (async)", () => {
  it("returns a Promise<string>", async () => {
    const result = await buildSystemPromptForNonMedicareWithLearning(
      makeTriggers(),
    );
    expect(typeof result).toBe("string");
  });

  it("resolves to the same output as the sync entrypoint (pass-through contract)", async () => {
    const triggers = makeTriggers({ isCounselor: true });
    const session = makeSession();

    const syncResult = buildSystemPromptForNonMedicare(triggers, session);
    const asyncResult = await buildSystemPromptForNonMedicareWithLearning(
      triggers,
      session,
    );

    expect(asyncResult).toBe(syncResult);
  });

  it("includes NON_MEDICARE_ACKNOWLEDGMENT_SKILL in the async output", async () => {
    const result = await buildSystemPromptForNonMedicareWithLearning(
      makeTriggers(),
    );
    expect(result).toContain(firstHeader(NON_MEDICARE_ACKNOWLEDGMENT_SKILL));
  });

  it("suppresses a representative Medicare skill (APPEAL_SKILL) in the async output", async () => {
    const result = await buildSystemPromptForNonMedicareWithLearning(
      makeTriggers(),
    );
    expect(result).not.toContain(firstHeader(APPEAL_SKILL));
  });

  it("accepts and ignores messages array without changing output", async () => {
    const triggers = makeTriggers();
    const session = makeSession();
    const messages = [{ role: "user", content: "Hello" }];

    const withMessages = await buildSystemPromptForNonMedicareWithLearning(
      triggers,
      session,
      messages,
    );
    const withoutMessages = await buildSystemPromptForNonMedicareWithLearning(
      triggers,
      session,
    );

    expect(withMessages).toBe(withoutMessages);
  });
});

// ---------------------------------------------------------------------------
// 9. sessionState parameter — does not change cohort-agnostic output
// ---------------------------------------------------------------------------

describe("buildSystemPromptForNonMedicare — sessionState parameter", () => {
  it("produces the same output whether sessionState is provided or omitted", () => {
    const triggers = makeTriggers();
    const withSession = buildSystemPromptForNonMedicare(triggers, makeSession());
    const withoutSession = buildSystemPromptForNonMedicare(triggers);

    expect(withSession).toBe(withoutSession);
  });

  it("does not leak isOnMedicare:true session state into the prompt", () => {
    // Even if a malformed session has isOnMedicare:true, the loader's output
    // contract is determined by the loader itself, not the session value.
    // Suppression is structural — the Medicare skills are simply not included.
    const triggers = makeTriggers();
    const mismatchedSession = makeSession({ isOnMedicare: true });
    const prompt = buildSystemPromptForNonMedicare(triggers, mismatchedSession);

    // Still no Medicare overlay
    expect(prompt).not.toContain(firstHeader(MEDICARE_OVERLAY_PROMPT));
    // Still has the acknowledgment overlay
    expect(prompt).toContain(firstHeader(NON_MEDICARE_ACKNOWLEDGMENT_SKILL));
  });
});
