-- =============================================================================
-- Denali baseline schema (sql/001-schema.sql)
--
-- Provenance:
--   Generated from pg_dump --schema-only against denali-prod RDS on 2026-04-21
--   Source: denali-prod.ca5m0qc8e5h8.us-east-1.rds.amazonaws.com / db=denali
--   Dumper: pg_dump 16.13 (Debian) against PostgreSQL 16.9
--   Flags:  --schema-only --no-owner --no-acl --no-publications
--           --no-subscriptions --no-security-labels --no-tablespaces
--           --if-exists --clean --schema=public
--   Run via: ECS Fargate task (denali-prod-pgdump:1) — read-only on prod
--
-- Post-processing applied:
--   - Stripped psql \restrict / \unrestrict directives (psql-only, not portable)
--   - Stripped 262 destructive DROP / ALTER...DROP CONSTRAINT statements
--     produced by --clean (we want a non-destructive bootstrap baseline)
--   - Stripped 10 session SET statements (statement_timeout, lock_timeout,
--     client_encoding, etc.) and the SELECT pg_catalog.set_config('search_path')
--     so the file is replay-safe inside an enclosing transaction
--   - Stripped CREATE SCHEMA public + COMMENT ON SCHEMA public (public exists
--     by default on a fresh PostgreSQL database)
--   - Prepended CREATE EXTENSION IF NOT EXISTS for prod-installed extensions
--     (pgcrypto, pg_trgm, btree_gin) since pg_dump --schema=public filters out
--     the CREATE EXTENSION statements; pgcrypto is required by 40+ uses of
--     gen_random_uuid() in this schema
--   - Wrapped entire body in a single BEGIN / COMMIT transaction so the load
--     is atomic
--
-- Replaces: a Supabase-era schema (51,833 bytes, 16 tables) that was never
--   the actual builder of prod. Prod was bootstrapped from an adapted version
--   that stripped Supabase auth.users FKs, RLS policies, and uuid-ossp — and
--   that adapted version was never committed. This dump captures the true
--   prod schema (41 tables, including counselor_cases, landing_content,
--   outcome_followups, pricing_plans, provider_practices, site_settings,
--   testimonials, and the flywheel_metrics matview) as the new baseline.
--
-- Verification: 0 Supabase residue (no auth.uid, no auth.users, no RLS
--   policies, no anon/authenticated/service_role grants, no Supabase
--   extensions). All identifiers public-schema-qualified.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;

--
-- Name: add_appeal_credits(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_appeal_credits(p_email text, p_credits integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.usage
  SET appeal_credits = appeal_credits + p_credits
  WHERE email = p_email;

  IF NOT FOUND THEN
    INSERT INTO public.usage (email, appeal_count, appeal_credits)
    VALUES (p_email, 0, p_credits);
  END IF;
END;
$$;

--
-- Name: apply_outcome_incentive(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.apply_outcome_incentive(p_email text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_updated BOOLEAN := false;
BEGIN
  UPDATE usage
  SET appeal_count = GREATEST(appeal_count - 1, 0)
  WHERE email = p_email;

  IF FOUND THEN
    UPDATE outcome_followups
    SET incentive_applied = true
    WHERE email = p_email
      AND responded_at IS NOT NULL
      AND incentive_applied = false;
    v_updated := true;
  END IF;

  RETURN v_updated;
END;
$$;

--
-- Name: check_and_increment_chat(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_and_increment_chat(p_identifier text, p_daily_limit integer) RETURNS TABLE(allowed boolean, count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
  DECLARE
    v_count INT;
    v_today DATE := CURRENT_DATE;
  BEGIN
    SELECT message_count INTO v_count
    FROM chat_daily_usage
    WHERE identifier = p_identifier AND usage_date = v_today;
    v_count := COALESCE(v_count, 0);
    IF p_daily_limit > 0 AND v_count >= p_daily_limit THEN
      RETURN QUERY SELECT false, v_count;
      RETURN;
    END IF;
    INSERT INTO chat_daily_usage (identifier, usage_date, message_count)
    VALUES (p_identifier, v_today, 1)
    ON CONFLICT (identifier, usage_date)
    DO UPDATE SET message_count = chat_daily_usage.message_count + 1, updated_at = now();
    RETURN QUERY SELECT true, v_count + 1;
    RETURN;
  END;
  $$;

--
-- Name: check_appeal_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_appeal_access(p_email text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_credits INT;
BEGIN
  IF p_email IS NULL THEN
    RETURN 'paywall';
  END IF;

  SELECT appeal_credits INTO v_credits FROM public.usage WHERE email = p_email;

  IF v_credits IS NULL OR v_credits <= 0 THEN
    RETURN 'paywall';
  END IF;

  RETURN 'allowed';
END;
$$;

--
-- Name: check_rolling_chat_limit(text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_rolling_chat_limit(p_identifier text, p_max integer, p_window_days integer) RETURNS TABLE(allowed boolean, total integer, is_last boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$ DECLARE v_total INT; BEGIN SELECT COALESCE(SUM(message_count), 0) INTO v_total FROM chat_daily_usage WHERE identifier = p_identifier AND usage_date >= CURRENT_DATE - p_window_days; RETURN QUERY SELECT v_total < p_max, v_total, v_total = p_max - 1; END; $$;

--
-- Name: check_weekly_frequency(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_weekly_frequency(p_identifier text, p_max_days integer) RETURNS TABLE(allowed boolean, days_used integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$ DECLARE v_week_start DATE; v_days INT; v_has_today BOOLEAN; BEGIN v_week_start := date_trunc('week', CURRENT_DATE)::DATE; SELECT COUNT(DISTINCT usage_date) INTO v_days FROM chat_daily_usage WHERE identifier = p_identifier AND usage_date >= v_week_start AND usage_date < v_week_start + 7; v_has_today := EXISTS (SELECT 1 FROM chat_daily_usage WHERE identifier = p_identifier AND usage_date = CURRENT_DATE); IF p_max_days = 0 THEN RETURN QUERY SELECT true, v_days; RETURN; END IF; IF v_has_today THEN RETURN QUERY SELECT v_days <= p_max_days, v_days; ELSE RETURN QUERY SELECT v_days < p_max_days, v_days; END IF; END; $$;

--
-- Name: claim_conversation(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_conversation(p_conversation_id uuid, p_user_id uuid DEFAULT NULL::uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_updated BOOLEAN := false;
BEGIN
  -- Only claim if conversation is unclaimed (user_id IS NULL)
  UPDATE public.conversations
  SET user_id = p_user_id
  WHERE id = p_conversation_id AND user_id IS NULL AND p_user_id IS NOT NULL;

  v_updated := FOUND;
  RETURN v_updated;
END;
$$;

--
-- Name: claim_learning_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_learning_job() RETURNS TABLE(job_id uuid, job_type text, job_data jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM public.learning_queue
  WHERE status = 'pending'
  ORDER BY priority DESC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.learning_queue
  SET status = 'processing', started_at = now(), attempts = attempts + 1
  WHERE id = v_id;

  RETURN QUERY
  SELECT lq.id, lq.job_type, lq.job_data
  FROM public.learning_queue lq
  WHERE lq.id = v_id;
END;
$$;

--
-- Name: complete_learning_job(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_learning_job(p_job_id uuid, p_success boolean, p_error text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.learning_queue
  SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
      completed_at = CASE WHEN p_success THEN now() ELSE NULL END,
      last_error = p_error
  WHERE id = p_job_id;
END;
$$;

--
-- Name: decrement_appeal_credit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_appeal_credit(p_email text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_credits INT;
BEGIN
  SELECT appeal_credits INTO v_credits FROM public.usage WHERE email = p_email;

  IF v_credits IS NULL OR v_credits <= 0 THEN
    RETURN -1;
  END IF;

  UPDATE public.usage
  SET appeal_credits = appeal_credits - 1
  WHERE email = p_email;

  RETURN v_credits - 1;
END;
$$;

--
-- Name: delete_user_cascade(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_cascade(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  DELETE FROM public.fhir_cache WHERE user_id = target_user_id;
  DELETE FROM public.ehr_connections WHERE user_id = target_user_id;
  DELETE FROM public.diabetes_insights WHERE user_id = target_user_id;
  DELETE FROM public.diabetes_log WHERE user_id = target_user_id;
  DELETE FROM public.diabetes_snapshots WHERE user_id = target_user_id;
  DELETE FROM public.chat_daily_usage WHERE identifier = target_user_id::text;
  DELETE FROM public.consent_preferences WHERE user_id = target_user_id;
  DELETE FROM public.user_feedback WHERE user_id = target_user_id;
  -- Messages cascade from conversations
  DELETE FROM public.appeals WHERE user_id = target_user_id;
  DELETE FROM public.conversations WHERE user_id = target_user_id;
  DELETE FROM public.usage WHERE user_id = target_user_id;
  DELETE FROM public.subscriptions WHERE user_id = target_user_id;
  DELETE FROM public.user_events WHERE user_id IS NULL; -- user_events has no user_id column, skip
  DELETE FROM public.user_verification WHERE user_id = target_user_id;
  DELETE FROM public.provider_practices WHERE user_id = target_user_id;
  -- audit_logs intentionally NOT deleted (HIPAA 6-year retention)
  DELETE FROM public.users WHERE id = target_user_id;
END;
$$;

--
-- Name: fulfill_checkout(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fulfill_checkout(p_user_id uuid, p_email text, p_plan text, p_stripe_customer_id text DEFAULT NULL::text, p_stripe_subscription_id text DEFAULT NULL::text, p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  -- Update user plan
  UPDATE public.users SET plan = p_plan WHERE id = p_user_id;

  -- Upsert subscription. Mark trial_converted = true since payment proves the
  -- user is no longer on trial — /api/trial keys "expired" off this flag once
  -- the original trial_end has passed.
  INSERT INTO public.subscriptions (user_id, plan, status, stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, trial_converted)
  VALUES (p_user_id, p_plan, 'active', p_stripe_customer_id, p_stripe_subscription_id, p_period_start, p_period_end, true)
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = 'active',
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
    current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
    trial_converted = true,
    updated_at = now();
END;
$$;

--
-- Name: generate_case_ref(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_case_ref(p_counselor_id uuid, p_initials text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT count(*) INTO v_count FROM public.counselor_cases WHERE counselor_id = p_counselor_id;
  RETURN upper(p_initials) || '-' || to_char(now(), 'YYYYMM') || '-' || lpad((v_count + 1)::text, 4, '0');
END;
$$;

--
-- Name: get_appeal_context(text[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_appeal_context(p_icd10_codes text[], p_cpt_codes text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_patterns jsonb;
  v_outcomes jsonb;
BEGIN
  -- Denial patterns for these CPT codes
  SELECT jsonb_agg(jsonb_build_object('reason', dp.reason, 'appeal_strategy', dp.appeal_strategy, 'estimated_success_rate', dp.estimated_success_rate))
  INTO v_patterns
  FROM public.denial_patterns_latest dp
  WHERE dp.common_cpts && p_cpt_codes
  LIMIT 5;

  -- Recent appeal outcomes
  SELECT jsonb_agg(jsonb_build_object('outcome', ao.outcome, 'successful_arguments', ao.successful_arguments, 'days_to_resolution', ao.days_to_resolution))
  INTO v_outcomes
  FROM public.appeal_outcomes ao
  WHERE ao.cpt_codes && p_cpt_codes
    AND ao.outcome IN ('approved', 'partial')
  ORDER BY ao.created_at DESC
  LIMIT 5;

  v_result := jsonb_build_object(
    'denial_patterns', COALESCE(v_patterns, '[]'::jsonb),
    'successful_outcomes', COALESCE(v_outcomes, '[]'::jsonb)
  );

  RETURN v_result;
END;
$$;

--
-- Name: get_appeal_count(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_appeal_count(p_email text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
BEGIN
  SELECT appeal_count INTO v_count FROM public.usage WHERE email = p_email;
  RETURN COALESCE(v_count, 0);
END;
$$;

--
-- Name: get_counselor_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_counselor_stats(p_counselor_id uuid) RETURNS TABLE(open_cases bigint, filed_this_month bigint, outcomes_reported bigint, approved_count bigint, denied_count bigint, partial_count bigint, avg_resolution_days numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE cc.status = 'open') AS open_cases,
    count(*) FILTER (WHERE cc.status = 'appeal_filed' AND cc.created_at >= date_trunc('month', now())) AS filed_this_month,
    count(*) FILTER (WHERE cc.status = 'outcome_reported') AS outcomes_reported,
    count(*) FILTER (WHERE cc.outcome = 'approved') AS approved_count,
    count(*) FILTER (WHERE cc.outcome = 'denied') AS denied_count,
    count(*) FILTER (WHERE cc.outcome = 'partial') AS partial_count,
    avg(EXTRACT(epoch FROM (cc.outcome_date - cc.created_at::date)) / 86400) FILTER (WHERE cc.outcome_date IS NOT NULL) AS avg_resolution_days
  FROM public.counselor_cases cc
  WHERE cc.counselor_id = p_counselor_id;
END;
$$;

--
-- Name: get_denial_pattern_for_carc(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_denial_pattern_for_carc(carc_code_input text) RETURNS TABLE(reason text, category text, appeal_strategy text, documentation_checklist text[], estimated_success_rate text, appeal_deadline_days integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT dp.reason, dp.category, dp.appeal_strategy, dp.documentation_checklist,
         dp.estimated_success_rate, dp.appeal_deadline_days
  FROM public.denial_patterns_latest dp
  WHERE carc_code_input = ANY(dp.reason_codes)
  LIMIT 1;
END;
$$;

--
-- Name: get_denial_patterns_for_cpt(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_denial_patterns_for_cpt(cpt_code_input text) RETURNS TABLE(id uuid, reason text, category text, reason_codes text[], common_cpts text[], common_diagnoses text[], appeal_strategy text, documentation_checklist text[], estimated_success_rate text, appeal_deadline_days integer, effective_date date, is_active boolean, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT dp.id, dp.reason, dp.category, dp.reason_codes, dp.common_cpts, dp.common_diagnoses,
         dp.appeal_strategy, dp.documentation_checklist, dp.estimated_success_rate,
         dp.appeal_deadline_days, dp.effective_date, dp.is_active, dp.created_at
  FROM public.denial_patterns_latest dp
  WHERE cpt_code_input = ANY(dp.common_cpts);
END;
$$;

--
-- Name: get_flywheel_context(text[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_flywheel_context(p_cpt_codes text[], p_carc_codes text[]) RETURNS TABLE(carc_code text, total_cases bigint, success_rate numeric, avg_days numeric, approved bigint, denied bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
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
$$;

--
-- Name: get_grouped_audit_logs(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_grouped_audit_logs(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(action text, resource_type text, ip_address text, latest_at timestamp with time zone, log_date date, entry_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.action,
    al.resource_type,
    al.ip_address,
    MAX(al.created_at) AS latest_at,
    DATE(al.created_at) AS log_date,
    COUNT(*)::integer AS entry_count
  FROM public.audit_logs al
  WHERE al.user_id = p_user_id
  GROUP BY al.action, al.resource_type, al.ip_address, DATE(al.created_at)
  ORDER BY MAX(al.created_at) DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$;

--
-- Name: get_learning_context(text[], text[], text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_learning_context(p_symptom_phrases text[] DEFAULT NULL::text[], p_icd10_codes text[] DEFAULT NULL::text[], p_cpt_codes text[] DEFAULT NULL::text[], p_limit integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_result jsonb := '{}'::jsonb;
  v_symptoms jsonb;
  v_procedures jsonb;
  v_coverage jsonb;
BEGIN
  -- High-confidence symptom mappings
  IF p_symptom_phrases IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('phrase', sm.phrase, 'icd10_code', sm.icd10_code, 'icd10_description', sm.icd10_description, 'confidence', sm.confidence))
    INTO v_symptoms
    FROM public.symptom_mappings sm
    WHERE sm.phrase = ANY(p_symptom_phrases) AND sm.confidence >= 0.7
    LIMIT p_limit;

    v_result := v_result || jsonb_build_object('symptom_mappings', COALESCE(v_symptoms, '[]'::jsonb));
  END IF;

  -- High-confidence coverage paths
  IF p_icd10_codes IS NOT NULL AND p_cpt_codes IS NOT NULL THEN
    SELECT jsonb_agg(jsonb_build_object('icd10_code', cp.icd10_code, 'cpt_code', cp.cpt_code, 'outcome', cp.outcome, 'ncd_id', cp.ncd_id, 'lcd_id', cp.lcd_id, 'use_count', cp.use_count))
    INTO v_coverage
    FROM public.coverage_paths cp
    WHERE cp.icd10_code = ANY(p_icd10_codes) AND cp.cpt_code = ANY(p_cpt_codes)
    ORDER BY cp.use_count DESC
    LIMIT p_limit;

    v_result := v_result || jsonb_build_object('coverage_paths', COALESCE(v_coverage, '[]'::jsonb));
  END IF;

  RETURN v_result;
END;
$$;

--
-- Name: get_unreported_outcome(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unreported_outcome(p_email text) RETURNS TABLE(appeal_id uuid, followup_id uuid, service_description text, denial_date text, appeal_level integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$BEGIN RETURN QUERY SELECT a.id AS appeal_id,f.id AS followup_id,a.service_description,a.denial_date::TEXT,a.appeal_level FROM outcome_followups f JOIN appeals a ON a.id=f.appeal_id WHERE f.email=p_email AND f.status='pending' AND f.scheduled_at<=NOW() AND NOT EXISTS(SELECT 1 FROM appeal_outcomes ao WHERE ao.appeal_id=a.id) ORDER BY f.scheduled_at ASC LIMIT 1;END;$$;

--
-- Name: handle_subscription_change(text, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_subscription_change(p_stripe_subscription_id text, p_status text, p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = p_status,
      current_period_start = COALESCE(p_period_start, current_period_start),
      current_period_end = COALESCE(p_period_end, current_period_end),
      cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END,
      updated_at = now()
  WHERE stripe_subscription_id = p_stripe_subscription_id;

  -- When status flips to 'cancelled', revert the user's plan so the UI matches
  -- Stripe-side reality. Prior version only touched the subscriptions table,
  -- leaving users.plan stale at the paid tier.
  IF p_status = 'cancelled' THEN
    UPDATE public.users
    SET plan = 'trial', updated_at = now()
    WHERE id = (
      SELECT user_id FROM public.subscriptions
      WHERE stripe_subscription_id = p_stripe_subscription_id
      LIMIT 1
    );
  END IF;
END;
$$;

--
-- Name: increment_appeal_count(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_appeal_count(p_email text, p_user_id uuid DEFAULT NULL::uuid, p_device_fingerprint text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE public.usage
  SET appeal_count = appeal_count + 1,
      last_appeal_at = now()
  WHERE email = p_email
  RETURNING appeal_count INTO v_count;

  IF v_count IS NULL THEN
    INSERT INTO public.usage (email, user_id, device_fingerprint, appeal_count, last_appeal_at)
    VALUES (p_email, p_user_id, p_device_fingerprint, 1, now())
    RETURNING appeal_count INTO v_count;
  END IF;

  RETURN v_count;
END;
$$;

--
-- Name: process_feedback(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_feedback(p_message_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_rating text DEFAULT NULL::text, p_correction text DEFAULT NULL::text, p_feedback_type text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.user_feedback (message_id, user_id, rating, correction, feedback_type)
  VALUES (p_message_id, p_user_id, p_rating, p_correction, p_feedback_type)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

--
-- Name: prune_weak_mappings(real, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_weak_mappings(p_min_confidence real DEFAULT 0.3, p_min_use_count integer DEFAULT 2, p_days_inactive integer DEFAULT 90) RETURNS TABLE(pruned_symptoms integer, pruned_procedures integer, pruned_coverage_paths integer)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_pruned_symptoms INT;
  v_pruned_procedures INT;
  v_pruned_coverage INT;
BEGIN
  WITH deleted AS (
    DELETE FROM public.symptom_mappings
    WHERE confidence < p_min_confidence
       OR (use_count < p_min_use_count AND last_used_at < now() - (p_days_inactive || ' days')::interval)
    RETURNING 1
  ) SELECT count(*) INTO v_pruned_symptoms FROM deleted;

  WITH deleted AS (
    DELETE FROM public.procedure_mappings
    WHERE confidence < p_min_confidence
       OR (use_count < p_min_use_count AND last_used_at < now() - (p_days_inactive || ' days')::interval)
    RETURNING 1
  ) SELECT count(*) INTO v_pruned_procedures FROM deleted;

  WITH deleted AS (
    DELETE FROM public.coverage_paths
    WHERE use_count < p_min_use_count
       AND last_used_at < now() - (p_days_inactive || ' days')::interval
    RETURNING 1
  ) SELECT count(*) INTO v_pruned_coverage FROM deleted;

  RETURN QUERY SELECT v_pruned_symptoms, v_pruned_procedures, v_pruned_coverage;
END;
$$;

--
-- Name: queue_learning_job(text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_learning_job(p_job_type text, p_job_data jsonb, p_priority integer DEFAULT 5) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.learning_queue (job_type, job_data, priority)
  VALUES (p_job_type, p_job_data, p_priority)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

--
-- Name: record_appeal_outcome(uuid, text, text, text, text[], text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_appeal_outcome(p_appeal_id uuid, p_email text, p_outcome text, p_denial_reason text DEFAULT NULL::text, p_documentation_gaps text[] DEFAULT NULL::text[], p_successful_arguments text[] DEFAULT NULL::text[], p_days_to_resolution integer DEFAULT NULL::integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Update appeal status
  UPDATE public.appeals
  SET status = p_outcome, outcome_reported_at = now()
  WHERE id = p_appeal_id;

  -- Insert into appeal_outcomes (learning table)
  INSERT INTO public.appeal_outcomes (appeal_id, email, outcome, denial_reason, documentation_gaps, successful_arguments, days_to_resolution)
  VALUES (p_appeal_id, p_email, p_outcome, p_denial_reason, p_documentation_gaps, p_successful_arguments, p_days_to_resolution)
  RETURNING id INTO v_id;

  -- Mark followup as responded
  UPDATE public.outcome_followups
  SET responded_at = now(), outcome = p_outcome
  WHERE appeal_id = p_appeal_id AND responded_at IS NULL;

  RETURN v_id;
END;
$$;

--
-- Name: refresh_flywheel_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_flywheel_metrics() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW public.flywheel_metrics;
END;
$$;

--
-- Name: reset_monthly_appeal_credits(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reset_monthly_appeal_credits(p_email text, p_credits integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.usage
  SET appeal_credits = p_credits
  WHERE email = p_email;

  IF NOT FOUND THEN
    INSERT INTO public.usage (email, appeal_count, appeal_credits)
    VALUES (p_email, 0, p_credits);
  END IF;
END;
$$;

--
-- Name: search_denial_codes(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_denial_codes(search_text text) RETURNS TABLE(code_type text, code text, description text, category text, plain_english text)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT 'CARC'::text, c.code, c.description, c.category, c.plain_english
  FROM public.carc_codes_latest c
  WHERE c.description ILIKE '%' || search_text || '%'
     OR c.plain_english ILIKE '%' || search_text || '%'
     OR c.code ILIKE '%' || search_text || '%'
  UNION ALL
  SELECT 'RARC'::text, r.code, r.description, r.category, r.plain_english
  FROM public.rarc_codes_latest r
  WHERE r.description ILIKE '%' || search_text || '%'
     OR r.plain_english ILIKE '%' || search_text || '%'
     OR r.code ILIKE '%' || search_text || '%'
  LIMIT 20;
END;
$$;

--
-- Name: track_user_event(text, text, jsonb, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_user_event(p_phone text DEFAULT NULL::text, p_event_type text DEFAULT NULL::text, p_event_data jsonb DEFAULT NULL::jsonb, p_conversation_id uuid DEFAULT NULL::uuid, p_appeal_id uuid DEFAULT NULL::uuid, p_device_fingerprint text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.user_events (phone, event_type, event_data, conversation_id, appeal_id, device_fingerprint)
  VALUES (p_phone, p_event_type, p_event_data, p_conversation_id, p_appeal_id, p_device_fingerprint)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

--
-- Name: update_conversation_pattern(text, text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_pattern(p_trigger_phrase text, p_intent text, p_question_sequence jsonb, p_was_successful boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.conversation_patterns (trigger_phrase, intent, question_sequence, success_rate, use_count)
  VALUES (lower(p_trigger_phrase), p_intent, p_question_sequence,
          CASE WHEN p_was_successful THEN 0.7 ELSE 0.3 END, 1)
  ON CONFLICT (trigger_phrase, intent) DO UPDATE
  SET use_count = conversation_patterns.use_count + 1,
      success_rate = (conversation_patterns.success_rate * conversation_patterns.use_count +
                      CASE WHEN p_was_successful THEN 1 ELSE 0 END::real) /
                     (conversation_patterns.use_count + 1),
      last_used_at = now(),
      question_sequence = p_question_sequence;
END;
$$;

--
-- Name: update_coverage_path(text, text, text, text, text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_coverage_path(p_icd10_code text, p_cpt_code text, p_outcome text, p_ncd_id text DEFAULT ''::text, p_lcd_id text DEFAULT ''::text, p_contractor_id text DEFAULT NULL::text, p_documentation_required text[] DEFAULT NULL::text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.coverage_paths (icd10_code, cpt_code, outcome, ncd_id, lcd_id, contractor_id, documentation_required)
  VALUES (p_icd10_code, p_cpt_code, p_outcome, p_ncd_id, p_lcd_id, p_contractor_id, p_documentation_required)
  ON CONFLICT (icd10_code, cpt_code, ncd_id, lcd_id) DO UPDATE
  SET use_count = coverage_paths.use_count + 1,
      last_used_at = now(),
      outcome = p_outcome;
END;
$$;

--
-- Name: update_procedure_mapping(text, text, text, real); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_procedure_mapping(p_phrase text, p_cpt_code text, p_cpt_description text, p_boost real) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.procedure_mappings (phrase, cpt_code, cpt_description, confidence, use_count)
  VALUES (lower(p_phrase), p_cpt_code, p_cpt_description, 0.5 + p_boost, 1)
  ON CONFLICT (phrase, cpt_code) DO UPDATE
  SET confidence = LEAST(procedure_mappings.confidence + p_boost, 1.0),
      use_count = procedure_mappings.use_count + 1,
      last_used_at = now(),
      cpt_description = COALESCE(p_cpt_description, procedure_mappings.cpt_description);
END;
$$;

--
-- Name: update_symptom_mapping(text, text, text, real); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_symptom_mapping(p_phrase text, p_icd10_code text, p_icd10_description text, p_boost real) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.symptom_mappings (phrase, icd10_code, icd10_description, confidence, use_count)
  VALUES (lower(p_phrase), p_icd10_code, p_icd10_description, 0.5 + p_boost, 1)
  ON CONFLICT (phrase, icd10_code) DO UPDATE
  SET confidence = LEAST(symptom_mappings.confidence + p_boost, 1.0),
      use_count = symptom_mappings.use_count + 1,
      last_used_at = now(),
      icd10_description = COALESCE(p_icd10_description, symptom_mappings.icd10_description);
END;
$$;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

--
-- Name: alert_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    alert_type text NOT NULL,
    dedup_key text NOT NULL,
    email text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    resend_id text,
    status text DEFAULT 'sent'::text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    CONSTRAINT alert_log_alert_type_check CHECK ((alert_type = ANY (ARRAY['appeal_deadline'::text, 'med_refill'::text, 'new_denial'::text, 'data_refresh'::text, 'outcome_followup'::text]))),
    CONSTRAINT alert_log_status_check CHECK ((status = ANY (ARRAY['sent'::text, 'bounced'::text, 'failed'::text])))
);

--
-- Name: alert_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.alert_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    alert_type text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alert_preferences_alert_type_check CHECK ((alert_type = ANY (ARRAY['appeal_deadline'::text, 'med_refill'::text, 'new_denial'::text, 'data_refresh'::text])))
);

--
-- Name: appeal_levels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appeal_levels (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    time_limit text NOT NULL,
    decision_timeframe text NOT NULL,
    success_rate text,
    effective_date date DEFAULT '2025-12-10'::date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: appeal_levels_latest; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.appeal_levels_latest AS
 SELECT id,
    level,
    name,
    description,
    time_limit,
    decision_timeframe,
    success_rate,
    effective_date,
    created_at
   FROM public.appeal_levels
  WHERE (effective_date = ( SELECT max(al.effective_date) AS max
           FROM public.appeal_levels al))
  ORDER BY level;

--
-- Name: appeal_outcomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appeal_outcomes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appeal_id uuid,
    phone text,
    icd10_codes text[],
    cpt_codes text[],
    ncd_refs text[],
    lcd_refs text[],
    outcome text,
    denial_reason text,
    documentation_gaps text[],
    successful_arguments text[],
    days_to_resolution integer,
    outcome_reported_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    email text,
    CONSTRAINT appeal_outcomes_outcome_check CHECK ((outcome = ANY (ARRAY['approved'::text, 'denied'::text, 'partial'::text, 'pending'::text, 'unknown'::text])))
);

--
-- Name: appeals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appeals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    phone text,
    user_id uuid,
    denial_date date,
    denial_reason text,
    service_description text,
    appeal_letter text NOT NULL,
    icd10_codes text[],
    cpt_codes text[],
    ncd_refs text[],
    lcd_refs text[],
    pubmed_refs text[],
    deadline date,
    status text DEFAULT 'draft'::text,
    paid boolean DEFAULT false,
    stripe_payment_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    carc_codes text[] DEFAULT '{}'::text[],
    rarc_codes text[] DEFAULT '{}'::text[],
    email text,
    outcome_reported_at timestamp with time zone,
    outcome_details jsonb,
    appeal_level integer DEFAULT 1 NOT NULL,
    prior_appeal_id uuid,
    CONSTRAINT appeal_level_range CHECK (((appeal_level >= 1) AND (appeal_level <= 5))),
    CONSTRAINT appeals_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'sent'::text, 'approved'::text, 'denied'::text, 'pending'::text])))
);

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    action text NOT NULL,
    resource_type text,
    resource_id text,
    metadata jsonb DEFAULT '{}'::jsonb,
    ip_address text,
    user_agent text,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: blog_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.blog_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    title text NOT NULL,
    kicker text NOT NULL,
    key_message text NOT NULL,
    body text NOT NULL,
    category text NOT NULL,
    cta_text text DEFAULT 'Check your coverage on Denali.health'::text NOT NULL,
    cta_url text DEFAULT '/chat'::text NOT NULL,
    sources text[],
    meta_title text,
    meta_description text,
    published boolean DEFAULT false,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tags text[] DEFAULT '{}'::text[],
    CONSTRAINT blog_posts_category_check CHECK ((category = ANY (ARRAY['denial-codes'::text, 'coverage'::text, 'appeals'::text, 'prior-auth'::text])))
);

--
-- Name: carc_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carc_codes (
    code text NOT NULL,
    group_code text,
    description text NOT NULL,
    category text,
    plain_english text,
    effective_date date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: carc_codes_latest; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.carc_codes_latest AS
 SELECT code,
    group_code,
    description,
    category,
    plain_english,
    effective_date,
    is_active,
    created_at
   FROM public.carc_codes
  WHERE (effective_date = ( SELECT max(cc.effective_date) AS max
           FROM public.carc_codes cc));

--
-- Name: chat_daily_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_daily_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    identifier text NOT NULL,
    usage_date date DEFAULT CURRENT_DATE NOT NULL,
    message_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: consent_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.consent_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    consent_type text NOT NULL,
    granted boolean DEFAULT false NOT NULL,
    granted_at timestamp with time zone,
    revoked_at timestamp with time zone,
    version integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: conversation_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_patterns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    trigger_phrase text NOT NULL,
    intent text NOT NULL,
    question_sequence jsonb NOT NULL,
    success_rate real DEFAULT 0.5,
    use_count integer DEFAULT 1,
    last_used_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT conversation_patterns_intent_check CHECK ((intent = ANY (ARRAY['coverage_check'::text, 'appeal_help'::text, 'provider_lookup'::text, 'general'::text]))),
    CONSTRAINT conversation_patterns_success_rate_check CHECK (((success_rate >= (0)::double precision) AND (success_rate <= (1)::double precision)))
);

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    phone text,
    device_fingerprint text,
    title text,
    status text DEFAULT 'active'::text NOT NULL,
    is_appeal boolean DEFAULT false,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_suggestions jsonb,
    CONSTRAINT conversations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])))
);

--
-- Name: counselor_cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.counselor_cases (
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

--
-- Name: coverage_paths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coverage_paths (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    icd10_code text NOT NULL,
    cpt_code text NOT NULL,
    ncd_id text DEFAULT ''::text,
    lcd_id text DEFAULT ''::text,
    contractor_id text,
    outcome text NOT NULL,
    documentation_required text[],
    use_count integer DEFAULT 1 NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coverage_paths_outcome_check CHECK ((outcome = ANY (ARRAY['approved'::text, 'denied'::text, 'conditional'::text])))
);

--
-- Name: denial_patterns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.denial_patterns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reason text NOT NULL,
    category text NOT NULL,
    reason_codes text[] DEFAULT '{}'::text[],
    common_cpts text[] DEFAULT '{}'::text[],
    common_diagnoses text[] DEFAULT '{}'::text[],
    appeal_strategy text NOT NULL,
    documentation_checklist text[] DEFAULT '{}'::text[],
    estimated_success_rate text,
    appeal_deadline_days integer DEFAULT 120 NOT NULL,
    effective_date date DEFAULT '2025-12-10'::date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: denial_patterns_latest; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.denial_patterns_latest AS
 SELECT id,
    reason,
    category,
    reason_codes,
    common_cpts,
    common_diagnoses,
    appeal_strategy,
    documentation_checklist,
    estimated_success_rate,
    appeal_deadline_days,
    effective_date,
    is_active,
    created_at
   FROM public.denial_patterns
  WHERE ((effective_date = ( SELECT max(dp.effective_date) AS max
           FROM public.denial_patterns dp)) AND (is_active = true));

--
-- Name: diabetes_insights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diabetes_insights (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    classification text NOT NULL,
    summary text NOT NULL,
    recommendations jsonb DEFAULT '[]'::jsonb NOT NULL,
    risk_alerts jsonb DEFAULT '[]'::jsonb NOT NULL,
    screening_reminders jsonb DEFAULT '[]'::jsonb NOT NULL,
    data_hash text NOT NULL,
    generated_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT diabetes_insights_classification_check CHECK ((classification = ANY (ARRAY['diabetic'::text, 'pre-diabetic'::text, 'at-risk'::text, 'none'::text])))
);

--
-- Name: diabetes_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diabetes_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    logged_at timestamp with time zone NOT NULL,
    entry_type text NOT NULL,
    glucose_value numeric,
    glucose_context text,
    activity_minutes integer,
    activity_type text,
    note text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT diabetes_log_activity_minutes_check CHECK (((activity_minutes IS NULL) OR (activity_minutes > 0))),
    CONSTRAINT diabetes_log_entry_type_check CHECK ((entry_type = ANY (ARRAY['glucose'::text, 'activity'::text, 'meal'::text, 'note'::text]))),
    CONSTRAINT diabetes_log_glucose_context_check CHECK (((glucose_context IS NULL) OR (glucose_context = ANY (ARRAY['fasting'::text, 'before_meal'::text, 'after_meal'::text, 'bedtime'::text, 'other'::text]))))
);

--
-- Name: diabetes_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diabetes_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    loinc_code text NOT NULL,
    lab_name text NOT NULL,
    value numeric NOT NULL,
    unit text DEFAULT '%'::text NOT NULL,
    observed_date date NOT NULL,
    source text DEFAULT 'fhir'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: ehr_connections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ehr_connections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    provider text DEFAULT 'bluebutton'::text NOT NULL,
    fhir_patient_id text,
    access_token_encrypted text NOT NULL,
    refresh_token_encrypted text NOT NULL,
    token_expires_at timestamp with time zone NOT NULL,
    scopes text,
    status text DEFAULT 'active'::text NOT NULL,
    last_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: eob_denial_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eob_denial_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    eob_code text NOT NULL,
    eob_description text,
    carc_code text NOT NULL,
    rarc_code text,
    effective_date date NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: eob_denial_mappings_latest; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.eob_denial_mappings_latest AS
 SELECT id,
    eob_code,
    eob_description,
    carc_code,
    rarc_code,
    effective_date,
    created_at
   FROM public.eob_denial_mappings
  WHERE (effective_date = ( SELECT max(edm.effective_date) AS max
           FROM public.eob_denial_mappings edm));

--
-- Name: fhir_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fhir_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    resource_type text NOT NULL,
    data jsonb NOT NULL,
    cached_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone DEFAULT (now() + '24:00:00'::interval)
);

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    phone text,
    email text NOT NULL,
    plan text DEFAULT 'trial'::text NOT NULL,
    theme text DEFAULT 'auto'::text,
    notifications_enabled boolean DEFAULT true,
    text_size real DEFAULT 1.0,
    high_contrast boolean DEFAULT false,
    reduce_motion boolean DEFAULT false,
    autoplay_media boolean DEFAULT true,
    voiceover_optimization boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    role text DEFAULT 'patient'::text NOT NULL,
    organization text,
    counselor_state text,
    counselor_id text,
    is_admin boolean DEFAULT false NOT NULL,
    CONSTRAINT users_plan_check CHECK ((plan = ANY (ARRAY['trial'::text, 'starter'::text, 'plus'::text, 'unlimited'::text]))),
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY['patient'::text, 'counselor'::text, 'provider'::text]))),
    CONSTRAINT users_text_size_check CHECK (((text_size >= (0.8)::double precision) AND (text_size <= (1.5)::double precision))),
    CONSTRAINT users_theme_check CHECK ((theme = ANY (ARRAY['auto'::text, 'light'::text, 'dark'::text])))
);

--
-- Name: flywheel_metrics; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.flywheel_metrics AS
 SELECT a.cpt_codes,
    a.icd10_codes,
    a.lcd_refs,
    carc.carc_code,
    a.status AS outcome,
    (EXTRACT(epoch FROM (a.outcome_reported_at - a.created_at)) / (86400)::numeric) AS days_to_resolution,
    u.counselor_state AS mac_state,
    count(*) AS case_count,
    count(*) FILTER (WHERE (a.status = 'approved'::text)) AS approved_count,
    count(*) FILTER (WHERE (a.status = 'denied'::text)) AS denied_count
   FROM (((public.appeals a
     LEFT JOIN LATERAL unnest(a.carc_codes) carc(carc_code) ON (true))
     LEFT JOIN public.conversations c ON ((a.conversation_id = c.id)))
     LEFT JOIN public.users u ON ((c.user_id = u.id)))
  WHERE ((a.status = ANY (ARRAY['approved'::text, 'denied'::text, 'partial'::text])) AND (a.outcome_reported_at IS NOT NULL))
  GROUP BY a.cpt_codes, a.icd10_codes, a.lcd_refs, carc.carc_code, a.status, (EXTRACT(epoch FROM (a.outcome_reported_at - a.created_at)) / (86400)::numeric), u.counselor_state
  WITH NO DATA;

--
-- Name: health_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.health_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    share_token uuid DEFAULT gen_random_uuid() NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    report_data jsonb,
    source_hash text,
    expires_at timestamp with time zone DEFAULT (now() + '30 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT health_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'generating'::text, 'ready'::text, 'failed'::text])))
);

--
-- Name: landing_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.landing_content (
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

--
-- Name: learning_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_type text NOT NULL,
    job_data jsonb NOT NULL,
    priority integer DEFAULT 5,
    status text DEFAULT 'pending'::text,
    attempts integer DEFAULT 0,
    max_attempts integer DEFAULT 3,
    last_error text,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    CONSTRAINT learning_queue_job_type_check CHECK ((job_type = ANY (ARRAY['update_symptom_mapping'::text, 'update_procedure_mapping'::text, 'update_coverage_path'::text, 'analyze_outcome_pattern'::text, 'reindex_policy'::text, 'prune_weak_mappings'::text, 'aggregate_patterns'::text, 'generate_report'::text]))),
    CONSTRAINT learning_queue_priority_check CHECK (((priority >= 1) AND (priority <= 10))),
    CONSTRAINT learning_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);

--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    icd10_codes text[],
    cpt_codes text[],
    npi text,
    policy_refs text[],
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT messages_role_check CHECK ((role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])))
);

--
-- Name: outcome_followups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.outcome_followups (
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

--
-- Name: policy_cache; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.policy_cache (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    policy_type text NOT NULL,
    policy_id text NOT NULL,
    contractor_id text DEFAULT ''::text,
    title text,
    effective_date date,
    content_hash text,
    coverage_requirements jsonb,
    covered_codes text[],
    last_checked_at timestamp with time zone DEFAULT now(),
    last_changed_at timestamp with time zone,
    change_summary text,
    version integer DEFAULT 1,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT policy_cache_policy_type_check CHECK ((policy_type = ANY (ARRAY['ncd'::text, 'lcd'::text, 'article'::text])))
);

--
-- Name: pricing_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pricing_plans (
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

--
-- Name: procedure_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.procedure_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phrase text NOT NULL,
    cpt_code text NOT NULL,
    cpt_description text,
    confidence real DEFAULT 0.5 NOT NULL,
    use_count integer DEFAULT 1 NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT procedure_mappings_confidence_check CHECK (((confidence >= (0)::double precision) AND (confidence <= (1)::double precision)))
);

--
-- Name: provider_practices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider_practices (
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

--
-- Name: rarc_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rarc_codes (
    code text NOT NULL,
    description text NOT NULL,
    category text,
    plain_english text,
    effective_date date NOT NULL,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: rarc_codes_latest; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.rarc_codes_latest AS
 SELECT code,
    description,
    category,
    plain_english,
    effective_date,
    is_active,
    created_at
   FROM public.rarc_codes
  WHERE (effective_date = ( SELECT max(rc.effective_date) AS max
           FROM public.rarc_codes rc));

--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    category text DEFAULT 'general'::text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    plan text NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    stripe_customer_id text,
    stripe_subscription_id text,
    current_period_start timestamp with time zone,
    current_period_end timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    trial_start timestamp with time zone,
    trial_end timestamp with time zone,
    trial_converted boolean DEFAULT false,
    CONSTRAINT subscriptions_plan_check CHECK ((plan = ANY (ARRAY['trial'::text, 'starter'::text, 'plus'::text, 'unlimited'::text, 'trialing'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'past_due'::text, 'trialing'::text])))
);

--
-- Name: symptom_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.symptom_mappings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phrase text NOT NULL,
    icd10_code text NOT NULL,
    icd10_description text,
    confidence real DEFAULT 0.5 NOT NULL,
    use_count integer DEFAULT 1 NOT NULL,
    last_used_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT symptom_mappings_confidence_check CHECK (((confidence >= (0)::double precision) AND (confidence <= (1)::double precision)))
);

--
-- Name: testimonials; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.testimonials (
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

--
-- Name: usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text,
    user_id uuid,
    device_fingerprint text,
    appeal_count integer DEFAULT 0 NOT NULL,
    last_appeal_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    email text,
    appeal_credits integer DEFAULT 0 NOT NULL
);

--
-- Name: user_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    phone text,
    device_fingerprint text,
    event_type text NOT NULL,
    event_data jsonb,
    conversation_id uuid,
    appeal_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_events_event_type_check CHECK ((event_type = ANY (ARRAY['print'::text, 'copy'::text, 'download'::text, 'share'::text, 'return_visit'::text, 'upgrade'::text, 'cancel'::text, 'feedback_positive'::text, 'feedback_negative'::text, 'appeal_started'::text, 'appeal_completed'::text, 'outcome_reported'::text])))
);

--
-- Name: user_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    message_id uuid NOT NULL,
    user_id uuid,
    rating text NOT NULL,
    correction text,
    feedback_type text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_feedback_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['accuracy'::text, 'clarity'::text, 'completeness'::text, 'other'::text]))),
    CONSTRAINT user_feedback_rating_check CHECK ((rating = ANY (ARRAY['up'::text, 'down'::text])))
);

--
-- Name: user_topic_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_topic_preferences (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    topic text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT user_topic_preferences_topic_check CHECK ((topic = ANY (ARRAY['diabetes'::text, 'obesity'::text, 'medicare-general'::text])))
);

--
-- Name: user_verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_verification (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    phone_verified boolean DEFAULT false NOT NULL,
    email_verified_at timestamp with time zone,
    phone_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    otp_code text,
    otp_expires_at timestamp with time zone,
    totp_secret text,
    totp_enrolled_at timestamp with time zone,
    idme_verified boolean DEFAULT false,
    idme_verified_at timestamp with time zone,
    idme_uuid text,
    idme_ial_level text,
    idme_first_name text,
    idme_gender text
);

--
-- Name: alert_log alert_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_log
    ADD CONSTRAINT alert_log_pkey PRIMARY KEY (id);

--
-- Name: alert_preferences alert_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_pkey PRIMARY KEY (id);

--
-- Name: alert_preferences alert_preferences_user_id_alert_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_user_id_alert_type_key UNIQUE (user_id, alert_type);

--
-- Name: appeal_levels appeal_levels_level_effective_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeal_levels
    ADD CONSTRAINT appeal_levels_level_effective_date_key UNIQUE (level, effective_date);

--
-- Name: appeal_levels appeal_levels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeal_levels
    ADD CONSTRAINT appeal_levels_pkey PRIMARY KEY (id);

--
-- Name: appeal_outcomes appeal_outcomes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeal_outcomes
    ADD CONSTRAINT appeal_outcomes_pkey PRIMARY KEY (id);

--
-- Name: appeals appeals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_pkey PRIMARY KEY (id);

--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

--
-- Name: blog_posts blog_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_pkey PRIMARY KEY (id);

--
-- Name: blog_posts blog_posts_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.blog_posts
    ADD CONSTRAINT blog_posts_slug_key UNIQUE (slug);

--
-- Name: carc_codes carc_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carc_codes
    ADD CONSTRAINT carc_codes_pkey PRIMARY KEY (code, effective_date);

--
-- Name: chat_daily_usage chat_daily_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_daily_usage
    ADD CONSTRAINT chat_daily_usage_pkey PRIMARY KEY (id);

--
-- Name: consent_preferences consent_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_preferences
    ADD CONSTRAINT consent_preferences_pkey PRIMARY KEY (id);

--
-- Name: consent_preferences consent_preferences_user_id_consent_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_preferences
    ADD CONSTRAINT consent_preferences_user_id_consent_type_key UNIQUE (user_id, consent_type);

--
-- Name: conversation_patterns conversation_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_patterns
    ADD CONSTRAINT conversation_patterns_pkey PRIMARY KEY (id);

--
-- Name: conversation_patterns conversation_patterns_trigger_phrase_intent_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_patterns
    ADD CONSTRAINT conversation_patterns_trigger_phrase_intent_key UNIQUE (trigger_phrase, intent);

--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

--
-- Name: counselor_cases counselor_cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_cases
    ADD CONSTRAINT counselor_cases_pkey PRIMARY KEY (id);

--
-- Name: coverage_paths coverage_paths_icd10_code_cpt_code_ncd_id_lcd_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coverage_paths
    ADD CONSTRAINT coverage_paths_icd10_code_cpt_code_ncd_id_lcd_id_key UNIQUE (icd10_code, cpt_code, ncd_id, lcd_id);

--
-- Name: coverage_paths coverage_paths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coverage_paths
    ADD CONSTRAINT coverage_paths_pkey PRIMARY KEY (id);

--
-- Name: denial_patterns denial_patterns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.denial_patterns
    ADD CONSTRAINT denial_patterns_pkey PRIMARY KEY (id);

--
-- Name: diabetes_insights diabetes_insights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diabetes_insights
    ADD CONSTRAINT diabetes_insights_pkey PRIMARY KEY (id);

--
-- Name: diabetes_log diabetes_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diabetes_log
    ADD CONSTRAINT diabetes_log_pkey PRIMARY KEY (id);

--
-- Name: diabetes_snapshots diabetes_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diabetes_snapshots
    ADD CONSTRAINT diabetes_snapshots_pkey PRIMARY KEY (id);

--
-- Name: ehr_connections ehr_connections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ehr_connections
    ADD CONSTRAINT ehr_connections_pkey PRIMARY KEY (id);

--
-- Name: ehr_connections ehr_connections_user_id_provider_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ehr_connections
    ADD CONSTRAINT ehr_connections_user_id_provider_key UNIQUE (user_id, provider);

--
-- Name: eob_denial_mappings eob_denial_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eob_denial_mappings
    ADD CONSTRAINT eob_denial_mappings_pkey PRIMARY KEY (id);

--
-- Name: fhir_cache fhir_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fhir_cache
    ADD CONSTRAINT fhir_cache_pkey PRIMARY KEY (id);

--
-- Name: fhir_cache fhir_cache_user_id_resource_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fhir_cache
    ADD CONSTRAINT fhir_cache_user_id_resource_type_key UNIQUE (user_id, resource_type);

--
-- Name: health_reports health_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_reports
    ADD CONSTRAINT health_reports_pkey PRIMARY KEY (id);

--
-- Name: landing_content landing_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_content
    ADD CONSTRAINT landing_content_pkey PRIMARY KEY (id);

--
-- Name: landing_content landing_content_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.landing_content
    ADD CONSTRAINT landing_content_section_key_key UNIQUE (section_key);

--
-- Name: learning_queue learning_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_queue
    ADD CONSTRAINT learning_queue_pkey PRIMARY KEY (id);

--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);

--
-- Name: outcome_followups outcome_followups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outcome_followups
    ADD CONSTRAINT outcome_followups_pkey PRIMARY KEY (id);

--
-- Name: outcome_followups outcome_followups_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outcome_followups
    ADD CONSTRAINT outcome_followups_token_key UNIQUE (token);

--
-- Name: policy_cache policy_cache_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_cache
    ADD CONSTRAINT policy_cache_pkey PRIMARY KEY (id);

--
-- Name: policy_cache policy_cache_policy_type_policy_id_contractor_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.policy_cache
    ADD CONSTRAINT policy_cache_policy_type_policy_id_contractor_id_key UNIQUE (policy_type, policy_id, contractor_id);

--
-- Name: pricing_plans pricing_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pricing_plans
    ADD CONSTRAINT pricing_plans_pkey PRIMARY KEY (id);

--
-- Name: procedure_mappings procedure_mappings_phrase_cpt_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_mappings
    ADD CONSTRAINT procedure_mappings_phrase_cpt_code_key UNIQUE (phrase, cpt_code);

--
-- Name: procedure_mappings procedure_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.procedure_mappings
    ADD CONSTRAINT procedure_mappings_pkey PRIMARY KEY (id);

--
-- Name: provider_practices provider_practices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_practices
    ADD CONSTRAINT provider_practices_pkey PRIMARY KEY (id);

--
-- Name: rarc_codes rarc_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rarc_codes
    ADD CONSTRAINT rarc_codes_pkey PRIMARY KEY (code, effective_date);

--
-- Name: site_settings site_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_key_key UNIQUE (key);

--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (id);

--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

--
-- Name: subscriptions subscriptions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);

--
-- Name: symptom_mappings symptom_mappings_phrase_icd10_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.symptom_mappings
    ADD CONSTRAINT symptom_mappings_phrase_icd10_code_key UNIQUE (phrase, icd10_code);

--
-- Name: symptom_mappings symptom_mappings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.symptom_mappings
    ADD CONSTRAINT symptom_mappings_pkey PRIMARY KEY (id);

--
-- Name: testimonials testimonials_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.testimonials
    ADD CONSTRAINT testimonials_pkey PRIMARY KEY (id);

--
-- Name: usage usage_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage
    ADD CONSTRAINT usage_email_key UNIQUE (email);

--
-- Name: usage usage_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage
    ADD CONSTRAINT usage_phone_key UNIQUE (phone);

--
-- Name: usage usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage
    ADD CONSTRAINT usage_pkey PRIMARY KEY (id);

--
-- Name: user_events user_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_events
    ADD CONSTRAINT user_events_pkey PRIMARY KEY (id);

--
-- Name: user_feedback user_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_feedback
    ADD CONSTRAINT user_feedback_pkey PRIMARY KEY (id);

--
-- Name: user_topic_preferences user_topic_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_preferences
    ADD CONSTRAINT user_topic_preferences_pkey PRIMARY KEY (id);

--
-- Name: user_verification user_verification_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_verification
    ADD CONSTRAINT user_verification_pkey PRIMARY KEY (id);

--
-- Name: user_verification user_verification_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_verification
    ADD CONSTRAINT user_verification_user_id_key UNIQUE (user_id);

--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);

--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);

--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);

--
-- Name: idx_alert_log_dedup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_alert_log_dedup ON public.alert_log USING btree (user_id, alert_type, dedup_key);

--
-- Name: idx_appeal_outcomes_appeal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeal_outcomes_appeal ON public.appeal_outcomes USING btree (appeal_id);

--
-- Name: idx_appeal_outcomes_codes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeal_outcomes_codes ON public.appeal_outcomes USING gin (icd10_codes);

--
-- Name: idx_appeal_outcomes_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeal_outcomes_outcome ON public.appeal_outcomes USING btree (outcome);

--
-- Name: idx_appeal_outcomes_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeal_outcomes_phone ON public.appeal_outcomes USING btree (phone);

--
-- Name: idx_appeals_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_conversation ON public.appeals USING btree (conversation_id);

--
-- Name: idx_appeals_deadline; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_deadline ON public.appeals USING btree (deadline) WHERE (deadline IS NOT NULL);

--
-- Name: idx_appeals_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_phone ON public.appeals USING btree (phone);

--
-- Name: idx_appeals_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_status ON public.appeals USING btree (status);

--
-- Name: idx_appeals_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_user ON public.appeals USING btree (user_id) WHERE (user_id IS NOT NULL);

--
-- Name: idx_appeals_user_service_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appeals_user_service_level ON public.appeals USING btree (user_id, service_description, appeal_level);

--
-- Name: idx_audit_logs_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_action ON public.audit_logs USING btree (action, created_at DESC);

--
-- Name: idx_audit_logs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_logs_user ON public.audit_logs USING btree (user_id, created_at DESC);

--
-- Name: idx_carc_codes_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carc_codes_category ON public.carc_codes USING btree (category);

--
-- Name: idx_carc_codes_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carc_codes_date ON public.carc_codes USING btree (effective_date DESC);

--
-- Name: idx_carc_codes_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_carc_codes_description ON public.carc_codes USING gin (to_tsvector('english'::regconfig, description));

--
-- Name: idx_cases_counselor; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_counselor ON public.counselor_cases USING btree (counselor_id, status);

--
-- Name: idx_cases_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cases_ref ON public.counselor_cases USING btree (case_ref);

--
-- Name: idx_chat_daily_usage_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_chat_daily_usage_date ON public.chat_daily_usage USING btree (usage_date);

--
-- Name: idx_chat_daily_usage_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_chat_daily_usage_unique ON public.chat_daily_usage USING btree (identifier, usage_date);

--
-- Name: idx_consent_prefs_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_consent_prefs_user ON public.consent_preferences USING btree (user_id);

--
-- Name: idx_conversation_patterns_intent; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_patterns_intent ON public.conversation_patterns USING btree (intent);

--
-- Name: idx_conversation_patterns_success; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_patterns_success ON public.conversation_patterns USING btree (success_rate DESC);

--
-- Name: idx_conversation_patterns_trigger; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversation_patterns_trigger ON public.conversation_patterns USING gin (to_tsvector('english'::regconfig, trigger_phrase));

--
-- Name: idx_conversations_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_device ON public.conversations USING btree (device_fingerprint);

--
-- Name: idx_conversations_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_phone ON public.conversations USING btree (phone) WHERE (phone IS NOT NULL);

--
-- Name: idx_conversations_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_status ON public.conversations USING btree (status);

--
-- Name: idx_conversations_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_conversations_user_id ON public.conversations USING btree (user_id) WHERE (user_id IS NOT NULL);

--
-- Name: idx_coverage_paths_codes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coverage_paths_codes ON public.coverage_paths USING btree (icd10_code, cpt_code);

--
-- Name: idx_coverage_paths_outcome; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coverage_paths_outcome ON public.coverage_paths USING btree (outcome);

--
-- Name: idx_denial_patterns_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_denial_patterns_category ON public.denial_patterns USING btree (category);

--
-- Name: idx_denial_patterns_common_cpts; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_denial_patterns_common_cpts ON public.denial_patterns USING gin (common_cpts);

--
-- Name: idx_denial_patterns_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_denial_patterns_date ON public.denial_patterns USING btree (effective_date DESC);

--
-- Name: idx_denial_patterns_reason_codes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_denial_patterns_reason_codes ON public.denial_patterns USING gin (reason_codes);

--
-- Name: idx_diabetes_insights_user; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_diabetes_insights_user ON public.diabetes_insights USING btree (user_id);

--
-- Name: idx_diabetes_log_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diabetes_log_user_date ON public.diabetes_log USING btree (user_id, logged_at DESC);

--
-- Name: idx_diabetes_snapshots_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_diabetes_snapshots_unique ON public.diabetes_snapshots USING btree (user_id, loinc_code, observed_date);

--
-- Name: idx_diabetes_snapshots_user_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_diabetes_snapshots_user_date ON public.diabetes_snapshots USING btree (user_id, loinc_code, observed_date DESC);

--
-- Name: idx_ehr_connections_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ehr_connections_user ON public.ehr_connections USING btree (user_id);

--
-- Name: idx_eob_mappings_carc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eob_mappings_carc ON public.eob_denial_mappings USING btree (carc_code);

--
-- Name: idx_eob_mappings_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eob_mappings_date ON public.eob_denial_mappings USING btree (effective_date DESC);

--
-- Name: idx_eob_mappings_eob; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_eob_mappings_eob ON public.eob_denial_mappings USING btree (eob_code);

--
-- Name: idx_fhir_cache_user_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fhir_cache_user_type ON public.fhir_cache USING btree (user_id, resource_type);

--
-- Name: idx_followups_email_unreported; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_email_unreported ON public.outcome_followups USING btree (email) WHERE (responded_at IS NULL);

--
-- Name: idx_followups_scheduled; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_scheduled ON public.outcome_followups USING btree (scheduled_at) WHERE (sent_at IS NULL);

--
-- Name: idx_followups_token; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_followups_token ON public.outcome_followups USING btree (token);

--
-- Name: idx_health_reports_share_token; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_health_reports_share_token ON public.health_reports USING btree (share_token);

--
-- Name: idx_health_reports_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_health_reports_user_id ON public.health_reports USING btree (user_id);

--
-- Name: idx_landing_content_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_content_display_order ON public.landing_content USING btree (display_order);

--
-- Name: idx_landing_content_section_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_landing_content_section_key ON public.landing_content USING btree (section_key);

--
-- Name: idx_learning_queue_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_queue_status ON public.learning_queue USING btree (status, priority) WHERE (status = 'pending'::text);

--
-- Name: idx_learning_queue_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_learning_queue_type ON public.learning_queue USING btree (job_type);

--
-- Name: idx_messages_conversation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_conversation ON public.messages USING btree (conversation_id);

--
-- Name: idx_messages_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_messages_created ON public.messages USING btree (created_at);

--
-- Name: idx_policy_cache_codes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_cache_codes ON public.policy_cache USING gin (covered_codes);

--
-- Name: idx_policy_cache_policy; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_cache_policy ON public.policy_cache USING btree (policy_type, policy_id);

--
-- Name: idx_policy_cache_updated; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_policy_cache_updated ON public.policy_cache USING btree (last_changed_at DESC);

--
-- Name: idx_pricing_plans_display_order; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pricing_plans_display_order ON public.pricing_plans USING btree (display_order);

--
-- Name: idx_procedure_mappings_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procedure_mappings_confidence ON public.procedure_mappings USING btree (confidence DESC);

--
-- Name: idx_procedure_mappings_phrase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_procedure_mappings_phrase ON public.procedure_mappings USING btree (phrase);

--
-- Name: idx_provider_practices_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_practices_user ON public.provider_practices USING btree (user_id);

--
-- Name: idx_rarc_codes_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rarc_codes_date ON public.rarc_codes USING btree (effective_date DESC);

--
-- Name: idx_rarc_codes_description; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_rarc_codes_description ON public.rarc_codes USING gin (to_tsvector('english'::regconfig, description));

--
-- Name: idx_site_settings_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_site_settings_key ON public.site_settings USING btree (key);

--
-- Name: idx_subscriptions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);

--
-- Name: idx_subscriptions_stripe_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions USING btree (stripe_customer_id);

--
-- Name: idx_symptom_mappings_confidence; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_symptom_mappings_confidence ON public.symptom_mappings USING btree (confidence DESC);

--
-- Name: idx_symptom_mappings_phrase; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_symptom_mappings_phrase ON public.symptom_mappings USING btree (phrase);

--
-- Name: idx_testimonials_featured; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_testimonials_featured ON public.testimonials USING btree (is_featured) WHERE (is_featured = true);

--
-- Name: idx_usage_device_fingerprint; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_device_fingerprint ON public.usage USING btree (device_fingerprint) WHERE (device_fingerprint IS NOT NULL);

--
-- Name: idx_usage_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_usage_user_id ON public.usage USING btree (user_id) WHERE (user_id IS NOT NULL);

--
-- Name: idx_user_events_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_events_created ON public.user_events USING btree (created_at DESC);

--
-- Name: idx_user_events_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_events_phone ON public.user_events USING btree (phone) WHERE (phone IS NOT NULL);

--
-- Name: idx_user_events_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_events_type ON public.user_events USING btree (event_type);

--
-- Name: idx_user_feedback_message; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_feedback_message ON public.user_feedback USING btree (message_id);

--
-- Name: idx_user_feedback_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_feedback_rating ON public.user_feedback USING btree (rating);

--
-- Name: idx_user_topic_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_topic_unique ON public.user_topic_preferences USING btree (user_id, topic);

--
-- Name: idx_user_verification_idme_uuid; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_verification_idme_uuid ON public.user_verification USING btree (idme_uuid) WHERE (idme_uuid IS NOT NULL);

--
-- Name: idx_user_verification_otp_expires; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_verification_otp_expires ON public.user_verification USING btree (otp_expires_at) WHERE (otp_expires_at IS NOT NULL);

--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email) WHERE (email IS NOT NULL);

--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role) WHERE (role <> 'patient'::text);

--
-- Name: appeals update_appeals_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_appeals_updated_at BEFORE UPDATE ON public.appeals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: usage update_usage_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_usage_updated_at BEFORE UPDATE ON public.usage FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

--
-- Name: alert_log alert_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_log
    ADD CONSTRAINT alert_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: alert_preferences alert_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alert_preferences
    ADD CONSTRAINT alert_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: appeal_outcomes appeal_outcomes_appeal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeal_outcomes
    ADD CONSTRAINT appeal_outcomes_appeal_id_fkey FOREIGN KEY (appeal_id) REFERENCES public.appeals(id) ON DELETE CASCADE;

--
-- Name: appeals appeals_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: appeals appeals_prior_appeal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_prior_appeal_id_fkey FOREIGN KEY (prior_appeal_id) REFERENCES public.appeals(id);

--
-- Name: appeals appeals_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appeals
    ADD CONSTRAINT appeals_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: consent_preferences consent_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.consent_preferences
    ADD CONSTRAINT consent_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: conversations conversations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: counselor_cases counselor_cases_appeal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_cases
    ADD CONSTRAINT counselor_cases_appeal_id_fkey FOREIGN KEY (appeal_id) REFERENCES public.appeals(id);

--
-- Name: counselor_cases counselor_cases_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_cases
    ADD CONSTRAINT counselor_cases_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id);

--
-- Name: counselor_cases counselor_cases_counselor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.counselor_cases
    ADD CONSTRAINT counselor_cases_counselor_id_fkey FOREIGN KEY (counselor_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: diabetes_insights diabetes_insights_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diabetes_insights
    ADD CONSTRAINT diabetes_insights_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: diabetes_log diabetes_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diabetes_log
    ADD CONSTRAINT diabetes_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: diabetes_snapshots diabetes_snapshots_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diabetes_snapshots
    ADD CONSTRAINT diabetes_snapshots_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: ehr_connections ehr_connections_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ehr_connections
    ADD CONSTRAINT ehr_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: eob_denial_mappings eob_denial_mappings_carc_code_effective_date_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eob_denial_mappings
    ADD CONSTRAINT eob_denial_mappings_carc_code_effective_date_fkey FOREIGN KEY (carc_code, effective_date) REFERENCES public.carc_codes(code, effective_date);

--
-- Name: eob_denial_mappings eob_denial_mappings_rarc_code_effective_date_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eob_denial_mappings
    ADD CONSTRAINT eob_denial_mappings_rarc_code_effective_date_fkey FOREIGN KEY (rarc_code, effective_date) REFERENCES public.rarc_codes(code, effective_date);

--
-- Name: fhir_cache fhir_cache_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fhir_cache
    ADD CONSTRAINT fhir_cache_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: health_reports health_reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.health_reports
    ADD CONSTRAINT health_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: outcome_followups outcome_followups_appeal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.outcome_followups
    ADD CONSTRAINT outcome_followups_appeal_id_fkey FOREIGN KEY (appeal_id) REFERENCES public.appeals(id) ON DELETE CASCADE;

--
-- Name: provider_practices provider_practices_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider_practices
    ADD CONSTRAINT provider_practices_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: usage usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.usage
    ADD CONSTRAINT usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: user_events user_events_appeal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_events
    ADD CONSTRAINT user_events_appeal_id_fkey FOREIGN KEY (appeal_id) REFERENCES public.appeals(id) ON DELETE SET NULL;

--
-- Name: user_events user_events_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_events
    ADD CONSTRAINT user_events_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE SET NULL;

--
-- Name: user_feedback user_feedback_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_feedback
    ADD CONSTRAINT user_feedback_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;

--
-- Name: user_feedback user_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_feedback
    ADD CONSTRAINT user_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

--
-- Name: user_topic_preferences user_topic_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_topic_preferences
    ADD CONSTRAINT user_topic_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

--
-- Name: user_verification user_verification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_verification
    ADD CONSTRAINT user_verification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

COMMIT;
