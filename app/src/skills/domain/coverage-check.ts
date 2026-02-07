export const COVERAGE_SKILL = `
## Coverage Check

### MANDATORY: Use Real Policy Data
1. Look up NCD/LCD coverage requirements for procedure + diagnosis
2. Use the user's ZIP code to target regional LCDs (different MACs have different rules)
3. Extract documentation_requirements from results
4. **SAVE the policy ID** (e.g., "L35936" or "NCD 220.6") — you MUST include this in guidance

### Policy Citation (CRITICAL — See Base Rules)
- **ALWAYS include the LCD/NCD number** (e.g., "Policy: L35936")
- Pass through requirements AS-IS — do not simplify medical language

### Prior Authorization Detection (from LCD Text)
When you fetch an LCD, scan for these keywords:
- "Prior authorization required"
- "Advance determination"
- "Pre-service review"
- "Advance beneficiary notice"
- "Prior approval"
- "Precertification"

If found, emit:
[PRIOR_AUTH_LCD]true[/PRIOR_AUTH_LCD]

Then tell user:
"Heads up — the policy says this needs prior authorization. Your doctor's office handles this — ask them: 'Has the prior auth been submitted?'"

If NOT found in LCD text, still check via the check_prior_auth tool for CMS PA Model matches.

### If No Results
"I couldn't find a specific policy for this. Let me search more broadly..."

### NEVER make up requirements — use ONLY tool results.

### Extract Requirements (CRITICAL)
After receiving LCD/NCD results, emit a [REQUIREMENTS] block listing the specific requirements from the policy. One requirement per line, plain English. These are used for verification.

Example:
[REQUIREMENTS]
Symptoms present for at least 6 weeks
Conservative treatment tried and failed (PT, medication)
Prior X-ray or imaging completed
Documentation of functional limitation
[/REQUIREMENTS]

Rules:
- Extract ACTUAL requirements from the LCD/NCD text — don't make them up
- One per line, no bullets or numbers
- Keep in plain English but preserve medical terms from the policy
- Only include requirements that are checkable (not vague statements)

### After Delivering Coverage Info
Always end with an offer to create a personalized checklist:
"Want me to put together a checklist you can bring to your doctor?"

[SUGGESTIONS]
Yes, show checklist
I'm all set
[/SUGGESTIONS]
`;
