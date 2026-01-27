---
name: symptom-to-diagnosis
description: Map plain English symptom descriptions to ICD-10 diagnosis codes
version: 1.0.0
triggers:
  - user_describes_symptoms
  - user_describes_condition
  - user_mentions_diagnosis
---

# Symptom-to-Diagnosis Skill

This skill translates plain English symptom descriptions into ICD-10 diagnosis codes for internal use. Codes are **never shown to users**.

## Purpose

Patients don't know medical codes. They say things like:
- "My back is killing me"
- "I get dizzy when I stand up"
- "She can't catch her breath"

This skill maps their words to the appropriate ICD-10 codes needed for coverage checks.

## Process

### 1. Listen for Symptoms

Detect when users describe:
- Physical symptoms (pain, numbness, weakness)
- Conditions (diabetes, high blood pressure)
- Problems (can't sleep, trouble breathing)

### 2. Ask Clarifying Questions

Gather specifics to narrow down the code:

| Question Type | Examples |
|--------------|----------|
| **Location** | "Where exactly is the pain?" |
| **Duration** | "How long has this been going on?" |
| **Severity** | "On a scale of 1-10, how bad is it?" |
| **Onset** | "Did it start suddenly or gradually?" |
| **Character** | "Is it sharp, dull, or burning?" |
| **Radiation** | "Does it spread anywhere else?" |
| **Triggers** | "Does anything make it better or worse?" |

### 3. Map to ICD-10

Use the ICD-10 search tool to find the best match:

```typescript
// Example mapping
userPhrase: "dizzy when I stand up"
clarifications: {
  duration: "few weeks",
  frequency: "every time",
  other_symptoms: "lightheaded, sometimes see spots"
}
→ ICD-10: R55 (Syncope and collapse) or R42 (Dizziness)
```

### 4. Store for Learning

Queue the successful mapping:

```typescript
queueLearning('update_symptom_mapping', {
  phrase: "dizzy when I stand up",
  code: "R55",
  confidence_boost: 0.05
});
```

## Clarifying Question Patterns

### For Pain

1. "Where exactly is the pain?"
2. "How long have you had it?"
3. "Does it stay in one place or travel somewhere else?"
4. "What does it feel like — sharp, dull, burning, aching?"
5. "What were you doing when it started?"

### For Neurological Symptoms

1. "Can you describe what happens?"
2. "How often does it happen?"
3. "How long does each episode last?"
4. "Is there any warning before it happens?"
5. "Have you noticed any patterns or triggers?"

### For Breathing Issues

1. "When do you notice it most — at rest, with activity, or lying down?"
2. "How long has this been going on?"
3. "Do you have any cough or chest tightness?"
4. "Does anything make it better or worse?"

### For General Symptoms

1. "Can you tell me more about what you're experiencing?"
2. "When did this start?"
3. "Is it constant or does it come and go?"
4. "Have you noticed anything else unusual?"

## Common Mappings

Use learned mappings when confidence is high:

| User Phrase | ICD-10 | Confidence |
|-------------|--------|------------|
| "back pain" | M54.5 (Low back pain) | 0.90 |
| "knee pain" | M25.56 (Pain in knee) | 0.88 |
| "dizzy spells" | R42 (Dizziness) | 0.85 |
| "can't sleep" | G47.00 (Insomnia) | 0.82 |
| "short of breath" | R06.02 (Shortness of breath) | 0.87 |
| "chest pain" | R07.9 (Chest pain, unspecified) | 0.75 |
| "headaches" | R51.9 (Headache) | 0.88 |
| "tired all the time" | R53.83 (Fatigue) | 0.80 |

## Specificity Matters

ICD-10 rewards specificity. Always try to get the most specific code:

```
Generic: M54.5 (Low back pain)
Better: M54.51 (Vertebrogenic low back pain)
Best: M54.51 + G89.29 (with chronic pain syndrome)
```

### Questions That Increase Specificity

| Generic Code | Ask | Specific Code |
|--------------|-----|---------------|
| M54.5 (back pain) | "Does it go into your legs?" | M54.4 (Lumbago with sciatica) |
| R42 (dizziness) | "Do you feel like spinning?" | H81.10 (Benign paroxysmal vertigo) |
| R07.9 (chest pain) | "Does it feel like pressure?" | R07.89 (Other chest pain) |

## Multiple Codes

Some situations need multiple codes:

```
User: "I have diabetes and my feet are numb"

Primary: E11.9 (Type 2 diabetes without complications)
Secondary: E11.42 (Type 2 diabetes with diabetic polyneuropathy)
```

## Red Flags

Some symptoms require immediate medical attention. Don't just map — acknowledge:

| Symptom | Response |
|---------|----------|
| Chest pain + shortness of breath | "If you're having these symptoms now, please call 911 or go to the ER immediately." |
| Sudden severe headache | "A sudden severe headache can be serious. If this is happening now, please seek emergency care." |
| Sudden numbness/weakness one side | "These could be signs of a stroke. If happening now, call 911." |

After the safety message, you can continue with coverage questions if they confirm it's not an emergency.

## What NOT to Do

- **Never show codes to users**: Say "back pain" not "M54.5"
- **Never ask for codes**: Say "What's going on?" not "Do you know the ICD-10?"
- **Never diagnose**: Say "symptoms like these" not "you have sciatica"
- **Never guess without clarification**: If unsure, ask more questions

## Example Conversation

**User**: "My mom's back is killing her"

**Assistant**: "I'm sorry to hear your mom is dealing with back pain. To help figure out what Medicare needs, I have a few questions.

Where in her back is the pain — upper, middle, or lower?"

**User**: "Lower back, and it goes down her left leg"

**Assistant**: "Lower back pain that goes down into the leg — that's called radiating pain, and it's an important detail.

How long has she been dealing with this?"

**User**: "About 3 months"

**Assistant**: "Three months of lower back pain radiating into the leg — thank you. One more question: has she had any numbness or tingling in that leg?"

**User**: "Yes, her foot tingles sometimes"

**Assistant**: *[Internal: Maps to M54.41 (Lumbago with sciatica, left side) + potentially M79.2 (Neuralgia)]*

"That's really helpful information. The combination of back pain, leg pain, and tingling often supports the need for imaging like an MRI.

Has she tried any treatments so far?"
