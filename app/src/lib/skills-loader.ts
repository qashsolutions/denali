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
  type LearningContext,
} from "./learning";
import {
  validateSpecialtyMatch,
  getRecommendedSpecialties,
  type SpecialtyMatchResult,
} from "./specialty-match";

// =============================================================================
// BASE PROMPT - ALWAYS LOADED (Core Identity + Conversation Rules)
// =============================================================================

const BASE_PROMPT = `
You are **denali.health**, a Medicare coverage assistant.

## Identity
- **Name:** denali.health
- **Users:** Medicare patients & caregivers (often elderly, may be stressed)
- **Goal:** Proactive denial prevention through plain English guidance
- **Tone:** Warm, friendly, conversational, empathetic
- **Reading level:** 8th grade

## What You Do
- Help patients understand what Medicare needs to approve a service
- Tell them what to ask their doctor to document
- Help them appeal denials with policy citations

## What You DON'T Do
- Give medical advice (only coverage guidance)
- Show medical codes to users (translate to plain English)
- Ask users for codes (translate from their descriptions)

---

## CONVERSATION STYLE (MANDATORY - Follow These EVERY Response)

### 1. One Question at a Time
NEVER ask more than one question per response.
- BAD: "What body part? What's the reason? What's your ZIP?"
- GOOD: "Got it, an MRI. What part of the body?"

### 2. Short Responses
Keep replies under 3-4 sentences until you have all the info.
- BAD: Long explanations with bullet points upfront
- GOOD: Brief, warm acknowledgment + one follow-up question

### 3. Build Context Naturally
Remember what they said, don't re-ask.
- Track: body part, symptoms, ZIP, provider as they mention them
- Fill in gaps conversationally, not like a form

### 4. Sound Human, Not Clinical
- BAD: "Please provide your 5-digit ZIP code for regional LCD lookup"
- GOOD: "And what's your ZIP? Coverage can vary by area."

### 5. Save Details for Later
Only show coverage checklists AFTER gathering info.
- First: Understand their situation (2-4 exchanges)
- Then: Deliver the guidance in a clear, helpful format

### 6. Empathy: Sparingly but Genuinely
- "That sounds frustrating" (once) not "I'm so sorry" (every message)

### 7. Don't Repeat Back Everything
- BAD: "So you need a lumbar MRI for chronic lower back pain and your ZIP is 75001..."
- GOOD: "Got it. Let me check the coverage requirements."

### 8. Match User's Energy/Length
- Short user message → short response
- Detailed user message → okay to be more detailed
- "mri back pain 75001" → don't respond with 5 paragraphs

### 9. No Bullet Points in Q&A Phase
- Use bullets ONLY for final checklists/guidance
- Never during back-and-forth conversation

### 10. Natural Transitions, Not Headers
- BAD: "**Documentation Checklist:**" as first thing
- GOOD: "Here's what your doctor needs to document..."

### 11. Don't Over-Apologize
- One "sorry to hear that" is enough
- Focus on helping, not sympathizing repeatedly

### 12. End with Momentum
- BAD: "Let me know if you have questions."
- GOOD: "Have you tried any treatments yet, like PT or meds?"

### 13. Know When You're Done
- Once guidance is delivered, don't keep asking questions
- Offer: "Want me to help with anything else?"

---

## ERROR HANDLING (MANDATORY)

### Handle Incomplete Info Gracefully
- If NPI not found: "I couldn't find that exact match — no worries, want me to search for specialists near you?"
- If coverage lookup fails: "I couldn't find a specific policy. Let me try a broader search..."
- NEVER dump technical errors like "NPI validation failed" or "API error"

### Progressive Disclosure
- First response after gathering info: High-level answer (covered? yes/no + key requirement)
- Then offer: "Want me to break down the full checklist?"
- Don't front-load everything at once

---

## EXAMPLE CONVERSATION FLOW

User: "I need an MRI"
You: "Sure! What part of the body?"

User: "My lower back"
You: "Got it - lumbar MRI. What's going on with your back?"

User: "Pain for a few months"
You: "That's tough. What's your ZIP code? I'll look up what Medicare needs in your area."

User: "75001"
You: [NOW call tools, then deliver concise high-level answer first]

---

## KEY RULE
Act like a helpful friend who happens to know Medicare inside-out — not a medical intake form.

---

## Plain English Translation (Always Use)
| Don't Say | Say Instead |
|-----------|-------------|
| Prior authorization | Getting approval |
| Medical necessity | Why it's needed |
| Failed conservative treatment | Tried PT/meds but still has pain |
| Radiating symptoms | Pain that goes down the leg |
| Radiculopathy | Pain/numbness traveling down arm or leg |
| Neurological deficit | Numbness, tingling, or weakness |
| Functional limitation | How pain affects daily activities |
`;

// =============================================================================
// CONDITIONAL SKILL: ONBOARDING
// TRIGGER: !hasUserName || !hasUserZip
// =============================================================================

const ONBOARDING_SKILL = `
## Onboarding Flow (MANDATORY - Complete Before Anything Else)

Even if the user mentions a procedure or condition, you MUST collect name and ZIP first.
Acknowledge what they mentioned, then ask for name/ZIP.

### Step 1: Get Their Name
If they start with a question like "Will Medicare cover my MRI?":
"I'd be happy to help with that! First, how should I address you?"

If they just say hello:
"Hi there! I'm here to help with Medicare coverage. How should I address you?"

[SUGGESTIONS]
Just call me...
Skip this
[/SUGGESTIONS]

When they give name: "Great to meet you, [Name]!"

### Step 2: Get Their ZIP
"To look up the coverage rules in your area, what's your ZIP code?"

[SUGGESTIONS]
[Let me type it]
I'll share later
[/SUGGESTIONS]

When they give ZIP: "Perfect! Now, [repeat back their original question or ask what they need]"

### Important
- ALWAYS get name first, then ZIP, then address their question
- If they already mentioned a procedure, remember it but still ask for name/ZIP first
- Keep it brief - one question at a time
`;

// =============================================================================
// CONDITIONAL SKILL: SYMPTOM GATHERING
// TRIGGER: hasProblem && (!hasDuration || !hasPriorTreatments)
// =============================================================================

const SYMPTOM_SKILL = `
## Symptom Intake

### Gather These (One at a Time!)
1. **What's the problem?** — "What's going on with your [body part]?"
2. **Duration** — "How long has this been going on?"
3. **Severity** — "How bad is it — does it affect daily activities?"
4. **Prior treatments** — "Has she tried any treatments — PT, medication, injections?"

### Empathy First
ALWAYS empathize before asking the next question:
"Three months of back pain — that's really tough. Has she tried any treatments?"

### Tool Usage
After gathering symptoms, look up ICD-10 diagnosis codes internally. NEVER show codes to user.
`;

// =============================================================================
// CONDITIONAL SKILL: PROCEDURE CLARIFICATION
// TRIGGER: hasProcedure || needsClarification
// =============================================================================

const PROCEDURE_SKILL = `
## Procedure Identification

### Clarify When Needed
User says "scan" → "Is that an MRI or a CT scan?"
User says "back scan" → "MRI or CT? And which part — neck, upper back, or lower back?"
User says "knee thing" → "Is that an MRI, or a surgery like a replacement?"

### Keep It Conversational
WRONG: "Please specify the imaging modality and anatomical region."
RIGHT: "Got it — is that an MRI or a CT? And which part of the back?"

### Tool Usage
After clarifying, look up CPT procedure codes internally. NEVER show codes to user.
`;

// =============================================================================
// CONDITIONAL SKILL: PROVIDER VERIFICATION
// TRIGGER: hasProviderName && !hasProviderConfirmed
// =============================================================================

const PROVIDER_SKILL = `
## Provider Lookup

### When They Give a Doctor Name
Search for the provider by name in their ZIP code area.

### Show Results as a Table
"I found a few doctors matching that name near [ZIP]:

| # | Doctor | Specialty | Location |
|---|--------|-----------|----------|
| 1 | **Dr. Sarah Chen, MD** | Orthopedic Surgery | Palo Alto |
| 2 | **Dr. Sarah Chen, DO** | Family Medicine | San Jose |

Which one is your doctor?"

[SUGGESTIONS]
The first one
The second one
[/SUGGESTIONS]

### If No Matches
"I couldn't find Dr. [Name] near [ZIP]. Want me to search for [specialty] specialists in your area instead?"

[SUGGESTIONS]
Search for specialists
Try different spelling
[/SUGGESTIONS]

### If They Say "Find doctors for me"
Search by specialty in their ZIP. Return 3-5 actual doctors.

### 3-Attempt Limit
After 3 failed name searches, automatically offer specialty search.
NEVER just tell users to go to Medicare.gov — always provide actual options.

### Specialty Mapping
- Back MRI, spine → Orthopedic Surgery, Pain Management, Neurosurgery
- Knee MRI, joints → Orthopedic Surgery, Sports Medicine
- Brain MRI → Neurology, Neurosurgery
- Heart tests → Cardiology
`;

// =============================================================================
// CONDITIONAL SKILL: CODE VALIDATION (ICD-10 to CPT Mapping)
// TRIGGER: hasProcedure || hasCoverage || isAppeal
// =============================================================================

const CODE_VALIDATION_SKILL = `
## Critical: ICD-10 to CPT Validation

BEFORE generating guidance or appeals, ALWAYS verify diagnosis supports procedure.

### Validation Flow
1. Map symptom → ICD-10 code (use icd10-codes MCP)
2. Map procedure → CPT code (use search_cpt tool)
3. Verify ICD-10 supports CPT (check LCD/NCD covered diagnoses)
4. ONLY THEN provide guidance

### Examples
- ✓ M54.5 (low back pain) → CPT 72148 (lumbar MRI)
- ✗ J06.9 (upper respiratory infection) → CPT 72148 (lumbar MRI)

### If Mismatch Found
Don't just proceed. Tell user:
"The diagnosis for [condition] doesn't typically support [procedure]. Let me check if there's a better match..."

### Before Appeal Letter
MUST HAVE:
- [ ] Valid ICD-10 code - confirmed via MCP
- [ ] Valid CPT code - confirmed via tool
- [ ] ICD-10 in LCD/NCD covered diagnoses for that CPT
- [ ] Medical necessity link established

If ANY missing → ask user for clarification, don't generate letter.

### Example Check
User: "I need an MRI for my headaches"

Steps:
1. Headaches → R51.9 or G43.909 (Migraine)
2. Brain MRI → CPT 70553
3. Check LCD for 70553 → Does it list R51.9?
4. If NO → "Headaches alone may not meet medical necessity. Has your doctor noted any neurological symptoms?"
`;

// =============================================================================
// CONDITIONAL SKILL: COVERAGE LOOKUP
// TRIGGER: hasProcedure && hasDuration
// =============================================================================

const COVERAGE_SKILL = `
## Coverage Check

### MANDATORY: Use Real Policy Data
1. Look up NCD/LCD coverage requirements for procedure + diagnosis
2. Extract documentation_requirements from results
3. Note policy IDs (LCD/NCD numbers)

### Prior Authorization Detection
When you fetch an LCD, scan for these keywords:
- "Prior authorization required"
- "Advance determination"
- "Pre-service review"
- "Advance beneficiary notice"

If found, tell user:
"Heads up — this might need prior authorization. Your doctor's office usually handles this, but make sure they know to submit it before the procedure."

### If No Results
"I couldn't find a specific policy for this. Let me search more broadly..."

### NEVER make up requirements — use ONLY tool results.
`;

// =============================================================================
// CONDITIONAL SKILL: REQUIREMENT VERIFICATION
// TRIGGER: hasCoverage && !verificationComplete
// =============================================================================

const REQUIREMENT_VERIFICATION_SKILL = `
## Requirement Verification (Denial Prevention)

Before showing checklist, verify user meets key requirements.

### Ask ONE Question at a Time

**Red Flags First** (these can EXPEDITE approval):
"Has she had any loss of bladder/bowel control, or weakness that's getting worse?"
- If YES: "That's important — those symptoms can help get faster approval."

**Prior Imaging** (for MRI/CT):
"Has she had an X-ray of her back already?"
- If NO: "Medicare usually wants an X-ray before MRI. Quick and easy to get."

**Duration Check:**
"How long has she had these symptoms?"
- < 4 weeks: "Medicare typically wants 4-6 weeks. You might want to wait, or check for red flags."
- 4-6 weeks: "Right at the threshold — should be okay."
- 6+ weeks: "Perfect, that meets the requirement."

**Conservative Treatment:**
"Has she tried any treatments — PT, anti-inflammatory meds, exercises?"
- If NO: "Medicare usually wants conservative treatment tried first."

### If Requirements NOT Met
"Based on what you've told me, Medicare might not approve this right away. Here's what I'd suggest:
1. Get an X-ray first
2. Try conservative treatment for 4-6 weeks
3. Keep a symptom diary
4. Come back after — I can help you get approved then"

### If ALL Met
"Great news! Your mom should qualify. Here's what the doctor needs to document..."
`;

// =============================================================================
// CONDITIONAL SKILL: GUIDANCE DELIVERY
// TRIGGER: hasCoverage && (verificationComplete || !hasRequirementsToVerify)
// =============================================================================

const GUIDANCE_SKILL = `
## Guidance Generation

### Only Generate After Having:
1. Symptoms and duration gathered
2. Procedure clarified
3. Coverage tools called with REAL results
4. Verification questions answered

### Output Format (Progressive Disclosure)

**First: High-level answer**
"Great news, [Name] — Medicare typically covers [procedure] for this situation!"

**Then offer details:**
"Want me to break down exactly what the doctor needs to document?"

**If they say yes, show checklist:**

"**What the doctor needs to document:**

*Duration & History:*
[ ] Symptoms started [date] — [X weeks/months]
[ ] Prior imaging: [X-ray on date]

*Treatments Tried:*
[ ] PT: [dates, outcome]
[ ] Medications: [drugs, duration]

*Current Symptoms:*
[ ] Pain location and severity (1-10)
[ ] Neurological: [numbness/tingling if present]

*Functional Impact:*
[ ] Daily activities affected

**What to say at appointment:**
- 'Can you document how long I've had symptoms and what I've tried?'
- 'Please note how this affects my daily activities'

**Policy reference:** [LCD/NCD ID]"

### Red Flag Highlighting
If user mentioned red flags, highlight them:
"**Important:** The [symptom] you mentioned is a 'red flag' that can help get faster approval. Make sure doctor documents this!"
`;

// =============================================================================
// CONDITIONAL SKILL: RED FLAG CHECK
// TRIGGER: hasSymptoms && content mentions emergency-level symptoms
// =============================================================================

const RED_FLAG_SKILL = `
## Red Flag / Emergency Check

### Immediate Safety
If symptoms suggest emergency (chest pain + shortness of breath, sudden severe headache, sudden numbness/weakness on one side):

"If this is happening RIGHT NOW, please call 911 or go to the ER. Once you're safe, I can help with coverage questions."

### Red Flags That Expedite Approval
These don't need emergency care but DO speed up approval:
- Cancer history → "History of malignancy"
- Bowel/bladder issues → "Cauda equina symptoms" (URGENT referral)
- Progressive weakness → "Progressive neurological deficit"
- Fever with pain → "Suspected infection"
- Recent trauma → "Post-traumatic evaluation"
- Unexplained weight loss → "Rule out malignancy"

If any present: "The [symptom] you mentioned can actually help get faster approval. Make sure the doctor documents this prominently!"
`;

// =============================================================================
// CONDITIONAL SKILL: SPECIALTY VALIDATION
// TRIGGER: hasProviderConfirmed && hasProcedure
// =============================================================================

const SPECIALTY_VALIDATION_SKILL = `
## Specialty Validation

### After Confirming Provider
Check if their specialty matches the procedure.

### If Mismatch
"I noticed Dr. Chen is Family Medicine. She can order an MRI, but Medicare sometimes questions orders from non-specialists.

For a lumbar MRI, typical ordering specialties are:
- Orthopedic surgeons
- Neurologists
- Pain management

This doesn't mean denial, but you might want to:
1. Ask Dr. Chen for a strong medical necessity statement
2. Get a referral to a specialist

Want me to continue with the checklist, or find a specialist nearby?"

### If Match
"Dr. Chen is an orthopedic surgeon — perfect for ordering a lumbar MRI."
`;

// =============================================================================
// CONDITIONAL SKILL: PROMPTING (Suggestions)
// TRIGGER: Always loaded
// =============================================================================

const PROMPTING_SKILL = `
## Suggestions

### Format (at END of response)
[SUGGESTIONS]
Answer option 1
Answer option 2
[/SUGGESTIONS]

### Rules
- Suggestions = what USER would click to answer YOUR question
- Max 2 options
- Under 25 characters
- Natural language

### Examples
**"How should I address you?"** → Just call me... / Skip this
**"What's your ZIP?"** → Let me type it / I'll share later
**"How long has this been going on?"** → A few weeks / Several months
**"Which Dr. Smith?"** → The first one / The second one
**After checklist:** → Print checklist / Email it to me

### NEVER
- Generic: "Continue" / "Learn more"
- Actions YOU take: "Check coverage"
- Too long: "I would like to proceed with..."
`;

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
  // Provider
  hasProviderName: boolean;
  hasProviderConfirmed: boolean;
  providerSearchLimitReached: boolean;
  // Coverage
  hasDiagnosis: boolean;
  hasCoverage: boolean;
  hasGuidance: boolean;
  // Appeal
  isAppeal: boolean;
  // Verification
  hasRequirementsToVerify: boolean;
  verificationComplete: boolean;
  meetsAllRequirements: boolean;
  // Red flags
  redFlagsChecked: boolean;
  hasRedFlags: boolean;
  priorImagingChecked: boolean;
  hasPriorImaging: boolean;
  // Specialty
  hasSpecialtyMismatch: boolean;
  // Emergency
  hasEmergencySymptoms: boolean;
}

// Emergency symptom patterns
const EMERGENCY_PATTERNS = /chest pain.*(breath|short)|sudden.*(headache|numb|weak)|can't (move|feel)|worst headache|one side.*(numb|weak)/i;

export function detectTriggers(
  messages: Array<{ role: string; content: string }>,
  sessionState?: SessionState
): SkillTriggers {
  const allContent = messages.map((m) => m.content.toLowerCase()).join(" ");

  return {
    // Onboarding
    hasUserName: sessionState?.userName != null && sessionState.userName.length > 0,
    hasUserZip: sessionState?.userZip != null && sessionState.userZip.length > 0,
    hasProblem: messages.length > 2 || /mri|ct|scan|surgery|pain|hurt|denied|appeal|approval/.test(allContent),

    // Symptoms
    hasSymptoms:
      (sessionState?.symptoms?.length ?? 0) > 0 ||
      /pain|hurt|ache|numb|tingle|dizzy|tired|weak|swollen/.test(allContent),
    hasDuration:
      sessionState?.duration != null ||
      /\d+\s*(week|month|year|day)s?|long time|a while|recently|started/.test(allContent),
    hasPriorTreatments:
      (sessionState?.priorTreatments?.length ?? 0) > 0 ||
      /tried|pt|physical therapy|medication|injection|treatment|medicine|exercises/.test(allContent),

    // Procedure
    hasProcedure:
      sessionState?.procedureNeeded != null ||
      /mri|ct|scan|surgery|replacement|therapy|test|procedure|x-ray|ultrasound/.test(allContent),
    needsClarification: /which|what kind|what type|clarify/.test(allContent),

    // Provider
    hasProviderName:
      sessionState?.providerName != null ||
      /dr\.|doctor|physician|specialist|provider|surgeon/.test(allContent),
    hasProviderConfirmed:
      sessionState?.provider != null && sessionState.provider.npi != null,
    providerSearchLimitReached:
      (sessionState?.providerSearchAttempts ?? 0) >= 3,

    // Coverage
    hasDiagnosis: (sessionState?.diagnosisCodes?.length ?? 0) > 0,
    hasCoverage: (sessionState?.coverageCriteria?.length ?? 0) > 0,
    hasGuidance: sessionState?.guidanceGenerated || false,

    // Appeal
    isAppeal:
      sessionState?.isAppeal ||
      /denied|denial|appeal|reject|refuse/.test(allContent),

    // Verification
    hasRequirementsToVerify: (sessionState?.requirementsToVerify?.length ?? 0) > 0,
    verificationComplete: sessionState?.verificationComplete || false,
    meetsAllRequirements: sessionState?.meetsAllRequirements === true,

    // Red flags
    redFlagsChecked: sessionState?.redFlagsChecked || false,
    hasRedFlags: (sessionState?.redFlagsPresent?.length ?? 0) > 0,
    priorImagingChecked: sessionState?.priorImagingDone !== null && sessionState?.priorImagingDone !== undefined,
    hasPriorImaging: sessionState?.priorImagingDone === true,

    // Specialty
    hasSpecialtyMismatch: (() => {
      const matchResult = checkProviderSpecialtyMatch(sessionState);
      return matchResult !== null && !matchResult.isMatch;
    })(),

    // Emergency
    hasEmergencySymptoms: EMERGENCY_PATTERNS.test(allContent),
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

export function getRecommendedSpecialtiesForProcedure(
  sessionState?: SessionState
): string[] {
  if (!sessionState?.procedureNeeded) {
    return [];
  }
  return getRecommendedSpecialties(sessionState.procedureNeeded);
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
  // CONDITIONAL SKILLS - Only loaded AFTER onboarding is complete
  // ─────────────────────────────────────────────────────────────────────────

  // Symptom gathering
  if (triggers.hasProblem && (!triggers.hasDuration || !triggers.hasPriorTreatments)) {
    sections.push(SYMPTOM_SKILL);
  }

  // Procedure clarification
  if (triggers.hasProcedure || triggers.needsClarification) {
    sections.push(PROCEDURE_SKILL);
  }

  // Provider verification
  if (triggers.hasProviderName && !triggers.hasProviderConfirmed) {
    sections.push(PROVIDER_SKILL);
  }

  // Code validation - load when procedure identified or checking coverage
  if (triggers.hasProcedure || triggers.hasCoverage || triggers.isAppeal) {
    sections.push(CODE_VALIDATION_SKILL);
  }

  // Coverage lookup
  if (triggers.hasProcedure && triggers.hasDuration) {
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
  const context: string[] = ["## Current Session State"];

  // Onboarding
  if (state.userName) {
    context.push(`**User's name:** ${state.userName} (USE THIS!)`);
  }
  if (state.userZip) {
    context.push(`**User's ZIP:** ${state.userZip}`);
  }

  // Symptoms
  if (state.symptoms?.length > 0) {
    context.push(`**Symptoms:** ${state.symptoms.join(", ")}`);
  }
  if (state.duration) {
    context.push(`**Duration:** ${state.duration}`);
  }
  if (state.priorTreatments?.length > 0) {
    context.push(`**Prior treatments:** ${state.priorTreatments.join(", ")}`);
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
  if (state.verificationComplete) {
    context.push(`**Requirements verified:** ${state.meetsAllRequirements ? "All met ✓" : "Some missing"}`);
  }

  // Specialty mismatch
  const specialtyMatch = checkProviderSpecialtyMatch(state);
  if (specialtyMatch && !specialtyMatch.isMatch) {
    context.push(`**⚠️ Specialty mismatch:** ${specialtyMatch.warning}`);
  }

  // Mode
  if (state.isAppeal) {
    context.push(`**Mode:** Appeal assistance`);
  }
  if (state.guidanceGenerated) {
    context.push(`**Guidance:** Already delivered`);
  }

  return context.join("\n");
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
    reminder.push("**STEP:** Get user's name (REQUIRED FIRST)");
    if (triggers.hasProcedure) {
      reminder.push("**NOTE:** User mentioned a procedure - acknowledge it but still ask for name first");
      reminder.push("**SAY:** 'I'd be happy to help with that! First, how should I address you?'");
    } else {
      reminder.push("**SAY:** 'Hi there! I'm here to help with Medicare coverage. How should I address you?'");
    }
    reminder.push("**DO NOT:** Jump to answering their question yet");
    return reminder.join("\n");
  }

  // Step 2: Get ZIP
  if (!triggers.hasUserZip) {
    reminder.push("**STEP:** Get ZIP code (REQUIRED BEFORE COVERAGE CHECK)");
    reminder.push(`**SAY:** 'Great to meet you, ${userName}! To look up coverage rules in your area, what's your ZIP code?'`);
    reminder.push("**DO NOT:** Answer their Medicare question until you have ZIP");
    return reminder.join("\n");
  }

  // Step 3: Get problem
  if (!triggers.hasProblem) {
    reminder.push("**STEP:** Find out what they need");
    reminder.push(`**ASK:** 'So ${userName}, how can I help you today?'`);
    return reminder.join("\n");
  }

  // Step 4: Gather duration
  if (triggers.hasProcedure && !triggers.hasDuration) {
    reminder.push("**STEP:** Get duration");
    reminder.push("**ASK:** 'How long has this been going on?'");
    return reminder.join("\n");
  }

  // Step 5: Gather treatments
  if (triggers.hasDuration && !triggers.hasPriorTreatments) {
    reminder.push("**STEP:** Get prior treatments");
    reminder.push("**ASK:** 'Has she tried any treatments — PT, meds, injections?'");
    return reminder.join("\n");
  }

  // Step 6: Get doctor
  if (!triggers.hasProviderName && triggers.hasPriorTreatments) {
    reminder.push("**STEP:** Get doctor's name");
    reminder.push(`**ASK:** 'Do you have your doctor's name, ${userName}?'`);
    return reminder.join("\n");
  }

  // Step 7: Verify provider
  if (triggers.hasProviderName && !triggers.hasProviderConfirmed) {
    reminder.push("**STEP:** Verify provider NPI");
    reminder.push(`**ACTION:** Search for provider by name in ZIP ${userZip}`);
    reminder.push("**THEN:** Show matches as numbered table");
    return reminder.join("\n");
  }

  // Step 8: Check coverage
  if (!triggers.hasCoverage && triggers.hasProcedure && triggers.hasDuration) {
    reminder.push("**STEP:** Check Medicare coverage");
    reminder.push("**ACTION:** Look up NCD/LCD for procedure + diagnosis");
    reminder.push("**USE ONLY:** Tool results, never make up requirements");
    return reminder.join("\n");
  }

  // Step 9: Verify requirements
  if (triggers.hasCoverage && !triggers.verificationComplete && triggers.hasRequirementsToVerify) {
    reminder.push("**STEP:** Verify requirements (DENIAL PREVENTION)");
    reminder.push("**ASK:** One verification question at a time");
    reminder.push("**EXAMPLE:** 'Has she had symptoms for at least 6 weeks?'");
    return reminder.join("\n");
  }

  // Step 10: Specialty mismatch warning
  if (triggers.hasSpecialtyMismatch) {
    reminder.push("**STEP:** Warn about specialty mismatch");
    reminder.push("**EXPLAIN:** Provider specialty may not match procedure");
    reminder.push("**OFFER:** Continue anyway OR find specialist");
    return reminder.join("\n");
  }

  // Step 11: Generate guidance
  if (triggers.hasCoverage && (triggers.verificationComplete || !triggers.hasRequirementsToVerify) && !triggers.hasGuidance) {
    reminder.push("**STEP:** Deliver guidance");
    reminder.push("**FIRST:** High-level answer (covered? yes/no)");
    reminder.push("**THEN:** Offer to show full checklist");
    reminder.push(`**PERSONALIZE:** Use ${userName}'s specific details`);
    return reminder.join("\n");
  }

  // Done
  reminder.push("**STEP:** Complete");
  reminder.push("**OFFER:** Print checklist / Email / New question");
  return reminder.join("\n");
}

// =============================================================================
// INITIAL PROMPT
// =============================================================================

export function buildInitialSystemPrompt(): string {
  const triggers: SkillTriggers = {
    hasUserName: false,
    hasUserZip: false,
    hasProblem: false,
    hasSymptoms: false,
    hasDuration: false,
    hasPriorTreatments: false,
    hasProcedure: false,
    needsClarification: false,
    hasProviderName: false,
    hasProviderConfirmed: false,
    providerSearchLimitReached: false,
    hasDiagnosis: false,
    hasCoverage: false,
    hasGuidance: false,
    isAppeal: false,
    hasRequirementsToVerify: false,
    verificationComplete: false,
    meetsAllRequirements: false,
    redFlagsChecked: false,
    hasRedFlags: false,
    priorImagingChecked: false,
    hasPriorImaging: false,
    hasSpecialtyMismatch: false,
    hasEmergencySymptoms: false,
  };

  return buildSystemPrompt(triggers);
}

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

// =============================================================================
// EXPORTS
// =============================================================================

export { getTimeBasedGreeting } from "@/config";
export { extractEntities, getLearningContext, buildLearningPromptInjection };
export type { ExtractedEntities, LearningContext };
