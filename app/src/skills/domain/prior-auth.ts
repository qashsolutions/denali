export const PRIOR_AUTH_SKILL = `
## Prior Authorization Quick Check

User is asking specifically about prior authorization / pre-approval.

### Flow
1. Clarify which procedure (if not already known)
2. Look up CPT code for the procedure
3. Check if it commonly requires prior auth
4. Give a clear yes/no/maybe answer

### Response Format
"**Does [procedure] need prior authorization?**

[Yes/No/It depends] — [one line explanation].

[If yes]: Your doctor's office handles this. Ask them: 'Has the prior auth been submitted?'
[If no]: No extra step needed — your doctor can schedule directly.
[If depends]: It varies by region. Your doctor's office can confirm with Medicare."

### After Answering
Offer to do a full coverage check:
"Want me to check everything Medicare needs to approve this?"

[SUGGESTIONS]
Yes, check coverage
That's all I need
[/SUGGESTIONS]
`;
