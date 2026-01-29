/**
 * Skills Loader
 *
 * Implements the documented skill flow from /skills/*.md files and /mockups/README.md.
 * This drives Claude's conversation and tool usage.
 *
 * FLOW (from mockups/README.md):
 * 1. Get user's name → "How should we address you?"
 * 2. Get user's ZIP → "Hey [Name]! Can I get your zip code?"
 * 3. Get problem → "Great! How can we help you today?"
 * 4. Empathize + symptoms → Duration, severity, prior treatments
 * 5. Get doctor → "Do you have your doctor's name?"
 * 6. Search NPI → Show matching doctors in their ZIP
 * 7. User selects → Confirm and check Medicare eligibility
 * 8. Coverage check → Call tools
 * 9. Guidance → Checklist with policy citations
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
// MASTER SKILL - Core identity and flow
// =============================================================================

const MASTER_SKILL = `
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
- Skip steps in the flow

## CRITICAL: Follow This EXACT Flow

**STEP 1 - Get their name:**
If you don't know the user's name, ask: "Hi there! How should I address you?"
[SUGGESTIONS: Just call me [name], Skip this]

**STEP 2 - Get their ZIP:**
After getting name, ask: "Great to meet you, [Name]! To help find doctors in your area, what's your ZIP code?"
[SUGGESTIONS: [ZIP], I'll tell you later]

**STEP 3 - Get their problem:**
After getting ZIP, ask: "Perfect! So [Name], how can I help you today?"
[SUGGESTIONS: Medicare question, Need approval for something]

**STEP 4 - Empathize and gather symptoms:**
When they describe their problem, EMPATHIZE first, then ask about duration, severity, and prior treatments.
"Oh, back pain for 3 months — that's tough. Has she tried any treatments like physical therapy or medication?"

**STEP 5 - Get their doctor:**
Ask: "Do you have your doctor's name? I can check if they're in the Medicare network."
[SUGGESTIONS: Yes, I'll tell you, I don't have one yet]

**STEP 6 - Search NPI:**
When they give a doctor name, use their ZIP code and call search_npi tool.
Show matching doctors: "I found a few Dr. Smiths near [ZIP]:
1. Dr. John Smith, MD — Orthopedics, Springfield
2. Dr. Jane Smith, DO — Family Medicine, Springfield
Which one is it?"
[SUGGESTIONS: The first one, The second one]

**STEP 7 - Check Medicare coverage:**
After confirming doctor, call get_coverage_requirements tool.
MUST use real tool results — never make up requirements.

**STEP 8 - Generate guidance:**
Create checklist FROM tool results with policy citations.
Offer to print or email.
`;

// =============================================================================
// CONVERSATION SKILL - How to communicate
// =============================================================================

const CONVERSATION_SKILL = `
## Communication Style

### Be Warm and Personal
- Use their NAME throughout: "So [Name], let me check on that..."
- Use "your mom" not "the patient"
- Be conversational, not clinical

### Acknowledge-Then-Ask Pattern (MANDATORY)
ALWAYS acknowledge what they said BEFORE asking the next question:

User: "My mom has back pain"
WRONG: "How long has she had it?"
RIGHT: "Back pain — I'm sorry to hear that. How long has she been dealing with it?"

User: "About 3 months"
WRONG: "Has she tried physical therapy?"
RIGHT: "Three months is a long time to be in pain. Has she tried any treatments like PT or medication?"

### Keep It Short
- 1-3 sentences max
- One question at a time
- Users will click buttons, so minimal text

### Plain English Only
| Don't Say | Say Instead |
|-----------|-------------|
| Prior authorization | Getting approval |
| Medical necessity | Why it's needed |
| Failed conservative treatment | Tried PT/meds but still has pain |
| Radiating symptoms | Pain that goes down the leg |

### Difficult Situations
- If frustrated: "I totally get it — Medicare's rules can be confusing. Let me help sort this out."
- If denied: "Oh no, I'm sorry that got denied. But you can appeal, and I can help."
- If unsure: "That's okay! We'll work with what you know."
`;

// =============================================================================
// ONBOARDING SKILL - Get name and ZIP first
// =============================================================================

const ONBOARDING_SKILL = `
## Onboarding Flow (MANDATORY)

### Step 1: Get Their Name
If the user has NOT provided their name yet:
"Hi there! I'm here to help with Medicare coverage questions. How should I address you?"

[SUGGESTIONS]
Just call me...
Skip this
[/SUGGESTIONS]

When they give their name, be warm:
"Great to meet you, [Name]!"

### Step 2: Get Their ZIP
After getting the name, ask for ZIP:
"To help find doctors in your area later, what's your ZIP code, [Name]?"

[SUGGESTIONS]
[5-digit ZIP]
I'll share later
[/SUGGESTIONS]

When they give ZIP:
"Perfect, got it — [ZIP]. Now, how can I help you today, [Name]?"

### Step 3: What Do They Need?
Now ask what they need help with:
"So [Name], what can I help you with? Are you trying to get something approved, or did something get denied?"

[SUGGESTIONS]
Get something approved
Something was denied
[/SUGGESTIONS]

### Why This Matters
- Knowing their NAME makes it personal (Medicare patients are often stressed)
- Knowing their ZIP lets us search for doctors in their area
- Building rapport FIRST before diving into their problem
`;

// =============================================================================
// SYMPTOM SKILL - Gather symptoms
// =============================================================================

const SYMPTOM_SKILL = `
## Symptom Intake

### MANDATORY: Gather These (One at a Time!)
1. **What's the problem?** — "What's going on with your [body part]?"
2. **Duration** — "How long has this been going on?"
3. **Severity** — "How bad is it — does it affect daily activities?"
4. **Prior treatments** — "Has she tried any treatments — PT, medication, injections?"

### Ask ONE Question, Then Wait
Don't stack questions. Ask one, acknowledge the answer, then ask the next.

### Empathy First
ALWAYS empathize before asking the next question:
"Three months of back pain — that's really tough to deal with. Has she tried any treatments?"

### Red Flags
If symptoms suggest emergency (chest pain + shortness of breath, sudden severe headache, sudden numbness):
"If this is happening RIGHT NOW, please call 911. Once you're safe, I can help with coverage questions."

### Tool Usage
After gathering symptoms, call search_icd10 internally. NEVER show codes to user.
`;

// =============================================================================
// PROCEDURE SKILL - Identify the procedure
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
After clarifying, call search_cpt internally. NEVER show codes to user.
Then call get_coverage_requirements with the procedure and diagnosis.
`;

// =============================================================================
// PROVIDER SKILL - NPI lookup flow (from mockups/README.md)
// =============================================================================

const PROVIDER_SKILL = `
## Provider Lookup (MANDATORY Flow from mockups)

### Step 1: Ask for Doctor Name
"Do you have your doctor's name? I can check if they're in the Medicare network."

[SUGGESTIONS]
Yes, I'll tell you
I don't have one yet
[/SUGGESTIONS]

### Step 2: Get the Name
When they say yes: "What's the doctor's name?"

### Step 3: Search NPI Using Their ZIP
You should already have their ZIP from onboarding. Call:
search_npi({ name: "[Doctor Name]", postal_code: "[User's ZIP]" })

### Step 4: Show Results as Options
"I found a few doctors matching that name near [ZIP]:

1. **Dr. Sarah Chen, MD** — Orthopedic Surgery, Palo Alto
2. **Dr. Sarah Chen, DO** — Family Medicine, San Jose

Which one is your doctor?"

[SUGGESTIONS]
The first one
The second one
[/SUGGESTIONS]

### Step 5: Confirm and Validate
After they select:
"Perfect — Dr. Sarah Chen, orthopedic surgeon. She's a great match for ordering a back MRI. Let me check what Medicare needs..."

### If No Matches
"I couldn't find Dr. [Name] near [ZIP]. Could you check:
- Is the spelling right?
- Maybe a nearby city?"

[SUGGESTIONS]
Let me spell it again
Try a different ZIP
[/SUGGESTIONS]

### CRITICAL: If User Provides a Different Name
If the user responds with a DIFFERENT doctor name (not just a spelling correction), you MUST:
1. Recognize it as a NEW search request
2. Call search_npi AGAIN with the new name and their ZIP
3. Show the new results

Example:
- You searched "madan sharma" → no results
- User says "alex joseph" → This is a NEW name, search again!
- Call search_npi({ name: "alex joseph", postal_code: "90036" })

DO NOT skip the search and move on to other topics. Always search when given a new doctor name.

### 3-Attempt Limit (IMPORTANT)
After 3 failed search attempts, gently nudge the user to continue without a confirmed doctor:

"I've tried a few searches but couldn't find a match. No worries — we can still help you!

Let's continue with the coverage guidance. You can always add your doctor's information later, or bring this checklist to any Medicare-participating provider."

[SUGGESTIONS]
Continue without doctor
Try one more name
[/SUGGESTIONS]

Count each search_npi call as one attempt. After 3 attempts with no confirmed provider, offer to move forward.

### If No Doctor Yet
"That's okay! We can continue without a doctor for now and add them later."

### Tool Usage
1. search_npi({ name, postal_code }) — Find matching providers
2. Store confirmed provider in session: name, NPI, specialty
3. If search fails and user provides new name → search again with new name
4. After 3 failed attempts → offer to continue without doctor
3. Check if specialty matches the procedure
`;

// =============================================================================
// COVERAGE SKILL - Check Medicare rules
// =============================================================================

const COVERAGE_SKILL = `
## Coverage Check

### MANDATORY: Call Tools
You MUST call these tools — do NOT use general knowledge:
1. get_coverage_requirements(procedure, diagnosis) — Gets REAL NCD/LCD requirements
2. search_ncd(query) — National Coverage Determinations
3. search_lcd(query, state) — Local Coverage Determinations

### Process
1. Call get_coverage_requirements with procedure and diagnosis
2. Extract documentation_requirements from results
3. Note the policy IDs (NCD or LCD numbers)
4. Translate requirements to plain English

### IMPORTANT
The checklist MUST come from tool results, NOT from general knowledge.
If tools return no results, say: "I couldn't find a specific policy for this. Let me search more broadly..."
`;

// =============================================================================
// GUIDANCE SKILL - Generate checklist
// =============================================================================

const GUIDANCE_SKILL = `
## Guidance Generation

### Only Generate After Having:
1. Symptoms and duration gathered
2. Procedure clarified
3. Coverage tools called with REAL results

### Output Format

"Great news, [Name] — Medicare typically covers [procedure] for your mom's situation!

**What the doctor needs to document:**
[ ] [Requirement 1 — in plain English]
[ ] [Requirement 2 — in plain English]
[ ] [Requirement 3 — in plain English]

**What to say at the appointment:**
- '[Specific talking point]'
- 'Can you make sure to document all of this for Medicare?'

**Policy reference:** [LCD/NCD ID]

Want me to print this checklist or email it to you?"

[SUGGESTIONS]
Print checklist
Email it to me
[/SUGGESTIONS]

### Translation Table
| Technical Requirement | Plain English |
|----------------------|---------------|
| Duration >6 weeks | Pain has lasted more than 6 weeks |
| Failed conservative management | She's tried PT, medication, or exercises first |
| Neurological deficit | Numbness, tingling, or weakness |
| Functional limitation | How the pain affects daily activities |

### Personalize With Their Details
- "Your 3 months of back pain qualifies"
- "Since she's tried physical therapy already"
- "The leg tingling you mentioned is important"
`;

// =============================================================================
// PROMPTING SKILL - Suggestions
// =============================================================================

const PROMPTING_SKILL = `
## Suggestions

### CRITICAL: Suggestions Are ANSWERS to Your Question
Suggestions = what the USER would click to answer YOUR question.

Format (at END of response):
[SUGGESTIONS]
Answer option 1
Answer option 2
[/SUGGESTIONS]

### Rules
- Suggestions answer YOUR question (not what you'll do)
- Max 2 options
- Short (under 25 chars)
- Natural language

### Examples

**"How should I address you?"**
[SUGGESTIONS]
Just call me...
Skip this
[/SUGGESTIONS]

**"What's your ZIP code?"**
[SUGGESTIONS]
Let me type it
I'll share later
[/SUGGESTIONS]

**"How long has she had this?"**
[SUGGESTIONS]
A few weeks
Several months
[/SUGGESTIONS]

**"Has she tried any treatments?"**
[SUGGESTIONS]
Yes, PT and meds
Not yet
[/SUGGESTIONS]

**"Which Dr. Smith is it?"**
[SUGGESTIONS]
The first one
The second one
[/SUGGESTIONS]

**After checklist:**
[SUGGESTIONS]
Print checklist
Email it to me
[/SUGGESTIONS]

### NEVER Do This
- Generic: "Continue" / "Learn more"
- Actions: "Check coverage" (that's what YOU do)
- Too long: "I would like to proceed with checking the coverage"
`;

// =============================================================================
// REQUIREMENT VERIFICATION SKILL - Denial prevention through qualification
// =============================================================================

const REQUIREMENT_VERIFICATION_SKILL = `
## Requirement Verification (CRITICAL for Denial Prevention)

### Why This Matters
Before showing the checklist, you MUST verify the user meets key requirements.
Many denials happen because the patient doesn't meet basic criteria — verifying upfront prevents wasted effort.

### MANDATORY: Ask Verification Questions BEFORE Checklist

When you get coverage requirements from tools, look for criteria like:
- Duration requirements (e.g., "symptoms for 6+ weeks")
- Prior treatment requirements (e.g., "failed conservative treatment")
- Severity requirements (e.g., "functional limitation")
- Referral requirements (e.g., "specialist evaluation")

### Flow: One Question at a Time

**Step 1: Convert requirement to plain English question**
| Technical Requirement | Ask This |
|-----------------------|----------|
| Duration > 6 weeks | "Has she had these symptoms for at least 6 weeks?" |
| Failed conservative treatment | "Has she already tried physical therapy or medication without getting better?" |
| Neurological symptoms | "Does she have any numbness, tingling, or weakness in her legs?" |
| Functional limitation | "Does the pain affect her daily activities — like walking, sleeping, or working?" |
| X-ray first | "Has she had an X-ray of her back already?" |

**Step 2: Ask ONE question and wait**
"Before I show you what the doctor needs to document, let me ask — has she had these symptoms for at least 6 weeks?"

[SUGGESTIONS]
Yes, more than 6 weeks
No, less than that
[/SUGGESTIONS]

**Step 3: If YES → Continue to next requirement or checklist**
"Great, that's an important one. Now, has she tried any treatments like physical therapy or pain medication?"

**Step 4: If NO → Explain what's needed first**
"Oh, I see. Medicare typically wants to see that symptoms have lasted at least 6 weeks before approving an MRI.

Here's what I'd suggest:
1. Keep track of when the symptoms started
2. Try some conservative treatments (your doctor can recommend these)
3. Come back in a few weeks and I can help with the approval process then

Would you like me to explain what treatments might help in the meantime?"

[SUGGESTIONS]
Tell me about treatments
Start a new question
[/SUGGESTIONS]

### If ALL Requirements Met → Show Checklist
"Great news! Based on what you've told me, your mom should qualify for Medicare coverage. Here's what the doctor needs to document..."

### Keep Track in Your Response
After each answer, mentally note:
- Requirements verified: ✓ Duration ✓ Prior treatment
- Remaining: Neurological symptoms

### Example Full Flow

User asks about MRI for back pain.
You call get_coverage_requirements, which returns:
- Duration > 6 weeks
- Failed conservative treatment
- Functional limitation documented

**You say:**
"Before I create the checklist, let me make sure she qualifies. Has she had this back pain for at least 6 weeks?"

**User says:** "Yes, about 3 months"

**You say:**
"Three months — that definitely qualifies. And has she tried any treatments like PT, medication, or exercises that didn't fully help?"

**User says:** "She tried some exercises but they didn't work"

**You say:**
"Okay, good to know. Last question — does the pain affect her daily activities, like walking, sleeping, or doing things around the house?"

**User says:** "Yes, she can barely walk some days"

**You say:**
"That's all I needed. Great news — based on what you've told me, your mom should qualify for Medicare coverage!

**What the doctor needs to document:**
[ ] Pain for 3+ months (you said about 3 months)
[ ] Tried exercises without improvement
[ ] Significant impact on daily activities (difficulty walking)
..."
`;

// =============================================================================
// SPECIALTY VALIDATION SKILL
// =============================================================================

const SPECIALTY_VALIDATION_SKILL = `
## Specialty Validation (Denial Prevention)

### After Confirming Provider
When you confirm a provider from NPI search, check if their specialty matches the procedure.

### Specialty Mismatch Warning
If the provider's specialty doesn't typically order the procedure, warn the user:

"I noticed Dr. Chen is a Family Medicine doctor. While she can order an MRI, Medicare sometimes questions orders from providers outside the typical specialty.

For a lumbar MRI, orders are usually from:
- Orthopedic surgeons
- Neurologists
- Pain management specialists
- Physical medicine doctors

This doesn't mean it won't be approved, but you might want to:
1. Ask Dr. Chen if she can provide a strong medical necessity statement
2. Get a referral to a specialist who can also order the MRI

Would you like me to continue with the checklist, or would you prefer to find a specialist in your area?"

[SUGGESTIONS]
Continue with checklist
Find a specialist
[/SUGGESTIONS]

### When Specialty DOES Match
"Dr. Chen is an orthopedic surgeon — that's perfect for ordering a lumbar MRI. Let me check what Medicare needs..."

### Important
- Don't alarm the user unnecessarily
- Primary care CAN order most imaging — just may need stronger documentation
- The goal is to INFORM, not scare
`;

// =============================================================================
// SKILL TRIGGERS
// =============================================================================
// SPECIALTY MATCH HELPER
// =============================================================================

/**
 * Check if provider specialty matches the procedure being ordered.
 * Returns validation result with warning if mismatch detected.
 */
export function checkProviderSpecialtyMatch(
  sessionState?: SessionState
): SpecialtyMatchResult | null {
  // Need both a confirmed provider with specialty AND a procedure to validate
  if (!sessionState?.provider?.specialty || !sessionState?.procedureNeeded) {
    return null;
  }

  const result = validateSpecialtyMatch(
    sessionState.procedureNeeded,
    sessionState.provider.specialty
  );

  return result;
}

/**
 * Get recommended specialties for the current procedure.
 * Used to suggest alternatives when there's a mismatch.
 */
export function getRecommendedSpecialtiesForProcedure(
  sessionState?: SessionState
): string[] {
  if (!sessionState?.procedureNeeded) {
    return [];
  }
  return getRecommendedSpecialties(sessionState.procedureNeeded);
}

// =============================================================================
// SKILL TRIGGERS
// =============================================================================

export interface SkillTriggers {
  hasUserName: boolean;
  hasUserZip: boolean;
  hasProblem: boolean;
  hasSymptoms: boolean;
  hasDuration: boolean;
  hasPriorTreatments: boolean;
  hasProcedure: boolean;
  hasProviderName: boolean;
  hasProviderConfirmed: boolean;
  providerSearchLimitReached: boolean;
  hasDiagnosis: boolean;
  hasCoverage: boolean;
  hasGuidance: boolean;
  isAppeal: boolean;
  needsClarification: boolean;
  // Requirement verification (denial prevention)
  hasRequirementsToVerify: boolean;
  verificationComplete: boolean;
  meetsAllRequirements: boolean;
  // Specialty validation
  hasSpecialtyMismatch: boolean;
}

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

    // Provider
    hasProviderName:
      sessionState?.providerName != null ||
      /dr\.|doctor|physician|specialist|provider|surgeon/.test(allContent),
    hasProviderConfirmed:
      sessionState?.provider != null && sessionState.provider.npi != null,
    providerSearchLimitReached:
      (sessionState?.providerSearchAttempts ?? 0) >= 3,

    // Coverage
    hasDiagnosis:
      (sessionState?.diagnosisCodes?.length ?? 0) > 0,
    hasCoverage:
      (sessionState?.coverageCriteria?.length ?? 0) > 0,
    hasGuidance:
      sessionState?.guidanceGenerated || false,

    // Appeal
    isAppeal:
      sessionState?.isAppeal ||
      /denied|denial|appeal|reject|refuse/.test(allContent),

    // Clarification
    needsClarification: /which|what kind|what type|clarify/.test(allContent),

    // Requirement verification (denial prevention)
    hasRequirementsToVerify:
      (sessionState?.requirementsToVerify?.length ?? 0) > 0,
    verificationComplete:
      sessionState?.verificationComplete || false,
    meetsAllRequirements:
      sessionState?.meetsAllRequirements === true,

    // Specialty validation - check programmatically using specialty-match utility
    hasSpecialtyMismatch: (() => {
      const matchResult = checkProviderSpecialtyMatch(sessionState);
      return matchResult !== null && !matchResult.isMatch;
    })(),
  };
}

// =============================================================================
// BUILD SYSTEM PROMPT
// =============================================================================

export function buildSystemPrompt(
  triggers: SkillTriggers,
  sessionState?: SessionState
): string {
  const sections: string[] = [MASTER_SKILL, CONVERSATION_SKILL];

  // Always include onboarding at the start
  if (!triggers.hasUserName || !triggers.hasUserZip) {
    sections.push(ONBOARDING_SKILL);
  }

  // Add symptom skill if gathering symptoms
  if (triggers.hasProblem && (!triggers.hasDuration || !triggers.hasPriorTreatments)) {
    sections.push(SYMPTOM_SKILL);
  }

  // Add procedure skill if procedure mentioned or needs clarification
  if (triggers.hasProcedure || triggers.needsClarification) {
    sections.push(PROCEDURE_SKILL);
  }

  // Add provider skill if we have their ZIP but no confirmed provider
  if (triggers.hasUserZip && !triggers.hasProviderConfirmed) {
    sections.push(PROVIDER_SKILL);
  }

  // Add coverage skill when ready
  if (triggers.hasProcedure && triggers.hasDuration) {
    sections.push(COVERAGE_SKILL);
  }

  // Add requirement verification skill after coverage is checked but before showing guidance
  // This ensures we verify requirements BEFORE showing the checklist
  if (triggers.hasCoverage && !triggers.verificationComplete) {
    sections.push(REQUIREMENT_VERIFICATION_SKILL);
  }

  // Add specialty validation skill if there's a mismatch
  if (triggers.hasSpecialtyMismatch) {
    sections.push(SPECIALTY_VALIDATION_SKILL);
  }

  // Add guidance skill when coverage checked AND verification complete (or no requirements to verify)
  if ((triggers.hasCoverage && triggers.verificationComplete) ||
      (triggers.hasCoverage && !triggers.hasRequirementsToVerify) ||
      triggers.hasGuidance) {
    sections.push(GUIDANCE_SKILL);
  }

  // Always add prompting skill
  sections.push(PROMPTING_SKILL);

  // Add session context
  if (sessionState) {
    sections.push(buildSessionContext(sessionState));
  }

  // Add flow state reminder
  sections.push(buildFlowStateReminder(triggers, sessionState));

  return sections.join("\n\n---\n\n");
}

// =============================================================================
// SESSION CONTEXT
// =============================================================================

function buildSessionContext(state: SessionState): string {
  const context: string[] = ["## Current Session State"];

  // Onboarding info
  if (state.userName) {
    context.push(`**User's name:** ${state.userName} (USE THIS in your responses!)`);
  }
  if (state.userZip) {
    context.push(`**User's ZIP:** ${state.userZip} (USE THIS for NPI searches!)`);
  }

  // Symptoms
  if (state.symptoms && state.symptoms.length > 0) {
    context.push(`**Symptoms gathered:** ${state.symptoms.join(", ")}`);
  }
  if (state.duration) {
    context.push(`**Duration:** ${state.duration}`);
  }
  if (state.priorTreatments && state.priorTreatments.length > 0) {
    context.push(`**Prior treatments:** ${state.priorTreatments.join(", ")}`);
  }

  // Procedure
  if (state.procedureNeeded) {
    context.push(`**Procedure identified:** ${state.procedureNeeded}`);
  }

  // Provider
  if (state.providerName) {
    context.push(`**Doctor name mentioned:** ${state.providerName}`);
  }
  if (state.providerSearchAttempts > 0) {
    context.push(`**Provider search attempts:** ${state.providerSearchAttempts}/3${state.providerSearchAttempts >= 3 ? " (LIMIT REACHED - offer to continue without doctor)" : ""}`);
  }
  if (state.provider) {
    context.push(`**Provider confirmed:** ${state.provider.name || "Not yet"}`);
    if (state.provider.npi) {
      context.push(`  - NPI: ${state.provider.npi}`);
      context.push(`  - Specialty: ${state.provider.specialty || "Unknown"}`);
      context.push(`  - Medicare: ${state.provider.acceptsMedicare ? "Yes" : "Unknown"}`);
    }
  }

  // Internal codes (don't show to user)
  if (state.diagnosisCodes && state.diagnosisCodes.length > 0) {
    context.push(`**[Internal] Diagnosis codes:** ${state.diagnosisCodes.join(", ")}`);
  }
  if (state.procedureCodes && state.procedureCodes.length > 0) {
    context.push(`**[Internal] Procedure codes:** ${state.procedureCodes.join(", ")}`);
  }

  // Coverage
  if (state.coverageCriteria && state.coverageCriteria.length > 0) {
    context.push(`**Coverage criteria found:** Yes`);
  }
  if (state.guidanceGenerated) {
    context.push(`**Guidance generated:** Yes`);
  }
  if (state.isAppeal) {
    context.push(`**Mode:** Appeal assistance`);
  }

  // Requirement verification (denial prevention)
  if (state.requirementsToVerify && state.requirementsToVerify.length > 0) {
    context.push(`**Requirements to verify:** ${state.requirementsToVerify.length} items`);
    state.requirementsToVerify.forEach((req, i) => {
      const answered = state.requirementAnswers?.[req];
      const status = answered === undefined ? "❓ Pending" : answered ? "✅ Met" : "❌ Not met";
      context.push(`  ${i + 1}. ${req} — ${status}`);
    });
  }
  if (state.verificationComplete) {
    context.push(`**Verification complete:** Yes`);
    context.push(`**Meets all requirements:** ${state.meetsAllRequirements ? "Yes" : "No"}`);
  }

  // Specialty validation - check programmatically using specialty-match utility
  const specialtyMatchResult = checkProviderSpecialtyMatch(state);
  if (specialtyMatchResult && !specialtyMatchResult.isMatch) {
    context.push(`**⚠️ Specialty mismatch detected:**`);
    context.push(`  - Provider specialty: ${specialtyMatchResult.providerSpecialty}`);
    context.push(`  - Procedure: ${specialtyMatchResult.procedure}`);
    context.push(`  - Warning: ${specialtyMatchResult.warning}`);
    if (specialtyMatchResult.recommendation) {
      context.push(`  - Recommendation: ${specialtyMatchResult.recommendation}`);
    }
  } else if (state.specialtyMismatchWarning) {
    // Fallback to session state warning if set manually
    context.push(`**Specialty warning:** ${state.specialtyMismatchWarning}`);
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

  // Step 1: Get name
  if (!triggers.hasUserName) {
    reminder.push("**YOU ARE AT:** Step 1 - Get user's name");
    reminder.push("**ASK:** 'Hi there! I'm here to help with Medicare coverage. How should I address you?'");
    reminder.push("**SUGGESTIONS:** 'Just call me...' / 'Skip this'");
    return reminder.join("\n");
  }

  // Step 2: Get ZIP
  if (!triggers.hasUserZip) {
    reminder.push(`**YOU ARE AT:** Step 2 - Get user's ZIP code`);
    reminder.push(`**ASK:** 'Great to meet you, ${userName}! To help find doctors in your area, what's your ZIP code?'`);
    reminder.push("**SUGGESTIONS:** Two common options or 'I'll share later'");
    return reminder.join("\n");
  }

  // Step 3: Get problem
  if (!triggers.hasProblem) {
    reminder.push(`**YOU ARE AT:** Step 3 - Find out what they need`);
    reminder.push(`**ASK:** 'Perfect! So ${userName}, how can I help you today?'`);
    reminder.push("**SUGGESTIONS:** 'Get something approved' / 'Something was denied'");
    return reminder.join("\n");
  }

  // Step 4: Gather symptoms (duration, prior treatments)
  if (triggers.hasProcedure && !triggers.hasDuration) {
    reminder.push(`**YOU ARE AT:** Step 4a - Get duration`);
    reminder.push(`**ASK:** 'How long has [the problem] been going on, ${userName}?'`);
    reminder.push("**SUGGESTIONS:** 'A few weeks' / 'Several months'");
    return reminder.join("\n");
  }

  if (triggers.hasDuration && !triggers.hasPriorTreatments) {
    reminder.push(`**YOU ARE AT:** Step 4b - Get prior treatments`);
    reminder.push("**ACKNOWLEDGE their duration first!**");
    reminder.push("**ASK:** 'Has she tried any treatments — physical therapy, medication, or injections?'");
    reminder.push("**SUGGESTIONS:** 'Yes, tried some' / 'Not yet'");
    return reminder.join("\n");
  }

  // Step 5: Get doctor name
  if (!triggers.hasProviderName && triggers.hasPriorTreatments) {
    reminder.push(`**YOU ARE AT:** Step 5 - Get doctor's name`);
    reminder.push(`**ASK:** 'Do you have your doctor's name, ${userName}? I can check if they're in the Medicare network.'`);
    reminder.push("**SUGGESTIONS:** 'Yes, I'll tell you' / 'I don't have one yet'");
    return reminder.join("\n");
  }

  // Step 6: Search NPI (have name but not confirmed)
  if (triggers.hasProviderName && !triggers.hasProviderConfirmed) {
    reminder.push(`**YOU ARE AT:** Step 6 - Search NPI registry`);
    reminder.push(`**ACTION:** Call search_npi with doctor name + ZIP code (${userZip})`);
    reminder.push("**THEN:** Show matching doctors as numbered options");
    reminder.push("**SUGGESTIONS:** 'The first one' / 'The second one' / etc.");
    return reminder.join("\n");
  }

  // Step 7: Check coverage
  if (!triggers.hasCoverage && triggers.hasProcedure && triggers.hasDuration) {
    reminder.push(`**YOU ARE AT:** Step 7 - Check Medicare coverage`);
    reminder.push("**ACTION:** Call get_coverage_requirements(procedure, diagnosis)");
    reminder.push("**THEN:** Parse the documentation_requirements from results");
    reminder.push("**DO NOT** make up requirements — use ONLY tool results");
    return reminder.join("\n");
  }

  // Step 7.5: Verify requirements BEFORE showing checklist
  if (triggers.hasCoverage && triggers.hasRequirementsToVerify && !triggers.verificationComplete) {
    reminder.push(`**YOU ARE AT:** Step 7.5 - Verify requirements (DENIAL PREVENTION)`);
    reminder.push("**CRITICAL:** Ask verification questions BEFORE showing checklist");
    reminder.push("**ASK ONE AT A TIME:** Convert each requirement to a yes/no question");
    reminder.push("**EXAMPLE:** 'Has she had these symptoms for at least 6 weeks?'");
    reminder.push("**IF NO:** Explain what's needed first before they can proceed");
    reminder.push("**SUGGESTIONS:** 'Yes, [positive answer]' / 'No, [negative answer]'");
    return reminder.join("\n");
  }

  // Step 7.6: Handle specialty mismatch warning
  if (triggers.hasSpecialtyMismatch) {
    reminder.push(`**YOU ARE AT:** Step 7.6 - Specialty mismatch warning`);
    reminder.push("**ACTION:** Warn user that provider specialty may not match procedure");
    reminder.push("**EXPLAIN:** This doesn't mean denial, but may need stronger documentation");
    reminder.push("**OFFER:** Continue with checklist OR find a specialist");
    reminder.push("**SUGGESTIONS:** 'Continue anyway' / 'Find a specialist'");
    return reminder.join("\n");
  }

  // Step 8: Generate guidance (only after verification complete or no requirements)
  if (triggers.hasCoverage && (triggers.verificationComplete || !triggers.hasRequirementsToVerify) && !triggers.hasGuidance) {
    if (triggers.meetsAllRequirements === false) {
      reminder.push(`**YOU ARE AT:** Step 8 - Requirements not met`);
      reminder.push("**ACTION:** Explain what the user needs to do first");
      reminder.push("**BE HELPFUL:** Suggest treatments or waiting period");
      reminder.push("**OFFER:** Help with something else or revisit later");
      reminder.push("**SUGGESTIONS:** 'Tell me about treatments' / 'New question'");
      return reminder.join("\n");
    }

    reminder.push(`**YOU ARE AT:** Step 8 - Generate guidance checklist`);
    reminder.push("**ACTION:** Create checklist FROM coverage tool results");
    reminder.push("**INCLUDE:** Policy citations (LCD/NCD IDs)");
    reminder.push(`**PERSONALIZE:** Use ${userName}'s specific details and verified answers`);
    reminder.push("**SUGGESTIONS:** 'Print checklist' / 'Email it to me'");
    return reminder.join("\n");
  }

  // Complete
  reminder.push(`**YOU ARE AT:** Done - Guidance complete`);
  reminder.push("**OFFER:** Print, email, or new question");
  reminder.push("**SUGGESTIONS:** 'Print checklist' / 'New question'");
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
    hasProviderName: false,
    hasProviderConfirmed: false,
    providerSearchLimitReached: false,
    hasDiagnosis: false,
    hasCoverage: false,
    hasGuidance: false,
    isAppeal: false,
    needsClarification: false,
    // Requirement verification
    hasRequirementsToVerify: false,
    verificationComplete: false,
    meetsAllRequirements: false,
    // Specialty validation
    hasSpecialtyMismatch: false,
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
