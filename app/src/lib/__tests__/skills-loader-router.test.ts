/**
 * Unit tests for the cohort-routing layer: skills-loader-router.ts
 *
 * Cohorts fixture decision: NOT imported. app/e2e/fixtures/cohorts.ts
 * contains ProfileOverrides (E2E /api/profile shape). The router accepts
 * SkillTriggers + SessionState — different types entirely. Importing E2E
 * fixtures into a server-side unit test would be a cross-tree smell and
 * provides no typing benefit. Minimal inline objects are used instead.
 *
 * Routing matrix under test (pinned per commit 9e26b03 / C.6.f):
 *   sessionState.isOnMedicare === false   → non-Medicare loader
 *   sessionState.isOnMedicare === true    → Medicare loader (default)
 *   sessionState.isOnMedicare === null    → Medicare loader (default-safe)
 *   sessionState.isOnMedicare === undefined → Medicare loader (default-safe)
 *   sessionState missing entirely         → Medicare loader (default-safe)
 *
 * Mocking strategy:
 *   vi.mock("@/lib/skills-loader") stubs buildSystemPrompt +
 *     buildSystemPromptWithLearning, each returning a sentinel string.
 *   vi.mock("@/lib/skills-loader-non-medicare") stubs
 *     buildSystemPromptForNonMedicare + buildSystemPromptForNonMedicareWithLearning,
 *     each returning a sentinel string.
 *   Per-test spy assertions verify exactly ONE loader is called and the
 *     other is not, and that the router propagates the return value.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// vi.mock hoisting — must appear before the subject import
// ---------------------------------------------------------------------------

vi.mock("@/lib/skills-loader", () => ({
  buildSystemPrompt: vi.fn(() => "MEDICARE_LOADER_OUTPUT"),
  buildSystemPromptWithLearning: vi.fn(() =>
    Promise.resolve("MEDICARE_LOADER_OUTPUT_ASYNC"),
  ),
}));

vi.mock("@/lib/skills-loader-non-medicare", () => ({
  buildSystemPromptForNonMedicare: vi.fn(
    () => "NON_MEDICARE_LOADER_OUTPUT",
  ),
  buildSystemPromptForNonMedicareWithLearning: vi.fn(() =>
    Promise.resolve("NON_MEDICARE_LOADER_OUTPUT_ASYNC"),
  ),
}));

// ---------------------------------------------------------------------------
// Subject under test
// ---------------------------------------------------------------------------

import {
  buildSystemPromptForUser,
  buildSystemPromptForUserWithLearning,
} from "@/lib/skills-loader-router";

// ---------------------------------------------------------------------------
// Mocked loader references (typed as vi.Mock for spy assertions)
// ---------------------------------------------------------------------------

import {
  buildSystemPrompt,
  buildSystemPromptWithLearning,
} from "@/lib/skills-loader";

import {
  buildSystemPromptForNonMedicare,
  buildSystemPromptForNonMedicareWithLearning,
} from "@/lib/skills-loader-non-medicare";

const medicareSync = buildSystemPrompt as ReturnType<typeof vi.fn>;
const medicareAsync = buildSystemPromptWithLearning as ReturnType<typeof vi.fn>;
const nonMedicareSync = buildSystemPromptForNonMedicare as ReturnType<typeof vi.fn>;
const nonMedicareAsync = buildSystemPromptForNonMedicareWithLearning as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixture builders — minimal inline types, NOT importing e2e cohorts fixture
// ---------------------------------------------------------------------------

import type { SkillTriggers } from "@/lib/skills-loader";
import type { SessionState } from "@/lib/session-state";

/** All-false SkillTriggers — the router never inspects these; content is irrelevant. */
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

/** Minimal SessionState with only isOnMedicare set. */
function makeSession(isOnMedicare: boolean | null | undefined): SessionState {
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
    isOnMedicare,
  } as SessionState;
}

const MESSAGES = [{ role: "user", content: "Hello" }];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("buildSystemPromptForUser (sync router)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── isOnMedicare === true → Medicare loader ─────────────────────────────

  describe("isOnMedicare === true", () => {
    it("calls the Medicare loader", () => {
      const triggers = makeTriggers();
      const session = makeSession(true);
      buildSystemPromptForUser(triggers, session);
      expect(medicareSync).toHaveBeenCalledOnce();
    });

    it("does NOT call the non-Medicare loader", () => {
      const triggers = makeTriggers();
      const session = makeSession(true);
      buildSystemPromptForUser(triggers, session);
      expect(nonMedicareSync).not.toHaveBeenCalled();
    });

    it("propagates the Medicare loader's return value", () => {
      const result = buildSystemPromptForUser(makeTriggers(), makeSession(true));
      expect(result).toBe("MEDICARE_LOADER_OUTPUT");
    });

    it("forwards triggers and sessionState to the Medicare loader", () => {
      const triggers = makeTriggers({ hasEmergencySymptoms: true });
      const session = makeSession(true);
      buildSystemPromptForUser(triggers, session);
      expect(medicareSync).toHaveBeenCalledWith(triggers, session);
    });
  });

  // ── isOnMedicare === false → non-Medicare loader ────────────────────────

  describe("isOnMedicare === false", () => {
    it("calls the non-Medicare loader", () => {
      const triggers = makeTriggers();
      const session = makeSession(false);
      buildSystemPromptForUser(triggers, session);
      expect(nonMedicareSync).toHaveBeenCalledOnce();
    });

    it("does NOT call the Medicare loader", () => {
      const triggers = makeTriggers();
      const session = makeSession(false);
      buildSystemPromptForUser(triggers, session);
      expect(medicareSync).not.toHaveBeenCalled();
    });

    it("propagates the non-Medicare loader's return value", () => {
      const result = buildSystemPromptForUser(makeTriggers(), makeSession(false));
      expect(result).toBe("NON_MEDICARE_LOADER_OUTPUT");
    });

    it("forwards triggers and sessionState to the non-Medicare loader", () => {
      const triggers = makeTriggers({ isCounselor: true });
      const session = makeSession(false);
      buildSystemPromptForUser(triggers, session);
      expect(nonMedicareSync).toHaveBeenCalledWith(triggers, session);
    });
  });

  // ── isOnMedicare === null → Medicare default-safe ───────────────────────

  describe("isOnMedicare === null (default-safe)", () => {
    it("calls the Medicare loader", () => {
      buildSystemPromptForUser(makeTriggers(), makeSession(null));
      expect(medicareSync).toHaveBeenCalledOnce();
    });

    it("does NOT call the non-Medicare loader", () => {
      buildSystemPromptForUser(makeTriggers(), makeSession(null));
      expect(nonMedicareSync).not.toHaveBeenCalled();
    });

    it("propagates the Medicare loader's return value", () => {
      const result = buildSystemPromptForUser(makeTriggers(), makeSession(null));
      expect(result).toBe("MEDICARE_LOADER_OUTPUT");
    });
  });

  // ── isOnMedicare === undefined → Medicare default-safe ──────────────────

  describe("isOnMedicare === undefined (default-safe)", () => {
    it("calls the Medicare loader", () => {
      buildSystemPromptForUser(makeTriggers(), makeSession(undefined));
      expect(medicareSync).toHaveBeenCalledOnce();
    });

    it("does NOT call the non-Medicare loader", () => {
      buildSystemPromptForUser(makeTriggers(), makeSession(undefined));
      expect(nonMedicareSync).not.toHaveBeenCalled();
    });

    it("propagates the Medicare loader's return value", () => {
      const result = buildSystemPromptForUser(
        makeTriggers(),
        makeSession(undefined),
      );
      expect(result).toBe("MEDICARE_LOADER_OUTPUT");
    });
  });

  // ── sessionState argument omitted entirely → Medicare default-safe ───────

  describe("sessionState argument missing entirely (default-safe)", () => {
    it("calls the Medicare loader when sessionState is omitted", () => {
      buildSystemPromptForUser(makeTriggers());
      expect(medicareSync).toHaveBeenCalledOnce();
    });

    it("does NOT call the non-Medicare loader when sessionState is omitted", () => {
      buildSystemPromptForUser(makeTriggers());
      expect(nonMedicareSync).not.toHaveBeenCalled();
    });

    it("propagates the Medicare loader's return value when sessionState is omitted", () => {
      const result = buildSystemPromptForUser(makeTriggers());
      expect(result).toBe("MEDICARE_LOADER_OUTPUT");
    });
  });
});

// ---------------------------------------------------------------------------
// Async entrypoint
// ---------------------------------------------------------------------------

describe("buildSystemPromptForUserWithLearning (async router)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── isOnMedicare === true → Medicare async loader ───────────────────────

  describe("isOnMedicare === true", () => {
    it("calls the Medicare async loader", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(true),
        MESSAGES,
      );
      expect(medicareAsync).toHaveBeenCalledOnce();
    });

    it("does NOT call the non-Medicare async loader", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(true),
        MESSAGES,
      );
      expect(nonMedicareAsync).not.toHaveBeenCalled();
    });

    it("propagates the Medicare async loader's resolved value", async () => {
      const result = await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(true),
        MESSAGES,
      );
      expect(result).toBe("MEDICARE_LOADER_OUTPUT_ASYNC");
    });

    it("forwards triggers, sessionState, and messages to the Medicare async loader", async () => {
      const triggers = makeTriggers({ isAppeal: true });
      const session = makeSession(true);
      await buildSystemPromptForUserWithLearning(triggers, session, MESSAGES);
      expect(medicareAsync).toHaveBeenCalledWith(triggers, session, MESSAGES);
    });
  });

  // ── isOnMedicare === false → non-Medicare async loader ──────────────────

  describe("isOnMedicare === false", () => {
    it("calls the non-Medicare async loader", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(false),
        MESSAGES,
      );
      expect(nonMedicareAsync).toHaveBeenCalledOnce();
    });

    it("does NOT call the Medicare async loader", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(false),
        MESSAGES,
      );
      expect(medicareAsync).not.toHaveBeenCalled();
    });

    it("propagates the non-Medicare async loader's resolved value", async () => {
      const result = await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(false),
        MESSAGES,
      );
      expect(result).toBe("NON_MEDICARE_LOADER_OUTPUT_ASYNC");
    });

    it("forwards triggers, sessionState, and messages to the non-Medicare async loader", async () => {
      const triggers = makeTriggers({ isCounselor: true });
      const session = makeSession(false);
      await buildSystemPromptForUserWithLearning(triggers, session, MESSAGES);
      expect(nonMedicareAsync).toHaveBeenCalledWith(triggers, session, MESSAGES);
    });
  });

  // ── isOnMedicare === null → Medicare async default-safe ─────────────────

  describe("isOnMedicare === null (default-safe)", () => {
    it("calls the Medicare async loader", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(null),
      );
      expect(medicareAsync).toHaveBeenCalledOnce();
    });

    it("does NOT call the non-Medicare async loader", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(null),
      );
      expect(nonMedicareAsync).not.toHaveBeenCalled();
    });

    it("propagates the Medicare async loader's resolved value", async () => {
      const result = await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(null),
      );
      expect(result).toBe("MEDICARE_LOADER_OUTPUT_ASYNC");
    });
  });

  // ── isOnMedicare === undefined → Medicare async default-safe ────────────

  describe("isOnMedicare === undefined (default-safe)", () => {
    it("calls the Medicare async loader", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(undefined),
      );
      expect(medicareAsync).toHaveBeenCalledOnce();
    });

    it("does NOT call the non-Medicare async loader", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(undefined),
      );
      expect(nonMedicareAsync).not.toHaveBeenCalled();
    });

    it("propagates the Medicare async loader's resolved value", async () => {
      const result = await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(undefined),
      );
      expect(result).toBe("MEDICARE_LOADER_OUTPUT_ASYNC");
    });
  });

  // ── sessionState omitted entirely → Medicare async default-safe ─────────

  describe("sessionState argument missing entirely (async, default-safe)", () => {
    it("calls the Medicare async loader when sessionState is omitted", async () => {
      await buildSystemPromptForUserWithLearning(makeTriggers());
      expect(medicareAsync).toHaveBeenCalledOnce();
    });

    it("does NOT call the non-Medicare async loader when sessionState is omitted", async () => {
      await buildSystemPromptForUserWithLearning(makeTriggers());
      expect(nonMedicareAsync).not.toHaveBeenCalled();
    });

    it("propagates the Medicare async loader's resolved value when sessionState is omitted", async () => {
      const result = await buildSystemPromptForUserWithLearning(makeTriggers());
      expect(result).toBe("MEDICARE_LOADER_OUTPUT_ASYNC");
    });
  });

  // ── messages argument omitted → still routes correctly ──────────────────

  describe("messages argument omitted (both cohorts)", () => {
    it("routes false → non-Medicare with no messages arg", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(false),
      );
      expect(nonMedicareAsync).toHaveBeenCalledOnce();
      expect(medicareAsync).not.toHaveBeenCalled();
    });

    it("routes true → Medicare with no messages arg", async () => {
      await buildSystemPromptForUserWithLearning(
        makeTriggers(),
        makeSession(true),
      );
      expect(medicareAsync).toHaveBeenCalledOnce();
      expect(nonMedicareAsync).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// Cross-entrypoint isolation: sync and async share the same routing logic
// ---------------------------------------------------------------------------

describe("routing parity — sync and async agree on the same input", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("both entrypoints route false → non-Medicare", async () => {
    const triggers = makeTriggers();
    const session = makeSession(false);

    buildSystemPromptForUser(triggers, session);
    await buildSystemPromptForUserWithLearning(triggers, session);

    expect(nonMedicareSync).toHaveBeenCalledOnce();
    expect(nonMedicareAsync).toHaveBeenCalledOnce();
    expect(medicareSync).not.toHaveBeenCalled();
    expect(medicareAsync).not.toHaveBeenCalled();
  });

  it("both entrypoints route true → Medicare", async () => {
    const triggers = makeTriggers();
    const session = makeSession(true);

    buildSystemPromptForUser(triggers, session);
    await buildSystemPromptForUserWithLearning(triggers, session);

    expect(medicareSync).toHaveBeenCalledOnce();
    expect(medicareAsync).toHaveBeenCalledOnce();
    expect(nonMedicareSync).not.toHaveBeenCalled();
    expect(nonMedicareAsync).not.toHaveBeenCalled();
  });

  it("both entrypoints route null → Medicare", async () => {
    const triggers = makeTriggers();
    const session = makeSession(null);

    buildSystemPromptForUser(triggers, session);
    await buildSystemPromptForUserWithLearning(triggers, session);

    expect(medicareSync).toHaveBeenCalledOnce();
    expect(medicareAsync).toHaveBeenCalledOnce();
    expect(nonMedicareSync).not.toHaveBeenCalled();
    expect(nonMedicareAsync).not.toHaveBeenCalled();
  });
});
