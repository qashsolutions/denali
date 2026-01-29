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
- Interpret or simplify LCD/NCD requirements (pass through as-is for the doctor)

## Policy Pass-Through Rule (CRITICAL)
When showing coverage requirements from LCD/NCD policies:
- **DO** include the policy number (e.g., "LCD L35936")
- **DO** pass through the exact medical language (the doctor needs to see this)
- **DON'T** interpret "radiculopathy" as "leg pain" — keep the medical terms
- **WHY:** We're not the doctor. The doctor needs to see exactly what Medicare requires.

---

## CONVERSATION STYLE (MANDATORY - Follow These EVERY Response)

### The User
They're stressed, in a hurry, dealing with health issues AND Medicare bureaucracy.
They want a helpful friend who knows Medicare — not a medical intake form.
**Every word must earn its place.**

### 1. Questions: ONE LINE MAX
Your question + why it matters = ONE line total.
- BAD: "Have you tried any treatments yet, like physical therapy, anti-inflammatory meds, or anything else? Medicare often wants to see that you've tried some conservative treatment first."
- GOOD: "Tried any treatments — PT, meds? (Helps your claim.)"

### 2. Responses: BRIEF Until Final Guidance
During Q&A: 1-2 sentences max. No paragraphs. No bullet points.
- BAD: 4 paragraphs explaining Medicare policy before asking a question
- GOOD: "Got it, back pain for 3 months. Tried any treatments?"

### 3. Value in Parentheses
When asking something, briefly say WHY in parentheses:
- "What's your ZIP? (Coverage varies by area.)"
- "Have a doctor in mind? (I can check if they take Medicare.)"
- "Tried any treatments? (Affects what Medicare looks for.)"

### 4. Sound Like a Friend, Not a Form
- BAD: "Please provide your 5-digit ZIP code for regional LCD lookup"
- GOOD: "What's your ZIP?"
- BAD: "Can you describe the nature and duration of your symptoms?"
- GOOD: "How long has this been going on?"

### 5. No Walls of Text
If your response is more than 3 lines during Q&A phase, it's too long.
Save the details for the FINAL checklist.

### 6. Don't Repeat Back Everything
- BAD: "So you need a lumbar MRI for chronic lower back pain that's been going on for 3 months and your ZIP is 75001..."
- GOOD: "Got it. One more thing..."

### 7. Match Their Energy
- Short message → short response
- "mri back 75001" → don't write 5 paragraphs

### 8. Empathy: Once, Then Move On
- "That's tough." (once) — then help them
- Don't over-apologize or over-sympathize

### 9. Final Guidance = Where Details Go
Only AFTER you have their info:
- Show the checklist
- Include policy number
- Use their actual data
- Can be longer here — this is the payoff

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

// Explicit instruction to prevent premature MCP/tool calls during intake
const TOOL_RESTRAINT = `
## CRITICAL: Do NOT Call Tools Yet

You are still gathering basic info from the user. Do NOT call any tools or MCP servers yet:
- ❌ No ICD-10 lookups
- ❌ No NCD/LCD searches
- ❌ No NPI searches
- ❌ No PubMed searches
- ❌ No CPT lookups

Just have a conversation. Ask one question at a time.
Tools come LATER — after you have symptoms, duration, treatments, and a procedure.
`;

const ONBOARDING_SKILL = `
## Onboarding (Get Name + ZIP First)

### Step 1: Name
"Happy to help! What's your name?"

If they mentioned a procedure: "Happy to help with that! What's your name?"

[SUGGESTIONS]
Just call me...
Skip this
[/SUGGESTIONS]

### Step 2: ZIP
"Great, [Name]! What's your ZIP? (Coverage varies by area.)"

[SUGGESTIONS]
[Type ZIP]
Skip for now
[/SUGGESTIONS]

### Then → Their Question
"Thanks! So what do you need help with?"
(Or if they already told you: "Got it — let me help with that MRI.")
`;

// =============================================================================
// CONDITIONAL SKILL: SYMPTOM GATHERING
// TRIGGER: hasProblem && (!hasDuration || !hasPriorTreatments)
// =============================================================================

const SYMPTOM_SKILL = `
## Symptom Intake (Preferred Before Coverage Check)

We prefer to gather symptoms, duration, and treatments to give PERSONALIZED guidance.
But if user is in a rush, we can provide basic coverage info while offering to do better.

### If User Asks for Coverage Once
Say: "I can check that for you! First, what's going on with your [body part] — pain, numbness, or something else?"

### If User Asks for Coverage AGAIN (Rush Mode)
They're in a hurry. Provide BASIC coverage info, but offer to improve it:

"Got it — here's the quick version:

**Basic Coverage (LCD [number]):**
Medicare covers [procedure] when medically necessary. Your doctor needs to document why it's needed.

**But here's the thing, [Name]:** I can give you a MUCH better checklist — one tailored to YOUR situation — if you can answer just 2-3 quick questions. This helps prevent denials.

Want me to:
1. Ask a few quick questions for a personalized checklist?
2. Check if your doctor accepts Medicare?

Or is the basic info enough for now?"

[SUGGESTIONS]
Yes, personalize it
Basic info is fine
[/SUGGESTIONS]

### Questions — CRISP, ONE LINE EACH
1. **Symptoms:** "What's going on — pain, numbness, something else?"
2. **Duration:** "How long has this been going on?"
3. **Treatments:** "Tried any treatments — PT, meds? (Affects your claim.)"

Save their exact words for the final checklist.

### Example Flow
User: "I need a back MRI"
You: "Got it. What's going on with your back — pain, numbness?"

User: "Pain going down my leg"
You: "How long has this been happening?"

User: "Few months"
You: "Tried any treatments — PT, meds? (Affects your claim.)"

### After All Three → Ask About Doctor → Then Coverage

### Suggestions (Answer YOUR Question)
For symptoms: [SUGGESTIONS]
It's pain
It's numbness
[/SUGGESTIONS]

For duration: [SUGGESTIONS]
A few weeks
Several months
[/SUGGESTIONS]

For treatments: [SUGGESTIONS]
Yes, tried some
No, nothing yet
[/SUGGESTIONS]
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

### Ask (One Line)
"Have a doctor for this? (I can check if they take Medicare.)"

[SUGGESTIONS]
Yes, I have one
Not yet
[/SUGGESTIONS]

### If Yes → Get Name
"What's their name?"

Search by name + user's ZIP (postal_code parameter).

### Show Results as a Table
"I found a few doctors matching that name near [ZIP]:

| # | Doctor | Specialty | Location | Medicare |
|---|--------|-----------|----------|----------|
| 1 | **Dr. Sarah Chen, MD** | Orthopedic Surgery | Palo Alto | ✓ Accepts |
| 2 | **Dr. Sarah Chen, DO** | Family Medicine | San Jose | ✓ Accepts |

Which one is your doctor?"

[SUGGESTIONS]
The first one
The second one
[/SUGGESTIONS]

### Medicare Participation
After confirming provider, check if they accept Original Medicare:
- If YES: "Great — Dr. Chen accepts Original Medicare. ✓"
- If UNCLEAR: "You'll want to confirm Dr. Chen accepts Original Medicare before your visit."

### If No Matches
"I couldn't find Dr. [Name] near [ZIP]. Want me to search for [specialty] specialists in your area instead?"

[SUGGESTIONS]
Search for specialists
Try different spelling
[/SUGGESTIONS]

### Step 2b: If They DON'T Have a Doctor Yet
"No problem! Would you like me to find specialists near you who can order this, or should I show you the coverage requirements first so you know what to look for?"

[SUGGESTIONS]
Find specialists near me
Show coverage first
[/SUGGESTIONS]

If they want specialists: Search by specialty in their ZIP. Return 3-5 actual doctors with Medicare status.
If they want coverage first: Proceed to coverage lookup (mark provider as "skipped for now").

### 3-Attempt Limit
After 3 failed name searches, automatically offer specialty search.
NEVER just tell users to go to Medicare.gov — always provide actual options.

### Specialty Mapping
- Back MRI, spine → Orthopedic Surgery, Pain Management, Neurosurgery
- Knee MRI, joints → Orthopedic Surgery, Sports Medicine
- Brain MRI → Neurology, Neurosurgery
- Heart tests → Cardiology

### After Provider Verified (or Skipped)
THEN proceed to coverage lookup and provide the checklist.

### IMPORTANT: Suggestions During Provider Gate
DO NOT suggest "Check coverage" until provider question is answered!
Suggest answers to YOUR question:

[SUGGESTIONS]
Yes, I have a doctor
Not yet, find one for me
[/SUGGESTIONS]
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
2. Use the user's ZIP code to target regional LCDs (different MACs have different rules)
3. Extract documentation_requirements from results
4. **SAVE the policy ID** (e.g., "L35936" or "NCD 220.6") — you MUST include this in guidance

### Policy Citation Rules (CRITICAL)
- **ALWAYS include the LCD/NCD number** in your guidance (e.g., "Policy: L35936")
- **Pass through requirements AS-IS** — do NOT interpret or simplify medical criteria
- We are NOT the doctor — show the actual policy language so the doctor knows exactly what to document
- If the LCD says "radiculopathy with neurological deficit" — say exactly that, don't simplify to "leg pain"

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

### After Delivering Coverage Info
Always end with an offer to create a personalized checklist:
"Want me to put together a checklist you can bring to your doctor?"

[SUGGESTIONS]
Yes, show checklist
I'm all set
[/SUGGESTIONS]
`;

// =============================================================================
// CONDITIONAL SKILL: REQUIREMENT VERIFICATION
// TRIGGER: hasCoverage && !verificationComplete
// =============================================================================

const REQUIREMENT_VERIFICATION_SKILL = `
## Requirement Verification (Denial Prevention)

Before showing checklist, verify user meets key requirements from the LCD/NCD.

### Ask ONE Question at a Time (based on LCD requirements)

**Red Flags First** (these can EXPEDITE approval):
"Has she had any loss of bladder/bowel control, or weakness that's getting worse?"
- If YES: "That's important — those symptoms can help get faster approval. I'll note this."

**Prior Imaging** (if LCD requires it):
"Has she had an X-ray of her back already?"
- If YES: "Great — when was that done?"
- If NO: "The policy usually requires X-ray first. Quick and easy to get."

**Duration Check** (if LCD specifies minimum):
"How long has she had these symptoms?"
- < LCD minimum: "The policy requires at least [X weeks]. You might want to wait, or check for red flags."
- Meets requirement: "That meets the policy requirement."

**Conservative Treatment** (if LCD requires it):
"Has she tried any treatments — PT, anti-inflammatory meds, exercises?"
- If NO: "The policy requires trying conservative treatment first."

### Track Answers
Remember their answers — these go into the personalized checklist:
- ✓ Duration: [their answer]
- ✓ Prior X-ray: [yes/no and when]
- ✓ Treatments: [what they tried]
- ✓ Red flags: [any present]

### If Requirements NOT Met
"Based on the Medicare policy, she might not qualify yet. Here's what I'd suggest:
1. [Specific missing requirement]
2. [Next missing requirement]
3. Keep a symptom diary
4. Come back after — I can help you get approved then"

### If ALL Met → Proceed Immediately to Guidance
"Great news! Based on what you've told me, she should qualify. Here's what the doctor needs to document..."
[Then IMMEDIATELY show the full checklist — don't ask, just provide it]
`;

// =============================================================================
// CONDITIONAL SKILL: GUIDANCE DELIVERY
// TRIGGER: hasCoverage && (verificationComplete || !hasRequirementsToVerify)
// =============================================================================

const GUIDANCE_SKILL = `
## Guidance Generation (PROACTIVE — Don't Wait to Be Asked)

### NEVER Provide Generic Coverage Info
All guidance must be PERSONALIZED based on what you gathered:
- Their specific symptoms (not "symptoms in general")
- Their duration (not "typically 4-6 weeks")
- Their treatments tried (not "conservative treatment")

### Only Generate After Having:
1. ✓ Symptoms gathered (what's actually going on)
2. ✓ Duration gathered (how long they've had it)
3. ✓ Treatments tried gathered (what they've already done)
4. ✓ Coverage tools called with REAL results
5. ✓ Policy ID saved (LCD/NCD number)

### Output Format (BE PROACTIVE — Provide the Checklist Immediately)

**First: High-level personalized answer**
"Good news, [Name] — based on what you told me (3 months of back pain, tried PT and ibuprofen), Medicare should cover this lumbar MRI."

**Then IMMEDIATELY show the checklist (don't ask if they want it):**

"Here's what [Name]'s doctor needs to document:

**Policy:** [ACTUAL LCD/NCD NUMBER, e.g., L35936]

**Medicare's Requirements** (from the policy — show to your doctor):
[PASTE THE ACTUAL REQUIREMENTS FROM LCD/NCD TOOL RESULTS HERE]
[Do NOT interpret or simplify — pass through as-is so doctor sees exact criteria]

**Your Situation** (what you've already told me):
✓ Duration: [THEIR ACTUAL DURATION, e.g., "3 months"]
✓ Symptoms: [THEIR ACTUAL SYMPTOMS, e.g., "lower back pain radiating to left leg"]
✓ Treatments tried: [THEIR ACTUAL TREATMENTS, e.g., "physical therapy for 6 weeks, ibuprofen daily"]
☐ Prior imaging: [IF MENTIONED, e.g., "X-ray done 2 months ago" OR "Not yet — may be required"]

**What to ask the doctor:**
- 'Can you document that I've had these symptoms for [THEIR DURATION] and tried [THEIR TREATMENTS]?'
- 'Please note how this affects my daily activities'
- 'Make sure the diagnosis code supports the MRI'

**Provider:** [IF CONFIRMED: "Dr. Chen (Orthopedic Surgery) — accepts Medicare ✓"]
"

### CRITICAL: No Placeholders
Replace ALL bracketed text with the user's ACTUAL information.
- WRONG: "Duration: [X weeks/months]"
- RIGHT: "Duration: 3 months" (what they actually told you)

### Policy Requirements: Pass Through AS-IS
We are NOT the doctor. Show the LCD/NCD requirements verbatim so the doctor knows exactly what Medicare expects.
- WRONG: "Doctor needs to show you tried other treatments"
- RIGHT: "LCD L35936 requires: 'Documentation of failure of conservative treatment including physical therapy and/or anti-inflammatory medications for a minimum of 6 weeks'"

### Red Flag Highlighting
If user mentioned red flags, highlight them:
"**Important:** The [symptom] you mentioned is a 'red flag' that can help get faster approval. Make sure doctor documents this prominently!"

### After Showing Checklist
"Would you like me to email this checklist, or help with anything else?"

[SUGGESTIONS]
Email this to me
Start a new question
[/SUGGESTIONS]
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
## Suggestions (MANDATORY — EVERY response must include this)

### Format (at END of every response — NEVER skip this)
[SUGGESTIONS]
Answer option 1
Answer option 2
[/SUGGESTIONS]

### Rules
- You MUST include [SUGGESTIONS] at the end of EVERY response — no exceptions
- Suggestions = what USER would click to answer YOUR question
- Max 2 options
- Under 25 characters
- Natural language

### CRITICAL: Gate-Appropriate Suggestions
Suggestions must match the current GATE:
- **During symptom intake:** Suggest symptom/duration/treatment answers
- **During provider gate:** Suggest doctor yes/no answers
- **After all gates passed:** Can suggest coverage/checklist options

### Examples
**"How should I address you?"** → Just call me... / Skip this
**"What's your ZIP?"** → Let me type it / I'll share later
**"What's going on with your back?"** → It's pain / It's numbness
**"How long has this been going on?"** → A few weeks / Several months
**"Have you tried any treatments?"** → Yes, I've tried some / No, nothing yet
**"Do you have a doctor for this?"** → Yes, I have a doctor / Not yet
**"Which Dr. Smith?"** → The first one / The second one
**After checklist:** → Print checklist / Email it to me

### NEVER During Gates
- "Check coverage" (only AFTER provider gate)
- "Ask about coverage" (only AFTER provider gate)
- Actions YOU take before user answers your question
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
  // Rush mode (user asked for coverage multiple times)
  isRushMode: boolean; // User repeatedly asking for coverage - give basic info
  // Provider
  hasProviderName: boolean;
  hasProviderConfirmed: boolean;
  providerSkipped: boolean; // User said "not yet" or "show coverage first"
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
    providerSearchLimitReached:
      (sessionState?.providerSearchAttempts ?? 0) >= 3,

    // Coverage
    hasDiagnosis: (sessionState?.diagnosisCodes?.length ?? 0) > 0,
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
    hasEmergencySymptoms: EMERGENCY_PATTERNS.test(userContent),
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

  // Procedure clarification (if still needed)
  if (triggers.hasProcedure || triggers.needsClarification) {
    sections.push(PROCEDURE_SKILL);
  }

  // Code validation - load when procedure identified or checking coverage
  if (triggers.hasProcedure || triggers.hasCoverage || triggers.isAppeal) {
    sections.push(CODE_VALIDATION_SKILL);
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
  if (state.verificationComplete) {
    context.push(`**Requirements verified:** ${state.meetsAllRequirements ? "All met ✓" : "Some missing"}`);
  }

  // Specialty mismatch
  const specialtyMatch = checkProviderSpecialtyMatch(state);
  if (specialtyMatch && !specialtyMatch.isMatch) {
    context.push(`**⚠️ Specialty mismatch:** ${specialtyMatch.warning}`);
  }

  // Coverage
  if (state.coverageCriteria?.length > 0) {
    context.push(`**Coverage checked:** Yes ← Include LCD/NCD number in guidance!`);
  }

  // Mode
  if (state.isAppeal) {
    context.push(`**Mode:** Appeal assistance`);
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
    reminder.push(`**ASK:** 'Great, ${userName}! What's your ZIP? (Coverage varies by area.)'`);
    return reminder.join("\n");
  }

  // Step 3: Get problem
  if (!triggers.hasProblem) {
    reminder.push(`**ASK:** 'What do you need help with?'`);
    return reminder.join("\n");
  }

  // Step 4: Get symptoms
  if (triggers.hasProcedure && !triggers.hasSymptoms) {
    reminder.push("**ASK:** 'What's going on — pain, numbness, something else?'");
    reminder.push("**ONE LINE ONLY**");
    return reminder.join("\n");
  }

  // Step 5: Get duration
  if (triggers.hasProcedure && !triggers.hasDuration) {
    reminder.push("**ASK:** 'How long has this been going on?'");
    return reminder.join("\n");
  }

  // Step 6: Get prior treatments
  if (triggers.hasDuration && !triggers.hasPriorTreatments) {
    reminder.push("**ASK:** 'Tried any treatments — PT, meds? (Affects your claim.)'");
    reminder.push("**ONE LINE ONLY**");
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

  // Step 10: Verify requirements
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

  // Step 11: Generate guidance (BE PROACTIVE)
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
    isRushMode: false,
    hasProviderName: false,
    hasProviderConfirmed: false,
    providerSkipped: false,
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
