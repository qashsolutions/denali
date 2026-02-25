--
-- PostgreSQL database dump
--

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.8 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: pg_cron; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;


--
-- Name: EXTENSION pg_cron; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_cron IS 'Job scheduler for PostgreSQL';


--
-- Name: extensions; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA extensions;


--
-- Name: graphql; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql;


--
-- Name: graphql_public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA graphql_public;


--
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_net; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_net IS 'Async HTTP';


--
-- Name: pgbouncer; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA pgbouncer;


--
-- Name: realtime; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA realtime;


--
-- Name: storage; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA storage;


--
-- Name: supabase_migrations; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA supabase_migrations;


--
-- Name: vault; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA vault;


--
-- Name: hypopg; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS hypopg WITH SCHEMA extensions;


--
-- Name: EXTENSION hypopg; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION hypopg IS 'Hypothetical indexes for PostgreSQL';


--
-- Name: index_advisor; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS index_advisor WITH SCHEMA extensions;


--
-- Name: EXTENSION index_advisor; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION index_advisor IS 'Query index advisor';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql;


--
-- Name: EXTENSION pg_graphql; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_graphql IS 'pg_graphql: GraphQL support';


--
-- Name: pg_stat_statements; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;


--
-- Name: EXTENSION pg_stat_statements; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_stat_statements IS 'track planning and execution statistics of all SQL statements executed';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;


--
-- Name: EXTENSION supabase_vault; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION supabase_vault IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: aal_level; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.aal_level AS ENUM (
    'aal1',
    'aal2',
    'aal3'
);


--
-- Name: code_challenge_method; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.code_challenge_method AS ENUM (
    's256',
    'plain'
);


--
-- Name: factor_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_status AS ENUM (
    'unverified',
    'verified'
);


--
-- Name: factor_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.factor_type AS ENUM (
    'totp',
    'webauthn',
    'phone'
);


--
-- Name: oauth_authorization_status; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_authorization_status AS ENUM (
    'pending',
    'approved',
    'denied',
    'expired'
);


--
-- Name: oauth_client_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_client_type AS ENUM (
    'public',
    'confidential'
);


--
-- Name: oauth_registration_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_registration_type AS ENUM (
    'dynamic',
    'manual'
);


--
-- Name: oauth_response_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.oauth_response_type AS ENUM (
    'code'
);


--
-- Name: one_time_token_type; Type: TYPE; Schema: auth; Owner: -
--

CREATE TYPE auth.one_time_token_type AS ENUM (
    'confirmation_token',
    'reauthentication_token',
    'recovery_token',
    'email_change_token_new',
    'email_change_token_current',
    'phone_change_token'
);


--
-- Name: action; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE',
    'TRUNCATE',
    'ERROR'
);


--
-- Name: equality_op; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.equality_op AS ENUM (
    'eq',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'in'
);


--
-- Name: user_defined_filter; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.user_defined_filter AS (
	column_name text,
	op realtime.equality_op,
	value text
);


--
-- Name: wal_column; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_column AS (
	name text,
	type_name text,
	type_oid oid,
	value jsonb,
	is_pkey boolean,
	is_selectable boolean
);


--
-- Name: wal_rls; Type: TYPE; Schema: realtime; Owner: -
--

CREATE TYPE realtime.wal_rls AS (
	wal jsonb,
	is_rls_enabled boolean,
	subscription_ids uuid[],
	errors text[]
);


--
-- Name: buckettype; Type: TYPE; Schema: storage; Owner: -
--

CREATE TYPE storage.buckettype AS ENUM (
    'STANDARD',
    'ANALYTICS',
    'VECTOR'
);


--
-- Name: email(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.email() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.email', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
  )::text
$$;


--
-- Name: FUNCTION email(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.email() IS 'Deprecated. Use auth.jwt() -> ''email'' instead.';


--
-- Name: jwt(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.jwt() RETURNS jsonb
    LANGUAGE sql STABLE
    AS $$
  select 
    coalesce(
        nullif(current_setting('request.jwt.claim', true), ''),
        nullif(current_setting('request.jwt.claims', true), '')
    )::jsonb
$$;


--
-- Name: role(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.role() RETURNS text
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;


--
-- Name: FUNCTION role(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.role() IS 'Deprecated. Use auth.jwt() -> ''role'' instead.';


--
-- Name: uid(); Type: FUNCTION; Schema: auth; Owner: -
--

CREATE FUNCTION auth.uid() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$
  select 
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;


--
-- Name: FUNCTION uid(); Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON FUNCTION auth.uid() IS 'Deprecated. Use auth.jwt() -> ''sub'' instead.';


--
-- Name: grant_pg_cron_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_cron_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_cron'
  )
  THEN
    grant usage on schema cron to postgres with grant option;

    alter default privileges in schema cron grant all on tables to postgres with grant option;
    alter default privileges in schema cron grant all on functions to postgres with grant option;
    alter default privileges in schema cron grant all on sequences to postgres with grant option;

    alter default privileges for user supabase_admin in schema cron grant all
        on sequences to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on tables to postgres with grant option;
    alter default privileges for user supabase_admin in schema cron grant all
        on functions to postgres with grant option;

    grant all privileges on all tables in schema cron to postgres with grant option;
    revoke all on table cron.job from postgres;
    grant select on table cron.job to postgres with grant option;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_cron_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_cron_access() IS 'Grants access to pg_cron';


--
-- Name: grant_pg_graphql_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_graphql_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
DECLARE
    func_is_graphql_resolve bool;
BEGIN
    func_is_graphql_resolve = (
        SELECT n.proname = 'resolve'
        FROM pg_event_trigger_ddl_commands() AS ev
        LEFT JOIN pg_catalog.pg_proc AS n
        ON ev.objid = n.oid
    );

    IF func_is_graphql_resolve
    THEN
        -- Update public wrapper to pass all arguments through to the pg_graphql resolve func
        DROP FUNCTION IF EXISTS graphql_public.graphql;
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language sql
        as $$
            select graphql.resolve(
                query := query,
                variables := coalesce(variables, '{}'),
                "operationName" := "operationName",
                extensions := extensions
            );
        $$;

        -- This hook executes when `graphql.resolve` is created. That is not necessarily the last
        -- function in the extension so we need to grant permissions on existing entities AND
        -- update default permissions to any others that are created after `graphql.resolve`
        grant usage on schema graphql to postgres, anon, authenticated, service_role;
        grant select on all tables in schema graphql to postgres, anon, authenticated, service_role;
        grant execute on all functions in schema graphql to postgres, anon, authenticated, service_role;
        grant all on all sequences in schema graphql to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on tables to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on functions to postgres, anon, authenticated, service_role;
        alter default privileges in schema graphql grant all on sequences to postgres, anon, authenticated, service_role;

        -- Allow postgres role to allow granting usage on graphql and graphql_public schemas to custom roles
        grant usage on schema graphql_public to postgres with grant option;
        grant usage on schema graphql to postgres with grant option;
    END IF;

END;
$_$;


--
-- Name: FUNCTION grant_pg_graphql_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_graphql_access() IS 'Grants access to pg_graphql';


--
-- Name: grant_pg_net_access(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.grant_pg_net_access() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_event_trigger_ddl_commands() AS ev
    JOIN pg_extension AS ext
    ON ev.objid = ext.oid
    WHERE ext.extname = 'pg_net'
  )
  THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_roles
      WHERE rolname = 'supabase_functions_admin'
    )
    THEN
      CREATE USER supabase_functions_admin NOINHERIT CREATEROLE LOGIN NOREPLICATION;
    END IF;

    GRANT USAGE ON SCHEMA net TO supabase_functions_admin, postgres, anon, authenticated, service_role;

    IF EXISTS (
      SELECT FROM pg_extension
      WHERE extname = 'pg_net'
      -- all versions in use on existing projects as of 2025-02-20
      -- version 0.12.0 onwards don't need these applied
      AND extversion IN ('0.2', '0.6', '0.7', '0.7.1', '0.8', '0.10.0', '0.11.0')
    ) THEN
      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SECURITY DEFINER;

      ALTER function net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;
      ALTER function net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) SET search_path = net;

      REVOKE ALL ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;
      REVOKE ALL ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) FROM PUBLIC;

      GRANT EXECUTE ON FUNCTION net.http_get(url text, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
      GRANT EXECUTE ON FUNCTION net.http_post(url text, body jsonb, params jsonb, headers jsonb, timeout_milliseconds integer) TO supabase_functions_admin, postgres, anon, authenticated, service_role;
    END IF;
  END IF;
END;
$$;


--
-- Name: FUNCTION grant_pg_net_access(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.grant_pg_net_access() IS 'Grants access to pg_net';


--
-- Name: pgrst_ddl_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_ddl_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN SELECT * FROM pg_event_trigger_ddl_commands()
  LOOP
    IF cmd.command_tag IN (
      'CREATE SCHEMA', 'ALTER SCHEMA'
    , 'CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO', 'ALTER TABLE'
    , 'CREATE FOREIGN TABLE', 'ALTER FOREIGN TABLE'
    , 'CREATE VIEW', 'ALTER VIEW'
    , 'CREATE MATERIALIZED VIEW', 'ALTER MATERIALIZED VIEW'
    , 'CREATE FUNCTION', 'ALTER FUNCTION'
    , 'CREATE TRIGGER'
    , 'CREATE TYPE', 'ALTER TYPE'
    , 'CREATE RULE'
    , 'COMMENT'
    )
    -- don't notify in case of CREATE TEMP table or other objects created on pg_temp
    AND cmd.schema_name is distinct from 'pg_temp'
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: pgrst_drop_watch(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.pgrst_drop_watch() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  obj record;
BEGIN
  FOR obj IN SELECT * FROM pg_event_trigger_dropped_objects()
  LOOP
    IF obj.object_type IN (
      'schema'
    , 'table'
    , 'foreign table'
    , 'view'
    , 'materialized view'
    , 'function'
    , 'trigger'
    , 'type'
    , 'rule'
    )
    AND obj.is_temporary IS false -- no pg_temp objects
    THEN
      NOTIFY pgrst, 'reload schema';
    END IF;
  END LOOP;
END; $$;


--
-- Name: set_graphql_placeholder(); Type: FUNCTION; Schema: extensions; Owner: -
--

CREATE FUNCTION extensions.set_graphql_placeholder() RETURNS event_trigger
    LANGUAGE plpgsql
    AS $_$
    DECLARE
    graphql_is_dropped bool;
    BEGIN
    graphql_is_dropped = (
        SELECT ev.schema_name = 'graphql_public'
        FROM pg_event_trigger_dropped_objects() AS ev
        WHERE ev.schema_name = 'graphql_public'
    );

    IF graphql_is_dropped
    THEN
        create or replace function graphql_public.graphql(
            "operationName" text default null,
            query text default null,
            variables jsonb default null,
            extensions jsonb default null
        )
            returns jsonb
            language plpgsql
        as $$
            DECLARE
                server_version float;
            BEGIN
                server_version = (SELECT (SPLIT_PART((select version()), ' ', 2))::float);

                IF server_version >= 14 THEN
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql extension is not enabled.'
                            )
                        )
                    );
                ELSE
                    RETURN jsonb_build_object(
                        'errors', jsonb_build_array(
                            jsonb_build_object(
                                'message', 'pg_graphql is only available on projects running Postgres 14 onwards.'
                            )
                        )
                    );
                END IF;
            END;
        $$;
    END IF;

    END;
$_$;


--
-- Name: FUNCTION set_graphql_placeholder(); Type: COMMENT; Schema: extensions; Owner: -
--

COMMENT ON FUNCTION extensions.set_graphql_placeholder() IS 'Reintroduces placeholder function for graphql_public.graphql';


--
-- Name: get_auth(text); Type: FUNCTION; Schema: pgbouncer; Owner: -
--

CREATE FUNCTION pgbouncer.get_auth(p_usename text) RETURNS TABLE(username text, password text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $_$
  BEGIN
      RAISE DEBUG 'PgBouncer auth request: %', p_usename;

      RETURN QUERY
      SELECT
          rolname::text,
          CASE WHEN rolvaliduntil < now()
              THEN null
              ELSE rolpassword::text
          END
      FROM pg_authid
      WHERE rolname=$1 and rolcanlogin;
  END;
  $_$;


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
  -- Decrement appeal_count (min 0) and mark followup as incentive_applied
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

CREATE FUNCTION public.check_and_increment_chat(p_identifier text, p_daily_limit integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_count INT;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Get current count
  SELECT message_count INTO v_count
  FROM chat_daily_usage
  WHERE identifier = p_identifier AND usage_date = v_today;

  v_count := COALESCE(v_count, 0);

  -- Check limit (0 = unlimited)
  IF p_daily_limit > 0 AND v_count >= p_daily_limit THEN
    RETURN jsonb_build_object('allowed', false, 'count', v_count, 'limit', p_daily_limit);
  END IF;

  -- Increment (upsert)
  INSERT INTO chat_daily_usage (identifier, usage_date, message_count)
  VALUES (p_identifier, v_today, 1)
  ON CONFLICT (identifier, usage_date)
  DO UPDATE SET message_count = chat_daily_usage.message_count + 1, updated_at = now();

  RETURN jsonb_build_object('allowed', true, 'count', v_count + 1, 'limit', p_daily_limit);
END;
$$;


--
-- Name: check_appeal_access(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_appeal_access(p_email text DEFAULT NULL::text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_user_id UUID;
    v_plan TEXT;
    v_count INTEGER;
    v_subscription_status TEXT;
BEGIN
    -- Check if email has a user account
    IF p_email IS NOT NULL THEN
        SELECT id, plan INTO v_user_id, v_plan FROM users WHERE email = p_email;
    END IF;

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

    -- Check appeal count for this email
    IF p_email IS NOT NULL THEN
        SELECT appeal_count INTO v_count FROM usage WHERE email = p_email;
    END IF;

    -- Free tier: first 3 appeals are free
    IF COALESCE(v_count, 0) < 3 THEN
        RETURN 'free';
    END IF;

    -- Already used free appeals, needs payment
    RETURN 'paywall';
END;
$$;


--
-- Name: claim_conversation(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_conversation(p_conversation_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
  v_email TEXT;
  v_updated BOOLEAN := FALSE;
BEGIN
  -- Must be authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Ensure user exists in public.users (FK target)
  -- Pull email from auth.users if not in public.users yet
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user_id) THEN
    SELECT email INTO v_email FROM auth.users WHERE id = v_user_id;
    IF v_email IS NOT NULL THEN
      INSERT INTO users (id, email, plan)
      VALUES (v_user_id, v_email, 'free')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

  -- Claim the conversation (only if unclaimed)
  UPDATE conversations
  SET user_id = v_user_id
  WHERE id = p_conversation_id
  AND user_id IS NULL;

  IF FOUND THEN
    v_updated := TRUE;

    -- Also claim any associated appeals
    UPDATE appeals
    SET user_id = v_user_id
    WHERE conversation_id = p_conversation_id
    AND user_id IS NULL;
  END IF;

  RETURN v_updated;
END;
$$;


--
-- Name: claim_learning_job(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_learning_job() RETURNS TABLE(job_id uuid, job_type text, job_data jsonb)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: complete_learning_job(uuid, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_learning_job(p_job_id uuid, p_success boolean, p_error text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    UPDATE learning_queue
    SET status = CASE WHEN p_success THEN 'completed' ELSE 'failed' END,
        completed_at = NOW(),
        last_error = p_error
    WHERE id = p_job_id;
END;
$$;


--
-- Name: custom_access_token_hook(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.custom_access_token_hook(event jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  claims jsonb;
  user_practice_id text;
  user_role text;
BEGIN
  -- Get the current claims from the event
  claims := event->'claims';
  
  -- Look up the user's practice_id and role from the User table
  SELECT "practiceId", role::text INTO user_practice_id, user_role
  FROM "User"
  WHERE id = (event->>'user_id');
  
  -- Add practice_id and role to claims if user exists
  IF user_practice_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{practice_id}', to_jsonb(user_practice_id));
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  END IF;
  
  -- Return the modified event with updated claims
  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;


--
-- Name: decrement_appeal_credit(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.decrement_appeal_credit(p_email text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  remaining integer;
BEGIN
  UPDATE public.usage
  SET appeal_credits = appeal_credits - 1
  WHERE email = p_email AND appeal_credits > 0
  RETURNING appeal_credits INTO remaining;

  IF NOT FOUND THEN
    RETURN -1; -- no credits
  END IF;
  RETURN remaining;
END;
$$;


--
-- Name: delete_user_cascade(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_user_cascade(target_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: fulfill_checkout(uuid, text, text, text, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fulfill_checkout(p_user_id uuid, p_email text, p_plan text, p_stripe_customer_id text DEFAULT NULL::text, p_stripe_subscription_id text DEFAULT NULL::text, p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update user plan
  UPDATE users SET plan = p_plan, updated_at = now()
  WHERE id = p_user_id;

  -- Upsert subscription record (only for monthly plans)
  IF p_plan = 'monthly' AND p_stripe_subscription_id IS NOT NULL THEN
    INSERT INTO subscriptions (
      user_id, plan, status,
      stripe_customer_id, stripe_subscription_id,
      current_period_start, current_period_end,
      started_at, updated_at
    ) VALUES (
      p_user_id, p_plan, 'active',
      p_stripe_customer_id, p_stripe_subscription_id,
      p_period_start, p_period_end,
      now(), now()
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = 'active',
      stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
      stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = now();
  END IF;
END;
$$;


--
-- Name: generate_case_ref(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_case_ref(p_counselor_id uuid, p_initials text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
  v_year TEXT;
  v_seq INT;
BEGIN
  v_year := to_char(now(), 'YYYY');

  SELECT COALESCE(MAX(
    CAST(NULLIF(split_part(case_ref, '-', 3), '') AS INT)
  ), 0) + 1
  INTO v_seq
  FROM counselor_cases
  WHERE counselor_id = p_counselor_id
    AND case_ref LIKE p_initials || '-' || v_year || '-%';

  RETURN p_initials || '-' || v_year || '-' || LPAD(v_seq::TEXT, 3, '0');
END;
$$;


--
-- Name: get_appeal_context(text[], text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_appeal_context(p_icd10_codes text[], p_cpt_codes text[]) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_result JSONB;
    v_symptom_mappings JSONB;
    v_procedure_mappings JSONB;
    v_coverage_paths JSONB;
    v_recent_denials JSONB;
BEGIN
    -- Get relevant symptom mappings (high confidence)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'phrase', phrase,
        'icd10_code', icd10_code,
        'description', icd10_description,
        'confidence', confidence
    )), '[]'::jsonb) INTO v_symptom_mappings
    FROM symptom_mappings
    WHERE icd10_code = ANY(p_icd10_codes)
    AND confidence >= 0.6
    ORDER BY confidence DESC
    LIMIT 10;

    -- Get relevant procedure mappings
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'phrase', phrase,
        'cpt_code', cpt_code,
        'description', cpt_description,
        'confidence', confidence
    )), '[]'::jsonb) INTO v_procedure_mappings
    FROM procedure_mappings
    WHERE cpt_code = ANY(p_cpt_codes)
    AND confidence >= 0.6
    ORDER BY confidence DESC
    LIMIT 10;

    -- Get successful coverage paths
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'icd10_code', icd10_code,
        'cpt_code', cpt_code,
        'ncd_id', NULLIF(ncd_id, ''),
        'lcd_id', NULLIF(lcd_id, ''),
        'outcome', outcome,
        'documentation_required', documentation_required,
        'use_count', use_count
    )), '[]'::jsonb) INTO v_coverage_paths
    FROM coverage_paths
    WHERE icd10_code = ANY(p_icd10_codes)
    AND cpt_code = ANY(p_cpt_codes)
    AND outcome = 'approved'
    ORDER BY use_count DESC
    LIMIT 5;

    -- Get recent denial patterns to avoid
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'denial_reason', denial_reason,
        'documentation_gaps', documentation_gaps,
        'icd10_codes', d.icd10_codes,
        'cpt_codes', d.cpt_codes
    )), '[]'::jsonb) INTO v_recent_denials
    FROM (
        SELECT denial_reason, documentation_gaps, icd10_codes, cpt_codes
        FROM appeal_outcomes
        WHERE outcome = 'denied'
        AND icd10_codes && p_icd10_codes
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
$$;


--
-- Name: get_appeal_count(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_appeal_count(p_email text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT appeal_count INTO v_count FROM usage WHERE email = p_email;
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
    COUNT(*) FILTER (WHERE cc.status = 'open') AS open_cases,
    COUNT(*) FILTER (WHERE cc.status = 'appeal_filed' AND cc.created_at >= date_trunc('month', now())) AS filed_this_month,
    COUNT(*) FILTER (WHERE cc.outcome IS NOT NULL) AS outcomes_reported,
    COUNT(*) FILTER (WHERE cc.outcome = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE cc.outcome = 'denied') AS denied_count,
    COUNT(*) FILTER (WHERE cc.outcome = 'partial') AS partial_count,
    ROUND(AVG(cc.outcome_date - cc.denial_date) FILTER (WHERE cc.outcome IS NOT NULL AND cc.denial_date IS NOT NULL), 0) AS avg_resolution_days
  FROM counselor_cases cc
  WHERE cc.counselor_id = p_counselor_id;
END;
$$;


--
-- Name: get_current_practice_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_current_practice_id() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    -- First try JWT claim (most efficient)
    current_setting('request.jwt.claims', true)::jsonb ->> 'practice_id',
    -- Fall back to User table lookup
    (SELECT "practiceId" FROM "User" WHERE id = auth.uid()::text)
  );
$$;


--
-- Name: get_denial_pattern_for_carc(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_denial_pattern_for_carc(carc_code_input text) RETURNS TABLE(reason text, category text, appeal_strategy text, documentation_checklist text[], estimated_success_rate text, appeal_deadline_days integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT dp.reason, dp.category, dp.appeal_strategy,
         dp.documentation_checklist, dp.estimated_success_rate, dp.appeal_deadline_days
  FROM public.denial_patterns_latest dp
  WHERE EXISTS (
    SELECT 1 FROM unnest(dp.reason_codes) AS rc
    WHERE regexp_replace(rc, '^(CO|PR|OA|CR|PI)-?', '', 'i') =
          regexp_replace(carc_code_input, '^(CO|PR|OA|CR|PI)-?', '', 'i')
  )
  LIMIT 1;
$$;


--
-- Name: get_denial_patterns_for_cpt(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_denial_patterns_for_cpt(cpt_code_input text) RETURNS TABLE(id uuid, reason text, category text, reason_codes text[], common_cpts text[], common_diagnoses text[], appeal_strategy text, documentation_checklist text[], estimated_success_rate text, appeal_deadline_days integer, effective_date date, is_active boolean, created_at timestamp with time zone)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  SELECT dp.id, dp.reason, dp.category, dp.reason_codes, dp.common_cpts,
         dp.common_diagnoses, dp.appeal_strategy, dp.documentation_checklist,
         dp.estimated_success_rate, dp.appeal_deadline_days, dp.effective_date,
         dp.is_active, dp.created_at
  FROM public.denial_patterns_latest dp
  WHERE cpt_code_input = ANY(dp.common_cpts);
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
    SUM(fm.case_count)::BIGINT AS total_cases,
    ROUND(
      SUM(fm.approved_count)::NUMERIC /
      NULLIF(SUM(fm.case_count), 0) * 100,
      1
    ) AS success_rate,
    ROUND(AVG(fm.days_to_resolution), 0) AS avg_days,
    SUM(fm.approved_count)::BIGINT AS approved,
    SUM(fm.denied_count)::BIGINT AS denied
  FROM flywheel_metrics fm
  WHERE fm.cpt_codes && p_cpt_codes
    AND (p_carc_codes IS NULL OR fm.carc_code = ANY(p_carc_codes))
  GROUP BY fm.carc_code
  HAVING SUM(fm.case_count) >= 3;
END;
$$;


--
-- Name: get_grouped_audit_logs(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_grouped_audit_logs(p_user_id uuid, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0) RETURNS TABLE(action text, resource_type text, ip_address text, latest_at timestamp with time zone, log_date date, entry_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    AS $$
  SELECT
    al.action,
    al.resource_type,
    MIN(al.ip_address) AS ip_address,
    MAX(al.created_at) AS latest_at,
    DATE(al.created_at) AS log_date,
    COUNT(*)::INT AS entry_count
  FROM audit_logs al
  WHERE al.user_id = p_user_id
  GROUP BY al.action, al.resource_type, DATE(al.created_at)
  ORDER BY latest_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;


--
-- Name: get_learning_context(text[], text[], text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_learning_context(p_symptom_phrases text[] DEFAULT NULL::text[], p_icd10_codes text[] DEFAULT NULL::text[], p_cpt_codes text[] DEFAULT NULL::text[], p_limit integer DEFAULT 10) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_result JSONB;
    v_symptom_mappings JSONB;
    v_procedure_mappings JSONB;
    v_coverage_paths JSONB;
    v_conversation_patterns JSONB;
    v_recent_outcomes JSONB;
BEGIN
    -- Get symptom mappings (by phrase or ICD-10 code)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'phrase', phrase,
        'icd10_code', icd10_code,
        'description', icd10_description,
        'confidence', ROUND(confidence::numeric, 2)
    ) ORDER BY confidence DESC), '[]'::jsonb) INTO v_symptom_mappings
    FROM (
        SELECT DISTINCT ON (icd10_code) phrase, icd10_code, icd10_description, confidence
        FROM symptom_mappings
        WHERE confidence >= 0.5
        AND (
            (p_symptom_phrases IS NOT NULL AND phrase = ANY(p_symptom_phrases))
            OR (p_icd10_codes IS NOT NULL AND icd10_code = ANY(p_icd10_codes))
            OR (p_symptom_phrases IS NULL AND p_icd10_codes IS NULL)
        )
        ORDER BY icd10_code, confidence DESC
        LIMIT p_limit
    ) sub;

    -- Get procedure mappings (by CPT code)
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'phrase', phrase,
        'cpt_code', cpt_code,
        'description', cpt_description,
        'confidence', ROUND(confidence::numeric, 2)
    ) ORDER BY confidence DESC), '[]'::jsonb) INTO v_procedure_mappings
    FROM (
        SELECT DISTINCT ON (cpt_code) phrase, cpt_code, cpt_description, confidence
        FROM procedure_mappings
        WHERE confidence >= 0.5
        AND (
            (p_cpt_codes IS NOT NULL AND cpt_code = ANY(p_cpt_codes))
            OR p_cpt_codes IS NULL
        )
        ORDER BY cpt_code, confidence DESC
        LIMIT p_limit
    ) sub;

    -- Get successful coverage paths
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'icd10_code', icd10_code,
        'cpt_code', cpt_code,
        'ncd_id', NULLIF(ncd_id, ''),
        'lcd_id', NULLIF(lcd_id, ''),
        'outcome', outcome,
        'documentation_required', documentation_required,
        'use_count', use_count
    ) ORDER BY use_count DESC), '[]'::jsonb) INTO v_coverage_paths
    FROM coverage_paths
    WHERE outcome = 'approved'
    AND (
        (p_icd10_codes IS NOT NULL AND icd10_code = ANY(p_icd10_codes))
        OR (p_cpt_codes IS NOT NULL AND cpt_code = ANY(p_cpt_codes))
        OR (p_icd10_codes IS NULL AND p_cpt_codes IS NULL)
    )
    LIMIT p_limit;

    -- Get top conversation patterns
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'trigger_phrase', trigger_phrase,
        'intent', intent,
        'question_sequence', question_sequence,
        'success_rate', ROUND(success_rate::numeric, 2)
    ) ORDER BY success_rate DESC, use_count DESC), '[]'::jsonb) INTO v_conversation_patterns
    FROM conversation_patterns
    WHERE success_rate >= 0.6
    LIMIT 5;

    -- Get recent successful outcomes for learning
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'icd10_codes', icd10_codes,
        'cpt_codes', cpt_codes,
        'outcome', outcome,
        'successful_arguments', successful_arguments
    )), '[]'::jsonb) INTO v_recent_outcomes
    FROM (
        SELECT icd10_codes, cpt_codes, outcome, successful_arguments
        FROM appeal_outcomes
        WHERE outcome = 'approved'
        AND successful_arguments IS NOT NULL
        ORDER BY outcome_reported_at DESC
        LIMIT 5
    ) sub;

    -- Build the complete context object
    v_result := jsonb_build_object(
        'symptom_mappings', v_symptom_mappings,
        'procedure_mappings', v_procedure_mappings,
        'coverage_paths', v_coverage_paths,
        'conversation_patterns', v_conversation_patterns,
        'recent_successful_outcomes', v_recent_outcomes,
        'generated_at', NOW()
    );

    RETURN v_result;
END;
$$;


--
-- Name: get_unreported_outcome(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_unreported_outcome(p_email text) RETURNS TABLE(appeal_id uuid, followup_id uuid, followup_type text, scheduled_at timestamp with time zone, service_description text, denial_date text, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    of.appeal_id,
    of.id AS followup_id,
    of.followup_type,
    of.scheduled_at,
    a.service_description,
    a.denial_date,
    a.created_at
  FROM outcome_followups of
  JOIN appeals a ON of.appeal_id = a.id
  WHERE of.email = p_email
    AND of.responded_at IS NULL
    AND of.scheduled_at <= now()
  ORDER BY of.scheduled_at ASC
  LIMIT 1;
END;
$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  practice_id_param text;
BEGIN
  -- Get practice_id from user metadata (passed during signup)
  practice_id_param := NEW.raw_user_meta_data->>'practice_id';
  
  -- Only create User record if practice_id was provided
  IF practice_id_param IS NOT NULL THEN
    INSERT INTO "User" (id, email, "practiceId", "updatedAt")
    VALUES (
      NEW.id::text,
      NEW.email,
      practice_id_param,
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: handle_subscription_change(text, text, timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_subscription_change(p_stripe_subscription_id text, p_status text, p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone, p_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Find the subscription and get the user_id
  SELECT user_id INTO v_user_id
  FROM subscriptions
  WHERE stripe_subscription_id = p_stripe_subscription_id;

  IF v_user_id IS NULL THEN
    RETURN; -- No matching subscription found
  END IF;

  -- Update subscription status
  UPDATE subscriptions SET
    status = p_status,
    current_period_start = COALESCE(p_period_start, current_period_start),
    current_period_end = COALESCE(p_period_end, current_period_end),
    cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END,
    updated_at = now()
  WHERE stripe_subscription_id = p_stripe_subscription_id;

  -- If cancelled or past_due, revert user plan to free
  IF p_status IN ('cancelled', 'past_due') THEN
    UPDATE users SET plan = 'free', updated_at = now()
    WHERE id = v_user_id;
  END IF;
END;
$$;


--
-- Name: handle_user_update(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_user_update() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  UPDATE "User"
  SET 
    email = NEW.email,
    "updatedAt" = NOW()
  WHERE id = NEW.id::text;
  
  RETURN NEW;
END;
$$;


--
-- Name: increment_appeal_count(text, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.increment_appeal_count(p_email text, p_user_id uuid DEFAULT NULL::uuid, p_device_fingerprint text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_count INTEGER;
BEGIN
    INSERT INTO usage (email, user_id, device_fingerprint, appeal_count, last_appeal_at)
    VALUES (p_email, p_user_id, p_device_fingerprint, 1, NOW())
    ON CONFLICT (email)
    DO UPDATE SET
        appeal_count = usage.appeal_count + 1,
        last_appeal_at = NOW(),
        user_id = COALESCE(p_user_id, usage.user_id),
        device_fingerprint = COALESCE(p_device_fingerprint, usage.device_fingerprint)
    RETURNING appeal_count INTO v_count;

    RETURN v_count;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM "User" 
    WHERE id = auth.uid()::text 
    AND role = 'ADMIN'
  );
$$;


--
-- Name: process_feedback(uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.process_feedback(p_message_id uuid, p_user_id uuid DEFAULT NULL::uuid, p_rating text DEFAULT NULL::text, p_correction text DEFAULT NULL::text, p_feedback_type text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_feedback_id UUID;
    v_message RECORD;
    v_confidence_delta REAL;
BEGIN
    -- Insert the feedback record
    INSERT INTO user_feedback (message_id, user_id, rating, correction, feedback_type)
    VALUES (p_message_id, p_user_id, p_rating, p_correction, p_feedback_type)
    RETURNING id INTO v_feedback_id;

    -- Get the message to check for codes
    SELECT icd10_codes, cpt_codes INTO v_message
    FROM messages WHERE id = p_message_id;

    -- Determine confidence adjustment
    v_confidence_delta := CASE WHEN p_rating = 'up' THEN 0.05 ELSE -0.1 END;

    -- Update symptom mapping confidence for any ICD-10 codes in the message
    IF v_message.icd10_codes IS NOT NULL THEN
        UPDATE symptom_mappings
        SET confidence = GREATEST(0, LEAST(1, confidence + v_confidence_delta)),
            use_count = use_count + 1,
            last_used_at = NOW()
        WHERE icd10_code = ANY(v_message.icd10_codes);
    END IF;

    -- Update procedure mapping confidence for any CPT codes in the message
    IF v_message.cpt_codes IS NOT NULL THEN
        UPDATE procedure_mappings
        SET confidence = GREATEST(0, LEAST(1, confidence + v_confidence_delta)),
            use_count = use_count + 1,
            last_used_at = NOW()
        WHERE cpt_code = ANY(v_message.cpt_codes);
    END IF;

    -- Queue learning job if negative feedback with correction
    IF p_rating = 'down' AND p_correction IS NOT NULL THEN
        PERFORM queue_learning_job(
            'analyze_outcome_pattern',
            jsonb_build_object(
                'feedback_id', v_feedback_id,
                'message_id', p_message_id,
                'correction', p_correction,
                'feedback_type', p_feedback_type
            ),
            2 -- High priority for corrections
        );
    END IF;

    RETURN v_feedback_id;
END;
$$;


--
-- Name: prune_weak_mappings(real, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.prune_weak_mappings(p_min_confidence real DEFAULT 0.3, p_min_use_count integer DEFAULT 2, p_days_inactive integer DEFAULT 90) RETURNS TABLE(pruned_symptoms integer, pruned_procedures integer, pruned_coverage_paths integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_pruned_symptoms INTEGER;
    v_pruned_procedures INTEGER;
    v_pruned_coverage INTEGER;
BEGIN
    -- Prune weak symptom mappings
    WITH deleted AS (
        DELETE FROM symptom_mappings
        WHERE confidence < p_min_confidence
        AND use_count < p_min_use_count
        AND last_used_at < NOW() - (p_days_inactive || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_pruned_symptoms FROM deleted;

    -- Prune weak procedure mappings
    WITH deleted AS (
        DELETE FROM procedure_mappings
        WHERE confidence < p_min_confidence
        AND use_count < p_min_use_count
        AND last_used_at < NOW() - (p_days_inactive || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_pruned_procedures FROM deleted;

    -- Prune rarely used coverage paths (different criteria)
    WITH deleted AS (
        DELETE FROM coverage_paths
        WHERE use_count < p_min_use_count
        AND last_used_at < NOW() - (p_days_inactive || ' days')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO v_pruned_coverage FROM deleted;

    RETURN QUERY SELECT v_pruned_symptoms, v_pruned_procedures, v_pruned_coverage;
END;
$$;


--
-- Name: queue_learning_job(text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.queue_learning_job(p_job_type text, p_job_data jsonb, p_priority integer DEFAULT 5) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_job_id UUID;
BEGIN
    INSERT INTO learning_queue (job_type, job_data, priority)
    VALUES (p_job_type, p_job_data, p_priority)
    RETURNING id INTO v_job_id;

    RETURN v_job_id;
END;
$$;


--
-- Name: record_appeal_outcome(uuid, text, text, text, text[], text[], integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_appeal_outcome(p_appeal_id uuid, p_email text, p_outcome text, p_denial_reason text DEFAULT NULL::text, p_documentation_gaps text[] DEFAULT NULL::text[], p_successful_arguments text[] DEFAULT NULL::text[], p_days_to_resolution integer DEFAULT NULL::integer) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_outcome_id UUID;
    v_appeal RECORD;
BEGIN
    SELECT icd10_codes, cpt_codes, ncd_refs, lcd_refs INTO v_appeal
    FROM appeals WHERE id = p_appeal_id;

    INSERT INTO appeal_outcomes (
        appeal_id, email, icd10_codes, cpt_codes, ncd_refs, lcd_refs,
        outcome, denial_reason, documentation_gaps, successful_arguments,
        days_to_resolution
    ) VALUES (
        p_appeal_id, p_email, v_appeal.icd10_codes, v_appeal.cpt_codes,
        v_appeal.ncd_refs, v_appeal.lcd_refs,
        p_outcome, p_denial_reason, p_documentation_gaps, p_successful_arguments,
        p_days_to_resolution
    )
    RETURNING id INTO v_outcome_id;

    PERFORM queue_learning_job(
        'analyze_outcome_pattern',
        jsonb_build_object(
            'outcome_id', v_outcome_id,
            'appeal_id', p_appeal_id,
            'outcome', p_outcome
        ),
        3
    );

    RETURN v_outcome_id;
END;
$$;


--
-- Name: refresh_flywheel_metrics(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_flywheel_metrics() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW flywheel_metrics;
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
END;
$$;


--
-- Name: search_denial_codes(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.search_denial_codes(search_text text) RETURNS TABLE(code_type text, code text, description text, category text, plain_english text)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT 'CARC'::TEXT, c.code, c.description, c.category, c.plain_english
  FROM public.carc_codes c
  WHERE c.effective_date = (SELECT MAX(effective_date) FROM public.carc_codes)
    AND c.is_active = true
    AND (
      c.code ILIKE '%' || search_text || '%'
      OR c.description ILIKE '%' || search_text || '%'
      OR c.plain_english ILIKE '%' || search_text || '%'
    )
  UNION ALL
  SELECT 'RARC'::TEXT, r.code, r.description, r.category, r.plain_english
  FROM public.rarc_codes r
  WHERE r.effective_date = (SELECT MAX(effective_date) FROM public.rarc_codes)
    AND r.is_active = true
    AND (
      r.code ILIKE '%' || search_text || '%'
      OR r.description ILIKE '%' || search_text || '%'
      OR r.plain_english ILIKE '%' || search_text || '%'
    );
END;
$$;


--
-- Name: track_user_event(text, text, jsonb, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_user_event(p_phone text DEFAULT NULL::text, p_event_type text DEFAULT NULL::text, p_event_data jsonb DEFAULT NULL::jsonb, p_conversation_id uuid DEFAULT NULL::uuid, p_appeal_id uuid DEFAULT NULL::uuid, p_device_fingerprint text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_conversation_pattern(text, text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_conversation_pattern(p_trigger_phrase text, p_intent text, p_question_sequence jsonb, p_was_successful boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
            WHEN p_was_successful THEN p_question_sequence
            ELSE conversation_patterns.question_sequence
        END;
END;
$$;


--
-- Name: update_coverage_path(text, text, text, text, text, text, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_coverage_path(p_icd10_code text, p_cpt_code text, p_outcome text, p_ncd_id text DEFAULT ''::text, p_lcd_id text DEFAULT ''::text, p_contractor_id text DEFAULT NULL::text, p_documentation_required text[] DEFAULT NULL::text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    INSERT INTO coverage_paths (
        icd10_code, cpt_code, ncd_id, lcd_id, contractor_id,
        outcome, documentation_required, use_count, last_used_at
    ) VALUES (
        p_icd10_code, p_cpt_code, 
        COALESCE(p_ncd_id, ''), 
        COALESCE(p_lcd_id, ''),
        p_contractor_id,
        p_outcome, p_documentation_required, 1, NOW()
    )
    ON CONFLICT (icd10_code, cpt_code, ncd_id, lcd_id)
    DO UPDATE SET
        use_count = coverage_paths.use_count + 1,
        last_used_at = NOW(),
        -- Update outcome if we have more recent data
        outcome = CASE 
            WHEN p_outcome IN ('approved', 'denied') THEN p_outcome 
            ELSE coverage_paths.outcome 
        END,
        -- Merge documentation requirements
        documentation_required = CASE
            WHEN p_documentation_required IS NOT NULL 
            THEN ARRAY(
                SELECT DISTINCT unnest(
                    COALESCE(coverage_paths.documentation_required, ARRAY[]::TEXT[]) || 
                    p_documentation_required
                )
            )
            ELSE coverage_paths.documentation_required
        END,
        contractor_id = COALESCE(p_contractor_id, coverage_paths.contractor_id);
END;
$$;


--
-- Name: update_procedure_mapping(text, text, text, real); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_procedure_mapping(p_phrase text, p_cpt_code text, p_cpt_description text, p_boost real) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO procedure_mappings (phrase, cpt_code, cpt_description, confidence, use_count, last_used_at)
  VALUES (
    lower(trim(p_phrase)),
    p_cpt_code,
    p_cpt_description,
    LEAST(0.5 + p_boost, 1.0),
    1,
    now()
  )
  ON CONFLICT (phrase, cpt_code)
  DO UPDATE SET
    confidence = LEAST(procedure_mappings.confidence + p_boost, 1.0),
    use_count = procedure_mappings.use_count + 1,
    last_used_at = now(),
    cpt_description = COALESCE(EXCLUDED.cpt_description, procedure_mappings.cpt_description);
END;
$$;


--
-- Name: update_symptom_mapping(text, text, text, real); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_symptom_mapping(p_phrase text, p_icd10_code text, p_icd10_description text, p_boost real) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO symptom_mappings (phrase, icd10_code, icd10_description, confidence, use_count, last_used_at)
  VALUES (
    lower(trim(p_phrase)),
    p_icd10_code,
    p_icd10_description,
    LEAST(0.5 + p_boost, 1.0),
    1,
    now()
  )
  ON CONFLICT (phrase, icd10_code)
  DO UPDATE SET
    confidence = LEAST(symptom_mappings.confidence + p_boost, 1.0),
    use_count = symptom_mappings.use_count + 1,
    last_used_at = now(),
    icd10_description = COALESCE(EXCLUDED.icd10_description, symptom_mappings.icd10_description);
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: apply_rls(jsonb, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.apply_rls(wal jsonb, max_record_bytes integer DEFAULT (1024 * 1024)) RETURNS SETOF realtime.wal_rls
    LANGUAGE plpgsql
    AS $$
declare
-- Regclass of the table e.g. public.notes
entity_ regclass = (quote_ident(wal ->> 'schema') || '.' || quote_ident(wal ->> 'table'))::regclass;

-- I, U, D, T: insert, update ...
action realtime.action = (
    case wal ->> 'action'
        when 'I' then 'INSERT'
        when 'U' then 'UPDATE'
        when 'D' then 'DELETE'
        else 'ERROR'
    end
);

-- Is row level security enabled for the table
is_rls_enabled bool = relrowsecurity from pg_class where oid = entity_;

subscriptions realtime.subscription[] = array_agg(subs)
    from
        realtime.subscription subs
    where
        subs.entity = entity_
        -- Filter by action early - only get subscriptions interested in this action
        -- action_filter column can be: '*' (all), 'INSERT', 'UPDATE', or 'DELETE'
        and (subs.action_filter = '*' or subs.action_filter = action::text);

-- Subscription vars
roles regrole[] = array_agg(distinct us.claims_role::text)
    from
        unnest(subscriptions) us;

working_role regrole;
claimed_role regrole;
claims jsonb;

subscription_id uuid;
subscription_has_access bool;
visible_to_subscription_ids uuid[] = '{}';

-- structured info for wal's columns
columns realtime.wal_column[];
-- previous identity values for update/delete
old_columns realtime.wal_column[];

error_record_exceeds_max_size boolean = octet_length(wal::text) > max_record_bytes;

-- Primary jsonb output for record
output jsonb;

begin
perform set_config('role', null, true);

columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'columns') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

old_columns =
    array_agg(
        (
            x->>'name',
            x->>'type',
            x->>'typeoid',
            realtime.cast(
                (x->'value') #>> '{}',
                coalesce(
                    (x->>'typeoid')::regtype, -- null when wal2json version <= 2.4
                    (x->>'type')::regtype
                )
            ),
            (pks ->> 'name') is not null,
            true
        )::realtime.wal_column
    )
    from
        jsonb_array_elements(wal -> 'identity') x
        left join jsonb_array_elements(wal -> 'pk') pks
            on (x ->> 'name') = (pks ->> 'name');

for working_role in select * from unnest(roles) loop

    -- Update `is_selectable` for columns and old_columns
    columns =
        array_agg(
            (
                c.name,
                c.type_name,
                c.type_oid,
                c.value,
                c.is_pkey,
                pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
            )::realtime.wal_column
        )
        from
            unnest(columns) c;

    old_columns =
            array_agg(
                (
                    c.name,
                    c.type_name,
                    c.type_oid,
                    c.value,
                    c.is_pkey,
                    pg_catalog.has_column_privilege(working_role, entity_, c.name, 'SELECT')
                )::realtime.wal_column
            )
            from
                unnest(old_columns) c;

    if action <> 'DELETE' and count(1) = 0 from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            -- subscriptions is already filtered by entity
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 400: Bad Request, no primary key']
        )::realtime.wal_rls;

    -- The claims role does not have SELECT permission to the primary key of entity
    elsif action <> 'DELETE' and sum(c.is_selectable::int) <> count(1) from unnest(columns) c where c.is_pkey then
        return next (
            jsonb_build_object(
                'schema', wal ->> 'schema',
                'table', wal ->> 'table',
                'type', action
            ),
            is_rls_enabled,
            (select array_agg(s.subscription_id) from unnest(subscriptions) as s where claims_role = working_role),
            array['Error 401: Unauthorized']
        )::realtime.wal_rls;

    else
        output = jsonb_build_object(
            'schema', wal ->> 'schema',
            'table', wal ->> 'table',
            'type', action,
            'commit_timestamp', to_char(
                ((wal ->> 'timestamp')::timestamptz at time zone 'utc'),
                'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            ),
            'columns', (
                select
                    jsonb_agg(
                        jsonb_build_object(
                            'name', pa.attname,
                            'type', pt.typname
                        )
                        order by pa.attnum asc
                    )
                from
                    pg_attribute pa
                    join pg_type pt
                        on pa.atttypid = pt.oid
                where
                    attrelid = entity_
                    and attnum > 0
                    and pg_catalog.has_column_privilege(working_role, entity_, pa.attname, 'SELECT')
            )
        )
        -- Add "record" key for insert and update
        || case
            when action in ('INSERT', 'UPDATE') then
                jsonb_build_object(
                    'record',
                    (
                        select
                            jsonb_object_agg(
                                -- if unchanged toast, get column name and value from old record
                                coalesce((c).name, (oc).name),
                                case
                                    when (c).name is null then (oc).value
                                    else (c).value
                                end
                            )
                        from
                            unnest(columns) c
                            full outer join unnest(old_columns) oc
                                on (c).name = (oc).name
                        where
                            coalesce((c).is_selectable, (oc).is_selectable)
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                    )
                )
            else '{}'::jsonb
        end
        -- Add "old_record" key for update and delete
        || case
            when action = 'UPDATE' then
                jsonb_build_object(
                        'old_record',
                        (
                            select jsonb_object_agg((c).name, (c).value)
                            from unnest(old_columns) c
                            where
                                (c).is_selectable
                                and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                        )
                    )
            when action = 'DELETE' then
                jsonb_build_object(
                    'old_record',
                    (
                        select jsonb_object_agg((c).name, (c).value)
                        from unnest(old_columns) c
                        where
                            (c).is_selectable
                            and ( not error_record_exceeds_max_size or (octet_length((c).value::text) <= 64))
                            and ( not is_rls_enabled or (c).is_pkey ) -- if RLS enabled, we can't secure deletes so filter to pkey
                    )
                )
            else '{}'::jsonb
        end;

        -- Create the prepared statement
        if is_rls_enabled and action <> 'DELETE' then
            if (select 1 from pg_prepared_statements where name = 'walrus_rls_stmt' limit 1) > 0 then
                deallocate walrus_rls_stmt;
            end if;
            execute realtime.build_prepared_statement_sql('walrus_rls_stmt', entity_, columns);
        end if;

        visible_to_subscription_ids = '{}';

        for subscription_id, claims in (
                select
                    subs.subscription_id,
                    subs.claims
                from
                    unnest(subscriptions) subs
                where
                    subs.entity = entity_
                    and subs.claims_role = working_role
                    and (
                        realtime.is_visible_through_filters(columns, subs.filters)
                        or (
                          action = 'DELETE'
                          and realtime.is_visible_through_filters(old_columns, subs.filters)
                        )
                    )
        ) loop

            if not is_rls_enabled or action = 'DELETE' then
                visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
            else
                -- Check if RLS allows the role to see the record
                perform
                    -- Trim leading and trailing quotes from working_role because set_config
                    -- doesn't recognize the role as valid if they are included
                    set_config('role', trim(both '"' from working_role::text), true),
                    set_config('request.jwt.claims', claims::text, true);

                execute 'execute walrus_rls_stmt' into subscription_has_access;

                if subscription_has_access then
                    visible_to_subscription_ids = visible_to_subscription_ids || subscription_id;
                end if;
            end if;
        end loop;

        perform set_config('role', null, true);

        return next (
            output,
            is_rls_enabled,
            visible_to_subscription_ids,
            case
                when error_record_exceeds_max_size then array['Error 413: Payload Too Large']
                else '{}'
            end
        )::realtime.wal_rls;

    end if;
end loop;

perform set_config('role', null, true);
end;
$$;


--
-- Name: broadcast_changes(text, text, text, text, text, record, record, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.broadcast_changes(topic_name text, event_name text, operation text, table_name text, table_schema text, new record, old record, level text DEFAULT 'ROW'::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    -- Declare a variable to hold the JSONB representation of the row
    row_data jsonb := '{}'::jsonb;
BEGIN
    IF level = 'STATEMENT' THEN
        RAISE EXCEPTION 'function can only be triggered for each row, not for each statement';
    END IF;
    -- Check the operation type and handle accordingly
    IF operation = 'INSERT' OR operation = 'UPDATE' OR operation = 'DELETE' THEN
        row_data := jsonb_build_object('old_record', OLD, 'record', NEW, 'operation', operation, 'table', table_name, 'schema', table_schema);
        PERFORM realtime.send (row_data, event_name, topic_name);
    ELSE
        RAISE EXCEPTION 'Unexpected operation type: %', operation;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to process the row: %', SQLERRM;
END;

$$;


--
-- Name: build_prepared_statement_sql(text, regclass, realtime.wal_column[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.build_prepared_statement_sql(prepared_statement_name text, entity regclass, columns realtime.wal_column[]) RETURNS text
    LANGUAGE sql
    AS $$
      /*
      Builds a sql string that, if executed, creates a prepared statement to
      tests retrive a row from *entity* by its primary key columns.
      Example
          select realtime.build_prepared_statement_sql('public.notes', '{"id"}'::text[], '{"bigint"}'::text[])
      */
          select
      'prepare ' || prepared_statement_name || ' as
          select
              exists(
                  select
                      1
                  from
                      ' || entity || '
                  where
                      ' || string_agg(quote_ident(pkc.name) || '=' || quote_nullable(pkc.value #>> '{}') , ' and ') || '
              )'
          from
              unnest(columns) pkc
          where
              pkc.is_pkey
          group by
              entity
      $$;


--
-- Name: cast(text, regtype); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime."cast"(val text, type_ regtype) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
    declare
      res jsonb;
    begin
      execute format('select to_jsonb(%L::'|| type_::text || ')', val)  into res;
      return res;
    end
    $$;


--
-- Name: check_equality_op(realtime.equality_op, regtype, text, text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.check_equality_op(op realtime.equality_op, type_ regtype, val_1 text, val_2 text) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    AS $$
      /*
      Casts *val_1* and *val_2* as type *type_* and check the *op* condition for truthiness
      */
      declare
          op_symbol text = (
              case
                  when op = 'eq' then '='
                  when op = 'neq' then '!='
                  when op = 'lt' then '<'
                  when op = 'lte' then '<='
                  when op = 'gt' then '>'
                  when op = 'gte' then '>='
                  when op = 'in' then '= any'
                  else 'UNKNOWN OP'
              end
          );
          res boolean;
      begin
          execute format(
              'select %L::'|| type_::text || ' ' || op_symbol
              || ' ( %L::'
              || (
                  case
                      when op = 'in' then type_::text || '[]'
                      else type_::text end
              )
              || ')', val_1, val_2) into res;
          return res;
      end;
      $$;


--
-- Name: is_visible_through_filters(realtime.wal_column[], realtime.user_defined_filter[]); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.is_visible_through_filters(columns realtime.wal_column[], filters realtime.user_defined_filter[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
    /*
    Should the record be visible (true) or filtered out (false) after *filters* are applied
    */
        select
            -- Default to allowed when no filters present
            $2 is null -- no filters. this should not happen because subscriptions has a default
            or array_length($2, 1) is null -- array length of an empty array is null
            or bool_and(
                coalesce(
                    realtime.check_equality_op(
                        op:=f.op,
                        type_:=coalesce(
                            col.type_oid::regtype, -- null when wal2json version <= 2.4
                            col.type_name::regtype
                        ),
                        -- cast jsonb to text
                        val_1:=col.value #>> '{}',
                        val_2:=f.value
                    ),
                    false -- if null, filter does not match
                )
            )
        from
            unnest(filters) f
            join unnest(columns) col
                on f.column_name = col.name;
    $_$;


--
-- Name: list_changes(name, name, integer, integer); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.list_changes(publication name, slot_name name, max_changes integer, max_record_bytes integer) RETURNS SETOF realtime.wal_rls
    LANGUAGE sql
    SET log_min_messages TO 'fatal'
    AS $$
      with pub as (
        select
          concat_ws(
            ',',
            case when bool_or(pubinsert) then 'insert' else null end,
            case when bool_or(pubupdate) then 'update' else null end,
            case when bool_or(pubdelete) then 'delete' else null end
          ) as w2j_actions,
          coalesce(
            string_agg(
              realtime.quote_wal2json(format('%I.%I', schemaname, tablename)::regclass),
              ','
            ) filter (where ppt.tablename is not null and ppt.tablename not like '% %'),
            ''
          ) w2j_add_tables
        from
          pg_publication pp
          left join pg_publication_tables ppt
            on pp.pubname = ppt.pubname
        where
          pp.pubname = publication
        group by
          pp.pubname
        limit 1
      ),
      w2j as (
        select
          x.*, pub.w2j_add_tables
        from
          pub,
          pg_logical_slot_get_changes(
            slot_name, null, max_changes,
            'include-pk', 'true',
            'include-transaction', 'false',
            'include-timestamp', 'true',
            'include-type-oids', 'true',
            'format-version', '2',
            'actions', pub.w2j_actions,
            'add-tables', pub.w2j_add_tables
          ) x
      )
      select
        xyz.wal,
        xyz.is_rls_enabled,
        xyz.subscription_ids,
        xyz.errors
      from
        w2j,
        realtime.apply_rls(
          wal := w2j.data::jsonb,
          max_record_bytes := max_record_bytes
        ) xyz(wal, is_rls_enabled, subscription_ids, errors)
      where
        w2j.w2j_add_tables <> ''
        and xyz.subscription_ids[1] is not null
    $$;


--
-- Name: quote_wal2json(regclass); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.quote_wal2json(entity regclass) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
      select
        (
          select string_agg('' || ch,'')
          from unnest(string_to_array(nsp.nspname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
        )
        || '.'
        || (
          select string_agg('' || ch,'')
          from unnest(string_to_array(pc.relname::text, null)) with ordinality x(ch, idx)
          where
            not (x.idx = 1 and x.ch = '"')
            and not (
              x.idx = array_length(string_to_array(nsp.nspname::text, null), 1)
              and x.ch = '"'
            )
          )
      from
        pg_class pc
        join pg_namespace nsp
          on pc.relnamespace = nsp.oid
      where
        pc.oid = entity
    $$;


--
-- Name: send(jsonb, text, text, boolean); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.send(payload jsonb, event text, topic text, private boolean DEFAULT true) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
  generated_id uuid;
  final_payload jsonb;
BEGIN
  BEGIN
    -- Generate a new UUID for the id
    generated_id := gen_random_uuid();

    -- Check if payload has an 'id' key, if not, add the generated UUID
    IF payload ? 'id' THEN
      final_payload := payload;
    ELSE
      final_payload := jsonb_set(payload, '{id}', to_jsonb(generated_id));
    END IF;

    -- Set the topic configuration
    EXECUTE format('SET LOCAL realtime.topic TO %L', topic);

    -- Attempt to insert the message
    INSERT INTO realtime.messages (id, payload, event, topic, private, extension)
    VALUES (generated_id, final_payload, event, topic, private, 'broadcast');
  EXCEPTION
    WHEN OTHERS THEN
      -- Capture and notify the error
      RAISE WARNING 'ErrorSendingBroadcastMessage: %', SQLERRM;
  END;
END;
$$;


--
-- Name: subscription_check_filters(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.subscription_check_filters() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    /*
    Validates that the user defined filters for a subscription:
    - refer to valid columns that the claimed role may access
    - values are coercable to the correct column type
    */
    declare
        col_names text[] = coalesce(
                array_agg(c.column_name order by c.ordinal_position),
                '{}'::text[]
            )
            from
                information_schema.columns c
            where
                format('%I.%I', c.table_schema, c.table_name)::regclass = new.entity
                and pg_catalog.has_column_privilege(
                    (new.claims ->> 'role'),
                    format('%I.%I', c.table_schema, c.table_name)::regclass,
                    c.column_name,
                    'SELECT'
                );
        filter realtime.user_defined_filter;
        col_type regtype;

        in_val jsonb;
    begin
        for filter in select * from unnest(new.filters) loop
            -- Filtered column is valid
            if not filter.column_name = any(col_names) then
                raise exception 'invalid column for filter %', filter.column_name;
            end if;

            -- Type is sanitized and safe for string interpolation
            col_type = (
                select atttypid::regtype
                from pg_catalog.pg_attribute
                where attrelid = new.entity
                      and attname = filter.column_name
            );
            if col_type is null then
                raise exception 'failed to lookup type for column %', filter.column_name;
            end if;

            -- Set maximum number of entries for in filter
            if filter.op = 'in'::realtime.equality_op then
                in_val = realtime.cast(filter.value, (col_type::text || '[]')::regtype);
                if coalesce(jsonb_array_length(in_val), 0) > 100 then
                    raise exception 'too many values for `in` filter. Maximum 100';
                end if;
            else
                -- raises an exception if value is not coercable to type
                perform realtime.cast(filter.value, col_type);
            end if;

        end loop;

        -- Apply consistent order to filters so the unique constraint on
        -- (subscription_id, entity, filters) can't be tricked by a different filter order
        new.filters = coalesce(
            array_agg(f order by f.column_name, f.op, f.value),
            '{}'
        ) from unnest(new.filters) f;

        return new;
    end;
    $$;


--
-- Name: to_regrole(text); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.to_regrole(role_name text) RETURNS regrole
    LANGUAGE sql IMMUTABLE
    AS $$ select role_name::regrole $$;


--
-- Name: topic(); Type: FUNCTION; Schema: realtime; Owner: -
--

CREATE FUNCTION realtime.topic() RETURNS text
    LANGUAGE sql STABLE
    AS $$
select nullif(current_setting('realtime.topic', true), '')::text;
$$;


--
-- Name: can_insert_object(text, text, uuid, jsonb); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.can_insert_object(bucketid text, name text, owner uuid, metadata jsonb) RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  INSERT INTO "storage"."objects" ("bucket_id", "name", "owner", "metadata") VALUES (bucketid, name, owner, metadata);
  -- hack to rollback the successful insert
  RAISE sqlstate 'PT200' using
  message = 'ROLLBACK',
  detail = 'rollback successful insert';
END
$$;


--
-- Name: delete_leaf_prefixes(text[], text[]); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.delete_leaf_prefixes(bucket_ids text[], names text[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
DECLARE
    v_rows_deleted integer;
BEGIN
    LOOP
        WITH candidates AS (
            SELECT DISTINCT
                t.bucket_id,
                unnest(storage.get_prefixes(t.name)) AS name
            FROM unnest(bucket_ids, names) AS t(bucket_id, name)
        ),
        uniq AS (
             SELECT
                 bucket_id,
                 name,
                 storage.get_level(name) AS level
             FROM candidates
             WHERE name <> ''
             GROUP BY bucket_id, name
        ),
        leaf AS (
             SELECT
                 p.bucket_id,
                 p.name,
                 p.level
             FROM storage.prefixes AS p
                  JOIN uniq AS u
                       ON u.bucket_id = p.bucket_id
                           AND u.name = p.name
                           AND u.level = p.level
             WHERE NOT EXISTS (
                 SELECT 1
                 FROM storage.objects AS o
                 WHERE o.bucket_id = p.bucket_id
                   AND o.level = p.level + 1
                   AND o.name COLLATE "C" LIKE p.name || '/%'
             )
             AND NOT EXISTS (
                 SELECT 1
                 FROM storage.prefixes AS c
                 WHERE c.bucket_id = p.bucket_id
                   AND c.level = p.level + 1
                   AND c.name COLLATE "C" LIKE p.name || '/%'
             )
        )
        DELETE
        FROM storage.prefixes AS p
            USING leaf AS l
        WHERE p.bucket_id = l.bucket_id
          AND p.name = l.name
          AND p.level = l.level;

        GET DIAGNOSTICS v_rows_deleted = ROW_COUNT;
        EXIT WHEN v_rows_deleted = 0;
    END LOOP;
END;
$$;


--
-- Name: enforce_bucket_name_length(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.enforce_bucket_name_length() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
    if length(new.name) > 100 then
        raise exception 'bucket name "%" is too long (% characters). Max is 100.', new.name, length(new.name);
    end if;
    return new;
end;
$$;


--
-- Name: extension(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.extension(name text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
    _filename text;
BEGIN
    SELECT string_to_array(name, '/') INTO _parts;
    SELECT _parts[array_length(_parts,1)] INTO _filename;
    RETURN reverse(split_part(reverse(_filename), '.', 1));
END
$$;


--
-- Name: filename(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.filename(name text) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
_parts text[];
BEGIN
	select string_to_array(name, '/') into _parts;
	return _parts[array_length(_parts,1)];
END
$$;


--
-- Name: foldername(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.foldername(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE
    AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(name, '/') INTO _parts;
    -- Return everything except the last segment
    RETURN _parts[1 : array_length(_parts,1) - 1];
END
$$;


--
-- Name: get_common_prefix(text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_common_prefix(p_key text, p_prefix text, p_delimiter text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
SELECT CASE
    WHEN position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)) > 0
    THEN left(p_key, length(p_prefix) + position(p_delimiter IN substring(p_key FROM length(p_prefix) + 1)))
    ELSE NULL
END;
$$;


--
-- Name: get_level(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_level(name text) RETURNS integer
    LANGUAGE sql IMMUTABLE STRICT
    AS $$
SELECT array_length(string_to_array("name", '/'), 1);
$$;


--
-- Name: get_prefix(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefix(name text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT
    AS $_$
SELECT
    CASE WHEN strpos("name", '/') > 0 THEN
             regexp_replace("name", '[\/]{1}[^\/]+\/?$', '')
         ELSE
             ''
        END;
$_$;


--
-- Name: get_prefixes(text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_prefixes(name text) RETURNS text[]
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
DECLARE
    parts text[];
    prefixes text[];
    prefix text;
BEGIN
    -- Split the name into parts by '/'
    parts := string_to_array("name", '/');
    prefixes := '{}';

    -- Construct the prefixes, stopping one level below the last part
    FOR i IN 1..array_length(parts, 1) - 1 LOOP
            prefix := array_to_string(parts[1:i], '/');
            prefixes := array_append(prefixes, prefix);
    END LOOP;

    RETURN prefixes;
END;
$$;


--
-- Name: get_size_by_bucket(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.get_size_by_bucket() RETURNS TABLE(size bigint, bucket_id text)
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    return query
        select sum((metadata->>'size')::bigint) as size, obj.bucket_id
        from "storage".objects as obj
        group by obj.bucket_id;
END
$$;


--
-- Name: list_multipart_uploads_with_delimiter(text, text, text, integer, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_multipart_uploads_with_delimiter(bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, next_key_token text DEFAULT ''::text, next_upload_token text DEFAULT ''::text) RETURNS TABLE(key text, id text, created_at timestamp with time zone)
    LANGUAGE plpgsql
    AS $_$
BEGIN
    RETURN QUERY EXECUTE
        'SELECT DISTINCT ON(key COLLATE "C") * from (
            SELECT
                CASE
                    WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                        substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1)))
                    ELSE
                        key
                END AS key, id, created_at
            FROM
                storage.s3_multipart_uploads
            WHERE
                bucket_id = $5 AND
                key ILIKE $1 || ''%'' AND
                CASE
                    WHEN $4 != '''' AND $6 = '''' THEN
                        CASE
                            WHEN position($2 IN substring(key from length($1) + 1)) > 0 THEN
                                substring(key from 1 for length($1) + position($2 IN substring(key from length($1) + 1))) COLLATE "C" > $4
                            ELSE
                                key COLLATE "C" > $4
                            END
                    ELSE
                        true
                END AND
                CASE
                    WHEN $6 != '''' THEN
                        id COLLATE "C" > $6
                    ELSE
                        true
                    END
            ORDER BY
                key COLLATE "C" ASC, created_at ASC) as e order by key COLLATE "C" LIMIT $3'
        USING prefix_param, delimiter_param, max_keys, next_key_token, bucket_id, next_upload_token;
END;
$_$;


--
-- Name: list_objects_with_delimiter(text, text, text, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.list_objects_with_delimiter(_bucket_id text, prefix_param text, delimiter_param text, max_keys integer DEFAULT 100, start_after text DEFAULT ''::text, next_token text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, metadata jsonb, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;

    -- Configuration
    v_is_asc BOOLEAN;
    v_prefix TEXT;
    v_start TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_is_asc := lower(coalesce(sort_order, 'asc')) = 'asc';
    v_prefix := coalesce(prefix_param, '');
    v_start := CASE WHEN coalesce(next_token, '') <> '' THEN next_token ELSE coalesce(start_after, '') END;
    v_file_batch_size := LEAST(GREATEST(max_keys * 2, 100), 1000);

    -- Calculate upper bound for prefix filtering (bytewise, using COLLATE "C")
    IF v_prefix = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix, 1) = delimiter_param THEN
        v_upper_bound := left(v_prefix, -1) || chr(ascii(delimiter_param) + 1);
    ELSE
        v_upper_bound := left(v_prefix, -1) || chr(ascii(right(v_prefix, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'AND o.name COLLATE "C" < $3 ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" >= $2 ' ||
                'ORDER BY o.name COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'AND o.name COLLATE "C" >= $3 ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND o.name COLLATE "C" < $2 ' ||
                'ORDER BY o.name COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- ========================================================================
    -- SEEK INITIALIZATION: Determine starting position
    -- ========================================================================
    IF v_start = '' THEN
        IF v_is_asc THEN
            v_next_seek := v_prefix;
        ELSE
            -- DESC without cursor: find the last item in range
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_next_seek FROM storage.objects o
                WHERE o.bucket_id = _bucket_id
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;

            IF v_next_seek IS NOT NULL THEN
                v_next_seek := v_next_seek || delimiter_param;
            ELSE
                RETURN;
            END IF;
        END IF;
    ELSE
        -- Cursor provided: determine if it refers to a folder or leaf
        IF EXISTS (
            SELECT 1 FROM storage.objects o
            WHERE o.bucket_id = _bucket_id
              AND o.name COLLATE "C" LIKE v_start || delimiter_param || '%'
            LIMIT 1
        ) THEN
            -- Cursor refers to a folder
            IF v_is_asc THEN
                v_next_seek := v_start || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_start || delimiter_param;
            END IF;
        ELSE
            -- Cursor refers to a leaf object
            IF v_is_asc THEN
                v_next_seek := v_start || delimiter_param;
            ELSE
                v_next_seek := v_start;
            END IF;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= max_keys;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek AND o.name COLLATE "C" < v_upper_bound
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" >= v_next_seek
                ORDER BY o.name COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek AND o.name COLLATE "C" >= v_prefix
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = _bucket_id AND o.name COLLATE "C" < v_next_seek
                ORDER BY o.name COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(v_peek_name, v_prefix, delimiter_param);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Emit and skip to next folder (no heap access needed)
            name := rtrim(v_common_prefix, delimiter_param);
            id := NULL;
            updated_at := NULL;
            created_at := NULL;
            last_accessed_at := NULL;
            metadata := NULL;
            RETURN NEXT;
            v_count := v_count + 1;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := left(v_common_prefix, -1) || chr(ascii(delimiter_param) + 1);
            ELSE
                v_next_seek := v_common_prefix;
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query USING _bucket_id, v_next_seek,
                CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix) ELSE v_prefix END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(v_current.name, v_prefix, delimiter_param);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := v_current.name;
                    EXIT;
                END IF;

                -- Emit file
                name := v_current.name;
                id := v_current.id;
                updated_at := v_current.updated_at;
                created_at := v_current.created_at;
                last_accessed_at := v_current.last_accessed_at;
                metadata := v_current.metadata;
                RETURN NEXT;
                v_count := v_count + 1;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := v_current.name || delimiter_param;
                ELSE
                    v_next_seek := v_current.name;
                END IF;

                EXIT WHEN v_count >= max_keys;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: operation(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.operation() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
BEGIN
    RETURN current_setting('storage.operation', true);
END;
$$;


--
-- Name: protect_delete(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.protect_delete() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Check if storage.allow_delete_query is set to 'true'
    IF COALESCE(current_setting('storage.allow_delete_query', true), 'false') != 'true' THEN
        RAISE EXCEPTION 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
            USING HINT = 'This prevents accidental data loss from orphaned objects.',
                  ERRCODE = '42501';
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: search(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_peek_name TEXT;
    v_current RECORD;
    v_common_prefix TEXT;
    v_delimiter CONSTANT TEXT := '/';

    -- Configuration
    v_limit INT;
    v_prefix TEXT;
    v_prefix_lower TEXT;
    v_is_asc BOOLEAN;
    v_order_by TEXT;
    v_sort_order TEXT;
    v_upper_bound TEXT;
    v_file_batch_size INT;

    -- Dynamic SQL for batch query only
    v_batch_query TEXT;

    -- Seek state
    v_next_seek TEXT;
    v_count INT := 0;
    v_skipped INT := 0;
BEGIN
    -- ========================================================================
    -- INITIALIZATION
    -- ========================================================================
    v_limit := LEAST(coalesce(limits, 100), 1500);
    v_prefix := coalesce(prefix, '') || coalesce(search, '');
    v_prefix_lower := lower(v_prefix);
    v_is_asc := lower(coalesce(sortorder, 'asc')) = 'asc';
    v_file_batch_size := LEAST(GREATEST(v_limit * 2, 100), 1000);

    -- Validate sort column
    CASE lower(coalesce(sortcolumn, 'name'))
        WHEN 'name' THEN v_order_by := 'name';
        WHEN 'updated_at' THEN v_order_by := 'updated_at';
        WHEN 'created_at' THEN v_order_by := 'created_at';
        WHEN 'last_accessed_at' THEN v_order_by := 'last_accessed_at';
        ELSE v_order_by := 'name';
    END CASE;

    v_sort_order := CASE WHEN v_is_asc THEN 'asc' ELSE 'desc' END;

    -- ========================================================================
    -- NON-NAME SORTING: Use path_tokens approach (unchanged)
    -- ========================================================================
    IF v_order_by != 'name' THEN
        RETURN QUERY EXECUTE format(
            $sql$
            WITH folders AS (
                SELECT path_tokens[$1] AS folder
                FROM storage.objects
                WHERE objects.name ILIKE $2 || '%%'
                  AND bucket_id = $3
                  AND array_length(objects.path_tokens, 1) <> $1
                GROUP BY folder
                ORDER BY folder %s
            )
            (SELECT folder AS "name",
                   NULL::uuid AS id,
                   NULL::timestamptz AS updated_at,
                   NULL::timestamptz AS created_at,
                   NULL::timestamptz AS last_accessed_at,
                   NULL::jsonb AS metadata FROM folders)
            UNION ALL
            (SELECT path_tokens[$1] AS "name",
                   id, updated_at, created_at, last_accessed_at, metadata
             FROM storage.objects
             WHERE objects.name ILIKE $2 || '%%'
               AND bucket_id = $3
               AND array_length(objects.path_tokens, 1) = $1
             ORDER BY %I %s)
            LIMIT $4 OFFSET $5
            $sql$, v_sort_order, v_order_by, v_sort_order
        ) USING levels, v_prefix, bucketname, v_limit, offsets;
        RETURN;
    END IF;

    -- ========================================================================
    -- NAME SORTING: Hybrid skip-scan with batch optimization
    -- ========================================================================

    -- Calculate upper bound for prefix filtering
    IF v_prefix_lower = '' THEN
        v_upper_bound := NULL;
    ELSIF right(v_prefix_lower, 1) = v_delimiter THEN
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(v_delimiter) + 1);
    ELSE
        v_upper_bound := left(v_prefix_lower, -1) || chr(ascii(right(v_prefix_lower, 1)) + 1);
    END IF;

    -- Build batch query (dynamic SQL - called infrequently, amortized over many rows)
    IF v_is_asc THEN
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'AND lower(o.name) COLLATE "C" < $3 ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" >= $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" ASC LIMIT $4';
        END IF;
    ELSE
        IF v_upper_bound IS NOT NULL THEN
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'AND lower(o.name) COLLATE "C" >= $3 ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        ELSE
            v_batch_query := 'SELECT o.name, o.id, o.updated_at, o.created_at, o.last_accessed_at, o.metadata ' ||
                'FROM storage.objects o WHERE o.bucket_id = $1 AND lower(o.name) COLLATE "C" < $2 ' ||
                'ORDER BY lower(o.name) COLLATE "C" DESC LIMIT $4';
        END IF;
    END IF;

    -- Initialize seek position
    IF v_is_asc THEN
        v_next_seek := v_prefix_lower;
    ELSE
        -- DESC: find the last item in range first (static SQL)
        IF v_upper_bound IS NOT NULL THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower AND lower(o.name) COLLATE "C" < v_upper_bound
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSIF v_prefix_lower <> '' THEN
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_prefix_lower
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        ELSE
            SELECT o.name INTO v_peek_name FROM storage.objects o
            WHERE o.bucket_id = bucketname
            ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
        END IF;

        IF v_peek_name IS NOT NULL THEN
            v_next_seek := lower(v_peek_name) || v_delimiter;
        ELSE
            RETURN;
        END IF;
    END IF;

    -- ========================================================================
    -- MAIN LOOP: Hybrid peek-then-batch algorithm
    -- Uses STATIC SQL for peek (hot path) and DYNAMIC SQL for batch
    -- ========================================================================
    LOOP
        EXIT WHEN v_count >= v_limit;

        -- STEP 1: PEEK using STATIC SQL (plan cached, very fast)
        IF v_is_asc THEN
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek AND lower(o.name) COLLATE "C" < v_upper_bound
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" >= v_next_seek
                ORDER BY lower(o.name) COLLATE "C" ASC LIMIT 1;
            END IF;
        ELSE
            IF v_upper_bound IS NOT NULL THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSIF v_prefix_lower <> '' THEN
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek AND lower(o.name) COLLATE "C" >= v_prefix_lower
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            ELSE
                SELECT o.name INTO v_peek_name FROM storage.objects o
                WHERE o.bucket_id = bucketname AND lower(o.name) COLLATE "C" < v_next_seek
                ORDER BY lower(o.name) COLLATE "C" DESC LIMIT 1;
            END IF;
        END IF;

        EXIT WHEN v_peek_name IS NULL;

        -- STEP 2: Check if this is a FOLDER or FILE
        v_common_prefix := storage.get_common_prefix(lower(v_peek_name), v_prefix_lower, v_delimiter);

        IF v_common_prefix IS NOT NULL THEN
            -- FOLDER: Handle offset, emit if needed, skip to next folder
            IF v_skipped < offsets THEN
                v_skipped := v_skipped + 1;
            ELSE
                name := split_part(rtrim(storage.get_common_prefix(v_peek_name, v_prefix, v_delimiter), v_delimiter), v_delimiter, levels);
                id := NULL;
                updated_at := NULL;
                created_at := NULL;
                last_accessed_at := NULL;
                metadata := NULL;
                RETURN NEXT;
                v_count := v_count + 1;
            END IF;

            -- Advance seek past the folder range
            IF v_is_asc THEN
                v_next_seek := lower(left(v_common_prefix, -1)) || chr(ascii(v_delimiter) + 1);
            ELSE
                v_next_seek := lower(v_common_prefix);
            END IF;
        ELSE
            -- FILE: Batch fetch using DYNAMIC SQL (overhead amortized over many rows)
            -- For ASC: upper_bound is the exclusive upper limit (< condition)
            -- For DESC: prefix_lower is the inclusive lower limit (>= condition)
            FOR v_current IN EXECUTE v_batch_query
                USING bucketname, v_next_seek,
                    CASE WHEN v_is_asc THEN COALESCE(v_upper_bound, v_prefix_lower) ELSE v_prefix_lower END, v_file_batch_size
            LOOP
                v_common_prefix := storage.get_common_prefix(lower(v_current.name), v_prefix_lower, v_delimiter);

                IF v_common_prefix IS NOT NULL THEN
                    -- Hit a folder: exit batch, let peek handle it
                    v_next_seek := lower(v_current.name);
                    EXIT;
                END IF;

                -- Handle offset skipping
                IF v_skipped < offsets THEN
                    v_skipped := v_skipped + 1;
                ELSE
                    -- Emit file
                    name := split_part(v_current.name, v_delimiter, levels);
                    id := v_current.id;
                    updated_at := v_current.updated_at;
                    created_at := v_current.created_at;
                    last_accessed_at := v_current.last_accessed_at;
                    metadata := v_current.metadata;
                    RETURN NEXT;
                    v_count := v_count + 1;
                END IF;

                -- Advance seek past this file
                IF v_is_asc THEN
                    v_next_seek := lower(v_current.name) || v_delimiter;
                ELSE
                    v_next_seek := lower(v_current.name);
                END IF;

                EXIT WHEN v_count >= v_limit;
            END LOOP;
        END IF;
    END LOOP;
END;
$_$;


--
-- Name: search_by_timestamp(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_by_timestamp(p_prefix text, p_bucket_id text, p_limit integer, p_level integer, p_start_after text, p_sort_order text, p_sort_column text, p_sort_column_after text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
DECLARE
    v_cursor_op text;
    v_query text;
    v_prefix text;
BEGIN
    v_prefix := coalesce(p_prefix, '');

    IF p_sort_order = 'asc' THEN
        v_cursor_op := '>';
    ELSE
        v_cursor_op := '<';
    END IF;

    v_query := format($sql$
        WITH raw_objects AS (
            SELECT
                o.name AS obj_name,
                o.id AS obj_id,
                o.updated_at AS obj_updated_at,
                o.created_at AS obj_created_at,
                o.last_accessed_at AS obj_last_accessed_at,
                o.metadata AS obj_metadata,
                storage.get_common_prefix(o.name, $1, '/') AS common_prefix
            FROM storage.objects o
            WHERE o.bucket_id = $2
              AND o.name COLLATE "C" LIKE $1 || '%%'
        ),
        -- Aggregate common prefixes (folders)
        -- Both created_at and updated_at use MIN(obj_created_at) to match the old prefixes table behavior
        aggregated_prefixes AS (
            SELECT
                rtrim(common_prefix, '/') AS name,
                NULL::uuid AS id,
                MIN(obj_created_at) AS updated_at,
                MIN(obj_created_at) AS created_at,
                NULL::timestamptz AS last_accessed_at,
                NULL::jsonb AS metadata,
                TRUE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NOT NULL
            GROUP BY common_prefix
        ),
        leaf_objects AS (
            SELECT
                obj_name AS name,
                obj_id AS id,
                obj_updated_at AS updated_at,
                obj_created_at AS created_at,
                obj_last_accessed_at AS last_accessed_at,
                obj_metadata AS metadata,
                FALSE AS is_prefix
            FROM raw_objects
            WHERE common_prefix IS NULL
        ),
        combined AS (
            SELECT * FROM aggregated_prefixes
            UNION ALL
            SELECT * FROM leaf_objects
        ),
        filtered AS (
            SELECT *
            FROM combined
            WHERE (
                $5 = ''
                OR ROW(
                    date_trunc('milliseconds', %I),
                    name COLLATE "C"
                ) %s ROW(
                    COALESCE(NULLIF($6, '')::timestamptz, 'epoch'::timestamptz),
                    $5
                )
            )
        )
        SELECT
            split_part(name, '/', $3) AS key,
            name,
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
        FROM filtered
        ORDER BY
            COALESCE(date_trunc('milliseconds', %I), 'epoch'::timestamptz) %s,
            name COLLATE "C" %s
        LIMIT $4
    $sql$,
        p_sort_column,
        v_cursor_op,
        p_sort_column,
        p_sort_order,
        p_sort_order
    );

    RETURN QUERY EXECUTE v_query
    USING v_prefix, p_bucket_id, p_level, p_limit, p_start_after, p_sort_column_after;
END;
$_$;


--
-- Name: search_legacy_v1(text, text, integer, integer, integer, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_legacy_v1(prefix text, bucketname text, limits integer DEFAULT 100, levels integer DEFAULT 1, offsets integer DEFAULT 0, search text DEFAULT ''::text, sortcolumn text DEFAULT 'name'::text, sortorder text DEFAULT 'asc'::text) RETURNS TABLE(name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $_$
declare
    v_order_by text;
    v_sort_order text;
begin
    case
        when sortcolumn = 'name' then
            v_order_by = 'name';
        when sortcolumn = 'updated_at' then
            v_order_by = 'updated_at';
        when sortcolumn = 'created_at' then
            v_order_by = 'created_at';
        when sortcolumn = 'last_accessed_at' then
            v_order_by = 'last_accessed_at';
        else
            v_order_by = 'name';
        end case;

    case
        when sortorder = 'asc' then
            v_sort_order = 'asc';
        when sortorder = 'desc' then
            v_sort_order = 'desc';
        else
            v_sort_order = 'asc';
        end case;

    v_order_by = v_order_by || ' ' || v_sort_order;

    return query execute
        'with folders as (
           select path_tokens[$1] as folder
           from storage.objects
             where objects.name ilike $2 || $3 || ''%''
               and bucket_id = $4
               and array_length(objects.path_tokens, 1) <> $1
           group by folder
           order by folder ' || v_sort_order || '
     )
     (select folder as "name",
            null as id,
            null as updated_at,
            null as created_at,
            null as last_accessed_at,
            null as metadata from folders)
     union all
     (select path_tokens[$1] as "name",
            id,
            updated_at,
            created_at,
            last_accessed_at,
            metadata
     from storage.objects
     where objects.name ilike $2 || $3 || ''%''
       and bucket_id = $4
       and array_length(objects.path_tokens, 1) = $1
     order by ' || v_order_by || ')
     limit $5
     offset $6' using levels, prefix, search, bucketname, limits, offsets;
end;
$_$;


--
-- Name: search_v2(text, text, integer, integer, text, text, text, text); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.search_v2(prefix text, bucket_name text, limits integer DEFAULT 100, levels integer DEFAULT 1, start_after text DEFAULT ''::text, sort_order text DEFAULT 'asc'::text, sort_column text DEFAULT 'name'::text, sort_column_after text DEFAULT ''::text) RETURNS TABLE(key text, name text, id uuid, updated_at timestamp with time zone, created_at timestamp with time zone, last_accessed_at timestamp with time zone, metadata jsonb)
    LANGUAGE plpgsql STABLE
    AS $$
DECLARE
    v_sort_col text;
    v_sort_ord text;
    v_limit int;
BEGIN
    -- Cap limit to maximum of 1500 records
    v_limit := LEAST(coalesce(limits, 100), 1500);

    -- Validate and normalize sort_order
    v_sort_ord := lower(coalesce(sort_order, 'asc'));
    IF v_sort_ord NOT IN ('asc', 'desc') THEN
        v_sort_ord := 'asc';
    END IF;

    -- Validate and normalize sort_column
    v_sort_col := lower(coalesce(sort_column, 'name'));
    IF v_sort_col NOT IN ('name', 'updated_at', 'created_at') THEN
        v_sort_col := 'name';
    END IF;

    -- Route to appropriate implementation
    IF v_sort_col = 'name' THEN
        -- Use list_objects_with_delimiter for name sorting (most efficient: O(k * log n))
        RETURN QUERY
        SELECT
            split_part(l.name, '/', levels) AS key,
            l.name AS name,
            l.id,
            l.updated_at,
            l.created_at,
            l.last_accessed_at,
            l.metadata
        FROM storage.list_objects_with_delimiter(
            bucket_name,
            coalesce(prefix, ''),
            '/',
            v_limit,
            start_after,
            '',
            v_sort_ord
        ) l;
    ELSE
        -- Use aggregation approach for timestamp sorting
        -- Not efficient for large datasets but supports correct pagination
        RETURN QUERY SELECT * FROM storage.search_by_timestamp(
            prefix, bucket_name, v_limit, levels, start_after,
            v_sort_ord, v_sort_col, sort_column_after
        );
    END IF;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: storage; Owner: -
--

CREATE FUNCTION storage.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW; 
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_log_entries; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.audit_log_entries (
    instance_id uuid,
    id uuid NOT NULL,
    payload json,
    created_at timestamp with time zone,
    ip_address character varying(64) DEFAULT ''::character varying NOT NULL
);


--
-- Name: TABLE audit_log_entries; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.audit_log_entries IS 'Auth: Audit trail for user actions.';


--
-- Name: custom_oauth_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.custom_oauth_providers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    provider_type text NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    client_id text NOT NULL,
    client_secret text NOT NULL,
    acceptable_client_ids text[] DEFAULT '{}'::text[] NOT NULL,
    scopes text[] DEFAULT '{}'::text[] NOT NULL,
    pkce_enabled boolean DEFAULT true NOT NULL,
    attribute_mapping jsonb DEFAULT '{}'::jsonb NOT NULL,
    authorization_params jsonb DEFAULT '{}'::jsonb NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    email_optional boolean DEFAULT false NOT NULL,
    issuer text,
    discovery_url text,
    skip_nonce_check boolean DEFAULT false NOT NULL,
    cached_discovery jsonb,
    discovery_cached_at timestamp with time zone,
    authorization_url text,
    token_url text,
    userinfo_url text,
    jwks_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT custom_oauth_providers_authorization_url_https CHECK (((authorization_url IS NULL) OR (authorization_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_authorization_url_length CHECK (((authorization_url IS NULL) OR (char_length(authorization_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_client_id_length CHECK (((char_length(client_id) >= 1) AND (char_length(client_id) <= 512))),
    CONSTRAINT custom_oauth_providers_discovery_url_length CHECK (((discovery_url IS NULL) OR (char_length(discovery_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_identifier_format CHECK ((identifier ~ '^[a-z0-9][a-z0-9:-]{0,48}[a-z0-9]$'::text)),
    CONSTRAINT custom_oauth_providers_issuer_length CHECK (((issuer IS NULL) OR ((char_length(issuer) >= 1) AND (char_length(issuer) <= 2048)))),
    CONSTRAINT custom_oauth_providers_jwks_uri_https CHECK (((jwks_uri IS NULL) OR (jwks_uri ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_jwks_uri_length CHECK (((jwks_uri IS NULL) OR (char_length(jwks_uri) <= 2048))),
    CONSTRAINT custom_oauth_providers_name_length CHECK (((char_length(name) >= 1) AND (char_length(name) <= 100))),
    CONSTRAINT custom_oauth_providers_oauth2_requires_endpoints CHECK (((provider_type <> 'oauth2'::text) OR ((authorization_url IS NOT NULL) AND (token_url IS NOT NULL) AND (userinfo_url IS NOT NULL)))),
    CONSTRAINT custom_oauth_providers_oidc_discovery_url_https CHECK (((provider_type <> 'oidc'::text) OR (discovery_url IS NULL) OR (discovery_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_issuer_https CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NULL) OR (issuer ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_oidc_requires_issuer CHECK (((provider_type <> 'oidc'::text) OR (issuer IS NOT NULL))),
    CONSTRAINT custom_oauth_providers_provider_type_check CHECK ((provider_type = ANY (ARRAY['oauth2'::text, 'oidc'::text]))),
    CONSTRAINT custom_oauth_providers_token_url_https CHECK (((token_url IS NULL) OR (token_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_token_url_length CHECK (((token_url IS NULL) OR (char_length(token_url) <= 2048))),
    CONSTRAINT custom_oauth_providers_userinfo_url_https CHECK (((userinfo_url IS NULL) OR (userinfo_url ~~ 'https://%'::text))),
    CONSTRAINT custom_oauth_providers_userinfo_url_length CHECK (((userinfo_url IS NULL) OR (char_length(userinfo_url) <= 2048)))
);


--
-- Name: flow_state; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.flow_state (
    id uuid NOT NULL,
    user_id uuid,
    auth_code text,
    code_challenge_method auth.code_challenge_method,
    code_challenge text,
    provider_type text NOT NULL,
    provider_access_token text,
    provider_refresh_token text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    authentication_method text NOT NULL,
    auth_code_issued_at timestamp with time zone,
    invite_token text,
    referrer text,
    oauth_client_state_id uuid,
    linking_target_id uuid,
    email_optional boolean DEFAULT false NOT NULL
);


--
-- Name: TABLE flow_state; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.flow_state IS 'Stores metadata for all OAuth/SSO login flows';


--
-- Name: identities; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.identities (
    provider_id text NOT NULL,
    user_id uuid NOT NULL,
    identity_data jsonb NOT NULL,
    provider text NOT NULL,
    last_sign_in_at timestamp with time zone,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    email text GENERATED ALWAYS AS (lower((identity_data ->> 'email'::text))) STORED,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: TABLE identities; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.identities IS 'Auth: Stores identities associated to a user.';


--
-- Name: COLUMN identities.email; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.identities.email IS 'Auth: Email is a generated column that references the optional email property in the identity_data';


--
-- Name: instances; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.instances (
    id uuid NOT NULL,
    uuid uuid,
    raw_base_config text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: TABLE instances; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.instances IS 'Auth: Manages users across multiple sites.';


--
-- Name: mfa_amr_claims; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_amr_claims (
    session_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    authentication_method text NOT NULL,
    id uuid NOT NULL
);


--
-- Name: TABLE mfa_amr_claims; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_amr_claims IS 'auth: stores authenticator method reference claims for multi factor authentication';


--
-- Name: mfa_challenges; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_challenges (
    id uuid NOT NULL,
    factor_id uuid NOT NULL,
    created_at timestamp with time zone NOT NULL,
    verified_at timestamp with time zone,
    ip_address inet NOT NULL,
    otp_code text,
    web_authn_session_data jsonb
);


--
-- Name: TABLE mfa_challenges; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_challenges IS 'auth: stores metadata about challenge requests made';


--
-- Name: mfa_factors; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.mfa_factors (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    friendly_name text,
    factor_type auth.factor_type NOT NULL,
    status auth.factor_status NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NOT NULL,
    secret text,
    phone text,
    last_challenged_at timestamp with time zone,
    web_authn_credential jsonb,
    web_authn_aaguid uuid,
    last_webauthn_challenge_data jsonb
);


--
-- Name: TABLE mfa_factors; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.mfa_factors IS 'auth: stores metadata about factors';


--
-- Name: COLUMN mfa_factors.last_webauthn_challenge_data; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.mfa_factors.last_webauthn_challenge_data IS 'Stores the latest WebAuthn challenge data including attestation/assertion for customer verification';


--
-- Name: oauth_authorizations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_authorizations (
    id uuid NOT NULL,
    authorization_id text NOT NULL,
    client_id uuid NOT NULL,
    user_id uuid,
    redirect_uri text NOT NULL,
    scope text NOT NULL,
    state text,
    resource text,
    code_challenge text,
    code_challenge_method auth.code_challenge_method,
    response_type auth.oauth_response_type DEFAULT 'code'::auth.oauth_response_type NOT NULL,
    status auth.oauth_authorization_status DEFAULT 'pending'::auth.oauth_authorization_status NOT NULL,
    authorization_code text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '00:03:00'::interval) NOT NULL,
    approved_at timestamp with time zone,
    nonce text,
    CONSTRAINT oauth_authorizations_authorization_code_length CHECK ((char_length(authorization_code) <= 255)),
    CONSTRAINT oauth_authorizations_code_challenge_length CHECK ((char_length(code_challenge) <= 128)),
    CONSTRAINT oauth_authorizations_expires_at_future CHECK ((expires_at > created_at)),
    CONSTRAINT oauth_authorizations_nonce_length CHECK ((char_length(nonce) <= 255)),
    CONSTRAINT oauth_authorizations_redirect_uri_length CHECK ((char_length(redirect_uri) <= 2048)),
    CONSTRAINT oauth_authorizations_resource_length CHECK ((char_length(resource) <= 2048)),
    CONSTRAINT oauth_authorizations_scope_length CHECK ((char_length(scope) <= 4096)),
    CONSTRAINT oauth_authorizations_state_length CHECK ((char_length(state) <= 4096))
);


--
-- Name: oauth_client_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_client_states (
    id uuid NOT NULL,
    provider_type text NOT NULL,
    code_verifier text,
    created_at timestamp with time zone NOT NULL
);


--
-- Name: TABLE oauth_client_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.oauth_client_states IS 'Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.';


--
-- Name: oauth_clients; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_clients (
    id uuid NOT NULL,
    client_secret_hash text,
    registration_type auth.oauth_registration_type NOT NULL,
    redirect_uris text NOT NULL,
    grant_types text NOT NULL,
    client_name text,
    client_uri text,
    logo_uri text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    deleted_at timestamp with time zone,
    client_type auth.oauth_client_type DEFAULT 'confidential'::auth.oauth_client_type NOT NULL,
    token_endpoint_auth_method text NOT NULL,
    CONSTRAINT oauth_clients_client_name_length CHECK ((char_length(client_name) <= 1024)),
    CONSTRAINT oauth_clients_client_uri_length CHECK ((char_length(client_uri) <= 2048)),
    CONSTRAINT oauth_clients_logo_uri_length CHECK ((char_length(logo_uri) <= 2048)),
    CONSTRAINT oauth_clients_token_endpoint_auth_method_check CHECK ((token_endpoint_auth_method = ANY (ARRAY['client_secret_basic'::text, 'client_secret_post'::text, 'none'::text])))
);


--
-- Name: oauth_consents; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.oauth_consents (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    client_id uuid NOT NULL,
    scopes text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL,
    revoked_at timestamp with time zone,
    CONSTRAINT oauth_consents_revoked_after_granted CHECK (((revoked_at IS NULL) OR (revoked_at >= granted_at))),
    CONSTRAINT oauth_consents_scopes_length CHECK ((char_length(scopes) <= 2048)),
    CONSTRAINT oauth_consents_scopes_not_empty CHECK ((char_length(TRIM(BOTH FROM scopes)) > 0))
);


--
-- Name: one_time_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.one_time_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_type auth.one_time_token_type NOT NULL,
    token_hash text NOT NULL,
    relates_to text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT one_time_tokens_token_hash_check CHECK ((char_length(token_hash) > 0))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.refresh_tokens (
    instance_id uuid,
    id bigint NOT NULL,
    token character varying(255),
    user_id character varying(255),
    revoked boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    parent character varying(255),
    session_id uuid
);


--
-- Name: TABLE refresh_tokens; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.refresh_tokens IS 'Auth: Store of tokens used to refresh JWT tokens once they expire.';


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE; Schema: auth; Owner: -
--

CREATE SEQUENCE auth.refresh_tokens_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: refresh_tokens_id_seq; Type: SEQUENCE OWNED BY; Schema: auth; Owner: -
--

ALTER SEQUENCE auth.refresh_tokens_id_seq OWNED BY auth.refresh_tokens.id;


--
-- Name: saml_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_providers (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    entity_id text NOT NULL,
    metadata_xml text NOT NULL,
    metadata_url text,
    attribute_mapping jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    name_id_format text,
    CONSTRAINT "entity_id not empty" CHECK ((char_length(entity_id) > 0)),
    CONSTRAINT "metadata_url not empty" CHECK (((metadata_url = NULL::text) OR (char_length(metadata_url) > 0))),
    CONSTRAINT "metadata_xml not empty" CHECK ((char_length(metadata_xml) > 0))
);


--
-- Name: TABLE saml_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_providers IS 'Auth: Manages SAML Identity Provider connections.';


--
-- Name: saml_relay_states; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.saml_relay_states (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    request_id text NOT NULL,
    for_email text,
    redirect_to text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    flow_state_id uuid,
    CONSTRAINT "request_id not empty" CHECK ((char_length(request_id) > 0))
);


--
-- Name: TABLE saml_relay_states; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.saml_relay_states IS 'Auth: Contains SAML Relay State information for each Service Provider initiated login.';


--
-- Name: schema_migrations; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.schema_migrations (
    version character varying(255) NOT NULL
);


--
-- Name: TABLE schema_migrations; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.schema_migrations IS 'Auth: Manages updates to the auth system.';


--
-- Name: sessions; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    factor_id uuid,
    aal auth.aal_level,
    not_after timestamp with time zone,
    refreshed_at timestamp without time zone,
    user_agent text,
    ip inet,
    tag text,
    oauth_client_id uuid,
    refresh_token_hmac_key text,
    refresh_token_counter bigint,
    scopes text,
    CONSTRAINT sessions_scopes_length CHECK ((char_length(scopes) <= 4096))
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sessions IS 'Auth: Stores session data associated to a user.';


--
-- Name: COLUMN sessions.not_after; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.not_after IS 'Auth: Not after is a nullable column that contains a timestamp after which the session should be regarded as expired.';


--
-- Name: COLUMN sessions.refresh_token_hmac_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_hmac_key IS 'Holds a HMAC-SHA256 key used to sign refresh tokens for this session.';


--
-- Name: COLUMN sessions.refresh_token_counter; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sessions.refresh_token_counter IS 'Holds the ID (counter) of the last issued refresh token.';


--
-- Name: sso_domains; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_domains (
    id uuid NOT NULL,
    sso_provider_id uuid NOT NULL,
    domain text NOT NULL,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    CONSTRAINT "domain not empty" CHECK ((char_length(domain) > 0))
);


--
-- Name: TABLE sso_domains; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_domains IS 'Auth: Manages SSO email address domain mapping to an SSO Identity Provider.';


--
-- Name: sso_providers; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.sso_providers (
    id uuid NOT NULL,
    resource_id text,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    disabled boolean,
    CONSTRAINT "resource_id not empty" CHECK (((resource_id = NULL::text) OR (char_length(resource_id) > 0)))
);


--
-- Name: TABLE sso_providers; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.sso_providers IS 'Auth: Manages SSO identity provider information; see saml_providers for SAML.';


--
-- Name: COLUMN sso_providers.resource_id; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.sso_providers.resource_id IS 'Auth: Uniquely identifies a SSO provider according to a user-chosen resource ID (case insensitive), useful in infrastructure as code.';


--
-- Name: users; Type: TABLE; Schema: auth; Owner: -
--

CREATE TABLE auth.users (
    instance_id uuid,
    id uuid NOT NULL,
    aud character varying(255),
    role character varying(255),
    email character varying(255),
    encrypted_password character varying(255),
    email_confirmed_at timestamp with time zone,
    invited_at timestamp with time zone,
    confirmation_token character varying(255),
    confirmation_sent_at timestamp with time zone,
    recovery_token character varying(255),
    recovery_sent_at timestamp with time zone,
    email_change_token_new character varying(255),
    email_change character varying(255),
    email_change_sent_at timestamp with time zone,
    last_sign_in_at timestamp with time zone,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    is_super_admin boolean,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    phone text DEFAULT NULL::character varying,
    phone_confirmed_at timestamp with time zone,
    phone_change text DEFAULT ''::character varying,
    phone_change_token character varying(255) DEFAULT ''::character varying,
    phone_change_sent_at timestamp with time zone,
    confirmed_at timestamp with time zone GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
    email_change_token_current character varying(255) DEFAULT ''::character varying,
    email_change_confirm_status smallint DEFAULT 0,
    banned_until timestamp with time zone,
    reauthentication_token character varying(255) DEFAULT ''::character varying,
    reauthentication_sent_at timestamp with time zone,
    is_sso_user boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    is_anonymous boolean DEFAULT false NOT NULL,
    CONSTRAINT users_email_change_confirm_status_check CHECK (((email_change_confirm_status >= 0) AND (email_change_confirm_status <= 2)))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON TABLE auth.users IS 'Auth: Stores user login data within a secure schema.';


--
-- Name: COLUMN users.is_sso_user; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON COLUMN auth.users.is_sso_user IS 'Auth: Set this column to true when the account comes from SSO. These accounts can have duplicate emails.';


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

CREATE VIEW public.appeal_levels_latest WITH (security_invoker='true') AS
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
  WHERE (effective_date = ( SELECT max(appeal_levels_1.effective_date) AS max
           FROM public.appeal_levels appeal_levels_1))
  ORDER BY level;


--
-- Name: appeal_outcomes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appeal_outcomes (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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

CREATE VIEW public.carc_codes_latest WITH (security_invoker='true') AS
 SELECT code,
    group_code,
    description,
    category,
    plain_english,
    effective_date,
    is_active,
    created_at
   FROM public.carc_codes
  WHERE (effective_date = ( SELECT max(carc_codes_1.effective_date) AS max
           FROM public.carc_codes carc_codes_1));


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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid,
    phone text,
    device_fingerprint text,
    title text,
    status text DEFAULT 'active'::text NOT NULL,
    is_appeal boolean DEFAULT false,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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

CREATE VIEW public.denial_patterns_latest WITH (security_invoker='true') AS
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
  WHERE ((effective_date = ( SELECT max(denial_patterns_1.effective_date) AS max
           FROM public.denial_patterns denial_patterns_1)) AND (is_active = true));


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

CREATE VIEW public.eob_denial_mappings_latest WITH (security_invoker='true') AS
 SELECT id,
    eob_code,
    eob_description,
    carc_code,
    rarc_code,
    effective_date,
    created_at
   FROM public.eob_denial_mappings
  WHERE (effective_date = ( SELECT max(eob_denial_mappings_1.effective_date) AS max
           FROM public.eob_denial_mappings eob_denial_mappings_1));


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
    plan text DEFAULT 'free'::text NOT NULL,
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
    CONSTRAINT users_plan_check CHECK ((plan = ANY (ARRAY['trial'::text, 'per_appeal'::text, 'monthly'::text]))),
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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

CREATE VIEW public.rarc_codes_latest WITH (security_invoker='true') AS
 SELECT code,
    description,
    category,
    plain_english,
    effective_date,
    is_active,
    created_at
   FROM public.rarc_codes
  WHERE (effective_date = ( SELECT max(rarc_codes_1.effective_date) AS max
           FROM public.rarc_codes rarc_codes_1));


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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    CONSTRAINT subscriptions_plan_check CHECK ((plan = ANY (ARRAY['trial'::text, 'per_appeal'::text, 'monthly'::text]))),
    CONSTRAINT subscriptions_status_check CHECK ((status = ANY (ARRAY['active'::text, 'cancelled'::text, 'past_due'::text, 'trialing'::text])))
);


--
-- Name: symptom_mappings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.symptom_mappings (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
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
-- Name: user_verification; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_verification (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    email_verified boolean DEFAULT false NOT NULL,
    phone_verified boolean DEFAULT false NOT NULL,
    email_verified_at timestamp with time zone,
    phone_verified_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: messages; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.messages (
    topic text NOT NULL,
    extension text NOT NULL,
    payload jsonb,
    event text,
    private boolean DEFAULT false,
    updated_at timestamp without time zone DEFAULT now() NOT NULL,
    inserted_at timestamp without time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
)
PARTITION BY RANGE (inserted_at);


--
-- Name: schema_migrations; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.schema_migrations (
    version bigint NOT NULL,
    inserted_at timestamp(0) without time zone
);


--
-- Name: subscription; Type: TABLE; Schema: realtime; Owner: -
--

CREATE TABLE realtime.subscription (
    id bigint NOT NULL,
    subscription_id uuid NOT NULL,
    entity regclass NOT NULL,
    filters realtime.user_defined_filter[] DEFAULT '{}'::realtime.user_defined_filter[] NOT NULL,
    claims jsonb NOT NULL,
    claims_role regrole GENERATED ALWAYS AS (realtime.to_regrole((claims ->> 'role'::text))) STORED NOT NULL,
    created_at timestamp without time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    action_filter text DEFAULT '*'::text,
    CONSTRAINT subscription_action_filter_check CHECK ((action_filter = ANY (ARRAY['*'::text, 'INSERT'::text, 'UPDATE'::text, 'DELETE'::text])))
);


--
-- Name: subscription_id_seq; Type: SEQUENCE; Schema: realtime; Owner: -
--

ALTER TABLE realtime.subscription ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME realtime.subscription_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: buckets; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets (
    id text NOT NULL,
    name text NOT NULL,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    public boolean DEFAULT false,
    avif_autodetection boolean DEFAULT false,
    file_size_limit bigint,
    allowed_mime_types text[],
    owner_id text,
    type storage.buckettype DEFAULT 'STANDARD'::storage.buckettype NOT NULL
);


--
-- Name: COLUMN buckets.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.buckets.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: buckets_analytics; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_analytics (
    name text NOT NULL,
    type storage.buckettype DEFAULT 'ANALYTICS'::storage.buckettype NOT NULL,
    format text DEFAULT 'ICEBERG'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    deleted_at timestamp with time zone
);


--
-- Name: buckets_vectors; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.buckets_vectors (
    id text NOT NULL,
    type storage.buckettype DEFAULT 'VECTOR'::storage.buckettype NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: migrations; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.migrations (
    id integer NOT NULL,
    name character varying(100) NOT NULL,
    hash character varying(40) NOT NULL,
    executed_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


--
-- Name: objects; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.objects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bucket_id text,
    name text,
    owner uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    last_accessed_at timestamp with time zone DEFAULT now(),
    metadata jsonb,
    path_tokens text[] GENERATED ALWAYS AS (string_to_array(name, '/'::text)) STORED,
    version text,
    owner_id text,
    user_metadata jsonb
);


--
-- Name: COLUMN objects.owner; Type: COMMENT; Schema: storage; Owner: -
--

COMMENT ON COLUMN storage.objects.owner IS 'Field is deprecated, use owner_id instead';


--
-- Name: s3_multipart_uploads; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads (
    id text NOT NULL,
    in_progress_size bigint DEFAULT 0 NOT NULL,
    upload_signature text NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    version text NOT NULL,
    owner_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    user_metadata jsonb
);


--
-- Name: s3_multipart_uploads_parts; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.s3_multipart_uploads_parts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    upload_id text NOT NULL,
    size bigint DEFAULT 0 NOT NULL,
    part_number integer NOT NULL,
    bucket_id text NOT NULL,
    key text NOT NULL COLLATE pg_catalog."C",
    etag text NOT NULL,
    owner_id text,
    version text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vector_indexes; Type: TABLE; Schema: storage; Owner: -
--

CREATE TABLE storage.vector_indexes (
    id text DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL COLLATE pg_catalog."C",
    bucket_id text NOT NULL,
    data_type text NOT NULL,
    dimension integer NOT NULL,
    distance_metric text NOT NULL,
    metadata_configuration jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: schema_migrations; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.schema_migrations (
    version text NOT NULL,
    statements text[],
    name text,
    created_by text,
    idempotency_key text,
    rollback text[]
);


--
-- Name: seed_files; Type: TABLE; Schema: supabase_migrations; Owner: -
--

CREATE TABLE supabase_migrations.seed_files (
    path text NOT NULL,
    hash text NOT NULL
);


--
-- Name: refresh_tokens id; Type: DEFAULT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens ALTER COLUMN id SET DEFAULT nextval('auth.refresh_tokens_id_seq'::regclass);


--
-- Name: mfa_amr_claims amr_id_pk; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT amr_id_pk PRIMARY KEY (id);


--
-- Name: audit_log_entries audit_log_entries_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.audit_log_entries
    ADD CONSTRAINT audit_log_entries_pkey PRIMARY KEY (id);


--
-- Name: custom_oauth_providers custom_oauth_providers_identifier_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_identifier_key UNIQUE (identifier);


--
-- Name: custom_oauth_providers custom_oauth_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.custom_oauth_providers
    ADD CONSTRAINT custom_oauth_providers_pkey PRIMARY KEY (id);


--
-- Name: flow_state flow_state_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.flow_state
    ADD CONSTRAINT flow_state_pkey PRIMARY KEY (id);


--
-- Name: identities identities_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_pkey PRIMARY KEY (id);


--
-- Name: identities identities_provider_id_provider_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_provider_id_provider_unique UNIQUE (provider_id, provider);


--
-- Name: instances instances_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.instances
    ADD CONSTRAINT instances_pkey PRIMARY KEY (id);


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_authentication_method_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_authentication_method_pkey UNIQUE (session_id, authentication_method);


--
-- Name: mfa_challenges mfa_challenges_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_pkey PRIMARY KEY (id);


--
-- Name: mfa_factors mfa_factors_last_challenged_at_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_last_challenged_at_key UNIQUE (last_challenged_at);


--
-- Name: mfa_factors mfa_factors_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_pkey PRIMARY KEY (id);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_code_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_code_key UNIQUE (authorization_code);


--
-- Name: oauth_authorizations oauth_authorizations_authorization_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_authorization_id_key UNIQUE (authorization_id);


--
-- Name: oauth_authorizations oauth_authorizations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_pkey PRIMARY KEY (id);


--
-- Name: oauth_client_states oauth_client_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_client_states
    ADD CONSTRAINT oauth_client_states_pkey PRIMARY KEY (id);


--
-- Name: oauth_clients oauth_clients_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_clients
    ADD CONSTRAINT oauth_clients_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_pkey PRIMARY KEY (id);


--
-- Name: oauth_consents oauth_consents_user_client_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_client_unique UNIQUE (user_id, client_id);


--
-- Name: one_time_tokens one_time_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_token_unique; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_token_unique UNIQUE (token);


--
-- Name: saml_providers saml_providers_entity_id_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_entity_id_key UNIQUE (entity_id);


--
-- Name: saml_providers saml_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_pkey PRIMARY KEY (id);


--
-- Name: saml_relay_states saml_relay_states_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sso_domains sso_domains_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_pkey PRIMARY KEY (id);


--
-- Name: sso_providers sso_providers_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_providers
    ADD CONSTRAINT sso_providers_pkey PRIMARY KEY (id);


--
-- Name: users users_phone_key; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_phone_key UNIQUE (phone);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


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
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id, inserted_at);


--
-- Name: subscription pk_subscription; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.subscription
    ADD CONSTRAINT pk_subscription PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: realtime; Owner: -
--

ALTER TABLE ONLY realtime.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: buckets_analytics buckets_analytics_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_analytics
    ADD CONSTRAINT buckets_analytics_pkey PRIMARY KEY (id);


--
-- Name: buckets buckets_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets
    ADD CONSTRAINT buckets_pkey PRIMARY KEY (id);


--
-- Name: buckets_vectors buckets_vectors_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.buckets_vectors
    ADD CONSTRAINT buckets_vectors_pkey PRIMARY KEY (id);


--
-- Name: migrations migrations_name_key; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_name_key UNIQUE (name);


--
-- Name: migrations migrations_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.migrations
    ADD CONSTRAINT migrations_pkey PRIMARY KEY (id);


--
-- Name: objects objects_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT objects_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_pkey PRIMARY KEY (id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_pkey PRIMARY KEY (id);


--
-- Name: vector_indexes vector_indexes_pkey; Type: CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_idempotency_key_key; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_idempotency_key_key UNIQUE (idempotency_key);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: seed_files seed_files_pkey; Type: CONSTRAINT; Schema: supabase_migrations; Owner: -
--

ALTER TABLE ONLY supabase_migrations.seed_files
    ADD CONSTRAINT seed_files_pkey PRIMARY KEY (path);


--
-- Name: audit_logs_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX audit_logs_instance_id_idx ON auth.audit_log_entries USING btree (instance_id);


--
-- Name: confirmation_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX confirmation_token_idx ON auth.users USING btree (confirmation_token) WHERE ((confirmation_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: custom_oauth_providers_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_created_at_idx ON auth.custom_oauth_providers USING btree (created_at);


--
-- Name: custom_oauth_providers_enabled_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_enabled_idx ON auth.custom_oauth_providers USING btree (enabled);


--
-- Name: custom_oauth_providers_identifier_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_identifier_idx ON auth.custom_oauth_providers USING btree (identifier);


--
-- Name: custom_oauth_providers_provider_type_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX custom_oauth_providers_provider_type_idx ON auth.custom_oauth_providers USING btree (provider_type);


--
-- Name: email_change_token_current_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_current_idx ON auth.users USING btree (email_change_token_current) WHERE ((email_change_token_current)::text !~ '^[0-9 ]*$'::text);


--
-- Name: email_change_token_new_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX email_change_token_new_idx ON auth.users USING btree (email_change_token_new) WHERE ((email_change_token_new)::text !~ '^[0-9 ]*$'::text);


--
-- Name: factor_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX factor_id_created_at_idx ON auth.mfa_factors USING btree (user_id, created_at);


--
-- Name: flow_state_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX flow_state_created_at_idx ON auth.flow_state USING btree (created_at DESC);


--
-- Name: identities_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_email_idx ON auth.identities USING btree (email text_pattern_ops);


--
-- Name: INDEX identities_email_idx; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.identities_email_idx IS 'Auth: Ensures indexed queries on the email column';


--
-- Name: identities_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX identities_user_id_idx ON auth.identities USING btree (user_id);


--
-- Name: idx_auth_code; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_auth_code ON auth.flow_state USING btree (auth_code);


--
-- Name: idx_oauth_client_states_created_at; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_oauth_client_states_created_at ON auth.oauth_client_states USING btree (created_at);


--
-- Name: idx_user_id_auth_method; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX idx_user_id_auth_method ON auth.flow_state USING btree (user_id, authentication_method);


--
-- Name: mfa_challenge_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_challenge_created_at_idx ON auth.mfa_challenges USING btree (created_at DESC);


--
-- Name: mfa_factors_user_friendly_name_unique; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX mfa_factors_user_friendly_name_unique ON auth.mfa_factors USING btree (friendly_name, user_id) WHERE (TRIM(BOTH FROM friendly_name) <> ''::text);


--
-- Name: mfa_factors_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX mfa_factors_user_id_idx ON auth.mfa_factors USING btree (user_id);


--
-- Name: oauth_auth_pending_exp_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_auth_pending_exp_idx ON auth.oauth_authorizations USING btree (expires_at) WHERE (status = 'pending'::auth.oauth_authorization_status);


--
-- Name: oauth_clients_deleted_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_clients_deleted_at_idx ON auth.oauth_clients USING btree (deleted_at);


--
-- Name: oauth_consents_active_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_client_idx ON auth.oauth_consents USING btree (client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_active_user_client_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_active_user_client_idx ON auth.oauth_consents USING btree (user_id, client_id) WHERE (revoked_at IS NULL);


--
-- Name: oauth_consents_user_order_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX oauth_consents_user_order_idx ON auth.oauth_consents USING btree (user_id, granted_at DESC);


--
-- Name: one_time_tokens_relates_to_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_relates_to_hash_idx ON auth.one_time_tokens USING hash (relates_to);


--
-- Name: one_time_tokens_token_hash_hash_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX one_time_tokens_token_hash_hash_idx ON auth.one_time_tokens USING hash (token_hash);


--
-- Name: one_time_tokens_user_id_token_type_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX one_time_tokens_user_id_token_type_key ON auth.one_time_tokens USING btree (user_id, token_type);


--
-- Name: reauthentication_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX reauthentication_token_idx ON auth.users USING btree (reauthentication_token) WHERE ((reauthentication_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: recovery_token_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX recovery_token_idx ON auth.users USING btree (recovery_token) WHERE ((recovery_token)::text !~ '^[0-9 ]*$'::text);


--
-- Name: refresh_tokens_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_idx ON auth.refresh_tokens USING btree (instance_id);


--
-- Name: refresh_tokens_instance_id_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_instance_id_user_id_idx ON auth.refresh_tokens USING btree (instance_id, user_id);


--
-- Name: refresh_tokens_parent_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_parent_idx ON auth.refresh_tokens USING btree (parent);


--
-- Name: refresh_tokens_session_id_revoked_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_session_id_revoked_idx ON auth.refresh_tokens USING btree (session_id, revoked);


--
-- Name: refresh_tokens_updated_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX refresh_tokens_updated_at_idx ON auth.refresh_tokens USING btree (updated_at DESC);


--
-- Name: saml_providers_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_providers_sso_provider_id_idx ON auth.saml_providers USING btree (sso_provider_id);


--
-- Name: saml_relay_states_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_created_at_idx ON auth.saml_relay_states USING btree (created_at DESC);


--
-- Name: saml_relay_states_for_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_for_email_idx ON auth.saml_relay_states USING btree (for_email);


--
-- Name: saml_relay_states_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX saml_relay_states_sso_provider_id_idx ON auth.saml_relay_states USING btree (sso_provider_id);


--
-- Name: sessions_not_after_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_not_after_idx ON auth.sessions USING btree (not_after DESC);


--
-- Name: sessions_oauth_client_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_oauth_client_id_idx ON auth.sessions USING btree (oauth_client_id);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sessions_user_id_idx ON auth.sessions USING btree (user_id);


--
-- Name: sso_domains_domain_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_domains_domain_idx ON auth.sso_domains USING btree (lower(domain));


--
-- Name: sso_domains_sso_provider_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_domains_sso_provider_id_idx ON auth.sso_domains USING btree (sso_provider_id);


--
-- Name: sso_providers_resource_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX sso_providers_resource_id_idx ON auth.sso_providers USING btree (lower(resource_id));


--
-- Name: sso_providers_resource_id_pattern_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX sso_providers_resource_id_pattern_idx ON auth.sso_providers USING btree (resource_id text_pattern_ops);


--
-- Name: unique_phone_factor_per_user; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX unique_phone_factor_per_user ON auth.mfa_factors USING btree (user_id, phone);


--
-- Name: user_id_created_at_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX user_id_created_at_idx ON auth.sessions USING btree (user_id, created_at);


--
-- Name: users_email_partial_key; Type: INDEX; Schema: auth; Owner: -
--

CREATE UNIQUE INDEX users_email_partial_key ON auth.users USING btree (email) WHERE (is_sso_user = false);


--
-- Name: INDEX users_email_partial_key; Type: COMMENT; Schema: auth; Owner: -
--

COMMENT ON INDEX auth.users_email_partial_key IS 'Auth: A partial unique index that applies only when is_sso_user is false';


--
-- Name: users_instance_id_email_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_email_idx ON auth.users USING btree (instance_id, lower((email)::text));


--
-- Name: users_instance_id_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_instance_id_idx ON auth.users USING btree (instance_id);


--
-- Name: users_is_anonymous_idx; Type: INDEX; Schema: auth; Owner: -
--

CREATE INDEX users_is_anonymous_idx ON auth.users USING btree (is_anonymous);


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
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_email ON public.users USING btree (email) WHERE (email IS NOT NULL);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role) WHERE (role <> 'patient'::text);


--
-- Name: ix_realtime_subscription_entity; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX ix_realtime_subscription_entity ON realtime.subscription USING btree (entity);


--
-- Name: messages_inserted_at_topic_index; Type: INDEX; Schema: realtime; Owner: -
--

CREATE INDEX messages_inserted_at_topic_index ON ONLY realtime.messages USING btree (inserted_at DESC, topic) WHERE ((extension = 'broadcast'::text) AND (private IS TRUE));


--
-- Name: subscription_subscription_id_entity_filters_action_filter_key; Type: INDEX; Schema: realtime; Owner: -
--

CREATE UNIQUE INDEX subscription_subscription_id_entity_filters_action_filter_key ON realtime.subscription USING btree (subscription_id, entity, filters, action_filter);


--
-- Name: bname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bname ON storage.buckets USING btree (name);


--
-- Name: bucketid_objname; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX bucketid_objname ON storage.objects USING btree (bucket_id, name);


--
-- Name: buckets_analytics_unique_name_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX buckets_analytics_unique_name_idx ON storage.buckets_analytics USING btree (name) WHERE (deleted_at IS NULL);


--
-- Name: idx_multipart_uploads_list; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_multipart_uploads_list ON storage.s3_multipart_uploads USING btree (bucket_id, key, created_at);


--
-- Name: idx_objects_bucket_id_name; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name ON storage.objects USING btree (bucket_id, name COLLATE "C");


--
-- Name: idx_objects_bucket_id_name_lower; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX idx_objects_bucket_id_name_lower ON storage.objects USING btree (bucket_id, lower(name) COLLATE "C");


--
-- Name: name_prefix_search; Type: INDEX; Schema: storage; Owner: -
--

CREATE INDEX name_prefix_search ON storage.objects USING btree (name text_pattern_ops);


--
-- Name: vector_indexes_name_bucket_id_idx; Type: INDEX; Schema: storage; Owner: -
--

CREATE UNIQUE INDEX vector_indexes_name_bucket_id_idx ON storage.vector_indexes USING btree (name, bucket_id);


--
-- Name: users on_auth_user_created; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


--
-- Name: users on_auth_user_updated; Type: TRIGGER; Schema: auth; Owner: -
--

CREATE TRIGGER on_auth_user_updated AFTER UPDATE OF email ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_user_update();


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
-- Name: subscription tr_check_filters; Type: TRIGGER; Schema: realtime; Owner: -
--

CREATE TRIGGER tr_check_filters BEFORE INSERT OR UPDATE ON realtime.subscription FOR EACH ROW EXECUTE FUNCTION realtime.subscription_check_filters();


--
-- Name: buckets enforce_bucket_name_length_trigger; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();


--
-- Name: buckets protect_buckets_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects protect_objects_delete; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();


--
-- Name: objects update_objects_updated_at; Type: TRIGGER; Schema: storage; Owner: -
--

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


--
-- Name: identities identities_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.identities
    ADD CONSTRAINT identities_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: mfa_amr_claims mfa_amr_claims_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_amr_claims
    ADD CONSTRAINT mfa_amr_claims_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: mfa_challenges mfa_challenges_auth_factor_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_challenges
    ADD CONSTRAINT mfa_challenges_auth_factor_id_fkey FOREIGN KEY (factor_id) REFERENCES auth.mfa_factors(id) ON DELETE CASCADE;


--
-- Name: mfa_factors mfa_factors_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.mfa_factors
    ADD CONSTRAINT mfa_factors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_authorizations oauth_authorizations_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_authorizations
    ADD CONSTRAINT oauth_authorizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_client_id_fkey FOREIGN KEY (client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: oauth_consents oauth_consents_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.oauth_consents
    ADD CONSTRAINT oauth_consents_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: one_time_tokens one_time_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.one_time_tokens
    ADD CONSTRAINT one_time_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES auth.sessions(id) ON DELETE CASCADE;


--
-- Name: saml_providers saml_providers_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_providers
    ADD CONSTRAINT saml_providers_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_flow_state_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_flow_state_id_fkey FOREIGN KEY (flow_state_id) REFERENCES auth.flow_state(id) ON DELETE CASCADE;


--
-- Name: saml_relay_states saml_relay_states_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.saml_relay_states
    ADD CONSTRAINT saml_relay_states_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_oauth_client_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_oauth_client_id_fkey FOREIGN KEY (oauth_client_id) REFERENCES auth.oauth_clients(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: sso_domains sso_domains_sso_provider_id_fkey; Type: FK CONSTRAINT; Schema: auth; Owner: -
--

ALTER TABLE ONLY auth.sso_domains
    ADD CONSTRAINT sso_domains_sso_provider_id_fkey FOREIGN KEY (sso_provider_id) REFERENCES auth.sso_providers(id) ON DELETE CASCADE;


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
-- Name: user_verification user_verification_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_verification
    ADD CONSTRAINT user_verification_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: objects objects_bucketId_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.objects
    ADD CONSTRAINT "objects_bucketId_fkey" FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads s3_multipart_uploads_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads
    ADD CONSTRAINT s3_multipart_uploads_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets(id);


--
-- Name: s3_multipart_uploads_parts s3_multipart_uploads_parts_upload_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.s3_multipart_uploads_parts
    ADD CONSTRAINT s3_multipart_uploads_parts_upload_id_fkey FOREIGN KEY (upload_id) REFERENCES storage.s3_multipart_uploads(id) ON DELETE CASCADE;


--
-- Name: vector_indexes vector_indexes_bucket_id_fkey; Type: FK CONSTRAINT; Schema: storage; Owner: -
--

ALTER TABLE ONLY storage.vector_indexes
    ADD CONSTRAINT vector_indexes_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES storage.buckets_vectors(id);


--
-- Name: audit_log_entries; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.audit_log_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: flow_state; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.flow_state ENABLE ROW LEVEL SECURITY;

--
-- Name: identities; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.identities ENABLE ROW LEVEL SECURITY;

--
-- Name: instances; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.instances ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_amr_claims; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_amr_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_challenges; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: mfa_factors; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.mfa_factors ENABLE ROW LEVEL SECURITY;

--
-- Name: one_time_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.one_time_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: refresh_tokens; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.refresh_tokens ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: saml_relay_states; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.saml_relay_states ENABLE ROW LEVEL SECURITY;

--
-- Name: schema_migrations; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.schema_migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: sessions; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_domains; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_domains ENABLE ROW LEVEL SECURITY;

--
-- Name: sso_providers; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.sso_providers ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: auth; Owner: -
--

ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

--
-- Name: appeals Allow appeal inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow appeal inserts" ON public.appeals FOR INSERT WITH CHECK (((conversation_id IS NOT NULL) AND (appeal_letter IS NOT NULL)));


--
-- Name: messages Allow message inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow message inserts" ON public.messages FOR INSERT WITH CHECK ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations)));


--
-- Name: messages Allow message reads; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow message reads" ON public.messages FOR SELECT USING ((conversation_id IN ( SELECT conversations.id
   FROM public.conversations)));


--
-- Name: appeal_levels Allow public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access" ON public.appeal_levels FOR SELECT USING (true);


--
-- Name: denial_patterns Allow public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access" ON public.denial_patterns FOR SELECT USING (true);


--
-- Name: usage Allow usage inserts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow usage inserts" ON public.usage FOR INSERT TO authenticated WITH CHECK ((email IS NOT NULL));


--
-- Name: conversation_patterns Anyone can read conversation patterns; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read conversation patterns" ON public.conversation_patterns FOR SELECT USING (true);


--
-- Name: coverage_paths Anyone can read coverage paths; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read coverage paths" ON public.coverage_paths FOR SELECT USING (true);


--
-- Name: policy_cache Anyone can read policy cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read policy cache" ON public.policy_cache FOR SELECT USING (true);


--
-- Name: procedure_mappings Anyone can read procedure mappings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read procedure mappings" ON public.procedure_mappings FOR SELECT USING (true);


--
-- Name: symptom_mappings Anyone can read symptom mappings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read symptom mappings" ON public.symptom_mappings FOR SELECT USING (true);


--
-- Name: counselor_cases Counselors see own cases; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Counselors see own cases" ON public.counselor_cases USING ((auth.uid() = counselor_id));


--
-- Name: provider_practices Providers see own practice; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Providers see own practice" ON public.provider_practices USING ((auth.uid() = user_id));


--
-- Name: blog_posts Public can read published posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read published posts" ON public.blog_posts FOR SELECT USING ((published = true));


--
-- Name: carc_codes Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON public.carc_codes FOR SELECT USING (true);


--
-- Name: eob_denial_mappings Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON public.eob_denial_mappings FOR SELECT USING (true);


--
-- Name: landing_content Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON public.landing_content FOR SELECT USING ((is_published = true));


--
-- Name: pricing_plans Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON public.pricing_plans FOR SELECT USING ((is_active = true));


--
-- Name: rarc_codes Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON public.rarc_codes FOR SELECT USING (true);


--
-- Name: site_settings Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON public.site_settings FOR SELECT USING (true);


--
-- Name: testimonials Public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access" ON public.testimonials FOR SELECT USING ((is_published = true));


--
-- Name: audit_logs Service role can insert audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can insert audit logs" ON public.audit_logs FOR INSERT WITH CHECK (true);


--
-- Name: diabetes_snapshots Service role inserts snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role inserts snapshots" ON public.diabetes_snapshots FOR INSERT WITH CHECK (true);


--
-- Name: diabetes_insights Service role manages insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role manages insights" ON public.diabetes_insights USING (true) WITH CHECK (true);


--
-- Name: learning_queue Service role only - delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only - delete" ON public.learning_queue FOR DELETE USING (((auth.role() = 'service_role'::text) OR (CURRENT_USER = 'postgres'::name)));


--
-- Name: learning_queue Service role only - insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only - insert" ON public.learning_queue FOR INSERT WITH CHECK (((auth.role() = 'service_role'::text) OR (CURRENT_USER = 'postgres'::name)));


--
-- Name: learning_queue Service role only - select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only - select" ON public.learning_queue FOR SELECT USING (((auth.role() = 'service_role'::text) OR (CURRENT_USER = 'postgres'::name)));


--
-- Name: learning_queue Service role only - update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role only - update" ON public.learning_queue FOR UPDATE USING (((auth.role() = 'service_role'::text) OR (CURRENT_USER = 'postgres'::name)));


--
-- Name: diabetes_log Users CRUD own log entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users CRUD own log entries" ON public.diabetes_log USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: fhir_cache Users can delete own FHIR cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own FHIR cache" ON public.fhir_cache FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: conversations Users can insert conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert conversations" ON public.conversations FOR INSERT WITH CHECK ((((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR ((auth.uid() IS NULL) AND (user_id IS NULL))));


--
-- Name: user_feedback Users can insert feedback on own conversation messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert feedback on own conversation messages" ON public.user_feedback FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: consent_preferences Users can insert own consent; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own consent" ON public.consent_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: users Users can insert own row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own row" ON public.users FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));


--
-- Name: subscriptions Users can insert own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own subscriptions" ON public.subscriptions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: appeal_outcomes Users can read own appeal outcomes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own appeal outcomes" ON public.appeal_outcomes FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.phone = appeal_outcomes.phone) AND (users.id = auth.uid())))));


--
-- Name: appeals Users can read own appeals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own appeals" ON public.appeals FOR SELECT USING (((auth.uid() = user_id) OR ((auth.uid() IS NULL) AND (user_id IS NULL)) OR (conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid())))));


--
-- Name: audit_logs Users can read own audit logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own audit logs" ON public.audit_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: consent_preferences Users can read own consent; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own consent" ON public.consent_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: conversations Users can read own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own conversations" ON public.conversations FOR SELECT USING ((((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)) OR ((auth.uid() IS NULL) AND (user_id IS NULL))));


--
-- Name: user_events Users can read own events; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own events" ON public.user_events FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.phone = user_events.phone) AND (users.id = auth.uid())))));


--
-- Name: user_feedback Users can read own feedback; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own feedback" ON public.user_feedback FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: users Users can read own row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own row" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: subscriptions Users can read own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own subscriptions" ON public.subscriptions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: usage Users can read own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own usage" ON public.usage FOR SELECT USING (((auth.uid() = user_id) OR (email = (auth.jwt() ->> 'email'::text))));


--
-- Name: user_verification Users can read own verification; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read own verification" ON public.user_verification FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: appeals Users can update own appeals; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own appeals" ON public.appeals FOR UPDATE USING (((auth.uid() = user_id) OR ((auth.uid() IS NOT NULL) AND (user_id IS NULL) AND (conversation_id IN ( SELECT conversations.id
   FROM public.conversations
  WHERE (conversations.user_id = auth.uid())))))) WITH CHECK (((auth.uid() = user_id) OR ((auth.uid() IS NOT NULL) AND (auth.uid() = user_id))));


--
-- Name: consent_preferences Users can update own consent; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own consent" ON public.consent_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: conversations Users can update own conversations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (((auth.uid() IS NOT NULL) AND ((auth.uid() = user_id) OR (user_id IS NULL)))) WITH CHECK (((auth.uid() IS NOT NULL) AND (auth.uid() = user_id)));


--
-- Name: users Users can update own row; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own row" ON public.users FOR UPDATE USING ((auth.uid() = id));


--
-- Name: subscriptions Users can update own subscriptions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own subscriptions" ON public.subscriptions FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: usage Users can update own usage; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own usage" ON public.usage FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: ehr_connections Users can view own EHR connections; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own EHR connections" ON public.ehr_connections FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: fhir_cache Users can view own FHIR cache; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own FHIR cache" ON public.fhir_cache FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: diabetes_insights Users read own insights; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own insights" ON public.diabetes_insights FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: diabetes_snapshots Users read own snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users read own snapshots" ON public.diabetes_snapshots FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: appeal_levels; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appeal_levels ENABLE ROW LEVEL SECURITY;

--
-- Name: appeal_outcomes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appeal_outcomes ENABLE ROW LEVEL SECURITY;

--
-- Name: appeals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.appeals ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: blog_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: carc_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carc_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: chat_daily_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.chat_daily_usage ENABLE ROW LEVEL SECURITY;

--
-- Name: consent_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.consent_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_patterns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_patterns ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: counselor_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.counselor_cases ENABLE ROW LEVEL SECURITY;

--
-- Name: coverage_paths; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coverage_paths ENABLE ROW LEVEL SECURITY;

--
-- Name: denial_patterns; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.denial_patterns ENABLE ROW LEVEL SECURITY;

--
-- Name: diabetes_insights; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diabetes_insights ENABLE ROW LEVEL SECURITY;

--
-- Name: diabetes_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diabetes_log ENABLE ROW LEVEL SECURITY;

--
-- Name: diabetes_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.diabetes_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: ehr_connections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ehr_connections ENABLE ROW LEVEL SECURITY;

--
-- Name: eob_denial_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eob_denial_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: fhir_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fhir_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: landing_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.landing_content ENABLE ROW LEVEL SECURITY;

--
-- Name: learning_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.learning_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: outcome_followups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.outcome_followups ENABLE ROW LEVEL SECURITY;

--
-- Name: policy_cache; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.policy_cache ENABLE ROW LEVEL SECURITY;

--
-- Name: pricing_plans; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

--
-- Name: procedure_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.procedure_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: provider_practices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider_practices ENABLE ROW LEVEL SECURITY;

--
-- Name: rarc_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rarc_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: symptom_mappings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.symptom_mappings ENABLE ROW LEVEL SECURITY;

--
-- Name: testimonials; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

--
-- Name: usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

--
-- Name: user_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

--
-- Name: user_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: user_verification; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_verification ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: realtime; Owner: -
--

ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_analytics; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_analytics ENABLE ROW LEVEL SECURITY;

--
-- Name: buckets_vectors; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.buckets_vectors ENABLE ROW LEVEL SECURITY;

--
-- Name: migrations; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.migrations ENABLE ROW LEVEL SECURITY;

--
-- Name: objects; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads ENABLE ROW LEVEL SECURITY;

--
-- Name: s3_multipart_uploads_parts; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.s3_multipart_uploads_parts ENABLE ROW LEVEL SECURITY;

--
-- Name: vector_indexes; Type: ROW SECURITY; Schema: storage; Owner: -
--

ALTER TABLE storage.vector_indexes ENABLE ROW LEVEL SECURITY;

--
-- Name: supabase_realtime; Type: PUBLICATION; Schema: -; Owner: -
--

CREATE PUBLICATION supabase_realtime WITH (publish = 'insert, update, delete, truncate');


--
-- Name: issue_graphql_placeholder; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_graphql_placeholder ON sql_drop
         WHEN TAG IN ('DROP EXTENSION')
   EXECUTE FUNCTION extensions.set_graphql_placeholder();


--
-- Name: issue_pg_cron_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_cron_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_cron_access();


--
-- Name: issue_pg_graphql_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_graphql_access ON ddl_command_end
         WHEN TAG IN ('CREATE FUNCTION')
   EXECUTE FUNCTION extensions.grant_pg_graphql_access();


--
-- Name: issue_pg_net_access; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER issue_pg_net_access ON ddl_command_end
         WHEN TAG IN ('CREATE EXTENSION')
   EXECUTE FUNCTION extensions.grant_pg_net_access();


--
-- Name: pgrst_ddl_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_ddl_watch ON ddl_command_end
   EXECUTE FUNCTION extensions.pgrst_ddl_watch();


--
-- Name: pgrst_drop_watch; Type: EVENT TRIGGER; Schema: -; Owner: -
--

CREATE EVENT TRIGGER pgrst_drop_watch ON sql_drop
   EXECUTE FUNCTION extensions.pgrst_drop_watch();


--
-- PostgreSQL database dump complete
--

\unrestrict 3TFe9OhYUeZhWnn6jSFaVSHMppQ6Vz707bJ8raHsiibZdHLy5CVB7IDEbmWsBde

