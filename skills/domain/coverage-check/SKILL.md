---
name: coverage-check
description: Search Medicare NCDs and LCDs to determine coverage requirements
version: 1.0.0
triggers:
  - diagnosis_and_procedure_identified
  - user_asks_if_covered
  - user_mentions_denial
---

# Coverage Check Skill

This skill searches Medicare's National Coverage Determinations (NCDs) and Local Coverage Determinations (LCDs) to find coverage requirements for a diagnosis + procedure combination.

## Purpose

Determine:
1. Is this service covered by Medicare?
2. What documentation is required?
3. What medical necessity criteria must be met?
4. Are there any exclusions or limitations?

## Process

### 1. Gather Required Information

Before searching, ensure you have:
- Diagnosis (ICD-10 code) — from symptom-to-diagnosis skill
- Procedure (CPT code) — from procedure-identification skill
- Location (state) — for LCD lookup

### 2. Search Coverage Policies

#### Search NCDs First (National)

```typescript
searchNCD({
  procedure_code: "72148",
  diagnosis_code: "M54.5"
});
```

NCDs apply nationwide and take precedence.

#### Then Search LCDs (Regional)

```typescript
searchLCD({
  procedure_code: "72148",
  diagnosis_code: "M54.5",
  state: "CA",
  contractor: "Noridian" // MAC for that region
});
```

LCDs vary by Medicare Administrative Contractor (MAC).

### 3. Check SAD List

For drugs/biologics, check the Self-Administered Drug exclusion list:

```typescript
checkSAD({
  hcpcs_code: "J1234"
});
```

- If on SAD list → Part D (pharmacy benefit)
- If not on SAD list → Part B (medical benefit)

### 4. Extract Coverage Criteria

Parse the policy to find:
- Covered indications (when it's covered)
- Documentation requirements (what must be in medical record)
- Exclusions (when it's NOT covered)
- Frequency limits (how often)

### 5. Pull Supporting Evidence

If needed, search PubMed for clinical evidence:

```typescript
searchPubMed({
  condition: "low back pain",
  intervention: "MRI",
  outcome: "diagnosis"
});
```

## Coverage Determination Categories

### Covered

Service is covered when criteria are met:
```
"Medicare covers lumbar MRI (72148) for low back pain (M54.5) when:
- Pain persists for 6+ weeks despite conservative treatment
- Neurological symptoms are present (weakness, numbness)
- Red flag symptoms warrant urgent imaging"
```

### Covered with Conditions

Service is covered but has limitations:
```
"Medicare covers physical therapy with the following limits:
- Initial evaluation once per episode of care
- Up to 12 visits before additional documentation required
- Must show functional improvement"
```

### Not Covered

Service is excluded:
```
"Medicare does not cover:
- Routine screening MRI without symptoms
- Cosmetic procedures
- Experimental treatments"
```

### No Specific Policy

No NCD/LCD exists — coverage at contractor discretion:
```
"There's no specific Medicare policy for this combination.
Coverage will be determined based on general medical necessity criteria."
```

## Documentation Requirements

Extract what the doctor must document:

| Requirement Type | Example |
|-----------------|---------|
| Duration | "Symptoms present for X weeks" |
| Severity | "Pain level X/10 affecting daily activities" |
| Failed treatments | "Tried PT, NSAIDs, injections without relief" |
| Clinical findings | "Neurological exam showed X" |
| Functional impact | "Unable to perform X activities" |

### Common Requirements by Service

#### Imaging (MRI, CT)
- Duration of symptoms (usually 4-6+ weeks)
- Failed conservative treatment
- Specific clinical findings
- No contraindications

#### Physical Therapy
- Functional limitations
- Treatment goals
- Expected duration
- Progress documentation

#### DME (Equipment)
- Medical necessity statement
- Specific diagnosis
- Expected benefit
- Home use certification

#### Surgery
- Failed conservative treatment (usually 3-6 months)
- Imaging confirming diagnosis
- Functional limitations
- Surgical candidacy evaluation

## Policy Reference Format

When citing policies, include:

```
NCD 220.6 - Positron Emission Tomography (PET) Scans
Effective: January 1, 2023
Contractor: National (all MACs)

LCD L35047 - MRI of the Spine
Effective: October 1, 2023
Contractor: Noridian (CA, NV, etc.)
```

## What NOT to Do

- **Never guarantee coverage**: Say "typically covers" not "will cover"
- **Never skip policy search**: Always check current NCDs/LCDs
- **Never ignore regional differences**: LCDs vary by state
- **Never present codes to user**: Translate to plain English

## Example Output

### When Covered

```
Good news — Medicare typically covers a lumbar spine MRI for your mom's
situation. Based on her symptoms (back pain with leg involvement for 3 months),
here's what the doctor needs to document:

**Required Documentation:**
□ Pain duration: 6+ weeks (she has 3 months ✓)
□ Radiating symptoms: Pain or numbness in leg ✓
□ Failed conservative treatment: PT, medication, or home exercises
□ Neurological findings: Noted on physical exam

**Policy Reference:** LCD L35047 (Noridian)

The key thing Medicare wants to see is that she's tried simpler treatments
first. Has she done any physical therapy or taken medication for this?
```

### When Conditionally Covered

```
Medicare can cover this MRI, but they'll want to see that other treatments
were tried first. This is called "conservative treatment" — things like:

- Physical therapy (usually 4-6 weeks)
- Anti-inflammatory medication
- Home exercises

Has your mom tried any of these?
```

### When Not Covered

```
I looked into this carefully, and unfortunately Medicare doesn't typically
cover [service] for [reason].

Here's why: [explanation in plain English]

However, there may be some alternatives:
- [Alternative 1]
- [Alternative 2]

Would you like me to check coverage for any of these instead?
```

## Edge Cases

### No Policy Found

```
There's no specific Medicare policy I could find for this exact combination.
That doesn't mean it's not covered — it means the Medicare contractor will
decide based on general medical necessity.

The doctor should document:
- Why this service is needed
- What symptoms or findings support it
- What they expect it to show or accomplish
```

### Policy Recently Changed

```
Note: Medicare updated their policy on this in [date]. The new requirements
include [changes]. Make sure the doctor's documentation reflects the
current criteria.
```

### Regional Variation

```
Coverage for this can vary by location. In [state], the local Medicare
contractor ([MAC name]) requires:
- [Requirement 1]
- [Requirement 2]

If she's being seen in a different state, the requirements might be
slightly different.
```

## Example Conversation

**User**: "Will Medicare cover her MRI?"

**Assistant**: *[Has: M54.41 (lumbago with sciatica), 72148 (lumbar MRI), CA location]*

*[Searches: NCD for 72148 — none found]*
*[Searches: LCD L35047 for 72148 + M54.41 in CA]*

"I checked Medicare's coverage policies for a lumbar MRI with her diagnosis.

**Good news**: Medicare typically covers this when certain criteria are met.

Here's what the doctor needs to document:

1. **Duration** — Pain for 6+ weeks (she has 3 months ✓)
2. **Radiating symptoms** — Pain going into the leg ✓
3. **Failed conservative treatment** — Tried PT, meds, or exercises first
4. **Neurological findings** — Exam showing nerve involvement

The main thing I'd want to confirm: has she tried any physical therapy or
medication for this? That's usually what Medicare wants to see before
approving imaging."
