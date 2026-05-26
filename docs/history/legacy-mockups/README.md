> **ARCHIVED — 2026-05-26**
>
> These mockups date from the Jan 27 2026 initial design phase and were
> never iterated. The visual palette (dark blue gradient) predates the
> warm-amber migration; the documented product model (free-appeal, MCP
> tools, phone OTP) reflects pre-2026-03-04 architecture. Kept here as
> a historical record of the initial design intent. Not a reference for
> current product behavior.

---

# Denali.health UI Mockups

Professional SVG mockups for the denali.health Medicare guidance app. All screens are designed mobile-first with PWA compatibility and WCAG AA accessibility standards.

## Design System

### Theme Support

The app supports **Dark** and **Light** themes with automatic system detection:

| Theme | Toggle Location | Icon |
|-------|-----------------|------|
| Dark → Light | Header sun icon ☀️ | Tap to switch to light |
| Light → Dark | Header moon icon 🌙 | Tap to switch to dark |
| Settings | Account → Theme | Auto / ☀️ / 🌙 selector |

**Default behavior:** Follow system preference (`prefers-color-scheme`)

### Dark Theme Colors
| Element | Hex |
|---------|-----|
| Background | `#0f172a` → `#1e293b` (gradient) |
| Cards | `#1e293b` |
| Card Border | `#334155` |
| Text Primary | `#ffffff` |
| Text Secondary | `#94a3b8` |
| Text Muted | `#64748b` |
| Primary Accent | `#3b82f6` → `#8b5cf6` |
| Success | `#10b981` |
| Warning | `#f59e0b` |
| Error | `#ef4444` |

### Light Theme Colors
| Element | Hex |
|---------|-----|
| Background | `#f8fafc` → `#ffffff` (gradient) |
| Cards | `#ffffff` |
| Card Border | `#e2e8f0` |
| Card Shadow | `#94a3b8` @ 15% |
| Text Primary | `#0f172a` |
| Text Secondary | `#475569` |
| Text Muted | `#94a3b8` |
| Primary Accent | `#2563eb` → `#7c3aed` |
| Success | `#059669` |
| Warning | `#d97706` |
| Error | `#dc2626` |

### Typography
- Font: SF Pro Display / -apple-system / sans-serif
- **Minimum font size: 16px** (body), 11px (labels only)
- Touch targets: minimum 44x44px

### Device Sizes
- **Mobile**: 375×812 (iPhone standard)
- **Tablet**: 768×1024 (iPad)

---

## Screen Inventory

### Landing Page (Public Marketing)
| # | Screen | File | Description |
|---|--------|------|-------------|
| 00 | Landing Page | `00-landing-page.svg` | Public marketing page with hero, features, CTAs |

### Core Flow
| # | Screen | File | Description |
|---|--------|------|-------------|
| 01 | Welcome (Dark) | `01-welcome.svg` | Home screen with theme toggle, greeting, quick actions |
| 01 | Welcome (Light) | `01-welcome-light.svg` | Light theme version of welcome |
| 02 | Conversation Intake | `02-conversation-intake.svg` | Chat with smart suggestion chips for answers |
| 03 | Loading/Coverage Check | `03-loading-coverage-check.svg` | Animated loading with step indicators showing data sources |
| 04 | Guidance Output | `04-guidance-output.svg` | Coverage result with checklist, policy citations, print option |

### Monetization
| # | Screen | File | Description |
|---|--------|------|-------------|
| 05 | Paywall | `05-paywall.svg` | Upgrade modal with $10/appeal and $25/month options |

### Appeal Flow
| # | Screen | File | Description |
|---|--------|------|-------------|
| 06 | Appeal - Denied Claim | `06-appeal-denied-claim.svg` | Denial intake with deadline warning and strategy |
| 07 | Appeal Letter Generator | `07-appeal-letter-generator.svg` | Generated appeal letter with policy citations |

### User Management
| # | Screen | File | Description |
|---|--------|------|-------------|
| 08 | History | `08-history.svg` | Past questions with status filters, FAB for new question |
| 09 | Account Settings | `09-account-settings.svg` | Profile, subscription, **theme toggle** (Auto/Light/Dark) |

### Provider Lookup Flow (3 Steps)
| # | Screen | File | Description |
|---|--------|------|-------------|
| 10a | Ask Zip Code | `10a-provider-zip-ask.svg` | Step 1: Ask user for zip code to narrow NPI search |
| 10b | Multi-Provider Select | `10b-provider-multi-select.svg` | Step 2: Card list of matching providers for user to confirm |
| 10 | Provider Confirmed | `10-provider-lookup.svg` | Step 3: Selected provider shown in chat with full NPI details |

> **Provider Flow Logic:**
> 1. User mentions doctor name → Ask for zip code first
> 2. `npi_search` with name + location → Returns multiple matches
> 3. Show card list with name, specialty, location, Medicare status
> 4. User taps to confirm → `npi_lookup` for full details
> 5. Continue with coverage check

### Edge Cases
| # | Screen | File | Description |
|---|--------|------|-------------|
| 11 | Error/Offline | `11-error-offline.svg` | Offline state with available offline features |
| 15 | Not Covered | `15-denial-not-covered.svg` | When Medicare doesn't cover + what IS covered |

### Signup Wall (Before Appeal Letter)
| # | Screen | File | Description |
|---|--------|------|-------------|
| 17 | Signup Wall | `17-signup-wall.svg` | "Your appeal is ready!" - enter phone to view |
| 18 | Mobile OTP | `18-mobile-otp.svg` | 6-digit SMS code verification |

### Paid Upgrade Flow (After Free Appeal Used)
| # | Screen | File | Description |
|---|--------|------|-------------|
| 05 | Paywall | `05-paywall.svg` | $10/appeal or $25/month options |
| 13a | Email OTP | `13a-otp-email.svg` | Required for $25/month (account recovery) |
| -- | Stripe | (external) | Payment processing |

### Legacy Auth Screens (Deprecated)
| # | Screen | File | Description |
|---|--------|------|-------------|
| 12 | Email Entry | `12-onboarding-auth.svg` | ⚠️ Deprecated - phone-first now |
| 13b | Mobile OTP | `13b-otp-mobile.svg` | ⚠️ Replaced by `18-mobile-otp.svg` |

> **Note:** Coverage guidance is free and unlimited (no auth). Appeal letters require phone verification (signup wall). First appeal is FREE after phone OTP.

### Accessibility
| # | Screen | File | Description |
|---|--------|------|-------------|
| 14 | Accessibility Settings | `14-accessibility-settings.svg` | Text size, high contrast toggle, reduce motion |

### Tablet
| # | Screen | File | Description |
|---|--------|------|-------------|
| 16 | Tablet Welcome | `16-tablet-welcome.svg` | iPad-optimized two-column layout |

---

## Theme Toggle Locations

```
┌─────────────────────────────────────────────────┐
│  🏔️ Evening, Venkata              [☀️]         │  ← Header toggle
│                                                 │
│  ...                                            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Account Settings                               │
│                                                 │
│  Theme        [Auto] [☀️] [🌙]                  │  ← Settings toggle
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Data Sources (Connected MCPs)

The mockups reference these connected data sources:

| Source | MCP Tools | Shown In |
|--------|-----------|----------|
| **ICD-10 Codes** | `lookup_code`, `search_diagnosis_by_description`, `search_procedure_by_description` | Loading screen badges |
| **NPI Registry** | `npi_search` (multi-result), `npi_lookup` (single), `npi_validate` | Provider selection cards, confirmed provider |
| **CMS Coverage** | `search_ncds`, `search_lcds`, `get_ncd`, `sad_exclusion_list` | Guidance output, appeal letter |
| **PubMed** | `search_articles`, `get_article_metadata` | Appeal letter citations |
| **CPT Codes** (AMA - dev only) | External API | Loading screen badges |

---

## Provider Lookup Flow

```
User: "My doctor is Dr. Sarah Chen"
        │
        ▼
┌──────────────────────┐
│ Ask for Zip Code     │  (10a-provider-zip-ask.svg)
│ "What's your zip?"   │
└──────────┬───────────┘
           ▼
    User: "94305"
           │
           ▼
┌──────────────────────┐
│ npi_search API call  │  name="Sarah Chen", location="94305"
│ Returns 3 matches    │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Multi-Select Cards   │  (10b-provider-multi-select.svg)
│ • Dr. Chen (Stanford)│  ← Best match highlighted
│ • Dr. Chen (PAMF)    │
│ • Dr. Chen (Kaiser)  │
└──────────┬───────────┘
           ▼
    User taps first card
           │
           ▼
┌──────────────────────┐
│ npi_lookup API call  │  NPI="1234567890"
│ Full provider data   │
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ Provider Confirmed   │  (10-provider-lookup.svg)
│ Inline in chat       │
│ Continue to coverage │
└──────────────────────┘
```

---

## User Flows (Per 06-business.md)

### Coverage Guidance (Always Free, No Auth)
```
User asks: "Will Medicare cover my MRI?"
        │
        ▼
   ┌──────────────┐
   │ Chat Reply   │  (02-conversation-intake.svg)
   │ No limits!   │
   └──────────────┘
```

### First Appeal (Free with Phone Signup)
```
User: "Medicare denied my MRI, help me appeal"
        │
        ▼
   ┌──────────────┐
   │ Claude asks  │  Denial details gathered
   │ questions    │  (06-appeal-denied-claim.svg)
   └──────┬───────┘
          │
          ▼ (Appeal letter generated but hidden)
   ┌──────────────┐
   │ Signup Wall  │  (17-signup-wall.svg)
   │ "It's ready!"│  Enter phone number
   └──────┬───────┘
          ▼
   ┌──────────────┐
   │ Mobile OTP   │  (18-mobile-otp.svg)
   └──────┬───────┘
          ▼
   ┌──────────────┐
   │ Appeal Letter│  (07-appeal-letter-generator.svg)
   │ FREE!        │
   └──────────────┘
```

### Second Appeal (Paywall)
```
Phone already used 1 free appeal
        │
        ▼
   ┌──────────────┐
   │   Paywall    │  (05-paywall.svg)
   │ $10 or $25/mo│
   └──────┬───────┘
          │
    ┌─────┴─────┐
    │           │
    ▼           ▼
┌────────┐  ┌────────────┐
│ $10    │  │ $25/month  │
│ Appeal │  │ + Email OTP│  (13a-otp-email.svg)
└───┬────┘  └─────┬──────┘
    │             │
    ▼             ▼
┌──────────────────────────┐
│      Stripe Checkout     │
└───────────┬──────────────┘
            │
            ▼
┌──────────────────────────┐
│    Appeal Letter Access  │
└──────────────────────────┘
```

---

## UI Principles (Per 07-ui.md)

- ✅ Minimal interface — just a chat box
- ✅ No forms, no dropdowns, no medical jargon
- ✅ Mobile-first (Medicare patients often on phones/tablets)
- ✅ Accessibility (large text option, high contrast)
- ✅ Greeting personalization ("Evening, Venkata")
- ✅ Smart suggestions appear below input (tappable)
- ✅ Printable checklist at the end
- ✅ Feedback mechanism (simple thumbs up/down)
- ✅ **Dark/Light theme toggle** (header + settings)
- ✅ Ask zip code before provider search

---

## PWA Considerations

All screens designed for:
- ✅ Offline-first with service worker caching
- ✅ Add to Home Screen prompts
- ✅ iOS safe areas (status bar, home indicator)
- ✅ Pull-to-refresh patterns
- ✅ Native-like transitions
- ✅ Theme persisted to localStorage/database

---

## File Sizes

All SVGs are optimized and under 15KB each for fast loading.

---

## Total Screen Count: 24 SVGs

---

## Complete App Tree

For the full application hierarchy mapping screens, database tables, SQL functions, and learning triggers, see:

**[../legacy-design/09-app-tree.md](../legacy-design/09-app-tree.md)** - Complete application tree (archived 2026-05-24)

---

## Deprecated Files

- `13-otp-verification.svg` - Replaced by `13a-otp-email.svg` and `13b-otp-mobile.svg` (both email AND mobile OTP required per docs)
