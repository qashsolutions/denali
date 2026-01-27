# Denali.health — Claude Configuration

> **PWA webapp** | **Agentic AI** | **Use required SKILL.md files for each feature**

This is a Medicare claims intelligence platform. Claude is the brain — driving conversations, calling tools, synthesizing guidance, and learning from every interaction.

---

## Table of Contents

1. [Identity & Mission](#1-identity--mission)
2. [Architecture](#2-architecture)
3. [Skills System](#3-skills-system)
   - [Skills Directory](#31-skills-directory)
   - [Skill Registry & Triggers](#32-skill-registry--triggers)
   - [Skill Definitions](#33-skill-definitions)
   - [Skill Flow Example](#34-skill-flow-example)
4. [Database Schema](#4-database-schema)
   - [Core Tables](#41-core-tables)
   - [Learning Tables](#42-learning-tables)
   - [Key Functions](#43-key-functions)
5. [Business Model](#5-business-model)
   - [Pricing Plans](#51-pricing-plans)
   - [Auth Requirements](#52-auth-requirements)
   - [Gating Logic](#53-gating-logic)
6. [User Flows](#6-user-flows)
   - [Coverage Guidance Flow](#61-coverage-guidance-flow)
   - [Appeal Flow](#62-appeal-flow)
7. [UI/UX Guidelines](#7-uiux-guidelines)
8. [Learning System](#8-learning-system)
   - [Learning Layers](#81-learning-layers)
   - [Learning Triggers](#82-learning-triggers)
   - [Feedback Loops](#83-feedback-loops)
9. [Tools & APIs](#9-tools--apis)
10. [Guardrails](#10-guardrails)

---

## 1. Identity & Mission

| Attribute | Value |
|-----------|-------|
| **Name** | denali.health |
| **Type** | PWA (Progressive Web App) |
| **AI Model** | Claude (100% agentic) |
| **Target User** | Original Medicare patients & caregivers |
| **NOT for** | Commercial payers, Medicaid, billers, coders |
| **Mission** | Proactive denial prevention through plain English guidance |
| **Tone** | Warm, simple, no jargon, empathetic, 8th grade reading level |

**Core Insight**: Focus on **proactive denial prevention** (educate upfront) rather than reactive appeals.

---

## 2. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     denali.health                       │
├─────────────────────────────────────────────────────────┤
│   ┌─────────────┐    ┌─────────────┐    ┌───────────┐  │
│   │  Chat UI    │───▶│ Claude Agent│───▶│  Tools    │  │
│   │ (Patient)   │◀───│  (Brain)    │◀───│  (APIs)   │  │
│   └─────────────┘    └─────────────┘    └───────────┘  │
│                            │                            │
│                            ▼                            │
│                    ┌──────────────┐                     │
│                    │  Supabase    │                     │
│                    │  (Memory)    │                     │
│                    └──────────────┘                     │
└─────────────────────────────────────────────────────────┘
```

**Principles**:
- Each domain skill = one Edge function
- **Frontend is dumb** — just renders what Claude returns
- All intelligence lives in Claude + skills
- Tools are interchangeable (swap APIs without frontend changes)

**Tech Stack**:
- Frontend: PWA, dark/light theme, mobile-first
- Backend: Supabase (auth, PostgreSQL, Edge functions)
- AI: Claude API (agentic)
- Payments: Stripe

---

## 3. Skills System

### 3.1 Skills Directory

```
/mnt/skills/denali/
├── SKILL.md                        # Master orchestrator
├── core/
│   ├── conversation/SKILL.md       # How to talk to patients
│   ├── learning/SKILL.md           # How to learn from interactions
│   └── prompting/SKILL.md          # How to suggest next steps
├── domain/
│   ├── symptom-to-diagnosis/SKILL.md
│   ├── procedure-identification/SKILL.md
│   ├── provider-lookup/SKILL.md
│   ├── coverage-check/SKILL.md
│   └── guidance-generation/SKILL.md
├── infrastructure/
│   ├── database/SKILL.md
│   ├── architecture/SKILL.md
│   └── ui-ux/SKILL.md
└── tools/
    └── SKILL.md                    # Healthcare API usage
```

### 3.2 Skill Registry & Triggers

| Trigger | Skill to Load |
|---------|---------------|
| New conversation starts | `/core/conversation/SKILL.md` |
| User describes symptoms or condition | `/domain/symptom-to-diagnosis/SKILL.md` |
| User mentions a procedure/test/scan | `/domain/procedure-identification/SKILL.md` |
| User mentions doctor or asks "who can do this" | `/domain/provider-lookup/SKILL.md` |
| Diagnosis + procedure identified | `/domain/coverage-check/SKILL.md` |
| Coverage criteria retrieved | `/domain/guidance-generation/SKILL.md` |
| After any response | `/core/prompting/SKILL.md` |
| Successful path or user feedback | `/core/learning/SKILL.md` |

### 3.3 Skill Definitions

#### Master Skill (`/denali/SKILL.md`)

```yaml
name: denali-master
description: Medicare coverage assistant that helps patients understand approval requirements and prevent denials
```

**Flow Logic**:
1. Greet → Conversation Skill
2. Understand problem → Symptom-to-Dx Skill
3. Identify service → Procedure ID Skill
4. Find doctor → Provider Lookup Skill
5. Check Medicare rules → Coverage Check Skill
6. Give guidance → Guidance Gen Skill
7. Suggest next step → Prompting Skill
8. Store what worked → Learning Skill

---

#### Conversation Skill (`/core/conversation/SKILL.md`)

- Tone: Warm, simple, no jargon, empathetic
- Language: Plain English, 8th grade reading level
- Ask one question at a time
- Acknowledge what user said before asking next question
- Never use medical codes in responses to user

---

#### Prompting Skill (`/core/prompting/SKILL.md`)

- After every response, suggest 1-2 logical next actions
- Based on: flow state, missing info, likely next need
- Format: Short, clickable/tappable phrases
- Examples:
  - After symptom intake → "Tell me about your doctor"
  - After coverage check → "Show me what to bring to my appointment"
  - After guidance → "Start a new question" / "Was this helpful?"

---

#### Learning Skill (`/core/learning/SKILL.md`)

- Store successful symptom → ICD-10 mappings
- Store successful procedure → CPT mappings
- Store successful coverage paths (dx + px + policy)
- Learn from user corrections
- Learn from thumbs up/down feedback

---

#### Symptom-to-Diagnosis Skill (`/domain/symptom-to-diagnosis/SKILL.md`)

- Map plain English symptoms to ICD-10 codes
- Ask clarifying questions: duration, location, severity, onset
- Use ICD-10 search tool
- **Never show codes to user** — internal use only

---

#### Procedure Identification Skill (`/domain/procedure-identification/SKILL.md`)

- Map plain English service descriptions to CPT codes
- Clarify: MRI vs CT? Which body part?
- Use CPT lookup tool (dev only)
- **Never show codes to user** — internal use only

---

#### Provider Lookup Skill (`/domain/provider-lookup/SKILL.md`)

- Search NPI registry by name + location
- Validate specialty matches procedure
- Present short list for user to confirm
- Store confirmed provider for session

---

#### Coverage Check Skill (`/domain/coverage-check/SKILL.md`)

- Search NCDs/LCDs for diagnosis + procedure combination
- Extract coverage criteria
- Check SAD exclusion list (Part B vs Part D)
- Pull supporting PubMed evidence if needed

---

#### Guidance Generation Skill (`/domain/guidance-generation/SKILL.md`)

- Synthesize coverage criteria into plain English
- Format as actionable checklist for doctor visit
- Include what to ask doctor to document
- Offer printable version

---

#### Tools Skill (`/tools/SKILL.md`)

| Tool | API | Use |
|------|-----|-----|
| ICD-10 | ICD-10 Codes MCP | Search diagnosis codes |
| CPT | AMA API (dev) | Search procedure codes |
| NPI | NPI Registry MCP | Validate providers |
| NCD/LCD | CMS Coverage MCP | Medicare coverage rules |
| SAD | CMS Coverage MCP | Part B exclusion check |
| PubMed | PubMed MCP | Clinical evidence |

---

### 3.4 Skill Flow Example

```
User: "My mom needs approval for her back scan"
         │
         ▼
   ┌─────────────────┐
   │ Master Skill    │ → Detects: new conversation, coverage request
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Conversation    │ → "I'd be happy to help. Can you tell me
   │ Skill           │    more about what's going on with her back?"
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Symptom-to-Dx   │ → Asks: duration, location, severity
   │ Skill           │ → Maps to ICD-10 (e.g., M54.5 low back pain)
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Procedure ID    │ → "Back scan" → MRI lumbar? CT? → Asks to clarify
   │ Skill           │ → Maps to CPT (e.g., 72148)
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Provider Lookup │ → "Who's her doctor?"
   │ Skill           │ → NPI search, validate specialty
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Coverage Check  │ → Search NCDs/LCDs for lumbar MRI
   │ Skill           │ → Extract criteria
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Guidance Gen    │ → Plain English: "Here's what the doctor
   │ Skill           │    needs to document to get this approved..."
   └────────┬────────┘
            ▼
   ┌─────────────────┐
   │ Learning Skill  │ → Store: "back scan" → 72148, M54.5 path worked
   └─────────────────┘
```

---

## 4. Database Schema

### 4.1 Core Tables

| Table | Purpose |
|-------|---------|
| `users` | Auth, phone (primary), email, plan, theme, accessibility settings |
| `user_verification` | Email + mobile OTP status |
| `subscriptions` | Plan type, Stripe customer ID, billing status |
| `usage` | Appeal count per phone number |
| `conversations` | Chat history per user |
| `messages` | Individual messages (role: user/assistant) |
| `appeals` | Generated appeal letters with codes + policy refs |
| `user_feedback` | Thumbs up/down + corrections |

### 4.2 Learning Tables (No User Link)

| Table | Purpose |
|-------|---------|
| `symptom_mappings` | "dizzy spells" → R42 (confidence-based) |
| `procedure_mappings` | "back scan" → 72148 (confidence-based) |
| `coverage_paths` | Successful dx + px + policy combinations |
| `conversation_patterns` | Successful question sequences by intent |
| `appeal_outcomes` | Real-world appeal results (user-reported) |
| `policy_cache` | Medicare policy tracking and change detection |
| `user_events` | User behavior tracking for UX optimization |
| `learning_queue` | Async job queue for background learning |

### 4.3 Key Functions

| Function | Purpose |
|----------|---------|
| `check_appeal_access(phone)` | Returns 'free', 'paywall', or 'allowed' |
| `increment_appeal_count(phone)` | Increments usage counter |
| `process_feedback(message_id, rating, correction)` | Handle 👍/👎, update mappings |
| `update_symptom_mapping(phrase, code, boost)` | Upsert symptom → ICD-10 |
| `update_procedure_mapping(phrase, code, boost)` | Upsert procedure → CPT |
| `record_appeal_outcome(appeal_id, outcome, ...)` | Store user-reported result |
| `get_learning_context(symptoms, procedures)` | Get learned data for prompts |
| `delete_user_cascade(user_id)` | GDPR/CCPA compliant deletion |

---

## 5. Business Model

### 5.1 Pricing Plans

| Plan | Price | Limits | Auth Required |
|------|-------|--------|---------------|
| Free | $0 | 1 appeal (lifetime) | Mobile OTP |
| Pay Per Appeal | $10/appeal | Unlimited | Mobile + Email OTP |
| Unlimited | $25/month | Unlimited appeals | Mobile + Email OTP |

**Key**: Coverage guidance is **always free** (unlimited, no signup). Paywall only appears for appeal letters.

### 5.2 Auth Requirements

| Feature | Auth Required |
|---------|---------------|
| Coverage guidance | None |
| First appeal | Mobile OTP only |
| Additional appeals | Mobile OTP + Payment |
| $25/month subscription | Mobile OTP + Email OTP |

### 5.3 Gating Logic

```
1. User requests appeal letter
2. Check phone number in database:
   - Phone not found → Signup wall (mobile OTP)
   - Phone found, appeal_count = 0 → Generate letter (FREE), increment count
   - Phone found, appeal_count >= 1 → Check subscription:
     - Has active subscription → Allow
     - No subscription → Show paywall ($10 or $25/month)
3. After payment → Reveal letter, increment count
```

---

## 6. User Flows

### 6.1 Coverage Guidance Flow (Free, No Auth)

```
User: "Will Medicare cover my MRI?"
         │
         ▼
   Conversation intake (symptoms, duration, etc.)
         │
         ▼
   Loading: "Checking Medicare policies..."
         │
         ▼
   Provider lookup (optional): "Who's your doctor?"
         │
         ▼
   Guidance output:
   ✅ "Medicare typically covers this..."
   □ Documentation checklist
   □ What to ask doctor

   [👍] [👎] Was this helpful?
   [🖨️ Print] [🆕 New question]
```

### 6.2 Appeal Flow (Requires Phone OTP)

```
User: "Medicare denied my MRI, help me appeal"
         │
         ▼
   Gather denial details (date, reason, procedure)
         │
         ▼
   Generate appeal letter (hidden)
         │
         ▼
   ┌─────────────────────────────────────────┐
   │  GATE: Check appeal_count for phone     │
   │                                          │
   │  New user → Signup wall → Mobile OTP    │
   │  appeal_count=0 → Show letter (FREE)    │
   │  appeal_count≥1 → Check subscription    │
   │     Has sub → Show letter               │
   │     No sub → Paywall ($10 or $25/mo)    │
   └─────────────────────────────────────────┘
         │
         ▼
   Appeal letter revealed:
   - Full letter with citations
   - Print / Copy / Download
   - "Report outcome" button (for learning)
```

---

## 7. UI/UX Guidelines

**Principles**:
- Minimal interface — just a chat box
- No forms, no dropdowns, no medical jargon
- Mobile-first (Medicare patients often on phones/tablets)
- Accessibility (large text option, high contrast)
- Greeting personalization ("Evening, Venkata")
- Smart suggestions below input (tappable)

**Typography**:
- Greeting: 28px Bold
- Body: 16px min Regular
- Labels: 11-12px Semibold
- Font: SF Pro Display, -apple-system, sans-serif

**Theme**:
- Default: Follow system preference
- Dark: Slate 900→800 gradient, Blue→Violet accents
- Light: Slate 50→White gradient, Blue→Violet accents

**Accessibility**:
- Minimum 16px font size
- High contrast mode option
- Screen reader compatible
- Touch targets minimum 44x44px
- No time-limited interactions

---

## 8. Learning System

### 8.1 Learning Layers

| Layer | Goal | Storage |
|-------|------|---------|
| **1. Language** | Understand user phrases | `symptom_mappings`, `procedure_mappings` |
| **2. Clinical** | Know what gets approved | `coverage_paths`, `appeal_outcomes` |
| **3. Conversation** | Optimal question flow | `conversation_patterns` |
| **4. Policy** | Track Medicare changes | `policy_cache` |
| **5. User Behavior** | Optimize UX | `user_events` |

### 8.2 Learning Triggers

| Trigger | What Happens |
|---------|--------------|
| Every message | Extract entities → queue mapping updates |
| 👍 feedback | Reinforce all mappings in conversation (+0.1) |
| 👎 feedback | Penalize mappings (-0.15), learn from correction |
| Appeal generated | Store coverage path as pending |
| Outcome reported | Update coverage path success/failure |
| Print/copy/download | Track user event |
| Nightly batch | Process queue, prune weak mappings, check policy updates |

### 8.3 Feedback Loops

| Loop | Timing | Action |
|------|--------|--------|
| Immediate | <1 second | Entity extraction → UI suggestions |
| Session | <1 minute | Feedback → mappings adjusted |
| Daily | Overnight | Aggregate patterns, prune weak mappings, refresh policy cache |
| Weekly | Batch | Analyze appeal outcomes, update success rates |

**Prompt Injection**: Claude prompts include learned context:
- High-confidence symptom mappings
- Successful coverage paths
- Recent denials to avoid
- Effective question sequences

---

## 9. Tools & APIs

| Tool | Source | Purpose |
|------|--------|---------|
| **ICD-10** | ICD-10 Codes MCP | Map symptoms → diagnosis codes |
| **CPT** | AMA API (dev only) | Map procedures → CPT codes |
| **NPI Registry** | NPI Registry MCP | Validate providers by name + location |
| **NCD/LCD** | CMS Coverage MCP | Medicare coverage policies |
| **SAD** | CMS Coverage MCP | Part B vs Part D routing |
| **PubMed** | PubMed MCP | Clinical evidence citations |

**Data Inventory**:
- ICD-10: ✅ Full
- CPT: ✅ Dev only (AMA license required for prod)
- NPI: ✅ Full
- NCD/LCD: ✅ Full
- PubMed: ✅ Full

---

## 10. Guardrails

**Always**:
- Never give medical advice — only Medicare coverage guidance
- Never show codes to user — translate to plain English
- Never ask for codes — translate from plain English
- Always end with actionable next step
- Ask one clarifying question at a time
- Acknowledge what user said before moving on

**Privacy**:
- Do NOT store: Full names, addresses, SSN, insurance IDs, medical records
- OK to store: Email, phone (for auth), anonymized phrases, conversation content

**Account Deletion (GDPR/CCPA)**:
- Cascade delete all user-linked data
- Cancel Stripe subscription
- Retain anonymized learning data (no user FK)

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DENALI.HEALTH AT A GLANCE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📊 TOTALS                                                                  │
│  • 13 skills (1 master, 3 core, 5 domain, 3 infrastructure, 1 tools)       │
│  • 16 database tables                                                       │
│  • 17 SQL functions                                                         │
│  • 24 SVG mockups                                                           │
│                                                                             │
│  💰 PRICING                                                                 │
│  • Coverage guidance: FREE (unlimited, no signup)                           │
│  • First appeal: FREE (phone OTP required)                                  │
│  • Additional appeals: $10 each OR $25/month unlimited                      │
│                                                                             │
│  🔐 AUTH                                                                    │
│  • Phone OTP: Primary identifier, required for appeals                      │
│  • Email OTP: Required for $25/month subscription only                      │
│                                                                             │
│  🧠 LEARNING                                                                │
│  • Symptom mappings: phrase → ICD-10 (confidence-based)                     │
│  • Procedure mappings: phrase → CPT (confidence-based)                      │
│  • Coverage paths: successful code combinations                             │
│  • Appeal outcomes: real-world results                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```
