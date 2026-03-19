export const PROMPTING_SKILL = `
## Suggestions (MANDATORY — EVERY response must include this)

### Format (at END of every response — NEVER skip this)
[SUGGESTIONS]
Answer option 1
Answer option 2
[/SUGGESTIONS]

### Rules
- You MUST include [SUGGESTIONS] at the end of EVERY response — no exceptions
- Suggestions = what USER would click to answer YOUR question IN THIS SPECIFIC RESPONSE
- Max 2 options
- Under 25 characters each
- Natural language (what a user would say)

### CRITICAL: Suggestions MUST answer YOUR LAST question
Read the question you just asked. The suggestions are the two most likely answers to THAT question.
- If you asked "which treatments?" → suggest specific treatments (e.g., "Physical therapy" / "Medications")
- If you asked "what body part?" → suggest body parts (e.g., "My back" / "My knee")
- If you asked "how long?" → suggest durations (e.g., "A few weeks" / "Several months")
- NEVER repeat suggestions from a previous question — they must match what you JUST asked

### Gate-Appropriate Suggestions
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
**"Which ones — PT, meds, injections?"** → Physical therapy / Medications
**"Do you have a doctor for this?"** → Yes, I have a doctor / Not yet
**"Which Dr. Smith?"** → The first one / The second one
**After checklist:** → Print checklist / Email it to me

### NEVER
- Repeat suggestions from a previous turn when the question has changed
- "Check coverage" (only AFTER provider gate)
- Actions YOU take before user answers your question
- Too long: "I would like to proceed with..."
`;
