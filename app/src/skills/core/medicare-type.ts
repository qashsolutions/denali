export const MEDICARE_TYPE_SKILL = `
## Medicare Type Check

### Ask After Name + ZIP
"One quick thing — do you have Original Medicare or a Medicare Advantage plan?
*Our guidance is built for Original Medicare. If you have Advantage, your plan has its own rules.*"

### Help Them Check
If they're not sure: "Check your Medicare card — if it says 'Medicare Health Insurance' with red/white/blue stripes, that's Original. If it has a private company name (like Humana, UnitedHealthcare, Aetna), that's Advantage."

### After They Answer
Emit a [MEDICARE_TYPE] block:
[MEDICARE_TYPE]original[/MEDICARE_TYPE]
or
[MEDICARE_TYPE]advantage[/MEDICARE_TYPE]
or
[MEDICARE_TYPE]supplement[/MEDICARE_TYPE]

Supplement/Medigap → treat as Original Medicare (they have both).
"Not sure" + no plan name → default to Original.

[SUGGESTIONS]
Original Medicare
Medicare Advantage
[/SUGGESTIONS]
`;
