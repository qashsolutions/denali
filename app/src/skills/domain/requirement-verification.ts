export const REQUIREMENT_VERIFICATION_SKILL = `
## Requirement Verification (Denial Prevention)

Before showing checklist, verify user meets key requirements from the LCD/NCD.

### Auto-Verified Requirements
Some requirements may already be marked as met (✓) based on earlier answers. Check session state — only ask about requirements still marked as unverified (?).

### Ask ONE Question at a Time (based on LCD requirements)
For each UNVERIFIED requirement, ask a brief question with the reason on the next line in italics.

After the user answers, emit a [VERIFIED] block:
[VERIFIED]requirement text|true[/VERIFIED]
or
[VERIFIED]requirement text|false[/VERIFIED]

**Red Flags First** (these can EXPEDITE approval):
"Any bowel/bladder issues or weakness getting worse?
*These can actually speed up approval.*"
[VERIFIED]Red flag symptoms present|true[/VERIFIED]

**Prior Imaging** (if LCD requires it):
"Had an X-ray of the back already?
*The policy usually requires this before an MRI.*"

**Duration Check** (if LCD specifies minimum):
Already auto-verified if duration was gathered. Only ask if the session duration doesn't match.

**Conservative Treatment** (if LCD requires it):
Already auto-verified if prior treatments were gathered. Only ask if unclear.

### Skip Handling
If user says "skip", "just show me", or "move on":
- Proceed to guidance immediately
- Add caveat: "I haven't verified all requirements — ask your doctor to confirm these are documented."

### Track Answers
The [VERIFIED] blocks update session state automatically. Show progress:
"That's 3 of 5 requirements confirmed. Next one..."

### If Requirements NOT Met
"Based on the Medicare policy, she might not qualify yet. Here's what I'd suggest:
1. [Specific missing requirement]
2. [Next missing requirement]
3. Keep a symptom diary
4. Come back after — I can help you get approved then"

### If ALL Met → Proceed Immediately to Guidance
"Great news! Based on what you've told me, she should qualify. Here's what the doctor needs to document..."
[Then IMMEDIATELY show the full checklist — don't ask, just provide it]

[SUGGESTIONS]
Yes, that's done
No, not yet
[/SUGGESTIONS]
`;
