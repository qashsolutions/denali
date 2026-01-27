---
name: procedure-identification
description: Map plain English service descriptions to CPT procedure codes
version: 1.0.0
triggers:
  - user_mentions_procedure
  - user_mentions_test
  - user_mentions_scan
  - user_mentions_treatment
---

# Procedure Identification Skill

This skill translates plain English service descriptions into CPT procedure codes for internal use. Codes are **never shown to users**.

## Purpose

Patients describe services in everyday language:
- "I need a scan for my back"
- "The doctor wants me to do physical therapy"
- "She needs a sleep study"

This skill maps their words to CPT codes needed for coverage checks.

## Process

### 1. Listen for Procedures

Detect when users mention:
- Tests (MRI, CT, X-ray, blood work)
- Treatments (physical therapy, injections, surgery)
- Services (office visits, consultations)
- Equipment (wheelchair, CPAP, walker)

### 2. Clarify When Ambiguous

Many descriptions could map to multiple codes:

| User Says | Clarify |
|-----------|---------|
| "scan" | MRI? CT? X-ray? PET? |
| "back scan" | Lumbar? Thoracic? Cervical? With contrast? |
| "physical therapy" | Initial eval? Follow-up? How many visits? |
| "injection" | What type? Where? |
| "surgery" | What procedure specifically? |

### 3. Map to CPT

Use the CPT lookup tool (dev environment only):

```typescript
// Example mapping
userPhrase: "MRI of my lower back"
clarifications: {
  body_part: "lumbar spine",
  contrast: "without"
}
→ CPT: 72148 (MRI lumbar spine without contrast)
```

### 4. Store for Learning

Queue the successful mapping:

```typescript
queueLearning('update_procedure_mapping', {
  phrase: "MRI of my lower back",
  code: "72148",
  confidence_boost: 0.05
});
```

## Clarifying Question Patterns

### For Imaging (Scans)

1. "What type of scan — MRI, CT, or X-ray?"
2. "Which part of the body?"
3. "Did they mention anything about contrast or dye?"

### For Physical Therapy

1. "Is this the first evaluation or ongoing sessions?"
2. "How many visits per week are planned?"
3. "Is it for a specific injury or general conditioning?"

### For Injections

1. "What type of injection?"
2. "Where in the body?"
3. "Is it for pain, inflammation, or something else?"

### For Surgery

1. "What procedure is being recommended?"
2. "Is it outpatient or will they stay in the hospital?"
3. "Has the doctor given you any paperwork about it?"

### For Equipment (DME)

1. "What equipment do they need?"
2. "Is it for home use?"
3. "Will it be rented or purchased?"

## Common Mappings

Use learned mappings when confidence is high:

### Imaging

| User Phrase | CPT | Description |
|-------------|-----|-------------|
| "MRI of my back" | 72148 | MRI lumbar spine w/o contrast |
| "MRI of my knee" | 73721 | MRI knee w/o contrast |
| "CT scan of my head" | 70450 | CT head w/o contrast |
| "chest X-ray" | 71046 | Chest X-ray, 2 views |
| "mammogram" | 77067 | Screening mammography |

### Therapy

| User Phrase | CPT | Description |
|-------------|-----|-------------|
| "physical therapy evaluation" | 97163 | PT eval, high complexity |
| "physical therapy session" | 97110 | Therapeutic exercises |
| "occupational therapy" | 97530 | Therapeutic activities |
| "speech therapy" | 92507 | Speech therapy |

### Sleep

| User Phrase | CPT | Description |
|-------------|-----|-------------|
| "sleep study" | 95810 | Polysomnography |
| "home sleep test" | 95806 | Home sleep study |
| "CPAP titration" | 95811 | Polysomnography with CPAP |

### Injections

| User Phrase | CPT | Description |
|-------------|-----|-------------|
| "cortisone shot in my knee" | 20610 | Joint injection, large |
| "epidural for back pain" | 62322 | Lumbar epidural injection |
| "trigger point injection" | 20552 | Trigger point injection |

### Surgery

| User Phrase | CPT | Description |
|-------------|-----|-------------|
| "knee replacement" | 27447 | Total knee arthroplasty |
| "hip replacement" | 27130 | Total hip arthroplasty |
| "cataract surgery" | 66984 | Cataract removal with IOL |
| "colonoscopy" | 45378 | Colonoscopy, diagnostic |

## Modifiers Matter

Some situations need CPT modifiers:

| Modifier | Meaning | Example |
|----------|---------|---------|
| -RT | Right side | 73721-RT (MRI right knee) |
| -LT | Left side | 73721-LT (MRI left knee) |
| -50 | Bilateral | 73721-50 (MRI both knees) |
| -26 | Professional component | 72148-26 (interpretation only) |
| -TC | Technical component | 72148-TC (facility charge only) |

## Similar Procedures

Help users understand differences:

### MRI vs CT
```
User: "What's the difference between MRI and CT?"

Response: "Both are imaging tests, but they work differently:
- MRI uses magnets and is better for soft tissues like muscles, tendons, and the brain
- CT uses X-rays and is faster, better for bones and emergencies

Your doctor chose [X] because [reason based on their condition]."
```

### Screening vs Diagnostic
```
Screening mammogram (77067): Routine, no symptoms
Diagnostic mammogram (77066): Following up on a finding
```

## What NOT to Do

- **Never show codes**: Say "back MRI" not "CPT 72148"
- **Never ask for codes**: Say "What test?" not "Do you know the CPT?"
- **Never assume**: If "scan" could be MRI or CT, ask
- **Never skip laterality**: Left knee vs right knee matters

## Example Conversation

**User**: "The doctor wants her to get a scan for her back"

**Assistant**: "I can help figure out what Medicare needs for that scan.

Do you know what type of scan — is it an MRI, CT scan, or X-ray?"

**User**: "I think an MRI"

**Assistant**: "Good — MRIs give detailed pictures that can help see what's causing her symptoms.

Is the scan for her lower back, middle back, or upper back/neck area?"

**User**: "Lower back"

**Assistant**: *[Internal: Maps to 72148 (MRI lumbar spine w/o contrast) or 72149 (with contrast)]*

"Perfect — an MRI of the lower back. One more question: did they mention anything about using contrast dye, or is it just a regular MRI?"

**User**: "Just regular, no dye"

**Assistant**: *[Internal: Confirms 72148]*

"Got it — a lumbar spine MRI without contrast. Let me check what Medicare typically requires for this..."
