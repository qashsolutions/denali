# Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     denali.health                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
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
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. Chat UI

- Conversational interface
- Patient speaks plain English
- No forms, no dropdowns, no code entry

### 2. Claude Agent (The Brain)

- Drives the conversation
- Asks follow-up questions to identify condition/procedure
- Decides which tools to call
- Synthesizes findings into plain English guidance
- Learns from feedback

### 3. Tool Layer (APIs)

| Tool | Purpose |
|------|---------|
| ICD-10 Search | Map symptoms → diagnosis codes |
| CPT Lookup | Map procedure description → CPT (dev only via AMA) |
| NPI Registry | Validate doctor by name + location |
| NCD/LCD Search | Find Medicare coverage rules |
| SAD Exclusion | Part B vs Part D routing |
| PubMed | Supporting clinical evidence |

### 4. Supabase (Memory & Learning)

See [05-database.md](05-database.md) for full schema.

---

## Architecture Principles

- Each domain skill = one Edge function
- Frontend is dumb — just renders what Claude returns
- All intelligence lives in Claude + skills
- Tools are interchangeable (swap AMA API later, no frontend change)

---

## Auth Flow (Supabase Auth)

```
┌─────────────────────────────────────────────────────────────┐
│                        AUTH FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  FREE USER (No Auth)                                        │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Open App │───▶│ Device       │───▶│ 1 free appeal   │   │
│  │          │    │ Fingerprint  │    │ then paywall    │   │
│  └──────────┘    └──────────────┘    └─────────────────┘   │
│                                                             │
│  PAID USER (Full Auth)                                      │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────┐   │
│  │ Sign Up  │───▶│ Email + OTP  │───▶│ Email verified  │   │
│  └──────────┘    └──────────────┘    └────────┬────────┘   │
│                                               │             │
│                                               ▼             │
│                  ┌──────────────┐    ┌─────────────────┐   │
│                  │ Mobile + OTP │───▶│ Mobile verified │   │
│                  └──────────────┘    └────────┬────────┘   │
│                                               │             │
│                                               ▼             │
│                  ┌──────────────┐    ┌─────────────────┐   │
│                  │ Select Plan  │───▶│ Payment         │   │
│                  │ $10 or $25   │    │ (Stripe)        │   │
│                  └──────────────┘    └────────┬────────┘   │
│                                               │             │
│                                               ▼             │
│                                      ┌─────────────────┐   │
│                                      │ Full Access     │   │
│                                      └─────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Request Gating Logic

```
1. User starts appeal flow
2. Check auth status:
   - No auth → check device fingerprint appeal count
     - < 1 appeal → allow, mark appeal started
     - ≥ 1 appeal → return paywall
   - Auth verified → check plan:
     - Unlimited ($25) → allow
     - Pay-per-appeal ($10) → charge, then allow
3. If allowed → invoke Claude agent
4. When appeal letter generated → increment count in `usage` table
```
