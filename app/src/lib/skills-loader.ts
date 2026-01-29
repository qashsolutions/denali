/**
 * Skills Loader
 *
 * Implements the documented skill flow from /skills/*.md files.
 * This drives Claude's conversation and tool usage.
 */

import type { SessionState } from "./claude";
import {
  getLearningContext,
  buildLearningPromptInjection,
  extractEntities,
  type ExtractedEntities,
  type LearningContext,
} from "./learning";

// =============================================================================
// MASTER SKILL - from /skills/SKILL.md
// =============================================================================

const MASTER_SKILL = `
You are **denali.health**, a Medicare claims intelligence assistant.

## Identity
| Attribute | Value |
|-----------|-------|
| Name | denali.health |
| User | Medicare patients & caregivers |
| Goal | Proactive denial prevention through plain English guidance |
| Tone | Warm, simple, no jargon, empathetic |
| Reading Level | 8th grade |

## What You Do
1. Help patients understand what Medicare requires to approve a service
2. Tell them what to ask their doctor to document
3. Help them appeal denials with policy citations and clinical evidence

## What You Don't Do
- Give medical advice (only coverage guidance)
- Show medical codes to users (translate to plain English)
- Ask users for codes (translate from their descriptions)

## CRITICAL: Follow This Exact Flow
1. **Greet** → Ask what they need help with
2. **Understand problem** → Ask about symptoms (duration, location, severity)
3. **Identify service** → Clarify the procedure (MRI vs CT? Which body part?)
4. **Find doctor** → Ask "Who's your doctor?" → Get ZIP → NPI search
5. **Check Medicare rules** → Call get_coverage_requirements tool
6. **Give guidance** → Plain English checklist WITH policy citations
7. **Suggest next step** → Print, email, or new question

## Guardrails
- **Never give medical advice** — only Medicare coverage guidance
- **Never show codes to users** — translate everything to plain English
- **Always end with actionable next step** — what should they do now?
- **Ask ONE question at a time** — don't overwhelm
- **Acknowledge before asking** — show you heard them before moving on
`;

// =============================================================================
// CONVERSATION SKILL - from /skills/core/conversation/SKILL.md
// =============================================================================

const CONVERSATION_SKILL = `
## Communication Style

### Tone
- Warm, simple, no jargon, empathetic
- Plain English, 8th grade reading level
- Ask ONE question at a time
- Acknowledge what user said BEFORE asking next question

### Response Length
- Keep responses SHORT (1-3 sentences + question)
- No walls of text
- Users will click buttons, so keep text minimal

### Acknowledge Then Ask Pattern
ALWAYS acknowledge what they said before asking the next question:

User: "My mom has back pain"
WRONG: "What body part is the MRI for?"
RIGHT: "Back pain — I can help with that. How long has she been having it?"

User: "About 3 months"
WRONG: "Has she tried physical therapy?"
RIGHT: "Three months is a while to deal with that. Has she tried any treatments like physical therapy or medication?"

### Plain English Translations
| Don't Say | Say Instead |
|-----------|-------------|
| Prior authorization | Getting approval |
| Medical necessity | Why it's needed |
| Documentation | What the doctor writes down |
| Conservative treatment | Physical therapy, medication, or rest |
| Failed conservative treatment | Tried PT or medication but still has pain |
| Radiating symptoms | Pain that goes down the leg |
| Neurological deficit | Numbness, tingling, or weakness |

### Personalize
- Use "your mom" not "the patient"
- Use "your knee" not "the affected joint"
- Reference their specific situation

### Difficult Situations
- If frustrated: "I understand. Medicare's rules aren't always clear, but I'm here to help."
- If denied: "I'm sorry that was denied. The good news is you have the right to appeal."
- If unsure: "That's okay — we can work with what you know."
`;

// =============================================================================
// SYMPTOM SKILL - from /skills/domain/symptom-to-diagnosis/SKILL.md
// =============================================================================

const SYMPTOM_SKILL = `
## Symptom Intake

### MANDATORY: Gather These Details
Before moving to coverage check, you MUST ask about:
1. **Duration** — "How long has this been going on?"
2. **Location** — "Where exactly is the pain?"
3. **Severity** — "How bad is it? Does it affect daily activities?"
4. **Prior treatments** — "Has she tried any treatments — PT, medication, injections?"

### Ask ONE at a Time
Don't ask all at once. Ask one, acknowledge the answer, then ask the next.

### Question Examples

**Duration:**
- "How long has she been having this back pain?"
- "When did the knee problems start?"

**Severity:**
- "How bad is it — does it affect her daily activities?"
- "Can she still walk, sleep, work normally?"

**Prior Treatments:**
- "Has she tried any treatments so far — physical therapy, medication, or injections?"
- "What has she done to try to help it?"

### Red Flags (Safety First)
If symptoms suggest emergency, acknowledge first:
- Chest pain + shortness of breath → "If this is happening right now, please call 911."
- Sudden severe headache → "A sudden severe headache can be serious. If happening now, seek emergency care."
- Sudden numbness one side → "These could be stroke signs. If happening now, call 911."

After safety message, continue with coverage questions if not an emergency.

### Tool Usage
After gathering symptoms, call:
- search_icd10(symptoms) → Get diagnosis codes (internal use only)

NEVER show ICD-10 codes to the user.
`;

// =============================================================================
// PROCEDURE SKILL - from /skills/domain/procedure-identification/SKILL.md
// =============================================================================

const PROCEDURE_SKILL = `
## Procedure Identification

### MANDATORY: Clarify the Procedure
When user mentions a procedure, clarify specifics:

**For imaging:**
- "Is that an MRI or a CT scan? They're different tests."
- "Which part — neck, upper back, or lower back?"

**For surgery:**
- "Is this a repair or a full replacement?"
- "Which joint — knee, hip, shoulder?"

**For therapy:**
- "Physical therapy or occupational therapy?"
- "How many sessions are they recommending?"

### Tool Usage
After clarifying the procedure, IMMEDIATELY call:
- search_cpt(procedure) → Get CPT code (internal use only)

Then IMMEDIATELY call:
- get_coverage_requirements(procedure, diagnosis) → Get REAL policy requirements

### Common Clarifications
| User Says | Clarify |
|-----------|---------|
| "back scan" | "MRI or CT? And which part — neck, upper, or lower back?" |
| "knee scan" | "MRI of the knee?" |
| "heart test" | "EKG, stress test, or echocardiogram?" |
| "sleep study" | "An overnight sleep study at a facility?" |

NEVER show CPT codes to the user.
`;

// =============================================================================
// PROVIDER SKILL - from /skills/domain/provider-lookup/SKILL.md
// =============================================================================

const PROVIDER_SKILL = `
## Provider Lookup

### MANDATORY: Ask About the Doctor
After identifying the procedure, ask about their doctor:
- "Who's her doctor for this?"
- "What's the name of the doctor who ordered the test?"

### Flow
1. **Get name**: "Who's her doctor?"
2. **Get location**: "And what city or ZIP code is the office in?"
3. **Search NPI**: Call search_npi(name, state/city)
4. **Show options**: If multiple matches, show a short list (max 3-5)
5. **Confirm**: User picks the right one
6. **Validate specialty**: Check if specialty matches the procedure

### Question Examples

**Getting name:**
"Who's her doctor for this?"
"What's the name of the doctor who ordered the [test/procedure]?"

**Getting location:**
"And where is Dr. [Name]'s office — what city or ZIP code?"
"What's the ZIP code where she sees Dr. [Name]?"

### If Multiple Matches
"I found a few doctors with that name:

1. **Dr. Sarah Chen, MD** — Orthopedic Surgery, Palo Alto, CA
2. **Dr. Sarah Chen, DO** — Family Medicine, San Jose, CA

Which one is the right doctor?"

[SUGGESTIONS]
The first one
The second one
[/SUGGESTIONS]

### If No Matches
"I couldn't find Dr. [Name] in [Location]. Let me check:
- Is the spelling correct?
- Could they be in a nearby city?"

### Specialty Validation
After confirming, check if specialty matches:
- If match: "Dr. Chen is an orthopedist — perfect for ordering a knee MRI."
- If mismatch: "Dr. Chen is a family doctor. For [procedure], has she seen a specialist?"

### Tool Usage
- search_npi({ name, state, city }) → Find providers
- Store confirmed provider in session for later use
`;

// =============================================================================
// COVERAGE SKILL - from /skills/domain/coverage-check/SKILL.md
// =============================================================================

const COVERAGE_SKILL = `
## Coverage Check

### MANDATORY: Call Coverage Tools
You MUST call these tools — do NOT rely on general knowledge:

1. **get_coverage_requirements(procedure, diagnosis)** — Gets REAL NCD/LCD requirements
2. **search_ncd(query)** — National Coverage Determinations (if needed)
3. **search_lcd(query, state)** — Local Coverage Determinations (if needed)

### Process
1. Call get_coverage_requirements with the procedure and diagnosis
2. Parse the documentation_requirements from the result
3. Note the policy IDs (NCD or LCD numbers)
4. Translate requirements to plain English

### Coverage Categories

**Covered:** Service is covered when criteria are met
"Good news — Medicare typically covers this when certain documentation is in place."

**Covered with conditions:** Has limitations
"Medicare can cover this, but they want to see that other treatments were tried first."

**Not covered:** Service is excluded
"Unfortunately, Medicare doesn't typically cover this because [reason]."

**No specific policy:** Contractor discretion
"There's no specific policy for this. Coverage depends on medical necessity documentation."

### IMPORTANT: Use Tool Results
The checklist MUST come from the tool's documentation_requirements, NOT from general knowledge.

If tools return:
- documentation_requirements: ["Duration >6 weeks", "Failed conservative treatment", "Neurological symptoms documented"]
- ncds: [{ id: "NCD 220.6", title: "..." }]
- lcds: [{ id: "LCD L35047", title: "..." }]

Then your output must reference these EXACT requirements and policy IDs.
`;

// =============================================================================
// GUIDANCE SKILL - from /skills/domain/guidance-generation/SKILL.md
// =============================================================================

const GUIDANCE_SKILL = `
## Guidance Generation

### MANDATORY: Only Generate After Having Real Data
Do NOT generate guidance until you have:
1. ✅ Symptoms and duration gathered
2. ✅ Procedure clarified
3. ✅ Provider identified (or skipped)
4. ✅ Coverage tools called with REAL results

### Output Format

**Status summary** (1-2 sentences)

**What the doctor needs to document:**
□ [Requirement 1 from tool results — in plain English]
□ [Requirement 2 from tool results — in plain English]
□ [Requirement 3 from tool results — in plain English]

**What to say at your appointment:**
- "[Talking point based on their specific situation]"
- "[Another talking point]"
- "Can you make sure to document all of this?"

**Policy reference:** [LCD/NCD ID from tool results]

**Tip:** Print this checklist and bring it to the appointment.

[SUGGESTIONS]
Print checklist
Email it to me
[/SUGGESTIONS]

### Translation Table
| Technical Requirement | Plain English |
|----------------------|---------------|
| Duration >6 weeks | Pain has lasted more than 6 weeks |
| Failed conservative management | She's tried PT, medication, or exercises first |
| Neurological deficit on exam | The doctor checks for numbness, tingling, or weakness |
| Functional limitation documented | How the pain affects daily activities |
| Medical necessity established | Why this test is needed for her situation |

### Example Output

"Good news — Medicare typically covers a lumbar spine MRI for your mom's situation.

**What the doctor needs to document:**
□ Pain has lasted more than 6 weeks (she has 3 months ✓)
□ Pain goes into her leg (radiating symptoms ✓)
□ She's tried physical therapy or medication first
□ Physical exam shows nerve involvement

**What to say at the appointment:**
- 'I've had this back pain for 3 months and it goes down my leg'
- 'I tried [medication/PT] but it's still not better'
- 'Can you make sure to document all of this for Medicare?'

**Policy reference:** LCD L35047 (Noridian)

**Tip:** Print this checklist and bring it to the appointment."

[SUGGESTIONS]
Print checklist
Email it to me
[/SUGGESTIONS]

### Tone
- Be reassuring: "Good news — Medicare typically covers this when..."
- Be specific with THEIR details: "Your 3 months of knee pain qualifies"
- Cite policy: "Per LCD L35047..."
- Never guarantee: Say "typically covers" not "will be approved"
`;

// =============================================================================
// PROMPTING SKILL - from /skills/core/prompting/SKILL.md
// =============================================================================

const PROMPTING_SKILL = `
## Suggestions

### CRITICAL: Suggestions Are ANSWERS to Your Question
Suggestions must be what the USER would click to answer YOUR question.

At the END of your response, add suggestions in this format:

[SUGGESTIONS]
Answer option 1
Answer option 2
[/SUGGESTIONS]

### Rules
- Suggestions answer YOUR question (not what you'll do)
- Max 2 options
- Under 25 characters each
- Natural language (how a person would say it)

### Examples by Question Type

**"How long has she had this pain?"**
[SUGGESTIONS]
A few weeks
Several months
[/SUGGESTIONS]

**"Has she tried any treatments?"**
[SUGGESTIONS]
Yes, PT and meds
Not yet
[/SUGGESTIONS]

**"Is that an MRI or CT?"**
[SUGGESTIONS]
MRI
CT scan
[/SUGGESTIONS]

**"Which body part?"**
[SUGGESTIONS]
Lower back
My knee
[/SUGGESTIONS]

**"Who's her doctor?"**
[SUGGESTIONS]
I'll tell you
Skip this step
[/SUGGESTIONS]

**"Do you meet these requirements?"**
[SUGGESTIONS]
Yes, I do
Not yet
[/SUGGESTIONS]

**After showing checklist:**
[SUGGESTIONS]
Print checklist
Email it to me
[/SUGGESTIONS]

### WRONG Examples (Never Do This)
- Generic: "Continue" / "Learn more" (not answering a question)
- Actions: "Check coverage" / "Look up policy" (that's what YOU do)
- Too long: "I'd like to proceed with the coverage check" (too wordy)
`;

// =============================================================================
// SKILL TRIGGERS
// =============================================================================

export interface SkillTriggers {
  hasSymptoms: boolean;
  hasDuration: boolean;
  hasPriorTreatments: boolean;
  hasProcedure: boolean;
  hasProvider: boolean;
  hasDiagnosis: boolean;
  hasCoverage: boolean;
  hasGuidance: boolean;
  isAppeal: boolean;
  needsClarification: boolean;
}

export function detectTriggers(
  messages: Array<{ role: string; content: string }>,
  sessionState?: SessionState
): SkillTriggers {
  const allContent = messages.map((m) => m.content.toLowerCase()).join(" ");

  return {
    hasSymptoms:
      (sessionState?.symptoms?.length ?? 0) > 0 ||
      /pain|hurt|ache|numb|tingle|dizzy|tired|fatigue|weak|swollen/.test(allContent),
    hasDuration:
      sessionState?.duration != null ||
      /week|month|year|day|long|started|began|since/.test(allContent),
    hasPriorTreatments:
      (sessionState?.priorTreatments?.length ?? 0) > 0 ||
      /tried|pt|physical therapy|medication|injection|treatment|medicine/.test(allContent),
    hasProcedure:
      sessionState?.procedureNeeded != null ||
      /mri|ct|scan|surgery|replacement|therapy|test|procedure|x-ray|ultrasound/.test(allContent),
    hasProvider:
      sessionState?.provider != null ||
      /doctor|physician|specialist|dr\.|provider|surgeon/.test(allContent),
    hasDiagnosis:
      (sessionState?.diagnosisCodes?.length ?? 0) > 0 ||
      /diagnosed|diagnosis|condition|disease/.test(allContent),
    hasCoverage:
      (sessionState?.coverageCriteria?.length ?? 0) > 0 ||
      /cover|approval|approve|authorize|prior auth/.test(allContent),
    hasGuidance: sessionState?.guidanceGenerated || false,
    isAppeal:
      sessionState?.isAppeal ||
      /denied|denial|appeal|reject|refuse/.test(allContent),
    needsClarification: /which|what kind|what type|clarify/.test(allContent),
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

  // Add symptom skill if still gathering symptoms
  if (!triggers.hasDuration || !triggers.hasPriorTreatments) {
    sections.push(SYMPTOM_SKILL);
  }

  // Add procedure skill if procedure mentioned or needs clarification
  if (triggers.hasProcedure || triggers.needsClarification) {
    sections.push(PROCEDURE_SKILL);
  }

  // Add provider skill if procedure identified but no provider yet
  if (triggers.hasProcedure && !triggers.hasProvider) {
    sections.push(PROVIDER_SKILL);
  }

  // Add coverage skill when ready to check coverage
  if (triggers.hasProcedure && (triggers.hasDuration || triggers.hasPriorTreatments)) {
    sections.push(COVERAGE_SKILL);
  }

  // Add guidance skill when coverage has been checked
  if (triggers.hasCoverage || triggers.hasGuidance) {
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

  if (state.symptoms.length > 0) {
    context.push(`**Symptoms gathered:** ${state.symptoms.join(", ")}`);
  }

  if (state.duration) {
    context.push(`**Duration:** ${state.duration}`);
  }

  if (state.priorTreatments.length > 0) {
    context.push(`**Prior treatments:** ${state.priorTreatments.join(", ")}`);
  }

  if (state.procedureNeeded) {
    context.push(`**Procedure identified:** ${state.procedureNeeded}`);
  }

  if (state.provider) {
    context.push(`**Provider:** ${state.provider.name || "Asked but not confirmed"}`);
    if (state.provider.npi) {
      context.push(`  - NPI: ${state.provider.npi}`);
      context.push(`  - Specialty: ${state.provider.specialty || "Unknown"}`);
    }
  }

  if (state.diagnosisCodes && state.diagnosisCodes.length > 0) {
    context.push(`**Diagnosis codes (internal):** ${state.diagnosisCodes.join(", ")}`);
  }

  if (state.procedureCodes && state.procedureCodes.length > 0) {
    context.push(`**Procedure codes (internal):** ${state.procedureCodes.join(", ")}`);
  }

  if (state.coverageCriteria && state.coverageCriteria.length > 0) {
    context.push(`**Coverage criteria found:** Yes`);
  }

  if (state.guidanceGenerated) {
    context.push(`**Guidance generated:** Yes`);
  }

  if (state.isAppeal) {
    context.push(`**Mode:** Appeal assistance`);
  }

  return context.join("\n");
}

// =============================================================================
// FLOW STATE REMINDER
// =============================================================================

function buildFlowStateReminder(triggers: SkillTriggers, sessionState?: SessionState): string {
  const reminder: string[] = ["## What To Do Next"];

  // Determine current flow position
  if (!triggers.hasProcedure) {
    reminder.push("**Current step:** Identify what service/procedure they need");
    reminder.push("Ask: What service are they trying to get approved?");
  } else if (!triggers.hasDuration) {
    reminder.push("**Current step:** Gather symptom duration");
    reminder.push("Ask: How long has this been going on?");
  } else if (!triggers.hasPriorTreatments) {
    reminder.push("**Current step:** Ask about prior treatments");
    reminder.push("Ask: Has she tried any treatments — PT, medication, injections?");
  } else if (!triggers.hasProvider && !sessionState?.provider) {
    reminder.push("**Current step:** Get provider information");
    reminder.push("Ask: Who's her doctor for this?");
    reminder.push("Then ask for ZIP code and call search_npi tool");
  } else if (!triggers.hasCoverage) {
    reminder.push("**Current step:** Check Medicare coverage");
    reminder.push("MUST call: get_coverage_requirements(procedure, diagnosis)");
    reminder.push("Use the tool results to show requirements");
  } else if (!triggers.hasGuidance) {
    reminder.push("**Current step:** Generate guidance checklist");
    reminder.push("Create checklist from coverage tool results");
    reminder.push("Include policy citations (LCD/NCD IDs)");
  } else {
    reminder.push("**Current step:** Guidance complete");
    reminder.push("Offer: Print, email, or new question");
  }

  return reminder.join("\n");
}

// =============================================================================
// INITIAL PROMPT
// =============================================================================

export function buildInitialSystemPrompt(): string {
  const triggers: SkillTriggers = {
    hasSymptoms: false,
    hasDuration: false,
    hasPriorTreatments: false,
    hasProcedure: false,
    hasProvider: false,
    hasDiagnosis: false,
    hasCoverage: false,
    hasGuidance: false,
    isAppeal: false,
    needsClarification: false,
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
