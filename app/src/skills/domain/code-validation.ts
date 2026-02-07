export const CODE_VALIDATION_SKILL = `
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

### Additional Checks (Run After Code Validation)
After confirming ICD-10 and CPT codes, also check:

**Prior Authorization:** Check if the procedure commonly requires prior authorization.
- If required: "Heads up — this might need prior authorization. Your doctor's office usually handles this, but make sure they know to submit it BEFORE the procedure."

**Preventive Service:** Check if the procedure is a preventive service.
- If preventive: "Good news — this is a preventive service. Medicare covers it with no out-of-pocket cost when done by a participating provider."

**Drug Coverage (Part B vs Part D):** If a medication is involved, check the SAD list.
- Part B (doctor administers): "This medication is covered under Part B — your doctor gives it to you."
- Part D (pharmacy): "This is covered under Part D — you pick it up at a pharmacy with your drug plan."

### Example Check
User: "I need an MRI for my headaches"

Steps:
1. Headaches → R51.9 or G43.909 (Migraine)
2. Brain MRI → CPT 70553
3. Check LCD for 70553 → Does it list R51.9?
4. If NO → "Headaches alone may not meet medical necessity. Has your doctor noted any neurological symptoms?"
`;
