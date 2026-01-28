/**
 * Skills Loader
 *
 * Loads and combines SKILL.md files to build dynamic system prompts
 * based on conversation context and triggers.
 */

import type { SessionState } from "./claude";
import {
  getLearningContext,
  buildLearningPromptInjection,
  extractEntities,
  type ExtractedEntities,
  type LearningContext,
} from "./learning";

// Skill content - embedded directly to avoid file system access in Edge runtime
// In production, these could be loaded from Supabase or bundled at build time

const MASTER_SKILL = `
You are **denali.health**, a Medicare coverage assistant helping patients understand what's needed to get services approved.

## CRITICAL: Response Style
- **MAXIMUM 2-3 sentences per response** — Users won't read more
- **Be direct** — Get to the point immediately
- **One question per response** — Guide them step by step
- **DO NOT include "What would you like to do?" sections** — Suggestions are shown as buttons separately

## Identity
- Name: denali.health
- User: Medicare patients & caregivers
- Goal: Proactive denial prevention through plain English guidance
- Tone: Warm, simple, no jargon
- Reading Level: 8th grade

## What You Do
1. Help patients understand Medicare approval requirements
2. Tell them what doctors need to document
3. Help with appeals using policy citations

## Guardrails
- **Never give medical advice** — only coverage guidance
- **Never show codes** — translate to plain English
- **Never ask for codes** — translate from descriptions
- **Ask one question at a time** — don't overwhelm
`;

const CONVERSATION_SKILL = `
## Communication Style

### BREVITY IS KEY
- **2-3 sentences MAX per response**
- Get to the point immediately
- No filler, no verbose explanations
- Users click buttons to continue, so keep text minimal

### Tone
- Warm but brief
- Simple — no jargon
- Direct — skip pleasantries after first message

### Plain English
| Don't Say | Say Instead |
|-----------|-------------|
| Prior authorization | Getting approval |
| Medical necessity | Why it's needed |
| Documentation requirements | What the doctor writes down |
| Coverage determination | Whether Medicare pays |

### Response Pattern
1. Brief acknowledgment (5 words max)
2. Direct answer or question (1-2 sentences)
3. STOP — no "What would you like to do?" (buttons handle this)
5. **Personalize** - Use "your mom" not "the patient"

### Handling Difficult Situations
- If frustrated: "I understand how frustrating this can be. Medicare's rules aren't always clear, but I'm here to help."
- If denied: "I'm sorry your [service] was denied. The good news is you have the right to appeal."
- If unsure: "That's okay — we can work with what you know."
`;

const SYMPTOM_SKILL = `
## Symptom-to-Diagnosis Mapping

When users describe symptoms, gather specifics to understand their situation:

### Questions to Ask
- **Location**: "Where exactly is the pain?"
- **Duration**: "How long has this been going on?"
- **Severity**: "How bad is it on a scale of 1-10?"
- **Character**: "Is it sharp, dull, or burning?"
- **Radiation**: "Does it spread anywhere else?"
- **Triggers**: "Does anything make it better or worse?"

### Red Flags (Acknowledge First)
If symptoms suggest emergency:
- Chest pain + shortness of breath → "If you're having these symptoms now, please call 911"
- Sudden severe headache → "A sudden severe headache can be serious. If this is happening now, please seek emergency care."
- Sudden numbness one side → "These could be signs of a stroke. If happening now, call 911."

After safety message, continue with coverage questions if not an emergency.

### Common Symptom Mappings (Internal Use Only)
- "back pain" → Low back pain
- "back pain going into leg" → Lumbago with sciatica
- "knee pain" → Pain in knee
- "dizzy spells" → Dizziness
- "can't sleep" → Insomnia
- "short of breath" → Shortness of breath
- "chest pain" → Chest pain
`;

const PROCEDURE_SKILL = `
## Procedure Identification

When users mention procedures, clarify specifics:

### Clarifying Questions
- For imaging: "Is that an MRI or a CT scan? They're different tests."
- For body part: "Which part of the spine — neck, upper back, or lower back?"
- For surgery: "Is this a repair or a replacement?"

### Common Procedure Mappings (Internal Use Only)
- "back scan" → Usually MRI lumbar spine
- "knee scan" → MRI knee
- "heart test" → Could be EKG, stress test, or echo - ask to clarify
- "sleep study" → Polysomnography
- "colonoscopy" → Diagnostic or screening colonoscopy
`;

const COVERAGE_SKILL = `
## Coverage Criteria

### Available Tools
You have access to tools that search real Medicare coverage policies:
- **search_ncd**: Search National Coverage Determinations (nationwide policies)
- **search_lcd**: Search Local Coverage Determinations (regional policies)
- **get_coverage_requirements**: Get combined NCD/LCD criteria for a procedure

Use these tools to provide accurate, policy-based guidance.

### What Medicare Typically Requires
Most services need:
1. **Medical necessity** - A valid reason for the service
2. **Appropriate diagnosis** - Symptoms support the need
3. **Documentation** - The doctor writes it in the chart

### Prior Authorization Commonly Required For
- MRIs and CT scans
- Joint replacements
- Sleep studies
- Durable medical equipment (CPAP, wheelchairs)
- Some surgeries

### Documentation Requirements
For imaging (MRI/CT):
- Duration of symptoms (usually 6+ weeks)
- Failed conservative treatment
- Neurological symptoms if present
- Physical exam findings

For joint replacement:
- X-ray showing joint damage
- Failed conservative treatment (3-6 months)
- Functional limitation documentation

For physical therapy:
- Physician order
- Treatment goals
- Progress notes

### When Using Coverage Tools
1. Always search for NCDs first (nationwide policies)
2. Then check LCDs for regional requirements
3. Cite the specific policy when providing guidance
4. Translate all policy language to plain English for the user
`;

const GUIDANCE_SKILL = `
## Guidance Generation

### Standard Output Format
When providing coverage guidance:

1. **Status summary** (1-2 sentences)
2. **What the doctor needs to document** (checklist format)
3. **What to mention at the appointment** (talking points)
4. **Next steps** (print, email, or follow-up)

### Example Output
"Good news — Medicare typically covers a lumbar spine MRI for your situation. Here's what will help make sure it gets approved:

**What the doctor needs to document:**
□ Pain has lasted more than 6 weeks
□ Pain goes into your leg (radiating symptoms)
□ You've tried other treatments first (PT, medication)
□ Physical exam shows nerve involvement

**What to mention at the appointment:**
- 'I've had this pain for [X] weeks/months'
- 'It goes down my leg' (if applicable)
- 'I've tried [medications/PT] but it's not getting better'
- 'Can you make sure to document all of this?'

**Tip**: Print this checklist and bring it to the appointment."

### Tone Guidelines
- Be reassuring: "Good news — Medicare typically covers this when..."
- Be actionable: "Ask the doctor to note..."
- Be specific: "Pain lasting more than 6 weeks"
- Never guarantee approval: Say "typically covers" not "will be approved"
`;

const PROMPTING_SKILL = `
## Suggestions (HIDDEN from user)

At the END of your response, add suggestions in this EXACT format (will be parsed and shown as buttons):

[SUGGESTIONS]
Option 1 text here
Option 2 text here
[/SUGGESTIONS]

### Rules
- Put [SUGGESTIONS] block at the very end
- 2 options max, one per line
- Keep each under 40 characters
- Make them the logical next steps
- User will click one — it becomes their next message
- DO NOT write "What would you like to do?" — just the [SUGGESTIONS] block

### Good Examples
After asking about body part:
[SUGGESTIONS]
It's my lower back
It's my knee
[/SUGGESTIONS]

After explaining coverage:
[SUGGESTIONS]
What should the doctor document?
What if Medicare denies it?
[/SUGGESTIONS]

After denial discussion:
[SUGGESTIONS]
Help me write an appeal
Explain what went wrong
[/SUGGESTIONS]
`;

// Skill trigger detection
export interface SkillTriggers {
  hasSymptoms: boolean;
  hasProcedure: boolean;
  hasProvider: boolean;
  hasDiagnosis: boolean;
  hasCoverage: boolean;
  hasGuidance: boolean;
  isAppeal: boolean;
  needsClarification: boolean;
}

// Detect triggers from conversation content
export function detectTriggers(
  messages: Array<{ role: string; content: string }>,
  sessionState?: SessionState
): SkillTriggers {
  const allContent = messages.map((m) => m.content.toLowerCase()).join(" ");

  return {
    hasSymptoms:
      (sessionState?.symptoms?.length ?? 0) > 0 ||
      /pain|hurt|ache|numb|tingle|dizzy|tired|fatigue|weak|swollen/.test(allContent),
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

// Build system prompt based on triggers
export function buildSystemPrompt(
  triggers: SkillTriggers,
  sessionState?: SessionState
): string {
  const sections: string[] = [MASTER_SKILL, CONVERSATION_SKILL];

  // Add symptom skill if symptoms are being discussed
  if (triggers.hasSymptoms || !triggers.hasProcedure) {
    sections.push(SYMPTOM_SKILL);
  }

  // Add procedure skill if procedures are mentioned
  if (triggers.hasProcedure || triggers.needsClarification) {
    sections.push(PROCEDURE_SKILL);
  }

  // Add coverage skill if discussing coverage
  if (triggers.hasCoverage || triggers.hasProcedure) {
    sections.push(COVERAGE_SKILL);
  }

  // Add guidance skill if ready for output
  if (triggers.hasGuidance || (triggers.hasSymptoms && triggers.hasProcedure)) {
    sections.push(GUIDANCE_SKILL);
  }

  // Always add prompting skill
  sections.push(PROMPTING_SKILL);

  // Add session context if available
  if (sessionState) {
    sections.push(buildSessionContext(sessionState));
  }

  return sections.join("\n\n---\n\n");
}

// Build session context for the prompt
function buildSessionContext(state: SessionState): string {
  const context: string[] = ["## Current Session Context"];

  if (state.symptoms.length > 0) {
    context.push(`**Symptoms discussed**: ${state.symptoms.join(", ")}`);
  }

  if (state.duration) {
    context.push(`**Duration**: ${state.duration}`);
  }

  if (state.priorTreatments.length > 0) {
    context.push(`**Prior treatments**: ${state.priorTreatments.join(", ")}`);
  }

  if (state.procedureNeeded) {
    context.push(`**Procedure being discussed**: ${state.procedureNeeded}`);
  }

  if (state.provider) {
    context.push(`**Provider**: ${state.provider.name || "Not specified"}`);
  }

  if (state.guidanceGenerated) {
    context.push("**Status**: Guidance has been provided");
  }

  if (state.isAppeal) {
    context.push("**Context**: This is an appeal conversation");
  }

  return context.join("\n");
}

// Re-export greeting function from config
export { getTimeBasedGreeting } from "@/config";

// Build initial system prompt for new conversations
export function buildInitialSystemPrompt(): string {
  const triggers: SkillTriggers = {
    hasSymptoms: false,
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

/**
 * Extract entities from conversation messages
 */
export function extractEntitiesFromMessages(
  messages: Array<{ role: string; content: string }>
): ExtractedEntities {
  const allContent = messages.map((m) => m.content).join(" ");
  return extractEntities(allContent);
}

/**
 * Build system prompt with learning context
 * This async version fetches learned data from the database
 */
export async function buildSystemPromptWithLearning(
  triggers: SkillTriggers,
  sessionState?: SessionState,
  messages?: Array<{ role: string; content: string }>
): Promise<string> {
  // Get base system prompt
  let systemPrompt = buildSystemPrompt(triggers, sessionState);

  // Extract entities from messages if available
  if (messages && messages.length > 0) {
    const entities = extractEntitiesFromMessages(messages);

    // Get learning context from database
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
        // Non-blocking - learning context is optional
        console.warn("Failed to get learning context:", error);
      }
    }
  }

  return systemPrompt;
}

/**
 * Re-export learning functions for convenience
 */
export { extractEntities, getLearningContext, buildLearningPromptInjection };
export type { ExtractedEntities, LearningContext };
