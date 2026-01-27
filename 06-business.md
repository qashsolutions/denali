# Business Model

## Pricing Plans

| Plan | Price | Limits | Requirements |
|------|-------|--------|--------------|
| Free | $0 | 1 appeal (lifetime) | Mobile OTP verification |
| Pay Per Appeal | $10/appeal | Unlimited | Mobile + Email OTP verified |
| Unlimited | $25/month | Unlimited appeals | Mobile + Email OTP verified |

---

## What's Free vs Paid?

| Feature | Free (No Signup) | Free (Signed Up) | Paid |
|---------|------------------|------------------|------|
| Coverage guidance | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| "Will Medicare cover X?" | ✅ | ✅ | ✅ |
| Appeal letter generation | ❌ | ✅ 1 free | ✅ Unlimited |
| View/download appeal letter | ❌ | ✅ | ✅ |
| Conversation history | ❌ | ✅ | ✅ |
| Account settings | ❌ | ✅ | ✅ |

**Key insight**: Coverage guidance is always free to build trust. Signup wall only appears when user wants the appeal letter.

---

## What Counts as an "Appeal"?

An appeal is a complete end-to-end denial assistance flow:

1. User describes their denied claim
2. Claude gathers details (denial reason, dates, procedure)
3. System generates appeal letter with citations
4. User gets printable letter + checklist

**One appeal = one denial case, regardless of how many messages exchanged.**

---

## Auth Requirements

| Plan | Auth Required |
|------|---------------|
| Coverage guidance | None |
| Free appeal | Mobile OTP only |
| Paid | Mobile OTP + Email OTP |

### Why Mobile OTP First?

- **One phone per person** — harder to abuse than email
- **Faster UX** — phone number is shorter than email
- **Always available** — phone is with them
- **SMS is instant** — no checking inbox

### Why Add Email for Paid?

- **Account recovery** — if they lose phone
- **Receipts** — Stripe sends to email
- **Re-engagement** — can email about appeal status

---

## User Flow: Coverage Guidance (Always Free)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  1. User asks: "Will Medicare cover my MRI?"                        │
│                                                                     │
│  2. Claude responds with coverage guidance                          │
│     └── No signup required                                          │
│     └── No limits                                                   │
│     └── Tracked by device fingerprint (for analytics only)          │
│                                                                     │
│  3. User can ask unlimited coverage questions                       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Flow: First Appeal (Free with Signup)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  1. User says: "Medicare denied my MRI, help me appeal"             │
│                                                                     │
│  2. Claude gathers denial details                                   │
│     └── When denied? What reason? What procedure?                   │
│     └── No signup yet — building value first                        │
│                                                                     │
│  3. Appeal letter is GENERATED (but not shown)                      │
│                                                                     │
│  4. SIGNUP WALL appears                                             │
│     └── "Your appeal letter is ready!"                              │
│     └── "Enter your phone number to view it — it's free"            │
│                                                                     │
│  5. Mobile OTP verification                                         │
│     └── Enter phone → Get SMS code → Verify                         │
│                                                                     │
│  6. Appeal letter revealed                                          │
│     └── User can view, copy, print, download                        │
│     └── First appeal = FREE                                         │
│                                                                     │
│  7. Appeal count incremented for this phone number                  │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## User Flow: Second Appeal (Paywall)

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  1. User starts second appeal                                       │
│                                                                     │
│  2. Claude gathers denial details                                   │
│                                                                     │
│  3. PAYWALL appears (before letter shown)                           │
│     └── "You've used your free appeal"                              │
│     └── "$10 for this appeal" OR "$25/month unlimited"              │
│                                                                     │
│  4. If $10 option:                                                  │
│     └── Stripe checkout (one-time)                                  │
│     └── Appeal letter revealed                                      │
│                                                                     │
│  5. If $25/month option:                                            │
│     └── Email OTP verification (for account recovery)               │
│     └── Stripe subscription checkout                                │
│     └── Full access unlocked                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Appeal Gating Logic

```
1. User requests appeal letter
2. Check phone number in database:
   - Phone not found → Show signup wall (mobile OTP)
   - Phone found, appeal_count = 0 → Generate letter, increment count
   - Phone found, appeal_count >= 1 → Check subscription:
     - Has active subscription → Allow
     - No subscription → Show paywall
3. For paywall:
   - $10 one-time → Charge via Stripe, allow this appeal only
   - $25/month → Require email OTP, create subscription, allow unlimited
```

---

## Tracking & Fraud Prevention

### Primary Tracking: Phone Number
- One phone = one person
- Appeal count tied to phone number
- Account tied to phone number

### Secondary Tracking: Device Fingerprint
- Used for analytics only
- Helps detect suspicious patterns
- NOT used for gating (too unreliable)

### Fraud Signals
- Same device fingerprint with multiple phone numbers
- Rapid appeal generation
- VoIP/burner phone detection (optional)

---

## Payment

- Payment processor: Stripe
- $10/appeal: One-time payment, no subscription created
- $25/month: Subscription with auto-renewal
- Webhook for subscription status updates

---

## Upgrade Flow

```
User hits paywall (after free appeal used)
        │
        ▼
   ┌──────────────┐
   │   Paywall    │  Choose $10 or $25/month
   └──────┬───────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌────────┐  ┌────────────┐
│ $10    │  │ $25/month  │
│ Appeal │  │ Unlimited  │
└───┬────┘  └─────┬──────┘
    │             │
    │             ▼
    │      ┌──────────────┐
    │      │ Email + OTP  │  (for account recovery)
    │      └──────┬───────┘
    │             │
    ▼             ▼
┌──────────────────────────┐
│      Stripe Checkout     │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│      Full Access         │
└──────────────────────────┘
```
