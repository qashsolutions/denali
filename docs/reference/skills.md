# Skills & Prompt System Reference

Full skill loading priority table, contextual skill list with
file locations, and implementation notes. Extracted from
CLAUDE.md.

For the active subset (priority table + load-bearing rules
like TOOL_RESTRAINT and the Requirement Verification
Pipeline), see CLAUDE.md "Skills & Prompt System (summary)".

---


Skills are conditional prompt sections loaded by `skills-loader.ts` based on `SkillTriggers` detected in `route.ts`.

### Skill Loading Order & Gates

The system uses gates that return early and prevent later skills from loading prematurely:

| Priority | Trigger                                          | Skill Loaded             | Gate Behavior                                                                                                                                                                                                                |
| -------- | ------------------------------------------------ | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Emergency symptoms detected                      | RED_FLAG_SKILL           | Highest priority, overrides all. Regex covers: chest pain+SOB, sudden headache/numbness, DKA (fruity breath+thirst, extreme thirst+urination), severe hypoglycemia (shaking+sweating+sugar, seizure+sugar, passed out+sugar) |
| 2        | Missing name OR ZIP                              | ONBOARDING               | + TOOL_RESTRAINT (no tools allowed)                                                                                                                                                                                          |
| 3        | Has procedure but missing symptoms/duration      | SYMPTOM_GATHERING        | + TOOL_RESTRAINT (+ PROCEDURE_SKILL for clarification)                                                                                                                                                                       |
| 4        | Has symptom info but no provider confirmed       | PROVIDER_VERIFICATION    | NPI tools only                                                                                                                                                                                                               |
| 5        | Has procedure or needs clarification             | PROCEDURE_SKILL          | Disambiguate procedure type/region                                                                                                                                                                                           |
| 6        | Has procedure or coverage or appeal              | CODE_VALIDATION          | ICD-10 <-> CPT mapping + prior auth check + preventive check + SAD list                                                                                                                                                      |
| 7        | Has coverage but not all requirements verified   | REQUIREMENT_VERIFICATION | Ask 1 requirement at a time                                                                                                                                                                                                  |
| 8        | Provider confirmed + specialty mismatch          | SPECIALTY_VALIDATION     | Warn about ordering specialty risk                                                                                                                                                                                           |
| 9        | Has coverage and `verificationComplete === true` | GUIDANCE_DELIVERY        | Proactive checklist + denial warnings + prior auth status. **NOTE**: Guidance no longer loads when requirements are simply empty (vacuous truth fix) — Claude must emit `[REQUIREMENTS]` block and user must verify or skip  |
| 10       | Appeal detected                                  | APPEAL_SKILL             | Denial code lookup + strategy + PubMed evidence + letter generation (MA-aware: Request for Reconsideration for Advantage plans)                                                                                              |
| 11       | User asks about bills/claims + has health data   | EOB_EXPLAINER_SKILL      | Explains claims, charges, Medicare payment rules, denial reasons in plain English                                                                                                                                            |

**TOOL_RESTRAINT**: During onboarding and symptom gathering, the prompt explicitly forbids all tool calls. This prevents Claude from jumping ahead to code lookups before gathering enough context.

**Requirement Verification Pipeline**: After coverage lookup, Claude MUST emit a `[REQUIREMENTS]` block listing LCD/NCD requirements. This populates `requirementsToVerify` in sessionState. Without it, verification cannot proceed. Three safety mechanisms prevent stuck states: (1) step 9b flow reminder prompts Claude to emit the block, (2) explicit skip detection for "skip"/"move on", (3) implicit skip detection when user requests guidance directly with empty requirements. Guidance delivery (priority 9) only loads when `verificationComplete` is explicitly true — never on empty requirements.

### Base Prompt (always loaded)

- Identity & mission (denial prevention, plain English, empathy)
- Conversation rules (one question, brief responses, explain "why")
- Error handling (graceful failures, progressive disclosure)

### Additional Skills (Loaded Contextually)

| Skill                          | File                                       | Trigger                                                                                                                                                                                                                                                          |
| ------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `HEALTH_RECORDS_SKILL`         | `src/lib/skills/health-records.ts`         | `hasHealthData` or `hasRecentDenials`                                                                                                                                                                                                                            |
| `MEDICARE_NOTIFICATIONS_SKILL` | `src/lib/skills/medicare-notifications.ts` | `hasHealthData && hasRecentChanges`                                                                                                                                                                                                                              |
| `DIABETES_PREVENTION_SKILL`    | `src/lib/skills/diabetes-prevention.ts`    | `hasDiabetesContext` — includes provider search (NPI) for endocrinologists/dietitians/MDPP, urgent A1C values (≥12% contact doctor, ≥14% DKA warning)                                                                                                            |
| `OBESITY_PREVENTION_SKILL`     | `src/lib/skills/obesity-prevention.ts`     | `hasObesityContext` — obesity diagnosis (E66), obesity medications, or user keywords (weight loss, bariatric, BMI, Wegovy, etc.). Includes severity awareness (morbid/severe → bariatric/specialist referral), provider search for bariatric surgeons/counselors |
| `EOB_EXPLAINER_SKILL`          | `src/skills/domain/eob-explainer.ts`       | `hasEOBQuestion && hasHealthData` — user asks about bills/claims with Blue Button connected                                                                                                                                                                      |
| `OUTCOME_PROMPTING_SKILL`      | `src/skills/domain/outcome-prompting.ts`   | Returning user with pending appeal (`hasUnreportedOutcome`). Outcome reported via `/api/appeal-outcome` → `recordAppealOutcome()` + `applyOutcomeIncentive()` (free appeal credit)                                                                               |
| `COUNSELOR_SKILL`              | `src/skills/channel/counselor.ts`          | `role === "counselor"`                                                                                                                                                                                                                                           |
| `PROVIDER_PILOT_SKILL`         | `src/skills/channel/provider.ts`           | `role === "provider"`                                                                                                                                                                                                                                            |

### Implementation

Skills are string constants exported from `src/skills/` (core domain skills) and `src/lib/skills/` (data-dependent skills). They get concatenated into the system prompt by `skills-loader.ts` based on trigger booleans. The function `buildSystemPromptWithLearning()` in `route.ts` calls the skills loader and also injects learned context (high-confidence mappings, successful coverage paths).

