# Orchestration Flows

Full topic doc — extracted from CLAUDE.md during the 2026-05-13 doc refactor.

---

## Orchestration Flows

How ICD-10, CMS coverage, CARC/RARC, and NPI data come together in end-to-end tool sequences. Claude should follow these sequences when handling each scenario.

### Flow 1: Coverage Guidance (Proactive Denial Prevention)

**Trigger**: User asks about Medicare coverage for a procedure or treatment.

**Goal**: Walk the user through every check needed so the claim does NOT get denied — verifying provider, codes, policy, requirements, and warning about common denial traps before the service happens.

**Tool chain** (6 phases, gated by skill loading order):

1. **Intake** (TOOL_RESTRAINT — no tools): Gather name, ZIP, symptoms, duration, prior treatments, red flags → stored in `sessionState`. Gate: 2a-2c answered before tools unlock.
2. **Provider Verification** (NPI only): `npi_search` by name+ZIP → check Medicare enrollment + specialty match. Non-enrolled = automatic denial. Specialty mismatch = warn + suggest referral. Skippable.
3. **Code Validation** (all tools unlock): `search_icd10` → ICD-10 codes. `search_cpt` → CPT codes. `get_related_diagnoses` → cross-validate. `check_preventive` → no cost-sharing path. `check_prior_auth` → PA required? `check_sad_list` → Part B vs D (drugs only).
4. **Coverage Policy Lookup**: `search_local_coverage` (CPT+ICD-10+ZIP → LCD). `search_national_coverage` (CPT+ICD-10 → NCD). `get_coverage_document` (full policy text). LCD/NCD requirements shown **AS-IS**.
5. **Requirement Verification**: Claude walks through each LCD requirement one at a time, checking user's situation. Stored in `.requirementAnswers`.
6. **Guidance Delivery**: `get_common_denials` (CPT → top CARC reasons + prevention tips). Final output = personalized checklist with policy ref, requirements mapped to user data, denial warnings, provider status.

**Data handoff**: Symptoms → ICD-10+CPT → Provider NPI → PA/preventive/SAD → LCD/NCD policy → Requirements Q&A → Common denials → Personalized checklist.

### Flow 2: Appeal (Reactive Denial Response)

**Trigger**: User mentions a denial, appeal, or denial code.

**Tool chain**: `lookup_denial_code` (FIRST — explains denial in plain English + appeal strategy) → gather denial details (no tools) → `search_icd10` → `search_cpt` → `search_local_coverage` (for letter citations) → `generate_appeal_letter` → PAYWALL GATE (`check_appeal_access`).

**Key rule**: `lookup_denial_code` is the FIRST tool called — it gives Claude enough context to explain the denial before gathering more details.

**MA branching**: When `sessionState.medicareType === "advantage"`, `generate_appeal_letter` is called with `medicare_type: "advantage"` and `plan_name` from `sessionState.maPlanName`. Letter uses "Request for Reconsideration" (not "Level 1 Redetermination"), addresses the plan (not MAC), cites 42 CFR §422.101. MA appeal levels: L1 → plan, L2 → IRE (not QIC, plan auto-forwards per 42 CFR §422.590), L3-5 same as Original Medicare.

### Flows 3–5 (one-liners)

- **Flow 3 — Quick Denial Code Lookup**: single `lookup_denial_code` call → plain-English explanation + offer to appeal.
- **Flow 4 — Coverage→Appeal Bridge**: returning user; reuse `sessionState` → `lookup_denial_code` → `generate_appeal_letter` with minimal new questions.
- **Flow 5 — EOB Explainer**: regex trigger (bill/claim/owe/charged) + `hasHealthData`. No tools — uses `recentClaims` already in prompt. `EOB_EXPLAINER_SKILL` structures: identify claim → what happened → charged → Medicare paid → patient owes → next step.
---

