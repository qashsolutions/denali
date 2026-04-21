-- ============================================================================
-- Migration: Prod Drift Recovery
-- Generated: 2026-04-21
-- Source:    pg_dump --schema-only against denali-prod (read-only Fargate task)
-- Purpose:   Capture 9 prod-only objects that exist in production RDS but are
--            not present in any committed migration file. Apply this AFTER the
--            14 baseline migrations so staging matches prod schema.
--
-- Coverage (9 objects):
--   Tables (7):      counselor_cases, landing_content, outcome_followups,
--                    pricing_plans, provider_practices, site_settings, testimonials
--   Column adds (7): appeals.carc_codes, appeals.rarc_codes, appeals.email,
--                    appeals.outcome_reported_at, appeals.outcome_details,
--                    users.counselor_id, users.counselor_state
--   Matview (1):     flywheel_metrics (+ refresh_flywheel_metrics, get_flywheel_context)
--
-- Idempotency:
--   - CREATE TABLE IF NOT EXISTS for every table
--   - CREATE INDEX IF NOT EXISTS for every index
--   - ADD COLUMN IF NOT EXISTS for every column add
--   - CREATE MATERIALIZED VIEW IF NOT EXISTS for the matview
--   - CREATE OR REPLACE FUNCTION for both helper functions
--   - PK / UNIQUE / FK / CHECK constraints wrapped in DO blocks that probe
--     pg_constraint (PG 16 has no native ADD CONSTRAINT IF NOT EXISTS)
--
-- Dependencies (must already exist in target DB):
--   - public.users         (created by sql/001-schema.sql)
--   - public.appeals       (created by sql/001-schema.sql)
--   - public.conversations (created by sql/001-schema.sql)
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. counselor_cases
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counselor_cases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    counselor_id uuid NOT NULL,
    conversation_id uuid,
    appeal_id uuid,
    case_ref text NOT NULL,
    client_initials text,
    client_state text,
    client_medicare_type text,
    denial_code text,
    procedure_description text,
    denial_date date,
    status text DEFAULT 'open'::text NOT NULL,
    outcome text,
    outcome_date date,
    outcome_notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT counselor_cases_outcome_check CHECK ((outcome = ANY (ARRAY['approved'::text, 'denied'::text, 'partial'::text]))),
    CONSTRAINT counselor_cases_status_check CHECK ((status = ANY (ARRAY['open'::text, 'appeal_filed'::text, 'outcome_reported'::text, 'closed'::text])))
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'counselor_cases_pkey') THEN
        ALTER TABLE public.counselor_cases ADD CONSTRAINT counselor_cases_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'counselor_cases_appeal_id_fkey') THEN
        ALTER TABLE public.counselor_cases ADD CONSTRAINT counselor_cases_appeal_id_fkey
            FOREIGN KEY (appeal_id) REFERENCES public.appeals(id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'counselor_cases_conversation_id_fkey') THEN
        ALTER TABLE public.counselor_cases ADD CONSTRAINT counselor_cases_conversation_id_fkey
            FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'counselor_cases_counselor_id_fkey') THEN
        ALTER TABLE public.counselor_cases ADD CONSTRAINT counselor_cases_counselor_id_fkey
            FOREIGN KEY (counselor_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cases_counselor ON public.counselor_cases USING btree (counselor_id, status);
CREATE INDEX IF NOT EXISTS idx_cases_ref ON public.counselor_cases USING btree (case_ref);

-- ----------------------------------------------------------------------------
-- 2. landing_content
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.landing_content (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_key text NOT NULL,
    title text,
    subtitle text,
    content jsonb,
    display_order integer DEFAULT 0,
    is_published boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_content_pkey') THEN
        ALTER TABLE public.landing_content ADD CONSTRAINT landing_content_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'landing_content_section_key_key') THEN
        ALTER TABLE public.landing_content ADD CONSTRAINT landing_content_section_key_key UNIQUE (section_key);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_landing_content_display_order ON public.landing_content USING btree (display_order);
CREATE INDEX IF NOT EXISTS idx_landing_content_section_key ON public.landing_content USING btree (section_key);

-- ----------------------------------------------------------------------------
-- 3. outcome_followups
--    NOTE: scripts/migrate-appeal-levels.sql defines get_unreported_outcome()
--    which reads from this table. Apply this migration BEFORE that one.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outcome_followups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appeal_id uuid NOT NULL,
    email text NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    followup_type text NOT NULL,
    scheduled_at timestamp with time zone NOT NULL,
    sent_at timestamp with time zone,
    opened_at timestamp with time zone,
    responded_at timestamp with time zone,
    outcome text,
    incentive_applied boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT outcome_followups_followup_type_check CHECK ((followup_type = ANY (ARRAY['day_30'::text, 'day_60'::text, 'incentive'::text]))),
    CONSTRAINT outcome_followups_outcome_check CHECK ((outcome = ANY (ARRAY['approved'::text, 'denied'::text, 'partial'::text, 'pending'::text])))
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outcome_followups_pkey') THEN
        ALTER TABLE public.outcome_followups ADD CONSTRAINT outcome_followups_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outcome_followups_token_key') THEN
        ALTER TABLE public.outcome_followups ADD CONSTRAINT outcome_followups_token_key UNIQUE (token);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'outcome_followups_appeal_id_fkey') THEN
        ALTER TABLE public.outcome_followups ADD CONSTRAINT outcome_followups_appeal_id_fkey
            FOREIGN KEY (appeal_id) REFERENCES public.appeals(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_followups_email_unreported ON public.outcome_followups USING btree (email) WHERE (responded_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_followups_scheduled ON public.outcome_followups USING btree (scheduled_at) WHERE (sent_at IS NULL);
CREATE INDEX IF NOT EXISTS idx_followups_token ON public.outcome_followups USING btree (token);

-- ----------------------------------------------------------------------------
-- 4. pricing_plans
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pricing_plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    price_cents integer NOT NULL,
    billing_period text,
    features jsonb,
    is_popular boolean DEFAULT false,
    display_order integer DEFAULT 0,
    stripe_price_id text,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pricing_plans_pkey') THEN
        ALTER TABLE public.pricing_plans ADD CONSTRAINT pricing_plans_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pricing_plans_display_order ON public.pricing_plans USING btree (display_order);

-- ----------------------------------------------------------------------------
-- 5. provider_practices
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.provider_practices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    practice_name text NOT NULL,
    npi text,
    specialty text,
    mac_name text,
    mac_jurisdiction text,
    state text NOT NULL,
    claims_per_month integer,
    top_procedures text[],
    top_denial_codes text[],
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_practices_pkey') THEN
        ALTER TABLE public.provider_practices ADD CONSTRAINT provider_practices_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'provider_practices_user_id_fkey') THEN
        ALTER TABLE public.provider_practices ADD CONSTRAINT provider_practices_user_id_fkey
            FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_provider_practices_user ON public.provider_practices USING btree (user_id);

-- ----------------------------------------------------------------------------
-- 6. site_settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    category text DEFAULT 'general'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_pkey') THEN
        ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'site_settings_key_key') THEN
        ALTER TABLE public.site_settings ADD CONSTRAINT site_settings_key_key UNIQUE (key);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_site_settings_key ON public.site_settings USING btree (key);

-- ----------------------------------------------------------------------------
-- 7. testimonials
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.testimonials (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    author_name text NOT NULL,
    author_title text,
    content text NOT NULL,
    rating integer,
    is_featured boolean DEFAULT false,
    is_published boolean DEFAULT true,
    source text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT testimonials_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'testimonials_pkey') THEN
        ALTER TABLE public.testimonials ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_testimonials_featured ON public.testimonials USING btree (is_featured) WHERE (is_featured = true);

-- ----------------------------------------------------------------------------
-- 8. Column drift recovery — appeals + users
--    Prod-only columns not created by sql/001-schema.sql or migrate-appeal-levels.sql.
--    Must run BEFORE flywheel_metrics matview (which references carc_codes and
--    outcome_reported_at).
-- ----------------------------------------------------------------------------

ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS carc_codes          text[] DEFAULT '{}'::text[];
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS rarc_codes          text[] DEFAULT '{}'::text[];
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS email               text;
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS outcome_reported_at timestamptz;
ALTER TABLE public.appeals ADD COLUMN IF NOT EXISTS outcome_details     jsonb;

ALTER TABLE public.users   ADD COLUMN IF NOT EXISTS counselor_id        text;
ALTER TABLE public.users   ADD COLUMN IF NOT EXISTS counselor_state     text;

-- ----------------------------------------------------------------------------
-- 9. flywheel_metrics materialized view + helper functions
--    DEPENDS ON: appeals (cpt_codes, icd10_codes, lcd_refs, carc_codes,
--                status, outcome_reported_at, created_at, conversation_id),
--                conversations (id, user_id), users (id, counselor_state).
--    Must run AFTER step 8 (column adds) and AFTER baseline schema.
--    No indexes exist on this matview in prod (verified pg_indexes empty).
-- ----------------------------------------------------------------------------
CREATE MATERIALIZED VIEW IF NOT EXISTS public.flywheel_metrics AS
 SELECT a.cpt_codes,
    a.icd10_codes,
    a.lcd_refs,
    carc.carc_code,
    a.status AS outcome,
    EXTRACT(epoch FROM a.outcome_reported_at - a.created_at) / 86400::numeric AS days_to_resolution,
    u.counselor_state AS mac_state,
    count(*) AS case_count,
    count(*) FILTER (WHERE a.status = 'approved'::text) AS approved_count,
    count(*) FILTER (WHERE a.status = 'denied'::text) AS denied_count
   FROM appeals a
     LEFT JOIN LATERAL unnest(a.carc_codes) carc(carc_code) ON true
     LEFT JOIN conversations c ON a.conversation_id = c.id
     LEFT JOIN users u ON c.user_id = u.id
  WHERE (a.status = ANY (ARRAY['approved'::text, 'denied'::text, 'partial'::text])) AND a.outcome_reported_at IS NOT NULL
  GROUP BY a.cpt_codes, a.icd10_codes, a.lcd_refs, carc.carc_code, a.status, (EXTRACT(epoch FROM a.outcome_reported_at - a.created_at) / 86400::numeric), u.counselor_state
WITH NO DATA;

CREATE OR REPLACE FUNCTION public.refresh_flywheel_metrics()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  REFRESH MATERIALIZED VIEW public.flywheel_metrics;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_flywheel_context(p_cpt_codes text[], p_carc_codes text[])
 RETURNS TABLE(carc_code text, total_cases bigint, success_rate numeric, avg_days numeric, approved bigint, denied bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    fm.carc_code,
    sum(fm.case_count) AS total_cases,
    (sum(fm.approved_count)::numeric / NULLIF(sum(fm.case_count), 0)) AS success_rate,
    avg(fm.days_to_resolution) AS avg_days,
    sum(fm.approved_count) AS approved,
    sum(fm.denied_count) AS denied
  FROM public.flywheel_metrics fm
  WHERE fm.cpt_codes && p_cpt_codes AND fm.carc_code = ANY(p_carc_codes)
  GROUP BY fm.carc_code;
END;
$function$;

COMMIT;
