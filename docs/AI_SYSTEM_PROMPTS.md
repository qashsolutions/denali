# AI System Prompts

Denali uses a skills-based prompt architecture where the system prompt is dynamically assembled based on conversation context. Claude is the brain -- all intelligence lives in the prompt system and tool calling, not in the frontend.

---

## Architecture Overview

```
route.ts (chat endpoint)
    |
    +--> extractUserInfo()       -- parse user message for entities
    +--> detectTriggers()        -- determine which skills to load
    +--> buildSystemPrompt()     -- assemble prompt from skills-loader
    |       |
    |       +--> skills-loader.ts    -- conditional prompt builder
    |       |       |
    |       |       +--> base prompt (always loaded)
    |       |       +--> skill sections (conditional)
    |       |       +--> health context (consent-gated)
    |       |       +--> learning context (high-confidence mappings)
    |       |
    +--> claude.chat()           -- send to Claude Beta API
    +--> persistLearning()       -- store mappings (non-blocking)
```

---

## Skill Loading Order & Gates

Skills load based on `SkillTriggers` detected in `route.ts`. Gates return early and prevent later skills from loading prematurely. This ensures Claude gathers sufficient context before using tools.

| Priority | Trigger | Skill Loaded | Gate Behavior |
|----------|---------|-------------|---------------|
| 1 | Emergency symptoms detected | `RED_FLAG_SKILL` | Highest priority, overrides all other skills |
| 2 | Missing name OR ZIP | `ONBOARDING` | + `TOOL_RESTRAINT` (no tools allowed) |
| 3 | Has procedure but missing symptoms/duration | `SYMPTOM_GATHERING` | + `TOOL_RESTRAINT` + `PROCEDURE_SKILL` for clarification |
| 4 | Has symptom info but no provider confirmed | `PROVIDER_VERIFICATION` | NPI tools only |
| 5 | Has procedure or needs clarification | `PROCEDURE_SKILL` | Disambiguate procedure type/region |
| 6 | Has procedure or coverage or appeal | `CODE_VALIDATION` | ICD-10/CPT mapping + prior auth + preventive + SAD list |
| 7 | Has coverage but not all requirements verified | `REQUIREMENT_VERIFICATION` | Ask 1 requirement at a time |
| 8 | Provider confirmed + specialty mismatch | `SPECIALTY_VALIDATION` | Warn about ordering specialty risk |
| 9 | Has coverage and all requirements verified | `GUIDANCE_DELIVERY` | Proactive checklist + denial warnings + prior auth status |
| 10 | Appeal detected | `APPEAL_SKILL` | Denial code lookup + strategy + PubMed evidence + letter generation |

### TOOL_RESTRAINT

During onboarding and symptom gathering (priorities 2-3), the prompt explicitly forbids all tool calls. This prevents Claude from jumping ahead to code lookups before gathering enough context from the user.

The restraint is lifted once sufficient context is collected (name, ZIP, symptoms, duration).

---

## Base Prompt (Always Loaded)

The base prompt establishes Claude's identity and conversation rules:

- **Identity**: Denali, a Medicare coverage assistant focused on denial prevention
- **Mission**: Help patients understand Medicare coverage in plain English
- **Conversation rules**: one question at a time, brief responses, explain "why"
- **Error handling**: graceful failures, progressive disclosure
- **Guardrails**: never give medical advice, never show codes to users, never ask users for codes
- **Tone**: warm, simple, no jargon, empathetic, 8th grade reading level

---

## Additional Skills (Loaded Contextually)

These skills load based on data availability rather than conversation phase:

| Skill | File | Trigger | Purpose |
|-------|------|---------|---------|
| `HEALTH_RECORDS_SKILL` | `src/lib/skills/health-records.ts` | `hasHealthData` or `hasRecentDenials` | Guide Claude to reference FHIR data (coverage, claims, denials) |
| `MEDICARE_NOTIFICATIONS_SKILL` | `src/lib/skills/medicare-notifications.ts` | `hasHealthData && hasRecentChanges` | Alert user to EOB/coverage changes detected in FHIR data |
| `DIABETES_PREVENTION_SKILL` | `src/lib/skills/diabetes-prevention.ts` | `hasDiabetesContext` | A1C interpretation, coaching, MDPP references, lab-informed guidance |
| `OUTCOME_PROMPTING_SKILL` | `src/skills/domain/outcome-prompting.ts` | Returning user with pending appeal | Ask about appeal outcomes to feed learning system |
| `COUNSELOR_SKILL` | `src/skills/channel/counselor.ts` | `role === "counselor"` | Adjusted tone and depth for SHIP/SMP counselors |
| `PROVIDER_PILOT_SKILL` | `src/skills/channel/provider.ts` | `role === "provider"` | Provider-facing mode with clinical detail level |

---

## Health Context Injection

When a user has connected Blue Button and consented to AI data use:

1. `buildHealthContextForPrompt()` in `src/lib/fhir/context.ts` runs
2. Checks `health_data_ai` consent toggle (skips if false)
3. Builds structured context block with:
   - Active coverage details
   - Recent claims summary
   - Denial flags from EOB adjudication
   - Lab results with interpretations (A1C ranges, glucose values)
4. Context block is injected into the system prompt
5. Relevant skills (`HEALTH_RECORDS_SKILL`, `DIABETES_PREVENTION_SKILL`) activate

---

## Two-Tier Tool System

Claude has access to two types of tools, handled differently at the API level:

### MCP Tools (External, Auto-Handled)

MCP tools are declared via the `mcp_servers` parameter on the Beta API. Claude calls them directly, and the API handles tool results automatically -- no server-side processing needed.

| Server | URL | Tools | Data |
|--------|-----|-------|------|
| `cms-coverage` | `mcp.deepsense.ai/cms_coverage/mcp` | `search_local_coverage`, `search_national_coverage`, `get_coverage_document` | LCD/NCD coverage policies |
| `npi-registry` | `mcp.deepsense.ai/npi_registry/mcp` | `npi_lookup`, `npi_search` | Provider NPI, specialty, Medicare enrollment |
| `icd10-codes` | `mcp.deepsense.ai/icd10_codes/mcp` | `search_icd10` | ICD-10 diagnosis codes |

Content blocks: `mcp_tool_use` / `mcp_tool_result`

### Local Tools (Server-Executed)

Local tools are defined in `src/lib/tools/index.ts`. When Claude requests a local tool, the chat loop in `route.ts` executes it via `processToolCalls()` and feeds results back.

| Tool | Purpose | Data Source |
|------|---------|-------------|
| `search_cpt` | Map procedure descriptions to CPT codes | AMA API (dev only) |
| `get_related_diagnoses` | CPT to related ICD-10 codes | Local mappings |
| `get_related_procedures` | ICD-10 to related CPT codes | Local mappings |
| `check_prior_auth` | Check if CPT requires prior authorization | Local rules + CMS PA Model |
| `check_preventive` | Check if service is preventive (no cost-sharing) | Local rules |
| `search_pubmed` | Clinical evidence search (rate-limited) | NCBI E-utilities |
| `generate_appeal_letter` | Build Level 1 appeal with codes + policy refs + citations | Multiple sources combined |
| `check_sad_list` | Part B vs Part D drug routing | CMS SAD list |
| `lookup_denial_code` | CARC/RARC lookup + appeal strategy | Supabase denial tables |
| `get_common_denials` | Top denial reasons for a procedure + prevention tips | Supabase denial tables |

Content blocks: `tool_use` / `tool_result`

### Critical Rule

**Never hardcode MCP tool names in system prompts.** Claude discovers MCP tools dynamically. Use action descriptions instead:

- DO: "Look up ICD-10 diagnosis codes for the symptoms"
- DON'T: "Call search_icd10 to find codes"

MCP tool names are determined by the server and may change. Hardcoding causes Claude to call non-existent local tools.

---

## Learning Integration

After every chat response, `persistLearning()` runs non-blocking and stores mappings:

- Symptom phrases mapped to ICD-10 codes (confidence-scored)
- Procedure phrases mapped to CPT codes (confidence-scored)
- Successful coverage paths (diagnosis + procedure + policy combinations)

High-confidence mappings are injected into the system prompt via `buildSystemPromptWithLearning()`, giving Claude learned context from previous conversations. This improves accuracy over time without retraining.

---

## SessionState

The `SessionState` type (defined in `claude.ts`) tracks conversation context across the chat loop:

**User-facing fields** (plain English, shown to user):
- `name`, `zip`, `symptoms`, `duration`
- `priorTreatments`, `provider`
- `requirementAnswers`, `redFlags`

**Internal fields** (codes, never shown to user):
- `diagnosisCodes` (ICD-10)
- `procedureCodes` (CPT)
- `denialCodes` (CARC/RARC)
- `coverageCriteria`, `policyReferences`
- `denialDate`, `priorAuthRequired`
- `medicareType`, `priorAuthSource`

**Health data fields** (from Blue Button):
- `healthDataAvailable`
- `activeCoverage`
- `recentDenials`

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | Chat endpoint orchestration |
| `src/lib/claude.ts` | Claude API client, Beta API call, MCP config, SessionState type |
| `src/lib/tools/index.ts` | All 12 local tool definitions + executors |
| `src/lib/skills-loader.ts` | Conditional prompt builder based on SkillTriggers |
| `src/lib/fhir/context.ts` | Health context injection into prompts |
| `src/lib/denial-patterns.ts` | Denial pattern queries for appeal strategies |
| `src/skills/` | Domain and channel skill prompt files |
| `src/lib/skills/` | Data-dependent skill prompt files |
