> **Archived — May 24, 2026:** Superseded by `docs/design/denali-design-v1.1.md` and `CLAUDE.md`. Describes pre-AWS-migration architecture (Supabase, Vercel, RLS) that no longer applies. Preserved as historical record.

---

# Denali.health - Complete Application Tree

This document maps the entire PWA structure: screens, user flows, database tables, learning triggers, and agentic logic.

---

## Application Architecture

```
denali.health/
├── 🏠 Landing Page (Public)
├── 💬 Chat Interface (Core)
│   ├── Coverage Guidance Flow (Free, No Auth)
│   └── Appeal Flow (Requires Phone OTP)
├── 👤 Account Management
│   ├── Authentication (OTP)
│   ├── Settings
│   └── History
├── 💳 Payments (Stripe)
└── 🧠 Agentic Learning System (Background)
```

---

## Screen Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DENALI.HEALTH PWA                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📱 PUBLIC (No Auth Required)                                               │
│  │                                                                          │
│  ├── 00-landing-page.svg ─────────────────────────────────────────────────┐│
│  │   • Marketing page                                                      ││
│  │   • "Get Started" → Welcome                                             ││
│  │   • DB: None                                                            ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  ├── 01-welcome.svg / 01-welcome-light.svg ───────────────────────────────┐│
│  │   • App entry point (after PWA install)                                 ││
│  │   • "Ask about coverage" → Coverage Flow                                ││
│  │   • "Help with a denial" → Appeal Flow                                  ││
│  │   • Theme: Auto/Light/Dark                                              ││
│  │   • DB: conversations (device_fingerprint only)                         ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  └── 16-tablet-welcome.svg ───────────────────────────────────────────────┐│
│      • Tablet-optimized welcome (768x1024)                                 ││
│      • Same logic as mobile welcome                                        ││
│      └────────────────────────────────────────────────────────────────────┘│
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  💬 COVERAGE GUIDANCE FLOW (Free, Unlimited, No Auth)                       │
│  │                                                                          │
│  ├── 02-conversation-intake.svg ──────────────────────────────────────────┐│
│  │   • User describes situation in plain English                           ││
│  │   • "My mom needs a scan for her back pain"                             ││
│  │   • DB: conversations, messages                                         ││
│  │   • Learning: Extract symptoms → queue mapping updates                  ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 03-loading-coverage-check.svg ───────────────────────────────────────┐│
│  │   • MCP calls: CMS Coverage, ICD-10, NPI Registry                       ││
│  │   • Shows: "Checking Medicare policies..."                              ││
│  │   • DB: None (processing state)                                         ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 10a-provider-zip-ask.svg (Optional) ─────────────────────────────────┐│
│  │   • "What's your ZIP code?"                                             ││
│  │   • Needed to find local providers                                      ││
│  │   • DB: None                                                            ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 10-provider-lookup.svg / 10b-provider-multi-select.svg ──────────────┐│
│  │   • NPI search by name + location                                       ││
│  │   • Multi-select if multiple matches                                    ││
│  │   • DB: messages.npi                                                    ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  └── 04-guidance-output.svg ──────────────────────────────────────────────┐│
│      • Coverage determination                                              ││
│      • Documentation checklist                                             ││
│      • "Medicare usually covers... but needs these documented..."          ││
│      • 👍/👎 feedback buttons                                              ││
│      • DB: messages (icd10_codes, cpt_codes, policy_refs)                  ││
│      • Learning: Store successful coverage path                            ││
│      └────────────────────────────────────────────────────────────────────┘│
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📝 APPEAL FLOW (Requires Phone OTP for Letter)                             │
│  │                                                                          │
│  ├── 06-appeal-denied-claim.svg ──────────────────────────────────────────┐│
│  │   • User describes denial                                               ││
│  │   • "Medicare denied my MRI, help me appeal"                            ││
│  │   • Gather: denial date, reason, procedure                              ││
│  │   • DB: conversations (is_appeal=true), messages                        ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 15-denial-not-covered.svg (Branch) ──────────────────────────────────┐│
│  │   • If service is truly not covered                                     ││
│  │   • "Unfortunately, Medicare doesn't cover this service..."             ││
│  │   • Suggest alternatives if any                                         ││
│  │   • DB: messages                                                        ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 07-appeal-letter-generator.svg ──────────────────────────────────────┐│
│  │   • Claude generates appeal letter (hidden)                             ││
│  │   • Shows preview: "Your appeal letter is ready!"                       ││
│  │   • DB: appeals (status='draft', letter NOT shown yet)                  ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  │  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  │              GATE: Check appeal_count for phone                   │   │
│  │  │  ┌─────────────────┬─────────────────┬─────────────────┐         │   │
│  │  │  │ No phone (new)  │ appeal_count=0  │ appeal_count≥1  │         │   │
│  │  │  │       ↓         │       ↓         │       ↓         │         │   │
│  │  │  │  Signup Wall    │  Show Letter    │   Check Sub     │         │   │
│  │  │  │  (17-signup)    │  (FREE!)        │       ↓         │         │   │
│  │  │  └────────┬────────┴────────┬────────┴────────┬────────┘         │   │
│  │  │           │                 │                 │                   │   │
│  │  │           ▼                 │           ┌─────┴─────┐             │   │
│  │  │    18-mobile-otp.svg        │           │           │             │   │
│  │  │           │                 │        Has Sub    No Sub            │   │
│  │  │           ▼                 │           ↓           ↓             │   │
│  │  │    Show Letter (FREE)       │      Show Letter  05-paywall        │   │
│  │  └──────────────────────────────────────────────────────────────────┘   │
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 17-signup-wall.svg ──────────────────────────────────────────────────┐│
│  │   • "Your Appeal Letter is Ready!"                                      ││
│  │   • "Enter your phone number to view it — it's free"                    ││
│  │   • Phone number input                                                  ││
│  │   • DB: None (pre-auth state)                                           ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 18-mobile-otp.svg ───────────────────────────────────────────────────┐│
│  │   • 6-digit SMS code input                                              ││
│  │   • "Didn't receive code? Resend"                                       ││
│  │   • DB: users (created), user_verification (phone_verified=true)        ││
│  │   │   └── usage (phone, appeal_count=0)                                 ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 05-paywall.svg (If appeal_count ≥ 1) ────────────────────────────────┐│
│  │   • "You've used your free appeal"                                      ││
│  │   • Option A: $10 for this appeal                                       ││
│  │   • Option B: $25/month unlimited                                       ││
│  │   • DB: Check usage.appeal_count, subscriptions.status                  ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │    ┌────┴────┐                                                           │
│  │    ▼         ▼                                                           │
│  │  $10       $25/month                                                     │
│  │    │         │                                                           │
│  │    │         ▼                                                           │
│  │    │  13a-otp-email.svg ───────────────────────────────────────────────┐│
│  │    │   • Email required for subscription                                ││
│  │    │   • Account recovery + Stripe receipts                             ││
│  │    │   • DB: users.email, user_verification.email_verified              ││
│  │    │   └────────────────────────────────────────────────────────────────┘│
│  │    │         │                                                           │
│  │    ▼         ▼                                                           │
│  │  [Stripe Checkout] ────────────────────────────────────────────────────┐│
│  │   • One-time ($10) or Subscription ($25)                                ││
│  │   • DB: subscriptions (stripe_customer_id, status)                      ││
│  │   │   └── appeals (paid=true, stripe_payment_id)                        ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  └── [Appeal Letter Revealed] ────────────────────────────────────────────┐│
│      • Full letter with citations                                          ││
│      • Print / Copy / Download / Share                                     ││
│      • "Report outcome" button (for learning)                              ││
│      • DB: appeals (status='sent'), usage.appeal_count++                   ││
│      • Learning: Store coverage path, track print/copy events              ││
│      └────────────────────────────────────────────────────────────────────┘│
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  👤 ACCOUNT & SETTINGS (Requires Auth)                                      │
│  │                                                                          │
│  ├── 12-onboarding-auth.svg ──────────────────────────────────────────────┐│
│  │   • "Continue with Phone" / "Continue with Email"                       ││
│  │   • Phone is primary, email for paid tier                               ││
│  │   • DB: auth.users                                                      ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │         │                                                                │
│  │         ▼                                                                │
│  ├── 13-otp-verification.svg / 13b-otp-mobile.svg ────────────────────────┐│
│  │   • OTP code entry                                                      ││
│  │   • DB: user_verification                                               ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  ├── 08-history.svg ──────────────────────────────────────────────────────┐│
│  │   • Past conversations and appeals                                      ││
│  │   • Tap to continue conversation                                        ││
│  │   • DB: SELECT FROM conversations WHERE user_id = auth.uid()            ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  ├── 09-account-settings.svg ─────────────────────────────────────────────┐│
│  │   • Profile info                                                        ││
│  │   • Subscription management                                             ││
│  │   • Notifications toggle                                                ││
│  │   • Theme selection                                                     ││
│  │   • "Delete Account" (danger zone)                                      ││
│  │   • DB: users, subscriptions                                            ││
│  │   └────────────────────────────────────────────────────────────────────┘│
│  │                                                                          │
│  └── 14-accessibility-settings.svg ───────────────────────────────────────┐│
│      • Text size slider (0.8x - 1.5x)                                      ││
│      • High contrast toggle                                                ││
│      • Reduce motion toggle                                                ││
│      • Autoplay media toggle                                               ││
│      • VoiceOver optimization                                              ││
│      • DB: users (text_size, high_contrast, reduce_motion, etc.)           ││
│      └────────────────────────────────────────────────────────────────────┘│
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⚠️ ERROR STATES                                                            │
│  │                                                                          │
│  └── 11-error-offline.svg ────────────────────────────────────────────────┐│
│      • "You're offline"                                                    ││
│      • Retry button                                                        ││
│      • Cached content still accessible                                     ││
│      └────────────────────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Table Mapping

### By User Journey Stage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DATABASE USAGE BY FLOW                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ANONYMOUS USER (Coverage Guidance)                                         │
│  ────────────────────────────────────                                       │
│  conversations ←── device_fingerprint (analytics only)                      │
│       │                                                                     │
│       └── messages ←── content, icd10_codes, cpt_codes, policy_refs         │
│                                                                             │
│  LEARNING (No User Link):                                                   │
│  • symptom_mappings ←── phrase → icd10_code (confidence++)                  │
│  • procedure_mappings ←── phrase → cpt_code (confidence++)                  │
│  • coverage_paths ←── successful code combinations                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FREE USER (After Phone OTP)                                                │
│  ───────────────────────────                                                │
│  users ←── phone (PRIMARY), plan='free'                                     │
│       │                                                                     │
│       ├── user_verification ←── phone_verified=true                         │
│       │                                                                     │
│       ├── usage ←── phone, appeal_count (0 → 1)                             │
│       │                                                                     │
│       └── conversations ←── user_id, phone                                  │
│                │                                                            │
│                ├── messages                                                 │
│                │                                                            │
│                └── appeals ←── phone, appeal_letter, paid=false             │
│                                                                             │
│  LEARNING:                                                                  │
│  • user_feedback ←── message_id, rating, correction                         │
│  • user_events ←── phone, event_type (print, copy, download)                │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PAID USER ($10 or $25/month)                                               │
│  ───────────────────────────                                                │
│  users ←── phone, email, plan='per_appeal' or 'unlimited'                   │
│       │                                                                     │
│       ├── user_verification ←── phone_verified=true, email_verified=true    │
│       │                                                                     │
│       ├── subscriptions ←── stripe_customer_id, status='active'             │
│       │                                                                     │
│       ├── usage ←── phone, appeal_count (unlimited)                         │
│       │                                                                     │
│       └── conversations                                                     │
│                │                                                            │
│                ├── messages                                                 │
│                │                                                            │
│                └── appeals ←── paid=true, stripe_payment_id                 │
│                                                                             │
│  LEARNING:                                                                  │
│  • appeal_outcomes ←── outcome, denial_reason, documentation_gaps           │
│  • user_events ←── upgrade, cancel events                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## SQL Functions by Use Case

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        FUNCTION CALL MAPPING                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  APPEAL ACCESS CHECK (Before showing letter)                                │
│  ──────────────────────────────────────────────                             │
│                                                                             │
│  check_appeal_access(phone) → 'free' | 'paywall' | 'allowed'                │
│       │                                                                     │
│       ├── 'free' → Show letter, then increment_appeal_count(phone)          │
│       ├── 'paywall' → Show 05-paywall.svg                                   │
│       └── 'allowed' → Show letter (subscription active)                     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  APPEAL COUNT MANAGEMENT                                                    │
│  ──────────────────────────                                                 │
│                                                                             │
│  get_appeal_count(phone) → INTEGER                                          │
│       └── Returns 0 for new users                                           │
│                                                                             │
│  increment_appeal_count(phone, user_id?, device_fingerprint?) → INTEGER     │
│       └── Inserts or updates usage table, returns new count                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FEEDBACK & LEARNING                                                        │
│  ──────────────────────                                                     │
│                                                                             │
│  process_feedback(message_id, 'up'|'down', correction?)                     │
│       │                                                                     │
│       ├── 'up' → confidence += 0.1 for all mappings in conversation         │
│       └── 'down' → confidence -= 0.15, queue review if correction given     │
│                                                                             │
│  update_symptom_mapping(phrase, icd10, description?, boost?)                │
│       └── Upsert with confidence adjustment                                 │
│                                                                             │
│  update_procedure_mapping(phrase, cpt, description?, boost?)                │
│       └── Upsert with confidence adjustment                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OUTCOME TRACKING (User reports appeal result)                              │
│  ────────────────────────────────────────────                               │
│                                                                             │
│  record_appeal_outcome(appeal_id, outcome, denial_reason?, gaps?, ...)      │
│       │                                                                     │
│       ├── Stores in appeal_outcomes                                         │
│       ├── Updates appeals.status                                            │
│       ├── Calls update_coverage_path()                                      │
│       ├── Queues learning job                                               │
│       └── Tracks user_event                                                 │
│                                                                             │
│  update_coverage_path(icd10[], cpt[], ncd[], lcd[], outcome, gaps?)         │
│       └── Updates coverage_paths success/failure rates                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LEARNING SYSTEM (Background)                                               │
│  ────────────────────────────                                               │
│                                                                             │
│  queue_learning_job(type, data, priority) → UUID                            │
│       └── Types: update_symptom_mapping, analyze_outcome_pattern, etc.      │
│                                                                             │
│  claim_learning_job() → (job_id, job_type, job_data)                        │
│       └── Worker claims next pending job                                    │
│                                                                             │
│  complete_learning_job(job_id, success, error?)                             │
│       └── Mark job done                                                     │
│                                                                             │
│  get_learning_context(symptoms?, procedures?, limit) → JSONB                │
│       └── Returns mappings + paths for Claude prompts                       │
│                                                                             │
│  prune_weak_mappings(threshold?, days?) → TABLE                             │
│       └── Nightly cleanup of low-confidence mappings                        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER EVENTS (Analytics)                                                    │
│  ───────────────────────                                                    │
│                                                                             │
│  track_user_event(phone, type, data?, conversation_id?, appeal_id?, ...)    │
│       └── Types: print, copy, download, share, upgrade, cancel, etc.        │
│                                                                             │
│  update_conversation_pattern(trigger, intent, sequence, was_successful)     │
│       └── Learn optimal question flows                                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ACCOUNT DELETION (GDPR/CCPA)                                               │
│  ────────────────────────────                                               │
│                                                                             │
│  delete_user_cascade(user_id)                                               │
│       │                                                                     │
│       ├── Delete: user_feedback, appeals, messages, conversations           │
│       ├── Delete: usage, subscriptions, user_verification, users            │
│       └── Retain: symptom_mappings, procedure_mappings, coverage_paths      │
│                   (anonymized learning data)                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Agentic Learning Triggers

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LEARNING TRIGGER POINTS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ① EVERY MESSAGE                                                            │
│  ─────────────────                                                          │
│  User says: "My back is killing me"                                         │
│       │                                                                     │
│       ├── Extract entities: "back pain" → M54.5                             │
│       ├── queue_learning_job('update_symptom_mapping', {...})               │
│       └── symptom_mappings.confidence += 0.05                               │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ② FEEDBACK (👍/👎)                                                          │
│  ─────────────────                                                          │
│  User taps 👍 on guidance message                                           │
│       │                                                                     │
│       ├── process_feedback(message_id, 'up')                                │
│       ├── All mappings in conversation: confidence += 0.1                   │
│       └── conversation_patterns: success_rate += 0.1                        │
│                                                                             │
│  User taps 👎 with correction: "No, it's kidney pain"                       │
│       │                                                                     │
│       ├── process_feedback(message_id, 'down', 'kidney pain')               │
│       ├── Original mapping: confidence -= 0.15                              │
│       ├── queue_learning_job('analyze_outcome_pattern', {...})              │
│       └── New mapping created: "back is killing me" → N23 (renal)           │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ③ APPEAL LETTER GENERATED                                                  │
│  ────────────────────────────                                               │
│  Appeal letter created with codes and citations                             │
│       │                                                                     │
│       ├── Store coverage path: M54.5 + 72148 + LCD L12345 → pending         │
│       ├── track_user_event(phone, 'appeal_completed', {...})                │
│       └── Await outcome report for learning                                 │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ④ USER REPORTS OUTCOME                                                     │
│  ────────────────────────                                                   │
│  User returns: "My appeal was approved!"                                    │
│       │                                                                     │
│       ├── record_appeal_outcome(appeal_id, 'approved', ...)                 │
│       ├── coverage_paths: M54.5 + 72148 → outcome = 'approved'              │
│       ├── Mappings used: confidence += 0.15                                 │
│       └── Queue pattern analysis for learning                               │
│                                                                             │
│  User returns: "They denied it again..."                                    │
│       │                                                                     │
│       ├── record_appeal_outcome(appeal_id, 'denied', reason, gaps)          │
│       ├── coverage_paths: outcome = 'denied'                                │
│       ├── Mappings used: confidence -= 0.1                                  │
│       └── Learn from denial_reason and documentation_gaps                   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⑤ CONTENT ACTIONS                                                          │
│  ─────────────────                                                          │
│  User prints appeal letter                                                  │
│       └── track_user_event(phone, 'print', {appeal_id})                     │
│                                                                             │
│  User copies appeal letter                                                  │
│       └── track_user_event(phone, 'copy', {appeal_id})                      │
│                                                                             │
│  User downloads appeal letter                                               │
│       └── track_user_event(phone, 'download', {appeal_id})                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ⑥ NIGHTLY BATCH JOBS                                                       │
│  ────────────────────                                                       │
│  Scheduled function runs at 2am                                             │
│       │                                                                     │
│       ├── Process learning_queue (pending jobs)                             │
│       ├── prune_weak_mappings(0.3, 90) — remove low-confidence              │
│       ├── Aggregate conversation_patterns                                   │
│       ├── Check policy_cache for CMS updates                                │
│       └── Generate learning metrics report                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## RLS Policy Mapping

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROW LEVEL SECURITY                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER DATA (Requires auth.uid())                                            │
│  ────────────────────────────────                                           │
│  users              → SELECT/UPDATE own row (auth.uid() = id)               │
│  user_verification  → SELECT own row (auth.uid() = user_id)                 │
│  subscriptions      → SELECT own row (auth.uid() = user_id)                 │
│  usage              → SELECT own row (auth.uid() = user_id)                 │
│  conversations      → SELECT/INSERT/UPDATE own (auth.uid() = user_id)       │
│  messages           → SELECT/INSERT via conversation ownership              │
│  appeals            → SELECT/INSERT/UPDATE own (auth.uid() = user_id)       │
│  user_feedback      → SELECT/INSERT on own conversation messages            │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  LEARNING DATA (Public read, system write)                                  │
│  ──────────────────────────────────────────                                 │
│  symptom_mappings      → SELECT: anyone | INSERT/UPDATE: service role only  │
│  procedure_mappings    → SELECT: anyone | INSERT/UPDATE: service role only  │
│  coverage_paths        → SELECT: anyone | INSERT/UPDATE: service role only  │
│  conversation_patterns → SELECT: anyone | INSERT/UPDATE: service role only  │
│  policy_cache          → SELECT: anyone | INSERT/UPDATE: service role only  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  USER-LINKED LEARNING (Own data only)                                       │
│  ────────────────────────────────────                                       │
│  appeal_outcomes → SELECT where users.phone = appeal_outcomes.phone         │
│  user_events     → SELECT where users.phone = user_events.phone             │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SYSTEM ONLY (No client access)                                             │
│  ──────────────────────────────                                             │
│  learning_queue → No policies (service role only via Edge Functions)        │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ANONYMOUS ACCESS PATTERN                                                   │
│  ───────────────────────                                                    │
│  Coverage guidance (no auth) works via Edge Functions:                      │
│  1. Client sends device_fingerprint                                         │
│  2. Edge Function uses service role key (bypasses RLS)                      │
│  3. Creates conversation with user_id=NULL                                  │
│  4. RLS INSERT policy allows user_id IS NULL for Edge Functions             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Reference

### Documentation Files
| File | Purpose |
|------|---------|
| `README.md` | Project overview |
| `01-scope.md` | Project scope and features |
| `02-user-flow.md` | User journey descriptions |
| `03-architecture.md` | Technical architecture |
| `04-skills.md` | Claude capabilities |
| `05-database.md` | Database schema docs |
| `06-business.md` | Pricing and business model |
| `07-ui.md` | UI/UX guidelines |
| `08-learning.md` | Agentic learning system |
| `09-app-tree.md` | This file - complete app mapping |

### Mockup Files (24 total)
| File | Screen | Auth Required |
|------|--------|---------------|
| `00-landing-page.svg` | Marketing landing | No |
| `01-welcome.svg` | App entry (dark) | No |
| `01-welcome-light.svg` | App entry (light) | No |
| `02-conversation-intake.svg` | Chat input | No |
| `03-loading-coverage-check.svg` | Loading state | No |
| `04-guidance-output.svg` | Coverage result | No |
| `05-paywall.svg` | Payment wall | Phone OTP |
| `06-appeal-denied-claim.svg` | Appeal intake | No |
| `07-appeal-letter-generator.svg` | Letter preview | Phone OTP |
| `08-history.svg` | Conversation history | Phone OTP |
| `09-account-settings.svg` | Settings | Phone OTP |
| `10-provider-lookup.svg` | NPI search | No |
| `10a-provider-zip-ask.svg` | ZIP input | No |
| `10b-provider-multi-select.svg` | Provider select | No |
| `11-error-offline.svg` | Offline error | No |
| `12-onboarding-auth.svg` | Auth options | No |
| `13-otp-verification.svg` | OTP entry | No |
| `13a-otp-email.svg` | Email OTP | Phone OTP |
| `13b-otp-mobile.svg` | Phone OTP | No |
| `14-accessibility-settings.svg` | A11y settings | Phone OTP |
| `15-denial-not-covered.svg` | Not covered | No |
| `16-tablet-welcome.svg` | Tablet welcome | No |
| `17-signup-wall.svg` | Phone signup | No |
| `18-mobile-otp.svg` | Phone verify | No |

### SQL Files
| File | Purpose |
|------|---------|
| `sql/001-schema.sql` | Complete database schema |

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DENALI.HEALTH AT A GLANCE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 TOTALS                                                                  │
│  ────────                                                                   │
│  • 24 SVG mockups                                                           │
│  • 16 database tables                                                       │
│  • 17 SQL functions                                                         │
│  • 39 indexes                                                               │
│  • 22 RLS policies                                                          │
│  • 10 documentation files                                                   │
│                                                                             │
│  💰 PRICING                                                                 │
│  ─────────                                                                  │
│  • Coverage guidance: FREE (unlimited, no signup)                           │
│  • First appeal: FREE (phone OTP required)                                  │
│  • Additional appeals: $10 each OR $25/month unlimited                      │
│                                                                             │
│  🔐 AUTH                                                                    │
│  ──────                                                                     │
│  • Phone OTP: Primary identifier, required for appeals                      │
│  • Email OTP: Required for $25/month subscription only                      │
│  • Device fingerprint: Analytics only, not for gating                       │
│                                                                             │
│  🧠 LEARNING                                                                │
│  ──────────                                                                 │
│  • Symptom mappings: phrase → ICD-10 (confidence-based)                     │
│  • Procedure mappings: phrase → CPT (confidence-based)                      │
│  • Coverage paths: successful code combinations                             │
│  • Appeal outcomes: real-world results                                      │
│  • Conversation patterns: optimal question sequences                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
