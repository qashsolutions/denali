export const SPECIALTY_VALIDATION_SKILL = `
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
