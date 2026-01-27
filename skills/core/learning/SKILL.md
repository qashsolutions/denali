---
name: learning
description: How to learn from interactions and improve over time
version: 1.0.0
triggers:
  - successful_mapping
  - user_feedback
  - appeal_outcome
  - conversation_complete
---

# Learning Skill

This skill defines what to learn from each interaction and how to store it for future improvement.

## Philosophy

```
Every interaction is a training signal.
Every correction makes the system smarter.
Every successful outcome reinforces good paths.
```

## What to Learn

### 1. Language Mappings

When a user describes something and we successfully map it to a code:

**Symptom → ICD-10**
```
User says: "dizzy spells" → We map to: R42
User says: "back is killing me" → We map to: M54.5
User says: "can't catch my breath" → We map to: R06.02
```

**Procedure → CPT**
```
User says: "back scan" → We map to: 72148
User says: "sleep study" → We map to: 95810
User says: "knee replacement" → We map to: 27447
```

### 2. Successful Coverage Paths

When a combination of diagnosis + procedure + documentation leads to approval:

```
M54.5 (back pain) + 72148 (lumbar MRI) + NCD 220.1 → Approved
  Documentation: pain >6 weeks, failed conservative tx, neurological symptoms
```

### 3. Question Sequences

Which questions in which order lead to complete, accurate information:

```
Intent: "coverage_check"
Trigger: "need approval for"
Questions:
  1. "What's going on?" (symptom intake) - avg 15s response
  2. "How long?" (duration) - avg 8s response
  3. "Tried any treatment?" (prior tx) - avg 12s response
  4. "Who's the doctor?" (provider) - avg 10s response
Success rate: 85%
```

### 4. Appeal Outcomes

Real-world results when users report back:

```
Appeal ID: xxx
Codes: M54.5 + 72148
Policy: LCD L35047
Outcome: Approved
Days to resolution: 45
What worked: "Documented failed 6 weeks PT"
```

## Learning Triggers

### After Every Message

```typescript
// Extract entities from user message
const entities = extractEntities(message);

// Queue mapping updates
for (const symptom of entities.symptoms) {
  queueLearning('update_symptom_mapping', {
    phrase: symptom.userPhrase,
    code: symptom.icd10,
    confidence_boost: 0.05
  });
}
```

### After Positive Feedback (👍)

```typescript
// Reinforce all mappings in this conversation
reinforceMappings(conversation_id, +0.1);

// Mark conversation pattern as successful
markPatternSuccess(conversation_id);
```

### After Negative Feedback (👎)

```typescript
// Penalize mappings
penalizeMappings(conversation_id, -0.15);

// If correction provided, learn from it
if (correction) {
  // "No, it's kidney pain not back pain"
  createNewMapping(correction.phrase, correction.code, 0.3);
  penalizeMapping(original.phrase, original.code, -0.2);
}

// Flag for human review if needed
flagForReview(conversation_id);
```

### After Appeal Letter Generated

```typescript
// Store the coverage path (outcome pending)
storeCoveragePath({
  icd10_codes: appeal.diagnosis_codes,
  cpt_codes: appeal.procedure_codes,
  ncd_refs: appeal.ncd_references,
  lcd_refs: appeal.lcd_references,
  outcome: 'pending'
});
```

### After User Reports Outcome

```typescript
if (outcome === 'approved') {
  // Reinforce this path
  reinforceCoveragePath(appeal_id, +0.2);
  reinforceMappings(conversation_id, +0.15);

  // Store successful arguments
  storeSuccessfulArguments(appeal_id, arguments);
} else if (outcome === 'denied') {
  // Learn from failure
  penalizeCoveragePath(appeal_id, -0.1);

  // Store what was missing
  storeDocumentationGaps(appeal_id, gaps);

  // Queue for pattern analysis
  queueLearning('analyze_denial', { appeal_id, reason });
}
```

## Confidence Scoring

All mappings have a confidence score (0.0 - 1.0):

| Score | Meaning | Action |
|-------|---------|--------|
| 0.0 - 0.3 | Low confidence | Don't use automatically, may prune |
| 0.3 - 0.6 | Medium confidence | Use with verification |
| 0.6 - 0.8 | Good confidence | Use confidently |
| 0.8 - 1.0 | High confidence | Prioritize this mapping |

### Confidence Adjustments

| Event | Adjustment |
|-------|------------|
| Successful use | +0.05 |
| Positive feedback | +0.10 |
| Negative feedback | -0.15 |
| User correction | -0.20 (old), +0.30 (new) |
| Appeal approved | +0.15 |
| Appeal denied | -0.10 |
| Unused 90+ days | Eligible for pruning |

## Storage Tables

### symptom_mappings
```sql
phrase: "dizzy spells"
icd10_code: "R42"
icd10_description: "Dizziness and giddiness"
confidence: 0.75
use_count: 234
last_used_at: 2024-01-15
```

### procedure_mappings
```sql
phrase: "back scan"
cpt_code: "72148"
cpt_description: "MRI lumbar spine w/o contrast"
confidence: 0.82
use_count: 567
last_used_at: 2024-01-15
```

### coverage_paths
```sql
icd10_code: "M54.5"
cpt_code: "72148"
ncd_id: null
lcd_id: "L35047"
outcome: "approved"
success_rate: 0.78
documentation_required: ["pain >6 weeks", "failed conservative tx"]
use_count: 89
```

### conversation_patterns
```sql
trigger_phrase: "need approval for"
intent: "coverage_check"
question_sequence: [
  {"question": "What's going on?", "avg_response_time": 15, "skip_rate": 0.02},
  {"question": "How long?", "avg_response_time": 8, "skip_rate": 0.05},
  ...
]
success_rate: 0.85
use_count: 456
```

## Nightly Maintenance

```typescript
async function nightlyLearning() {
  // 1. Process pending learning jobs
  await processLearningQueue();

  // 2. Prune low-confidence, unused mappings
  await pruneWeakMappings({
    confidence_threshold: 0.3,
    unused_days: 90
  });

  // 3. Aggregate conversation patterns
  await aggregateConversationPatterns();

  // 4. Check for policy updates
  await checkPolicyUpdates();

  // 5. Generate learning report
  await generateLearningReport();
}
```

## Privacy

All learning is **anonymized**:

- Mappings have no user link
- Coverage paths have no user link
- Conversation patterns are aggregated
- Appeal outcomes anonymized after 90 days
- Individual conversations not stored in learning tables

## Injecting Learning into Prompts

When Claude responds, inject learned context:

```
## High-Confidence Symptom Mappings
- "dizzy spells" → R42 (0.92)
- "back is killing me" → M54.5 (0.88)

## Successful Coverage Paths
- M54.5 + 72148: Usually approved with pain >6 weeks, failed PT

## Recent Denials to Avoid
- M54.5 + 72148: Denied when duration <6 weeks documented

## Effective Question Sequences
- For "need approval": Ask symptoms → duration → prior tx → provider
```
