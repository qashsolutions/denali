-- =============================================================================
-- Denali.health Database Schema
-- Supabase PostgreSQL
-- =============================================================================

-- Enable UUID extension (should be enabled by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Users Table
-- Primary user record - phone is required (primary identifier)
-- Email is optional for free users, required for paid ($25/month)
-- -----------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone TEXT NOT NULL UNIQUE, -- Primary identifier, required for all users
    email TEXT UNIQUE,          -- Optional for free, required for $25/month subscription
    plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'per_appeal', 'unlimited')),
    -- Preferences
    theme TEXT DEFAULT 'auto' CHECK (theme IN ('auto', 'light', 'dark')),
    notifications_enabled BOOLEAN DEFAULT TRUE,
    -- Accessibility preferences
    text_size REAL DEFAULT 1.0 CHECK (text_size >= 0.8 AND text_size <= 1.5), -- multiplier (1.0 = 16px base)
    high_contrast BOOLEAN DEFAULT FALSE,
    reduce_motion BOOLEAN DEFAULT FALSE,
    autoplay_media BOOLEAN DEFAULT TRUE,
    voiceover_optimization BOOLEAN DEFAULT FALSE,
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for lookups
-- Note: phone has UNIQUE constraint which creates implicit index, no need for separate index
CREATE INDEX idx_users_email ON users(email) WHERE email IS NOT NULL;

-- -----------------------------------------------------------------------------
-- User Verification Table
-- Tracks email and phone OTP verification status
-- -----------------------------------------------------------------------------
CREATE TABLE user_verification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified_at TIMESTAMPTZ,
    phone_verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- -----------------------------------------------------------------------------
-- Subscriptions Table
-- Stripe subscription management
-- -----------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL CHECK (plan IN ('per_appeal', 'unlimited')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing')),
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for Stripe lookups
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- -----------------------------------------------------------------------------
-- Usage Table
-- Tracks appeal count by PHONE NUMBER (primary) and device fingerprint (analytics)
-- Phone number is the reliable identifier; device fingerprint helps detect fraud
-- -----------------------------------------------------------------------------
CREATE TABLE usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT NOT NULL UNIQUE,           -- Primary tracking key (one phone = one person)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Link to user if they exist
    device_fingerprint TEXT,              -- For analytics and fraud detection only
    appeal_count INTEGER NOT NULL DEFAULT 0,
    last_appeal_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage lookups
-- Note: phone has UNIQUE constraint which creates implicit index, no need for separate index
CREATE INDEX idx_usage_user_id ON usage(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_usage_device_fingerprint ON usage(device_fingerprint) WHERE device_fingerprint IS NOT NULL;

-- =============================================================================
-- CONVERSATION TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conversations Table
-- Chat sessions - can be anonymous (device only) or linked to phone/user
-- -----------------------------------------------------------------------------
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    phone TEXT,                  -- Phone number if user signed up
    device_fingerprint TEXT,     -- Always captured for analytics
    title TEXT,                  -- Auto-generated summary
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    is_appeal BOOLEAN DEFAULT FALSE, -- True if this conversation is an appeal flow
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_conversations_user_id ON conversations(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_conversations_phone ON conversations(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_conversations_device ON conversations(device_fingerprint);
CREATE INDEX idx_conversations_status ON conversations(status);

-- -----------------------------------------------------------------------------
-- Messages Table
-- Individual messages within conversations
-- -----------------------------------------------------------------------------
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    -- Metadata for assistant responses
    icd10_codes TEXT[], -- Identified diagnosis codes
    cpt_codes TEXT[],   -- Identified procedure codes
    npi TEXT,           -- Provider NPI if mentioned
    policy_refs TEXT[], -- NCD/LCD references cited
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for conversation lookups
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at);

-- =============================================================================
-- APPEALS TABLE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Appeals Table
-- Generated appeal letters linked to conversations
-- -----------------------------------------------------------------------------
CREATE TABLE appeals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,        -- Phone number (required - signup wall shown before appeal)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Denial info
    denial_date DATE,
    denial_reason TEXT,
    service_description TEXT,
    -- Generated content
    appeal_letter TEXT NOT NULL,
    -- Codes and policies referenced
    icd10_codes TEXT[],
    cpt_codes TEXT[],
    ncd_refs TEXT[],
    lcd_refs TEXT[],
    pubmed_refs TEXT[], -- PMIDs or citation strings
    -- Tracking
    deadline DATE, -- Appeal deadline (typically 120 days from denial)
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'denied', 'pending')),
    -- Payment tracking
    paid BOOLEAN DEFAULT FALSE,  -- True if this appeal was paid ($10) or user has subscription
    stripe_payment_id TEXT,      -- For $10 one-time payments
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_appeals_conversation ON appeals(conversation_id);
CREATE INDEX idx_appeals_phone ON appeals(phone);  -- phone is required, frequently queried
CREATE INDEX idx_appeals_user ON appeals(user_id) WHERE user_id IS NOT NULL;  -- partial index
CREATE INDEX idx_appeals_status ON appeals(status);
CREATE INDEX idx_appeals_deadline ON appeals(deadline) WHERE deadline IS NOT NULL;

-- =============================================================================
-- LEARNING TABLES (Global, No User Link)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Symptom Mappings Table
-- Plain English → ICD-10 code mappings learned from user interactions
-- -----------------------------------------------------------------------------
CREATE TABLE symptom_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phrase TEXT NOT NULL,
    icd10_code TEXT NOT NULL,
    icd10_description TEXT,
    confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    use_count INTEGER NOT NULL DEFAULT 1,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(phrase, icd10_code)
);

-- Index for phrase lookups
CREATE INDEX idx_symptom_mappings_phrase ON symptom_mappings(phrase);
CREATE INDEX idx_symptom_mappings_confidence ON symptom_mappings(confidence DESC);

-- -----------------------------------------------------------------------------
-- Procedure Mappings Table
-- Plain English → CPT code mappings learned from user interactions
-- -----------------------------------------------------------------------------
CREATE TABLE procedure_mappings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phrase TEXT NOT NULL,
    cpt_code TEXT NOT NULL,
    cpt_description TEXT,
    confidence REAL NOT NULL DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
    use_count INTEGER NOT NULL DEFAULT 1,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(phrase, cpt_code)
);

-- Index for phrase lookups
CREATE INDEX idx_procedure_mappings_phrase ON procedure_mappings(phrase);
CREATE INDEX idx_procedure_mappings_confidence ON procedure_mappings(confidence DESC);

-- -----------------------------------------------------------------------------
-- Coverage Paths Table
-- Successful diagnosis + procedure + policy combinations
-- -----------------------------------------------------------------------------
CREATE TABLE coverage_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    icd10_code TEXT NOT NULL,
    cpt_code TEXT NOT NULL,
    ncd_id TEXT DEFAULT '',          -- National Coverage Determination ID (empty string instead of NULL for unique constraint)
    lcd_id TEXT DEFAULT '',          -- Local Coverage Determination ID (empty string instead of NULL)
    contractor_id TEXT,              -- MAC contractor (for LCD)
    outcome TEXT NOT NULL CHECK (outcome IN ('approved', 'denied', 'conditional')),
    documentation_required TEXT[],   -- List of required documentation items
    use_count INTEGER NOT NULL DEFAULT 1,
    last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(icd10_code, cpt_code, ncd_id, lcd_id)
);
-- Note: ncd_id and lcd_id use empty string '' instead of NULL to ensure
-- the unique constraint works correctly (PostgreSQL treats NULLs as distinct)

-- Indexes
CREATE INDEX idx_coverage_paths_codes ON coverage_paths(icd10_code, cpt_code);
CREATE INDEX idx_coverage_paths_outcome ON coverage_paths(outcome);

-- =============================================================================
-- AGENTIC LEARNING TABLES
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conversation Patterns Table
-- Tracks successful conversation flows to optimize question sequences
-- -----------------------------------------------------------------------------
CREATE TABLE conversation_patterns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trigger_phrase TEXT NOT NULL,           -- What started this pattern
    intent TEXT NOT NULL CHECK (intent IN ('coverage_check', 'appeal_help', 'provider_lookup', 'general')),
    question_sequence JSONB NOT NULL,       -- [{question, avg_response_time_ms, skip_rate}]
    success_rate REAL DEFAULT 0.5 CHECK (success_rate >= 0 AND success_rate <= 1),
    use_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trigger_phrase, intent)          -- One pattern per trigger+intent combo
);

CREATE INDEX idx_conversation_patterns_trigger ON conversation_patterns USING gin(to_tsvector('english', trigger_phrase));
CREATE INDEX idx_conversation_patterns_intent ON conversation_patterns(intent);
CREATE INDEX idx_conversation_patterns_success ON conversation_patterns(success_rate DESC);

-- -----------------------------------------------------------------------------
-- Appeal Outcomes Table
-- Tracks real-world appeal results for learning what works
-- -----------------------------------------------------------------------------
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
    denial_reason TEXT,
    -- Learning signals
    documentation_gaps TEXT[],              -- What was missing?
    successful_arguments TEXT[],            -- What worked?
    days_to_resolution INTEGER,
    -- Timestamps
    outcome_reported_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_appeal_outcomes_codes ON appeal_outcomes USING gin(icd10_codes);
CREATE INDEX idx_appeal_outcomes_outcome ON appeal_outcomes(outcome);
CREATE INDEX idx_appeal_outcomes_appeal ON appeal_outcomes(appeal_id);
CREATE INDEX idx_appeal_outcomes_phone ON appeal_outcomes(phone);  -- for user lookups

-- -----------------------------------------------------------------------------
-- Policy Cache Table
-- Caches and tracks Medicare policy changes
-- -----------------------------------------------------------------------------
CREATE TABLE policy_cache (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    policy_type TEXT NOT NULL CHECK (policy_type IN ('ncd', 'lcd', 'article')),
    policy_id TEXT NOT NULL,
    contractor_id TEXT DEFAULT '',          -- For LCDs (MAC-specific), empty string for unique constraint
    title TEXT,
    effective_date DATE,
    content_hash TEXT,                      -- SHA256 to detect changes
    coverage_requirements JSONB,            -- Parsed requirements
    covered_codes TEXT[],                   -- ICD-10/CPT codes covered
    -- Change tracking
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    last_changed_at TIMESTAMPTZ,
    change_summary TEXT,
    version INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(policy_type, policy_id, contractor_id)
);
-- Note: contractor_id uses empty string '' instead of NULL to ensure
-- the unique constraint works correctly (PostgreSQL treats NULLs as distinct)

CREATE INDEX idx_policy_cache_policy ON policy_cache(policy_type, policy_id);
CREATE INDEX idx_policy_cache_codes ON policy_cache USING gin(covered_codes);
CREATE INDEX idx_policy_cache_updated ON policy_cache(last_changed_at DESC);

-- -----------------------------------------------------------------------------
-- User Events Table
-- Tracks user behavior for UX optimization and conversion analysis
-- -----------------------------------------------------------------------------
CREATE TABLE user_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone TEXT,
    device_fingerprint TEXT,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'print', 'copy', 'download', 'share',           -- Content actions
        'return_visit', 'upgrade', 'cancel',            -- Conversion events
        'feedback_positive', 'feedback_negative',       -- Feedback events
        'appeal_started', 'appeal_completed',           -- Flow events
        'outcome_reported'                              -- Learning events
    )),
    event_data JSONB,                       -- Additional context
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    appeal_id UUID REFERENCES appeals(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_events_phone ON user_events(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_user_events_type ON user_events(event_type);
CREATE INDEX idx_user_events_created ON user_events(created_at DESC);

-- -----------------------------------------------------------------------------
-- Learning Queue Table
-- Async queue for background learning jobs
-- -----------------------------------------------------------------------------
CREATE TABLE learning_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_type TEXT NOT NULL CHECK (job_type IN (
        'update_symptom_mapping', 'update_procedure_mapping',
        'update_coverage_path', 'analyze_outcome_pattern',
        'reindex_policy', 'prune_weak_mappings',
        'aggregate_patterns', 'generate_report'
    )),
    job_data JSONB NOT NULL,
    priority INTEGER DEFAULT 5 CHECK (priority >= 1 AND priority <= 10), -- 1=highest
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_learning_queue_status ON learning_queue(status, priority) WHERE status = 'pending';
CREATE INDEX idx_learning_queue_type ON learning_queue(job_type);

-- =============================================================================
-- FEEDBACK TABLE
-- =============================================================================

-- -----------------------------------------------------------------------------
-- User Feedback Table
-- Thumbs up/down and corrections on assistant messages
-- -----------------------------------------------------------------------------
CREATE TABLE user_feedback (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL, -- SET NULL for anonymization
    rating TEXT NOT NULL CHECK (rating IN ('up', 'down')),
    correction TEXT, -- Optional user-provided correction
    feedback_type TEXT CHECK (feedback_type IN ('accuracy', 'clarity', 'completeness', 'other')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX idx_user_feedback_message ON user_feedback(message_id);
CREATE INDEX idx_user_feedback_rating ON user_feedback(rating);

-- =============================================================================
-- UPDATED_AT TRIGGERS
-- =============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_updated_at
    BEFORE UPDATE ON usage
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_appeals_updated_at
    BEFORE UPDATE ON appeals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- Learning tables (read: all, write: system only via service role)
ALTER TABLE conversation_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeal_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appeals ENABLE ROW LEVEL SECURITY;
ALTER TABLE symptom_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE procedure_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE coverage_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- RLS Policies: Users
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can read own row"
    ON users FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own row"
    ON users FOR UPDATE
    USING (auth.uid() = id);

-- -----------------------------------------------------------------------------
-- RLS Policies: User Verification
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can read own verification"
    ON user_verification FOR SELECT
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RLS Policies: Subscriptions
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can read own subscription"
    ON subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RLS Policies: Usage
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can read own usage"
    ON usage FOR SELECT
    USING (auth.uid() = user_id);

-- Note: Anonymous users (device_fingerprint only) access usage table via service role
-- in Edge Functions, bypassing RLS. This is by design for free tier tracking.

-- -----------------------------------------------------------------------------
-- RLS Policies: Conversations
-- Authenticated users access via user_id
-- Phone-verified users (free tier) access via Edge Functions (service role)
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can read own conversations"
    ON conversations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert conversations"
    ON conversations FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
-- Note: user_id IS NULL allows Edge Functions (service role) to create conversations
-- for anonymous users before they sign up. Client-side inserts require auth.

CREATE POLICY "Users can update own conversations"
    ON conversations FOR UPDATE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RLS Policies: Messages
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can read messages in own conversations"
    ON messages FOR SELECT
    USING (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages in own conversations"
    ON messages FOR INSERT
    WITH CHECK (
        conversation_id IN (
            SELECT id FROM conversations WHERE user_id = auth.uid() OR user_id IS NULL
        )
    );

-- -----------------------------------------------------------------------------
-- RLS Policies: Appeals
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can read own appeals"
    ON appeals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own appeals"
    ON appeals FOR INSERT
    WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own appeals"
    ON appeals FOR UPDATE
    USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- RLS Policies: Learning Tables (Read: all, Write: system only via service role)
-- -----------------------------------------------------------------------------
CREATE POLICY "Anyone can read symptom mappings"
    ON symptom_mappings FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read procedure mappings"
    ON procedure_mappings FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read coverage paths"
    ON coverage_paths FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read conversation patterns"
    ON conversation_patterns FOR SELECT
    USING (true);

CREATE POLICY "Anyone can read policy cache"
    ON policy_cache FOR SELECT
    USING (true);

-- Appeal outcomes: users can only see anonymized aggregate data
-- Individual outcomes accessed via service role only
CREATE POLICY "Users can read own appeal outcomes"
    ON appeal_outcomes FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE phone = appeal_outcomes.phone AND id = auth.uid()
    ));

-- User events: users can see their own events
CREATE POLICY "Users can read own events"
    ON user_events FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE phone = user_events.phone AND id = auth.uid()
    ));

-- Learning queue: system only (no user access via client, only via service role)
-- No SELECT policy = users cannot read
-- No INSERT/UPDATE/DELETE policy = users cannot modify
-- Edge Functions use service role key which bypasses RLS

-- -----------------------------------------------------------------------------
-- RLS Policies: User Feedback
-- -----------------------------------------------------------------------------
CREATE POLICY "Users can read own feedback"
    ON user_feedback FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert feedback on own conversation messages"
    ON user_feedback FOR INSERT
    WITH CHECK (
        message_id IN (
            SELECT m.id FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE c.user_id = auth.uid()
        )
    );

-- =============================================================================
-- USER ACCESS PATTERNS
-- =============================================================================
--
-- COVERAGE GUIDANCE (No Auth Required):
-- - Anyone can ask coverage questions without signing up
-- - Tracked by device_fingerprint for analytics only
-- - No limits on coverage questions
--
-- APPEAL FLOW (Phone OTP Required):
-- - User goes through appeal conversation
-- - Before seeing appeal letter → Signup wall (phone OTP)
-- - Phone number becomes primary identifier
-- - First appeal is FREE, subsequent require payment
--
-- PAID USERS (Phone + Email OTP Required for $25/month):
-- - Email required for subscription (account recovery, receipts)
-- - Phone is still primary identifier
-- - Full access to all features
--
-- Edge Function Pattern:
-- 1. Client sends phone number (after OTP verification)
-- 2. Edge Function uses service role to query/insert
-- 3. Phone number is trusted after Supabase Auth OTP verification
-- =============================================================================

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: Increment appeal count (called when appeal letter is generated)
-- Phone number is the primary key for tracking
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_appeal_count(
    p_phone TEXT,
    p_user_id UUID DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO usage (phone, user_id, device_fingerprint, appeal_count, last_appeal_at)
    VALUES (p_phone, p_user_id, p_device_fingerprint, 1, NOW())
    ON CONFLICT (phone)
    DO UPDATE SET
        appeal_count = usage.appeal_count + 1,
        last_appeal_at = NOW(),
        user_id = COALESCE(p_user_id, usage.user_id),
        device_fingerprint = COALESCE(p_device_fingerprint, usage.device_fingerprint)
    RETURNING appeal_count INTO v_count;

    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Check if phone number can create appeal (free tier limit = 1)
-- Returns: 'free' (first appeal), 'paywall' (needs payment), 'allowed' (has subscription)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION check_appeal_access(
    p_phone TEXT
)
RETURNS TEXT AS $$
DECLARE
    v_user_id UUID;
    v_plan TEXT;
    v_count INTEGER;
    v_subscription_status TEXT;
BEGIN
    -- Check if phone has a user account
    SELECT id, plan INTO v_user_id, v_plan FROM users WHERE phone = p_phone;

    IF v_user_id IS NOT NULL THEN
        -- User exists, check their plan
        IF v_plan = 'unlimited' THEN
            SELECT status INTO v_subscription_status
            FROM subscriptions WHERE user_id = v_user_id;
            IF v_subscription_status = 'active' THEN
                RETURN 'allowed';
            END IF;
        END IF;

        -- Per-appeal plan = allowed (they pay per appeal)
        IF v_plan = 'per_appeal' THEN
            RETURN 'allowed';
        END IF;
    END IF;

    -- Check appeal count for this phone
    SELECT appeal_count INTO v_count FROM usage WHERE phone = p_phone;

    -- Free tier: first appeal is free
    IF COALESCE(v_count, 0) < 1 THEN
        RETURN 'free';
    END IF;

    -- Already used free appeal, needs payment
    RETURN 'paywall';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Get appeal count for a phone number
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_appeal_count(
    p_phone TEXT
)
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT appeal_count INTO v_count FROM usage WHERE phone = p_phone;
    RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Update learning mappings (called by system after successful interactions)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_symptom_mapping(
    p_phrase TEXT,
    p_icd10_code TEXT,
    p_icd10_description TEXT DEFAULT NULL,
    p_confidence_boost REAL DEFAULT 0.1
)
RETURNS void AS $$
BEGIN
    INSERT INTO symptom_mappings (phrase, icd10_code, icd10_description, confidence, use_count, last_used_at)
    VALUES (LOWER(TRIM(p_phrase)), p_icd10_code, p_icd10_description, 0.5, 1, NOW())
    ON CONFLICT (phrase, icd10_code)
    DO UPDATE SET
        confidence = LEAST(1.0, symptom_mappings.confidence + p_confidence_boost),
        use_count = symptom_mappings.use_count + 1,
        last_used_at = NOW(),
        icd10_description = COALESCE(p_icd10_description, symptom_mappings.icd10_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_procedure_mapping(
    p_phrase TEXT,
    p_cpt_code TEXT,
    p_cpt_description TEXT DEFAULT NULL,
    p_confidence_boost REAL DEFAULT 0.1
)
RETURNS void AS $$
BEGIN
    INSERT INTO procedure_mappings (phrase, cpt_code, cpt_description, confidence, use_count, last_used_at)
    VALUES (LOWER(TRIM(p_phrase)), p_cpt_code, p_cpt_description, 0.5, 1, NOW())
    ON CONFLICT (phrase, cpt_code)
    DO UPDATE SET
        confidence = LEAST(1.0, procedure_mappings.confidence + p_confidence_boost),
        use_count = procedure_mappings.use_count + 1,
        last_used_at = NOW(),
        cpt_description = COALESCE(p_cpt_description, procedure_mappings.cpt_description);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- AGENTIC LEARNING FUNCTIONS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: Queue a learning job for async processing
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION queue_learning_job(
    p_job_type TEXT,
    p_job_data JSONB,
    p_priority INTEGER DEFAULT 5
)
RETURNS UUID AS $$
DECLARE
    v_job_id UUID;
BEGIN
    INSERT INTO learning_queue (job_type, job_data, priority)
    VALUES (p_job_type, p_job_data, p_priority)
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Process user feedback (thumbs up/down)
-- Updates mapping confidence based on feedback
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_feedback(
    p_message_id UUID,
    p_rating TEXT,               -- 'up' or 'down'
    p_correction TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_conversation_id UUID;
    v_message_content TEXT;
    v_confidence_delta REAL;
BEGIN
    -- Get conversation and message info
    SELECT m.conversation_id, m.content
    INTO v_conversation_id, v_message_content
    FROM messages m
    WHERE m.id = p_message_id;

    -- Set confidence adjustment
    v_confidence_delta := CASE WHEN p_rating = 'up' THEN 0.1 ELSE -0.15 END;

    -- Update symptom mappings used in this conversation
    UPDATE symptom_mappings sm
    SET confidence = GREATEST(0, LEAST(1, sm.confidence + v_confidence_delta)),
        use_count = sm.use_count + 1,
        last_used_at = NOW()
    WHERE sm.icd10_code = ANY(
        SELECT UNNEST(m.icd10_codes)
        FROM messages m
        WHERE m.conversation_id = v_conversation_id
        AND m.icd10_codes IS NOT NULL
    );

    -- Update procedure mappings used in this conversation
    UPDATE procedure_mappings pm
    SET confidence = GREATEST(0, LEAST(1, pm.confidence + v_confidence_delta)),
        use_count = pm.use_count + 1,
        last_used_at = NOW()
    WHERE pm.cpt_code = ANY(
        SELECT UNNEST(m.cpt_codes)
        FROM messages m
        WHERE m.conversation_id = v_conversation_id
        AND m.cpt_codes IS NOT NULL
    );

    -- If negative feedback with correction, queue for review
    IF p_rating = 'down' AND p_correction IS NOT NULL THEN
        PERFORM queue_learning_job(
            'analyze_outcome_pattern',
            jsonb_build_object(
                'message_id', p_message_id,
                'correction', p_correction,
                'conversation_id', v_conversation_id
            ),
            2  -- High priority
        );
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Record appeal outcome (user-reported)
-- Stores real-world results and updates coverage paths
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_appeal_outcome(
    p_appeal_id UUID,
    p_outcome TEXT,                      -- 'approved', 'denied', 'partial', 'pending'
    p_denial_reason TEXT DEFAULT NULL,
    p_documentation_gaps TEXT[] DEFAULT NULL,
    p_successful_arguments TEXT[] DEFAULT NULL,
    p_days_to_resolution INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_outcome_id UUID;
    v_appeal appeals%ROWTYPE;
    v_confidence_delta REAL;
BEGIN
    -- Get appeal details
    SELECT * INTO v_appeal FROM appeals WHERE id = p_appeal_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Appeal not found: %', p_appeal_id;
    END IF;

    -- Insert outcome record
    INSERT INTO appeal_outcomes (
        appeal_id, phone, icd10_codes, cpt_codes, ncd_refs, lcd_refs,
        outcome, denial_reason, documentation_gaps, successful_arguments,
        days_to_resolution, outcome_reported_at
    ) VALUES (
        p_appeal_id, v_appeal.phone, v_appeal.icd10_codes, v_appeal.cpt_codes,
        v_appeal.ncd_refs, v_appeal.lcd_refs,
        p_outcome, p_denial_reason, p_documentation_gaps, p_successful_arguments,
        p_days_to_resolution, NOW()
    )
    RETURNING id INTO v_outcome_id;

    -- Update appeals table status
    UPDATE appeals SET status = p_outcome, updated_at = NOW()
    WHERE id = p_appeal_id;

    -- Calculate confidence delta based on outcome
    v_confidence_delta := CASE
        WHEN p_outcome = 'approved' THEN 0.15
        WHEN p_outcome = 'partial' THEN 0.05
        WHEN p_outcome = 'denied' THEN -0.1
        ELSE 0
    END;

    -- Update coverage paths
    PERFORM update_coverage_path(
        v_appeal.icd10_codes,
        v_appeal.cpt_codes,
        v_appeal.ncd_refs,
        v_appeal.lcd_refs,
        p_outcome,
        p_documentation_gaps
    );

    -- Queue pattern analysis for learning
    PERFORM queue_learning_job(
        'analyze_outcome_pattern',
        jsonb_build_object(
            'appeal_id', p_appeal_id,
            'outcome', p_outcome,
            'icd10_codes', v_appeal.icd10_codes,
            'cpt_codes', v_appeal.cpt_codes
        ),
        3  -- Medium-high priority
    );

    -- Track event
    INSERT INTO user_events (phone, event_type, event_data, appeal_id)
    VALUES (v_appeal.phone, 'outcome_reported',
            jsonb_build_object('outcome', p_outcome), p_appeal_id);

    RETURN v_outcome_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Update coverage path based on outcome
-- Records successful and failed diagnosis + procedure + policy combinations
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_coverage_path(
    p_icd10_codes TEXT[],
    p_cpt_codes TEXT[],
    p_ncd_refs TEXT[],
    p_lcd_refs TEXT[],
    p_outcome TEXT,
    p_documentation_gaps TEXT[] DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_icd10 TEXT;
    v_cpt TEXT;
    v_ncd TEXT;
    v_lcd TEXT;
BEGIN
    -- Insert/update coverage paths for each code combination
    FOREACH v_icd10 IN ARRAY COALESCE(p_icd10_codes, ARRAY[]::TEXT[]) LOOP
        FOREACH v_cpt IN ARRAY COALESCE(p_cpt_codes, ARRAY[]::TEXT[]) LOOP
            -- Get first NCD and LCD (if any), use empty string for unique constraint
            v_ncd := COALESCE(p_ncd_refs[1], '');
            v_lcd := COALESCE(p_lcd_refs[1], '');

            INSERT INTO coverage_paths (
                icd10_code, cpt_code, ncd_id, lcd_id, outcome,
                documentation_required, use_count, last_used_at
            ) VALUES (
                v_icd10, v_cpt, v_ncd, v_lcd, p_outcome,
                p_documentation_gaps, 1, NOW()
            )
            ON CONFLICT (icd10_code, cpt_code, ncd_id, lcd_id)
            DO UPDATE SET
                outcome = CASE
                    WHEN coverage_paths.use_count > 5 THEN coverage_paths.outcome  -- Keep established outcome
                    ELSE p_outcome  -- Update with new outcome
                END,
                documentation_required = COALESCE(p_documentation_gaps, coverage_paths.documentation_required),
                use_count = coverage_paths.use_count + 1,
                last_used_at = NOW();
        END LOOP;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Prune weak mappings (run nightly)
-- Removes low-confidence mappings that haven't been used recently
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION prune_weak_mappings(
    p_confidence_threshold REAL DEFAULT 0.3,
    p_days_unused INTEGER DEFAULT 90
)
RETURNS TABLE(
    table_name TEXT,
    deleted_count INTEGER
) AS $$
DECLARE
    v_symptom_count INTEGER;
    v_procedure_count INTEGER;
    v_coverage_count INTEGER;
BEGIN
    -- Prune symptom mappings
    WITH deleted AS (
        DELETE FROM symptom_mappings
        WHERE confidence < p_confidence_threshold
        AND last_used_at < NOW() - (p_days_unused || ' days')::INTERVAL
        AND use_count < 5  -- Keep mappings that have been used multiple times
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_symptom_count FROM deleted;

    -- Prune procedure mappings
    WITH deleted AS (
        DELETE FROM procedure_mappings
        WHERE confidence < p_confidence_threshold
        AND last_used_at < NOW() - (p_days_unused || ' days')::INTERVAL
        AND use_count < 5
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_procedure_count FROM deleted;

    -- Prune coverage paths with low use and old data
    WITH deleted AS (
        DELETE FROM coverage_paths
        WHERE use_count < 3
        AND last_used_at < NOW() - (p_days_unused * 2 || ' days')::INTERVAL
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_coverage_count FROM deleted;

    -- Return results
    RETURN QUERY SELECT 'symptom_mappings'::TEXT, v_symptom_count;
    RETURN QUERY SELECT 'procedure_mappings'::TEXT, v_procedure_count;
    RETURN QUERY SELECT 'coverage_paths'::TEXT, v_coverage_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Get learning context for Claude prompts
-- Retrieves relevant learned mappings and patterns for a given context
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_learning_context(
    p_symptoms TEXT[] DEFAULT NULL,
    p_procedures TEXT[] DEFAULT NULL,
    p_limit INTEGER DEFAULT 10
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
    v_symptom_mappings JSONB;
    v_procedure_mappings JSONB;
    v_coverage_paths JSONB;
    v_recent_denials JSONB;
BEGIN
    -- Get high-confidence symptom mappings
    SELECT COALESCE(jsonb_agg(row_to_json(s)), '[]'::JSONB) INTO v_symptom_mappings
    FROM (
        SELECT phrase, icd10_code, icd10_description, confidence
        FROM symptom_mappings
        WHERE confidence >= 0.7
        ORDER BY confidence DESC, use_count DESC
        LIMIT p_limit
    ) s;

    -- Get high-confidence procedure mappings
    SELECT COALESCE(jsonb_agg(row_to_json(p)), '[]'::JSONB) INTO v_procedure_mappings
    FROM (
        SELECT phrase, cpt_code, cpt_description, confidence
        FROM procedure_mappings
        WHERE confidence >= 0.7
        ORDER BY confidence DESC, use_count DESC
        LIMIT p_limit
    ) p;

    -- Get successful coverage paths
    SELECT COALESCE(jsonb_agg(row_to_json(c)), '[]'::JSONB) INTO v_coverage_paths
    FROM (
        SELECT icd10_code, cpt_code, ncd_id, lcd_id, outcome, documentation_required
        FROM coverage_paths
        WHERE outcome = 'approved'
        ORDER BY use_count DESC
        LIMIT p_limit
    ) c;

    -- Get recent denials (for learning what to avoid)
    SELECT COALESCE(jsonb_agg(row_to_json(d)), '[]'::JSONB) INTO v_recent_denials
    FROM (
        SELECT icd10_codes, cpt_codes, denial_reason, documentation_gaps
        FROM appeal_outcomes
        WHERE outcome = 'denied'
        AND outcome_reported_at > NOW() - INTERVAL '90 days'
        ORDER BY outcome_reported_at DESC
        LIMIT 5
    ) d;

    -- Build result object
    v_result := jsonb_build_object(
        'symptom_mappings', v_symptom_mappings,
        'procedure_mappings', v_procedure_mappings,
        'successful_coverage_paths', v_coverage_paths,
        'recent_denials', v_recent_denials,
        'generated_at', NOW()
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Track user event
-- Records user behavior for analytics and learning
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION track_user_event(
    p_phone TEXT,
    p_event_type TEXT,
    p_event_data JSONB DEFAULT NULL,
    p_conversation_id UUID DEFAULT NULL,
    p_appeal_id UUID DEFAULT NULL,
    p_device_fingerprint TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO user_events (
        phone, device_fingerprint, event_type, event_data,
        conversation_id, appeal_id
    ) VALUES (
        p_phone, p_device_fingerprint, p_event_type, p_event_data,
        p_conversation_id, p_appeal_id
    )
    RETURNING id INTO v_event_id;

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Get next learning job (for worker processing)
-- Claims and returns the next pending job
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION claim_learning_job()
RETURNS TABLE(
    job_id UUID,
    job_type TEXT,
    job_data JSONB
) AS $$
DECLARE
    v_job_id UUID;
    v_job_type TEXT;
    v_job_data JSONB;
BEGIN
    -- Select and lock the next pending job
    SELECT lq.id, lq.job_type, lq.job_data
    INTO v_job_id, v_job_type, v_job_data
    FROM learning_queue lq
    WHERE lq.status = 'pending'
    AND lq.attempts < lq.max_attempts
    ORDER BY lq.priority, lq.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF v_job_id IS NOT NULL THEN
        -- Mark as processing
        UPDATE learning_queue
        SET status = 'processing',
            started_at = NOW(),
            attempts = attempts + 1
        WHERE id = v_job_id;

        RETURN QUERY SELECT v_job_id, v_job_type, v_job_data;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Complete a learning job
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION complete_learning_job(
    p_job_id UUID,
    p_success BOOLEAN,
    p_error TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE learning_queue
    SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
        completed_at = NOW(),
        last_error = p_error
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- Function: Update conversation pattern (track successful flows)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_conversation_pattern(
    p_trigger_phrase TEXT,
    p_intent TEXT,
    p_question_sequence JSONB,
    p_was_successful BOOLEAN
)
RETURNS void AS $$
DECLARE
    v_success_delta REAL;
BEGIN
    v_success_delta := CASE WHEN p_was_successful THEN 0.1 ELSE -0.05 END;

    INSERT INTO conversation_patterns (
        trigger_phrase, intent, question_sequence, success_rate, use_count
    ) VALUES (
        LOWER(TRIM(p_trigger_phrase)), p_intent, p_question_sequence,
        CASE WHEN p_was_successful THEN 0.6 ELSE 0.4 END, 1
    )
    ON CONFLICT (trigger_phrase, intent)
    DO UPDATE SET
        success_rate = GREATEST(0, LEAST(1, conversation_patterns.success_rate + v_success_delta)),
        use_count = conversation_patterns.use_count + 1,
        last_used_at = NOW(),
        question_sequence = CASE
            WHEN p_was_successful THEN p_question_sequence  -- Keep successful sequences
            ELSE conversation_patterns.question_sequence
        END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- ACCOUNT DELETION (GDPR/CCPA)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Function: Delete user cascade (called by Edge Function)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION delete_user_cascade(target_user_id UUID)
RETURNS void AS $$
BEGIN
    -- Delete feedback on user's messages (anonymize instead if needed)
    DELETE FROM user_feedback WHERE message_id IN (
        SELECT m.id FROM messages m
        JOIN conversations c ON m.conversation_id = c.id
        WHERE c.user_id = target_user_id
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

    -- Delete user (this will also cascade via auth.users FK)
    DELETE FROM users WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- INITIAL DATA (Optional - for development)
-- =============================================================================

-- Sample symptom mappings
-- INSERT INTO symptom_mappings (phrase, icd10_code, icd10_description, confidence) VALUES
-- ('back pain', 'M54.5', 'Low back pain', 0.9),
-- ('dizzy spells', 'R42', 'Dizziness and giddiness', 0.85),
-- ('leg tingling', 'R20.2', 'Paresthesia of skin', 0.8),
-- ('chest pain', 'R07.9', 'Chest pain, unspecified', 0.9);

-- Sample procedure mappings
-- INSERT INTO procedure_mappings (phrase, cpt_code, cpt_description, confidence) VALUES
-- ('back scan', '72148', 'MRI lumbar spine without contrast', 0.85),
-- ('MRI', '70553', 'MRI brain with and without contrast', 0.7),
-- ('sleep study', '95810', 'Polysomnography', 0.9);
