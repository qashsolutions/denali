# Skills

Claude Code is anticipating the next logical step and prompting you. That's the UX we want for denali.health.

---

## Skills Directory Structure

```
/mnt/skills/denali/
│
├── SKILL.md                        # Master orchestrator
│
├── core/
│   ├── conversation/SKILL.md       # How to talk to patients
│   ├── learning/SKILL.md           # How to learn from interactions
│   └── prompting/SKILL.md          # How to suggest next steps
│
├── domain/
│   ├── symptom-to-diagnosis/SKILL.md
│   ├── procedure-identification/SKILL.md
│   ├── provider-lookup/SKILL.md
│   ├── coverage-check/SKILL.md
│   └── guidance-generation/SKILL.md
│
├── infrastructure/
│   ├── database/SKILL.md           # Supabase schema, queries, RLS
│   ├── architecture/SKILL.md       # Edge functions, API design, modularity
│   └── ui-ux/SKILL.md              # Frontend patterns, components, simplicity
│
└── tools/
    └── SKILL.md                    # How to use healthcare APIs (ICD-10, NPI, NCD, PubMed)
```

---

## Skills Reference

| Skill | Location | Purpose |
|-------|----------|---------|
| Master | `/denali/SKILL.md` | Orchestrates everything |
| Conversation | `/core/conversation/SKILL.md` | Tone, language, empathy |
| Learning | `/core/learning/SKILL.md` | What/how to remember |
| Prompting | `/core/prompting/SKILL.md` | Suggest next steps |
| Symptom-to-Dx | `/domain/symptom-to-diagnosis/SKILL.md` | Plain English → ICD-10 |
| Procedure ID | `/domain/procedure-identification/SKILL.md` | Service → CPT |
| Provider Lookup | `/domain/provider-lookup/SKILL.md` | Doctor → NPI |
| Coverage Check | `/domain/coverage-check/SKILL.md` | NCD/LCD lookup |
| Guidance Gen | `/domain/guidance-generation/SKILL.md` | Final recommendation |
| Database | `/infrastructure/database/SKILL.md` | Supabase schema, RLS |
| Architecture | `/infrastructure/architecture/SKILL.md` | Modularity, Edge functions |
| UI/UX | `/infrastructure/ui-ux/SKILL.md` | Minimal chat interface |
| Tools | `/tools/SKILL.md` | Healthcare API usage |

---

## Skill Flow Example

```
User: "My mom needs approval for her back scan"
         │
         ▼
   ┌─────────────────┐
   │ Master Skill    │ → Detects: new conversation, coverage request
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Conversation    │ → "I'd be happy to help. Can you tell me 
   │ Skill           │    more about what's going on with her back?"
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Symptom-to-Dx   │ → Asks: duration, location, severity
   │ Skill           │ → Maps to ICD-10 (e.g., M54.5 low back pain)
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Procedure ID    │ → "Back scan" → MRI lumbar? CT? → Asks to clarify
   │ Skill           │ → Maps to CPT (e.g., 72148)
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Provider Lookup │ → "Who's her doctor?"
   │ Skill           │ → NPI search, validate specialty
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Coverage Check  │ → Search NCDs/LCDs for lumbar MRI
   │ Skill           │ → Extract criteria
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Guidance Gen    │ → Plain English: "Here's what the doctor
   │ Skill           │    needs to document to get this approved..."
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Learning Skill  │ → Store: "back scan" → 72148, M54.5 path worked
   └─────────────────┘
```

---

## Skill Definitions

### Master Skill (`/denali/SKILL.md`)

The orchestrator. Loaded into context at startup. Knows all other skills and when to trigger them.

**YAML Frontmatter:**
```yaml
name: denali-master
description: Medicare coverage assistant that helps patients understand approval requirements and prevent denials
```

**Must Define:**

- **Identity**: denali.health — Medicare claims simplified
- **User**: Medicare patients and caregivers (not billers, not coders)
- **Goal**: Proactive denial prevention through plain English guidance
- **Tone**: Warm, simple, no jargon, empathetic

**Skill Registry** (when to trigger each):

| Trigger | Skill to Load |
|---------|---------------|
| New conversation starts | `/core/conversation/SKILL.md` |
| User describes symptoms or condition | `/domain/symptom-to-diagnosis/SKILL.md` |
| User mentions a procedure/test/scan | `/domain/procedure-identification/SKILL.md` |
| User mentions doctor or asks "who can do this" | `/domain/provider-lookup/SKILL.md` |
| Diagnosis + procedure identified | `/domain/coverage-check/SKILL.md` |
| Coverage criteria retrieved | `/domain/guidance-generation/SKILL.md` |
| After any response | `/core/prompting/SKILL.md` |
| Successful path or user feedback | `/core/learning/SKILL.md` |

**Flow Logic:**
```
1. Greet → Conversation Skill
2. Understand problem → Symptom-to-Dx Skill
3. Identify service → Procedure ID Skill
4. Find doctor → Provider Lookup Skill
5. Check Medicare rules → Coverage Check Skill
6. Give guidance → Guidance Gen Skill
7. Suggest next step → Prompting Skill
8. Store what worked → Learning Skill
```

**Guardrails:**
- Never give medical advice — only Medicare coverage guidance
- Never ask for codes — translate plain English
- Always end with actionable next step
- If unsure, ask clarifying question (one at a time)

---

### Prompting Skill (`/core/prompting/SKILL.md`)

Anticipating what the user needs next.

- After every response, suggest 1-2 logical next actions
- Suggestions based on:
  - Where they are in the flow
  - What's missing (diagnosis? doctor? procedure?)
  - What they might want to do next
- Format: Short, clickable/tappable phrases
- Examples:
  - After symptom intake → "Tell me about your doctor"
  - After coverage check → "Show me what to bring to my appointment"
  - After guidance → "Start a new question" / "Was this helpful?"

---

### Conversation Skill (`/core/conversation/SKILL.md`)

- Tone: Warm, simple, no jargon, empathetic
- Language: Plain English, 8th grade reading level
- Ask one question at a time
- Acknowledge what user said before asking next question
- Never use medical codes in responses to user

---

### Learning Skill (`/core/learning/SKILL.md`)

- Store successful symptom → ICD-10 mappings
- Store successful procedure → CPT mappings
- Store successful coverage paths (dx + px + policy)
- Learn from user corrections
- Learn from thumbs up/down feedback

---

### Symptom-to-Diagnosis Skill (`/domain/symptom-to-diagnosis/SKILL.md`)

- Map plain English symptoms to ICD-10 codes
- Ask clarifying questions: duration, location, severity, onset
- Use ICD-10 search tool
- Never show codes to user — internal use only

---

### Procedure Identification Skill (`/domain/procedure-identification/SKILL.md`)

- Map plain English service descriptions to CPT codes
- Clarify: MRI vs CT? Which body part?
- Use CPT lookup tool (dev only)
- Never show codes to user — internal use only

---

### Provider Lookup Skill (`/domain/provider-lookup/SKILL.md`)

- Search NPI registry by name + location
- Validate specialty matches procedure
- Present short list for user to confirm
- Store confirmed provider for session

---

### Coverage Check Skill (`/domain/coverage-check/SKILL.md`)

- Search NCDs/LCDs for diagnosis + procedure combination
- Extract coverage criteria
- Check SAD exclusion list (Part B vs Part D)
- Pull supporting PubMed evidence if needed

---

### Guidance Generation Skill (`/domain/guidance-generation/SKILL.md`)

- Synthesize coverage criteria into plain English
- Format as actionable checklist for doctor visit
- Include what to ask doctor to document
- Offer printable version

---

### Tools Skill (`/tools/SKILL.md`)

How to use healthcare APIs:

| Tool | API | Use |
|------|-----|-----|
| ICD-10 | ICD-10 Codes MCP | Search diagnosis codes |
| CPT | AMA API (dev) | Search procedure codes |
| NPI | NPI Registry MCP | Validate providers |
| NCD/LCD | CMS Coverage MCP | Medicare coverage rules |
| SAD | CMS Coverage MCP | Part B exclusion check |
| PubMed | PubMed MCP | Clinical evidence |
