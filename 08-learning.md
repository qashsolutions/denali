# Agentic Learning System

Denali.health learns from every interaction to improve accuracy, speed, and user experience. This document outlines the complete learning loop.

---

## Learning Philosophy

```
Every interaction is a training signal.
Every correction makes the system smarter.
Every successful outcome reinforces good paths.
```

---

## Learning Layers

### Layer 1: Language Understanding
**Goal**: Get better at understanding what users mean

| Signal | Example | What We Learn |
|--------|---------|---------------|
| User says | "My back is killing me" | → Maps to "back pain" |
| User says | "Can't sleep at night" | → Maps to "insomnia" |
| User corrects | "No, it's my shoulder not back" | → Negative signal for "back" |

**Storage**: `symptom_mappings`, `procedure_mappings`

**Learning Trigger**: Every time Claude successfully maps a phrase to a code

---

### Layer 2: Clinical Reasoning
**Goal**: Understand which diagnosis + procedure + documentation = approval

| Signal | What We Learn |
|--------|---------------|
| Appeal approved | This ICD-10 + CPT + documentation combo works |
| Appeal denied | This combo needs different documentation |
| User feedback "helped" | Reinforce this reasoning path |
| User feedback "didn't help" | Flag for review |

**Storage**: `coverage_paths`, `appeal_outcomes`

---

### Layer 3: Conversation Patterns
**Goal**: Know which questions to ask and in what order

| Signal | What We Learn |
|--------|---------------|
| User answers quickly | Good question, keep asking this way |
| User says "I don't know" | Question too complex, simplify |
| User skips question | Question not relevant, skip in future |
| Successful appeal | This question sequence works |

**Storage**: `conversation_patterns`

---

### Layer 4: Policy Intelligence
**Goal**: Stay current with Medicare policy changes

| Signal | What We Learn |
|--------|---------------|
| NCD/LCD updated | Re-index coverage requirements |
| New denial pattern | Policy interpretation changed |
| MAC-specific denial | Regional variation detected |

**Storage**: `policy_cache`, `policy_changes`

---

### Layer 5: User Behavior
**Goal**: Personalize and optimize UX

| Signal | What We Learn |
|--------|---------------|
| User prints checklist | This format works |
| User copies appeal letter | Letter format effective |
| User returns with same issue | First guidance wasn't clear |
| User upgrades to paid | Value proposition worked |

**Storage**: `user_events`, `conversion_signals`

---

## Database Schema Additions

### `conversation_patterns`
Tracks successful conversation flows.

```sql
CREATE TABLE conversation_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Pattern identification
    trigger_phrase TEXT NOT NULL,           -- What started this pattern
    intent TEXT NOT NULL,                   -- 'coverage_check', 'appeal_help', 'provider_lookup'
    -- Question sequence that worked
    question_sequence JSONB NOT NULL,       -- [{question, avg_response_time, skip_rate}]
    -- Outcome
    success_rate REAL DEFAULT 0.5,
    use_count INTEGER DEFAULT 1,
    -- Timestamps
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversation_patterns_trigger ON conversation_patterns(trigger_phrase);
CREATE INDEX idx_conversation_patterns_intent ON conversation_patterns(intent);
```

### `appeal_outcomes`
Tracks real-world appeal results (user-reported).

```sql
CREATE TABLE appeal_outcomes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appeal_id UUID REFERENCES appeals(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    -- What we generated
    icd10_codes TEXT[],
    cpt_codes TEXT[],
    ncd_refs TEXT[],
    lcd_refs TEXT[],
    -- Real outcome (user-reported)
    outcome TEXT CHECK (outcome IN ('approved', 'denied', 'partial', 'pending', 'unknown')),
    denial_reason TEXT,                     -- If denied, why?
    -- Learning signals
    documentation_gaps TEXT[],              -- What was missing?
    successful_arguments TEXT[],            -- What worked?
    -- Timestamps
    outcome_reported_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appeal_outcomes_codes ON appeal_outcomes(icd10_codes, cpt_codes);
CREATE INDEX idx_appeal_outcomes_outcome ON appeal_outcomes(outcome);
```

### `policy_cache`
Caches and tracks policy changes.

```sql
CREATE TABLE policy_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Policy identification
    policy_type TEXT NOT NULL CHECK (policy_type IN ('ncd', 'lcd', 'article')),
    policy_id TEXT NOT NULL,
    contractor_id TEXT,                     -- For LCDs
    -- Content
    title TEXT,
    effective_date DATE,
    content_hash TEXT,                      -- To detect changes
    coverage_requirements JSONB,            -- Parsed requirements
    -- Change tracking
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    last_changed_at TIMESTAMPTZ,
    change_summary TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(policy_type, policy_id, contractor_id)
);

CREATE INDEX idx_policy_cache_policy ON policy_cache(policy_type, policy_id);
```

### `user_events`
Tracks user behavior for UX optimization.

```sql
CREATE TABLE user_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- User identification
    phone TEXT,
    device_fingerprint TEXT,
    -- Event
    event_type TEXT NOT NULL,               -- 'print', 'copy', 'download', 'share', 'return_visit', 'upgrade'
    event_data JSONB,                       -- Additional context
    -- Source
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    appeal_id UUID REFERENCES appeals(id) ON DELETE SET NULL,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_events_phone ON user_events(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_user_events_type ON user_events(event_type);
CREATE INDEX idx_user_events_created ON user_events(created_at);
```

### `learning_queue`
Queue for async learning jobs.

```sql
CREATE TABLE learning_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Job details
    job_type TEXT NOT NULL,                 -- 'update_mapping', 'train_pattern', 'reindex_policy'
    job_data JSONB NOT NULL,
    priority INTEGER DEFAULT 5,             -- 1=highest, 10=lowest
    -- Status
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    last_error TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_learning_queue_status ON learning_queue(status, priority);
```

---

## Learning Triggers

### 1. After Every Message

```typescript
// Edge Function: process-message
async function afterMessage(message: Message, conversation: Conversation) {
  // Extract entities
  const entities = await extractEntities(message.content);

  // Queue mapping updates
  for (const symptom of entities.symptoms) {
    await queueLearning('update_mapping', {
      type: 'symptom',
      phrase: symptom.phrase,
      code: symptom.icd10,
      confidence_boost: 0.05
    });
  }

  // Track conversation pattern
  if (message.role === 'user') {
    await trackQuestionResponse(conversation.id, message);
  }
}
```

### 2. After Feedback (👍/👎)

```typescript
// Edge Function: process-feedback
async function afterFeedback(feedback: Feedback) {
  const message = await getMessage(feedback.message_id);
  const conversation = await getConversation(message.conversation_id);

  if (feedback.rating === 'up') {
    // Reinforce all mappings in this conversation
    await reinforceMappings(conversation.id, 0.1);
    // Mark conversation pattern as successful
    await markPatternSuccess(conversation.id);
  } else {
    // Flag for review
    await flagForReview(conversation.id, feedback.correction);
    // Decrease confidence in mappings
    await penalizeMappings(conversation.id, 0.1);
  }
}
```

### 3. After Appeal Letter Generated

```typescript
// Edge Function: after-appeal-generated
async function afterAppealGenerated(appeal: Appeal) {
  // Store the coverage path
  await storeCoveragePath({
    icd10_codes: appeal.icd10_codes,
    cpt_codes: appeal.cpt_codes,
    ncd_refs: appeal.ncd_refs,
    lcd_refs: appeal.lcd_refs,
    outcome: 'pending' // Will be updated when user reports
  });

  // Track conversion
  await trackEvent(appeal.phone, 'appeal_generated', {
    conversation_id: appeal.conversation_id
  });
}
```

### 4. After User Reports Outcome

```typescript
// Edge Function: report-appeal-outcome
async function reportOutcome(appeal_id: string, outcome: string, details: object) {
  // Store outcome
  await storeAppealOutcome({
    appeal_id,
    outcome,
    denial_reason: details.denial_reason,
    documentation_gaps: details.gaps
  });

  // Update coverage path
  if (outcome === 'approved') {
    await reinforceCoveragePath(appeal_id, 0.2);
  } else if (outcome === 'denied') {
    // Learn from denial
    await learnFromDenial(appeal_id, details);
  }

  // Queue pattern analysis
  await queueLearning('analyze_outcome_pattern', { appeal_id });
}
```

### 5. Nightly Learning Jobs

```typescript
// Scheduled Function: nightly-learning
async function nightlyLearning() {
  // 1. Process learning queue
  await processLearningQueue();

  // 2. Aggregate conversation patterns
  await aggregateConversationPatterns();

  // 3. Check for policy updates
  await checkPolicyUpdates();

  // 4. Prune low-confidence mappings
  await pruneWeakMappings(threshold: 0.3);

  // 5. Generate learning report
  await generateLearningReport();
}
```

---

## Feedback Loops

### Loop 1: Immediate (< 1 second)
- User types → Entity extraction → UI suggestions
- Previous mappings inform autocomplete

### Loop 2: Session (< 1 minute)
- Feedback received → Mappings adjusted
- Conversation pattern recorded

### Loop 3: Daily (overnight)
- Aggregate patterns analyzed
- Weak mappings pruned
- Policy cache refreshed

### Loop 4: Weekly
- Appeal outcomes analyzed
- Coverage path success rates updated
- Model prompts refined

---

## Prompt Engineering for Learning

Claude's prompts should include learning context:

```typescript
const systemPrompt = `
You are a Medicare coverage assistant. Use the following learned knowledge:

## High-Confidence Symptom Mappings (>0.8)
${topSymptomMappings.map(m => `- "${m.phrase}" → ${m.icd10_code} (${m.confidence})`).join('\n')}

## Successful Coverage Paths
${successfulPaths.map(p => `- ${p.icd10} + ${p.cpt} → Usually approved with: ${p.documentation}`).join('\n')}

## Recent Denials to Avoid
${recentDenials.map(d => `- ${d.icd10} + ${d.cpt}: Denied because "${d.reason}"`).join('\n')}

## Effective Question Sequences
${effectivePatterns.map(p => `- For "${p.trigger}": Ask ${p.questions.join(' → ')}`).join('\n')}
`;
```

---

## Learning Metrics Dashboard

Track these metrics to measure learning effectiveness:

| Metric | Target | Measurement |
|--------|--------|-------------|
| Symptom mapping accuracy | >90% | User corrections / total mappings |
| Appeal success rate | >70% | Approved / total reported outcomes |
| Conversation completion | >80% | Completed / started conversations |
| Time to guidance | <3 min | Avg time from first message to checklist |
| User return rate | >30% | Users who come back within 30 days |
| Feedback rate | >10% | Messages with 👍/👎 / total assistant messages |

---

## Privacy-Preserving Learning

All learning is **anonymized**:

1. **Symptom/Procedure mappings**: No user link, just phrase → code
2. **Coverage paths**: No user link, just code combinations
3. **Conversation patterns**: Aggregated, no individual conversations stored
4. **Appeal outcomes**: Anonymized after 90 days

---

## Edge Cases

### What if user corrects a mapping?

```typescript
// User: "No, it's not back pain, it's kidney pain"
await penalizeMapping('back is killing me', 'M54.5', -0.2);
await boostMapping('back is killing me', 'N23', 0.3); // Renal colic
```

### What if appeal was denied?

```typescript
// Learn what documentation was missing
const denial = await analyzeDenial(appeal_id);
await storeLearning({
  codes: denial.codes,
  missing: denial.documentation_gaps,
  suggestion: 'Next time, ensure patient has tried conservative treatment first'
});
```

### What if policy changed?

```typescript
// Detected NCD update
await invalidateCoveragePaths({
  ncd_id: 'NCD-220.6',
  after_date: '2024-01-01'
});
await queueLearning('reindex_policy', { ncd_id: 'NCD-220.6' });
```

---

## Implementation Priority

| Phase | What | Why |
|-------|------|-----|
| **MVP** | symptom_mappings, procedure_mappings | Core entity recognition |
| **v1.1** | user_feedback → mapping updates | Close the feedback loop |
| **v1.2** | coverage_paths, appeal_outcomes | Learn what works |
| **v2.0** | conversation_patterns | Optimize question flow |
| **v2.1** | policy_cache | Stay current with Medicare |
| **v3.0** | Full prompt injection | AI learns from AI |

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DENALI LEARNING LOOP                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   USER INPUT                                                        │
│       │                                                             │
│       ▼                                                             │
│   ┌─────────────────┐                                               │
│   │ Entity Extract  │ ──────► symptom_mappings                      │
│   │ (symptoms, dx)  │         procedure_mappings                    │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │ Claude Reasons  │ ◄────── coverage_paths (what worked before)   │
│   │ (coverage check)│         policy_cache (current rules)          │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │ Generate Output │ ──────► appeal_outcomes (track results)       │
│   │ (guidance/appeal)│        conversation_patterns (what to ask)   │
│   └────────┬────────┘                                               │
│            │                                                        │
│            ▼                                                        │
│   ┌─────────────────┐                                               │
│   │ User Feedback   │ ──────► Reinforce or penalize mappings        │
│   │ (👍/👎/outcome) │         Update success rates                  │
│   └─────────────────┘                                               │
│                                                                     │
│   NIGHTLY BATCH                                                     │
│   ├── Aggregate patterns                                            │
│   ├── Prune weak mappings                                           │
│   ├── Check policy updates                                          │
│   └── Inject learnings into prompts                                 │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

The system gets smarter with every:
- ✅ Message sent
- ✅ Entity recognized
- ✅ Feedback given
- ✅ Appeal outcome reported
- ✅ Policy update detected
