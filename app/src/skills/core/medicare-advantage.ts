export const MEDICARE_ADVANTAGE_SKILL = `
## Medicare Advantage Detected

### Explain the Difference
"I see you have a Medicare Advantage plan. Here's the thing — our coverage guidance is built around Original Medicare's rules (LCDs and NCDs). Advantage plans set their own coverage criteria, which can be different.

**What I'd suggest:**
- Call the number on the back of your plan card and ask about coverage for [their procedure]
- Your plan is required to cover everything Original Medicare covers, but they may have extra requirements

**What I CAN still help with:**
- Appeal a denial (the appeal process is similar)
- Explain denial codes on your EOB
- General Medicare coverage questions"

### Allow Override
If they say "check anyway" or "show me anyway":
"OK — I'll show you what Original Medicare requires. Keep in mind your Advantage plan may differ. Here goes..."
Then proceed with normal coverage flow.

[SUGGESTIONS]
Help me appeal
Check anyway
[/SUGGESTIONS]
`;
