---
name: database
description: Supabase database schema, queries, and Row Level Security patterns
version: 1.0.0
context: infrastructure
---

# Database Skill

This skill defines the Supabase database architecture, including schema design, query patterns, and security policies.

## Technology Stack

- **Database**: PostgreSQL (via Supabase)
- **Auth**: Supabase Auth (phone OTP primary, email OTP secondary)
- **Real-time**: Supabase Realtime (for live updates)
- **Storage**: Supabase Storage (for generated PDFs)
- **Functions**: Supabase Edge Functions (Deno)

## Schema Overview

### Core Tables

```sql
users                 -- Auth, preferences, plan type
user_verification     -- Email + phone OTP status
subscriptions         -- Stripe integration, plan status
usage                 -- Appeal count tracking
conversations         -- Chat sessions
messages              -- Individual messages
appeals               -- Generated appeal letters
user_feedback         -- Thumbs up/down, corrections
```

### Learning Tables (No User Link)

```sql
symptom_mappings      -- phrase → ICD-10
procedure_mappings    -- phrase → CPT
coverage_paths        -- successful code combinations
conversation_patterns -- effective question sequences
appeal_outcomes       -- real-world results
policy_cache          -- Medicare policy tracking
user_events           -- UX behavior analytics
learning_queue        -- async job processing
```

## Table Schemas

### users

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT UNIQUE NOT NULL,           -- Primary identifier
    email TEXT,                           -- Required for $25/month
    plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'per_appeal', 'unlimited')),
    theme TEXT DEFAULT 'auto' CHECK (theme IN ('auto', 'light', 'dark')),
    notifications_enabled BOOLEAN DEFAULT true,
    text_size REAL DEFAULT 1.0 CHECK (text_size BETWEEN 0.8 AND 1.5),
    high_contrast BOOLEAN DEFAULT false,
    reduce_motion BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### conversations

```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT,                           -- For anonymous tracking
    device_fingerprint TEXT,              -- Analytics only
    is_appeal BOOLEAN DEFAULT false,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
```

### messages

```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    -- Extracted entities (internal use)
    icd10_codes TEXT[],
    cpt_codes TEXT[],
    npi TEXT,
    policy_refs JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### appeals

```sql
CREATE TABLE appeals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    -- Denial information
    denial_date DATE,
    denial_reason TEXT,
    service_description TEXT,
    -- Generated content
    appeal_letter TEXT,
    icd10_codes TEXT[],
    cpt_codes TEXT[],
    ncd_refs TEXT[],
    lcd_refs TEXT[],
    pubmed_refs TEXT[],
    -- Status tracking
    deadline DATE,                        -- 120 days from denial
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'denied', 'pending')),
    paid BOOLEAN DEFAULT false,
    stripe_payment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### symptom_mappings (Learning)

```sql
CREATE TABLE symptom_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phrase TEXT NOT NULL,
    icd10_code TEXT NOT NULL,
    icd10_description TEXT,
    confidence REAL DEFAULT 0.5 CHECK (confidence BETWEEN 0 AND 1),
    use_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(phrase, icd10_code)
);

CREATE INDEX idx_symptom_mappings_phrase ON symptom_mappings(phrase);
CREATE INDEX idx_symptom_mappings_confidence ON symptom_mappings(confidence DESC);
```

## Row Level Security (RLS)

### User Data (Requires Auth)

```sql
-- Users can only access their own data
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_own_data ON users
    FOR ALL USING (auth.uid() = id);

-- Conversations
CREATE POLICY conversations_own_data ON conversations
    FOR ALL USING (auth.uid() = user_id OR user_id IS NULL);

-- Messages via conversation ownership
CREATE POLICY messages_via_conversation ON messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );
```

### Learning Data (Public Read, System Write)

```sql
-- Anyone can read learned mappings
CREATE POLICY symptom_mappings_read ON symptom_mappings
    FOR SELECT USING (true);

-- Only service role can write
CREATE POLICY symptom_mappings_write ON symptom_mappings
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY symptom_mappings_update ON symptom_mappings
    FOR UPDATE USING (auth.role() = 'service_role');
```

## Key Functions

### Appeal Access Check

```sql
CREATE OR REPLACE FUNCTION check_appeal_access(user_phone TEXT)
RETURNS TEXT AS $$
DECLARE
    appeal_count INTEGER;
    has_subscription BOOLEAN;
BEGIN
    -- Get appeal count for this phone
    SELECT COALESCE(u.appeal_count, 0) INTO appeal_count
    FROM usage u WHERE u.phone = user_phone;

    -- If no record or count is 0, first appeal is free
    IF appeal_count IS NULL OR appeal_count = 0 THEN
        RETURN 'free';
    END IF;

    -- Check for active subscription
    SELECT EXISTS(
        SELECT 1 FROM subscriptions s
        JOIN users u ON s.user_id = u.id
        WHERE u.phone = user_phone AND s.status = 'active'
    ) INTO has_subscription;

    IF has_subscription THEN
        RETURN 'allowed';
    ELSE
        RETURN 'paywall';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Process Feedback

```sql
CREATE OR REPLACE FUNCTION process_feedback(
    p_message_id UUID,
    p_rating TEXT,
    p_correction TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_conversation_id UUID;
    v_boost REAL;
BEGIN
    -- Get conversation
    SELECT conversation_id INTO v_conversation_id
    FROM messages WHERE id = p_message_id;

    -- Set boost based on rating
    v_boost := CASE p_rating WHEN 'up' THEN 0.1 ELSE -0.15 END;

    -- Update symptom mappings confidence
    UPDATE symptom_mappings sm
    SET confidence = LEAST(1.0, GREATEST(0.0, confidence + v_boost)),
        use_count = use_count + 1,
        last_used_at = NOW()
    WHERE sm.phrase IN (
        SELECT unnest(regexp_matches(m.content, '[a-z ]+', 'gi'))
        FROM messages m
        WHERE m.conversation_id = v_conversation_id AND m.role = 'user'
    );

    -- If correction provided, create new mapping
    IF p_correction IS NOT NULL THEN
        -- Queue learning job to analyze correction
        INSERT INTO learning_queue (job_type, job_data, priority)
        VALUES ('analyze_correction', jsonb_build_object(
            'message_id', p_message_id,
            'correction', p_correction
        ), 3);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Get Learning Context

```sql
CREATE OR REPLACE FUNCTION get_learning_context(
    p_symptoms TEXT[] DEFAULT NULL,
    p_procedures TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'symptom_mappings', (
            SELECT jsonb_agg(jsonb_build_object(
                'phrase', phrase,
                'code', icd10_code,
                'confidence', confidence
            ))
            FROM symptom_mappings
            WHERE confidence > 0.7
            ORDER BY confidence DESC, use_count DESC
            LIMIT p_limit
        ),
        'procedure_mappings', (
            SELECT jsonb_agg(jsonb_build_object(
                'phrase', phrase,
                'code', cpt_code,
                'confidence', confidence
            ))
            FROM procedure_mappings
            WHERE confidence > 0.7
            ORDER BY confidence DESC, use_count DESC
            LIMIT p_limit
        ),
        'coverage_paths', (
            SELECT jsonb_agg(jsonb_build_object(
                'icd10', icd10_code,
                'cpt', cpt_code,
                'outcome', outcome,
                'success_rate', success_rate
            ))
            FROM coverage_paths
            WHERE outcome = 'approved'
            ORDER BY success_rate DESC, use_count DESC
            LIMIT p_limit
        )
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Query Patterns

### Start New Conversation

```typescript
const { data: conversation } = await supabase
  .from('conversations')
  .insert({
    user_id: user?.id || null,
    phone: phone || null,
    device_fingerprint: fingerprint,
    is_appeal: false
  })
  .select()
  .single();
```

### Add Message

```typescript
const { data: message } = await supabase
  .from('messages')
  .insert({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
    icd10_codes: extractedCodes.icd10,
    cpt_codes: extractedCodes.cpt
  })
  .select()
  .single();
```

### Check Appeal Access

```typescript
const { data: access } = await supabase
  .rpc('check_appeal_access', { user_phone: phone });

// access = 'free' | 'paywall' | 'allowed'
```

### Get User History

```typescript
const { data: conversations } = await supabase
  .from('conversations')
  .select(`
    id,
    started_at,
    status,
    is_appeal,
    messages (
      id,
      role,
      content,
      created_at
    )
  `)
  .eq('user_id', userId)
  .order('started_at', { ascending: false })
  .limit(20);
```

## Edge Function Patterns

### Anonymous Coverage Guidance

```typescript
// Edge function uses service role (bypasses RLS)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

// Can create conversation without user_id
await supabase.from('conversations').insert({
  user_id: null,
  device_fingerprint: req.fingerprint
});
```

### Authenticated Operations

```typescript
// Get user from JWT
const authHeader = req.headers.get('Authorization')!;
const token = authHeader.replace('Bearer ', '');
const { data: { user } } = await supabase.auth.getUser(token);

// Operations now respect RLS
const { data } = await supabase
  .from('conversations')
  .select('*')
  .eq('user_id', user.id);
```

## Migrations

Store migrations in `/supabase/migrations/`:

```
001_initial_schema.sql
002_add_learning_tables.sql
003_add_rls_policies.sql
004_add_functions.sql
```

Run with:
```bash
supabase db push
```
