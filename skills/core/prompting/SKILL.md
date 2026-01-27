---
name: prompting
description: Anticipate what the user needs next and suggest logical follow-up actions
version: 1.0.0
triggers:
  - after_every_response
---

# Prompting Skill

This skill helps anticipate what the user might want to do next and surfaces 1-2 relevant suggestions after each response.

## Purpose

Users often don't know what questions to ask or what's possible. Proactive suggestions:
- Reduce friction
- Guide them through the flow
- Surface features they might not know about
- Keep the conversation moving

## Rules

1. **Always suggest 1-2 next actions** after substantive responses
2. **Make suggestions contextual** to where they are in the flow
3. **Keep suggestions short** — tappable chip format
4. **Don't repeat** suggestions they've already acted on
5. **Prioritize** the most logical next step first

## Suggestion Format

Suggestions appear as tappable chips below the response:

```
[Primary suggestion] [Secondary suggestion]
```

Examples:
- `[Tell me about the doctor]` `[What if it's denied?]`
- `[Print this checklist]` `[Start a new question]`

## Suggestions by Flow State

### At Conversation Start
```
[Ask about coverage] [Help with a denial]
```

### After Symptom Intake
```
[Tell me about the doctor] [What treatments has she tried?]
```

### After Procedure Identified
```
[Check if Medicare covers this] [Find a specialist]
```

### After Provider Lookup
```
[Check Medicare coverage] [Try a different doctor]
```

### After Coverage Check
```
[Show me what to document] [What if it's denied?]
```

### After Guidance Generated
```
[Print this checklist] [Start a new question]
```

### After Guidance with Feedback
```
[Was this helpful?] [Start a new question]
```

### After Appeal Letter Generated
```
[Print this letter] [Download PDF]
```

### After Appeal Letter Viewed
```
[Report the outcome] [Start a new question]
```

### If Service Not Covered
```
[Are there alternatives?] [Start a new question]
```

### If User Seems Stuck
```
[Let me help you rephrase] [Start over]
```

## Contextual Logic

### What's Missing?

Check session state and suggest gathering missing info:

| Missing | Suggestion |
|---------|------------|
| Symptoms/condition | "Tell me more about the symptoms" |
| Duration | "How long has this been going on?" |
| Prior treatments | "What treatments have been tried?" |
| Provider | "Tell me about the doctor" |
| Procedure details | "What kind of test or service?" |

### What's Next in Flow?

Based on what's been completed:

| Completed | Next Suggestion |
|-----------|-----------------|
| Symptoms gathered | "Check Medicare coverage" |
| Coverage checked | "Show documentation checklist" |
| Guidance generated | "Print this" |
| Appeal generated | "Download the letter" |

### What Might They Want?

Based on common patterns:

| Situation | Likely Want |
|-----------|-------------|
| Just got guidance | Print it, share with doctor |
| Service not covered | Understand why, find alternatives |
| Denial mentioned | Help with appeal |
| Outcome unknown | Check back later |

## Anti-Patterns

### Don't Suggest

- Actions they can't take yet (e.g., "Print checklist" before guidance)
- Things that don't apply (e.g., "Appeal help" when nothing was denied)
- Too many options (max 2 suggestions)
- Redundant suggestions (same as previous turn)

### Don't Be Pushy

- Let them drive if they're asking specific questions
- Don't suggest upgrading to paid unless relevant
- Don't suggest feedback immediately after every message

## Examples

### After Symptom Intake

**Response**: "Three months of back pain with leg tingling — that's helpful information. Medicare often considers imaging for symptoms like these.

Has she seen a doctor about this yet?"

**Suggestions**: `[Yes, tell me about the doctor]` `[Not yet]`

### After Coverage Guidance

**Response**: "Good news — Medicare typically covers lumbar MRI for your mom's situation. Here's what the doctor needs to document:

- Pain duration (3+ months)
- Radiating symptoms (leg involvement)
- Failed conservative treatment

Print this and bring it to her appointment."

**Suggestions**: `[Print this checklist]` `[What if it's still denied?]`

### After Appeal Letter

**Response**: "Your appeal letter is ready. It includes:

- Medicare policy citations (NCD 220.1)
- Clinical evidence from her records
- Supporting medical literature

You can print this and mail it to Medicare, or upload it to their portal."

**Suggestions**: `[Print letter]` `[Download PDF]`

### When Nothing Specific Needed

**Response**: "Is there anything else I can help you with?"

**Suggestions**: `[New question]` `[That's all for now]`
