# Database Schema

Supabase is used for auth, data storage, and learning memory.

---

## Tables

### Core Tables
| Table | Purpose |
|-------|---------|
| `users` | Auth, preferences, plan type, accessibility settings |
| `user_verification` | Email + mobile OTP status |
| `subscriptions` | Plan type, start date, billing status |
| `usage` | Appeal count per user (for free tier + pay-per-appeal) |
| `conversations` | Chat history per user |
| `messages` | Individual messages within conversations |
| `appeals` | Generated appeal letters linked to conversations |
| `user_feedback` | Thumbs up/down, corrections |

### Learning Tables (Global, No User Link)
| Table | Purpose |
|-------|---------|
| `symptom_mappings` | "dizzy spells" → R42 (learned from interactions) |
| `procedure_mappings` | "back scan" → 72148 (learned from interactions) |
| `coverage_paths` | Successful dx + px + policy combinations |
| `conversation_patterns` | Successful question sequences by intent |
| `appeal_outcomes` | Real-world appeal results (user-reported) |
| `policy_cache` | Medicare policy tracking and change detection |
| `user_events` | User behavior tracking for UX optimization |
| `learning_queue` | Async job queue for background learning |

---

## Table Details

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key (Supabase Auth) |
| phone | text | **Required, Unique** - Primary identifier |
| email | text | Optional for free, required for $25/month |
| plan | text | 'free', 'per_appeal', 'unlimited' |
| theme | text | 'auto', 'light', 'dark' |
| notifications_enabled | boolean | Push notifications toggle |
| text_size | float | 0.8-1.5 multiplier (1.0 = 16px) |
| high_contrast | boolean | Accessibility: high contrast mode |
| reduce_motion | boolean | Accessibility: minimize animations |
| autoplay_media | boolean | Accessibility: auto-play media |
| voiceover_optimization | boolean | Accessibility: VoiceOver mode |
| created_at | timestamp | |
| updated_at | timestamp | |

### `user_verification`
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK to users |
| email_verified | boolean | |
| phone_verified | boolean | |
| verified_at | timestamp | |

### `subscriptions`
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | FK to users |
| plan | text | 'per_appeal', 'unlimited' |
| status | text | 'active', 'cancelled', 'past_due' |
| stripe_customer_id | text | |
| started_at | timestamp | |

### `usage`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| phone | text | **Required, Unique** - Primary tracking key |
| user_id | uuid | FK to users (linked after signup) |
| device_fingerprint | text | Analytics/fraud detection only |
| appeal_count | int | Count of completed appeals |
| last_appeal_at | timestamp | |

### `conversations`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| user_id | uuid | FK to users |
| started_at | timestamp | |
| status | text | 'active', 'completed' |

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| conversation_id | uuid | FK to conversations |
| role | text | 'user', 'assistant' |
| content | text | |
| created_at | timestamp | |

### `symptom_mappings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| phrase | text | User's plain English |
| icd10_code | text | Mapped code |
| confidence | float | 0-1 score |
| use_count | int | Times this mapping used |

### `procedure_mappings`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| phrase | text | User's plain English |
| cpt_code | text | Mapped code |
| confidence | float | 0-1 score |
| use_count | int | Times this mapping used |

### `user_feedback`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| message_id | uuid | FK to messages |
| rating | text | 'up', 'down' |
| correction | text | User's correction (optional) |
| created_at | timestamp | |

### `coverage_paths`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| icd10_code | text | Diagnosis |
| cpt_code | text | Procedure |
| ncd_id | text | Policy ID |
| lcd_id | text | Policy ID (optional) |
| outcome | text | 'approved', 'denied' |
| use_count | int | |

### `appeals`
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | Primary key |
| conversation_id | uuid | FK to conversations |
| user_id | uuid | FK to users |
| denial_date | date | When denial was received |
| denial_reason | text | Reason given for denial |
| service_description | text | What was denied |
| appeal_letter | text | Generated appeal content |
| icd10_codes | text[] | Diagnosis codes cited |
| cpt_codes | text[] | Procedure codes cited |
| ncd_refs | text[] | NCD policy references |
| lcd_refs | text[] | LCD policy references |
| pubmed_refs | text[] | PubMed citations (PMIDs) |
| deadline | date | Appeal deadline (120 days) |
| status | text | 'draft', 'sent', 'approved', 'denied', 'pending' |
| created_at | timestamp | |
| updated_at | timestamp | |

---

## Row Level Security (RLS)

| Table | Rule |
|-------|------|
| `users` | Users can only read/write their own row |
| `conversations` | Users can only access their own conversations |
| `messages` | Users can only access messages in their conversations |
| `usage` | Users can only read their own usage |
| `symptom_mappings` | Read: all users. Write: system only |
| `procedure_mappings` | Read: all users. Write: system only |
| `coverage_paths` | Read: all users. Write: system only |
| `user_feedback` | Users can only write feedback on their own messages |
| `appeals` | Users can only access their own appeals |

---

## Privacy

**Do NOT store:**
- Full names
- Addresses
- SSN or insurance IDs
- Actual medical records

**OK to store:**
- Email (for auth)
- Phone (for auth)
- Anonymized symptom/procedure phrases
- Conversation content (user consented)

---

## Account Deletion (GDPR/CCPA Compliance)

### Deletion Trigger

User initiates from Settings → Delete Account with confirmation ("type DELETE").

### Deletion Procedure

```sql
-- 1. Cancel Stripe subscription (via Edge Function, before DB changes)
-- stripe.subscriptions.cancel(subscription_id)

-- 2. Delete user-linked data (cascade or explicit)
DELETE FROM user_feedback WHERE message_id IN (
  SELECT id FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE user_id = $user_id
  )
);
DELETE FROM messages WHERE conversation_id IN (
  SELECT id FROM conversations WHERE user_id = $user_id
);
DELETE FROM conversations WHERE user_id = $user_id;
DELETE FROM usage WHERE user_id = $user_id;
DELETE FROM subscriptions WHERE user_id = $user_id;
DELETE FROM user_verification WHERE user_id = $user_id;
DELETE FROM users WHERE id = $user_id;

-- 3. Anonymize learning data (optional - keeps system intelligence)
-- symptom_mappings, procedure_mappings, coverage_paths have no user FK
-- user_feedback can be anonymized instead of deleted if valuable
```

### Data Retention After Deletion

| Table | Action | Reason |
|-------|--------|--------|
| `users` | **Deleted** | PII removal |
| `user_verification` | **Deleted** | PII removal |
| `subscriptions` | **Deleted** | PII removal |
| `usage` | **Deleted** | User-linked |
| `conversations` | **Deleted** | User content |
| `messages` | **Deleted** | User content |
| `appeals` | **Deleted** | User content |
| `user_feedback` | **Deleted or Anonymized** | Optional learning |
| `symptom_mappings` | **Retained** | No user link, system learning |
| `procedure_mappings` | **Retained** | No user link, system learning |
| `coverage_paths` | **Retained** | No user link, system learning |

### Edge Function: `delete-account`

```typescript
// supabase/functions/delete-account/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

serve(async (req) => {
  const { user_id, confirmation } = await req.json()

  // Require explicit confirmation
  if (confirmation !== 'DELETE') {
    return new Response(JSON.stringify({ error: 'Confirmation required' }), { status: 400 })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Get user's Stripe customer ID
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user_id)
    .single()

  // 2. Cancel Stripe subscription if exists
  if (subscription?.stripe_customer_id) {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!)
    const subscriptions = await stripe.subscriptions.list({
      customer: subscription.stripe_customer_id,
      status: 'active'
    })
    for (const sub of subscriptions.data) {
      await stripe.subscriptions.cancel(sub.id)
    }
  }

  // 3. Delete all user data (in order due to FKs)
  await supabase.rpc('delete_user_cascade', { target_user_id: user_id })

  // 4. Delete auth user
  await supabase.auth.admin.deleteUser(user_id)

  return new Response(JSON.stringify({ success: true }), { status: 200 })
})
```

### Database Function: `delete_user_cascade`

```sql
CREATE OR REPLACE FUNCTION delete_user_cascade(target_user_id UUID)
RETURNS void AS $$
BEGIN
  -- Delete feedback on user's messages
  DELETE FROM user_feedback WHERE message_id IN (
    SELECT id FROM messages WHERE conversation_id IN (
      SELECT id FROM conversations WHERE user_id = target_user_id
    )
  );

  -- Delete appeals
  DELETE FROM appeals WHERE user_id = target_user_id;

  -- Delete messages
  DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE user_id = target_user_id
  );

  -- Delete conversations
  DELETE FROM conversations WHERE user_id = target_user_id;

  -- Delete usage records
  DELETE FROM usage WHERE user_id = target_user_id;

  -- Delete subscription
  DELETE FROM subscriptions WHERE user_id = target_user_id;

  -- Delete verification
  DELETE FROM user_verification WHERE user_id = target_user_id;

  -- Delete user
  DELETE FROM users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Agentic Learning Tables

The following additional tables power the self-improving learning system (see `08-learning.md` for full details):

| Table | Purpose |
|-------|---------|
| `conversation_patterns` | Successful question sequences by intent |
| `appeal_outcomes` | Real-world appeal results (user-reported) |
| `policy_cache` | Medicare policy tracking and change detection |
| `user_events` | User behavior tracking for UX optimization |
| `learning_queue` | Async job queue for background learning |

---

## Agentic Learning Functions

### Core Learning Functions

| Function | Purpose | Returns |
|----------|---------|---------|
| `queue_learning_job(type, data, priority)` | Add job to async learning queue | Job UUID |
| `claim_learning_job()` | Worker claims next pending job | Job details |
| `complete_learning_job(id, success, error)` | Mark job complete/failed | void |

### Feedback Processing

| Function | Purpose | Returns |
|----------|---------|---------|
| `process_feedback(message_id, rating, correction)` | Handle 👍/👎 and update mappings | void |
| `update_symptom_mapping(phrase, code, desc, boost)` | Update symptom → ICD-10 mapping | void |
| `update_procedure_mapping(phrase, code, desc, boost)` | Update procedure → CPT mapping | void |

### Outcome Tracking

| Function | Purpose | Returns |
|----------|---------|---------|
| `record_appeal_outcome(appeal_id, outcome, ...)` | Store user-reported appeal result | Outcome UUID |
| `update_coverage_path(codes, refs, outcome, gaps)` | Update coverage path success data | void |
| `track_user_event(phone, type, data, ...)` | Record user behavior event | Event UUID |

### Pattern Learning

| Function | Purpose | Returns |
|----------|---------|---------|
| `update_conversation_pattern(trigger, intent, seq, success)` | Track successful question flows | void |
| `get_learning_context(symptoms, procedures, limit)` | Get learned data for Claude prompts | JSONB |

### Maintenance

| Function | Purpose | Returns |
|----------|---------|---------|
| `prune_weak_mappings(threshold, days_unused)` | Remove low-confidence old mappings | Table of counts |

### Example Usage

```sql
-- User gives thumbs up on a message
SELECT process_feedback('message-uuid-here', 'up', NULL);
-- Result: All mappings in conversation get +0.1 confidence

-- User reports their appeal was approved
SELECT record_appeal_outcome(
    'appeal-uuid-here',
    'approved',
    NULL,  -- no denial reason
    NULL,  -- no documentation gaps
    ARRAY['Conservative treatment documented'],
    45     -- days to resolution
);

-- Get learned context to inject into Claude prompts
SELECT get_learning_context(
    ARRAY['back pain', 'leg tingling'],
    ARRAY['MRI', 'physical therapy'],
    10
);
```
