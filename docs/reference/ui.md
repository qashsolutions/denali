# UI/UX Reference

Layout architecture, landing page component breakdown, full
icon list, theme token palette, accessibility rules.
Extracted from CLAUDE.md.

For the active subset (principles + critical patterns), see
CLAUDE.md "UI/UX Guidelines (summary)".

---


- Minimal interface: just a chat box
- Mobile-first (Medicare patients often on phones/tablets)
- No forms, no dropdowns, no medical jargon
- Greeting personalization ("Evening, Venkata")
- Smart suggestions below input (tappable)

### Layout Architecture

**AppHeader** (`src/components/layout/AppHeader.tsx`) — universal, rendered in root layout (`src/app/layout.tsx`):

| Viewport    | Left       | Center                                               | Right                                        |
| ----------- | ---------- | ---------------------------------------------------- | -------------------------------------------- |
| **Desktop** | Logo → `/` | Nav: Health (rose), Ask Denali (blue), Blog (violet) | Sign In button (not auth) / Gear icon (auth) |
| **Mobile**  | Logo → `/` | —                                                    | Sign In / Gear + Hamburger menu              |

- Auth-aware via `createClient().auth.getSession()` + `onAuthStateChange`
- Nav icons have per-item Tailwind colors (e.g. `text-rose-500`); active state uses `--accent-primary`
- Sign In links to `/app/settings` (email OTP flow); Gear navigates to `/app/settings`
- Hamburger dropdown shows nav items on mobile

**Shared Footer** (`src/components/landing/LandingFooter.tsx`) — used across ALL pages:

- Used by: landing page, blog, legal pages (faq/terms/privacy/hipaa), app layout (desktop only via `hidden md:block`)
- Top row: Logo + "Qash Solutions Inc © 2026" (left), FAQ · Privacy · Terms · HIPAA links (right)
- Bottom row: HIPAA/BAA notice (`text-base font-medium`) + disclaimer (`text-xs`), separated by `border-t`
- **CRITICAL**: In `"use client"` components (like `app/layout.tsx`), import directly from `"@/components/landing/LandingFooter"` — NOT from barrel `"@/components/landing"`. Barrel import pulls `pg` into client bundle via transitive server deps

**BottomTabs** (`src/components/layout/BottomTabs.tsx`) — mobile only, `/app/*` pages:

- Tabs: Home, Health, Ask Denali, Settings (4 tabs, fixed bottom)

**Landing Page** (`src/components/landing/`) — premium warm medical reference design:

- **Hero** (`LandingHero.tsx`): Typographic hero with subtle mountain silhouette SVG (two path layers at opacity 0.08/0.12). Serif heading, decorative accent line, refined pill CTAs, uppercase trust line. Tagline: diabetes + obesity + coverage + denials + appeals. Primary CTA defaults to `/app/chat` (not `/app`) so users land on chat directly (sign-in required to send messages).
- **Features** (`LandingFeatures.tsx`): 3 health-first cards prioritizing CMS diabetes/obesity categories: (1) Pre-Diabetes & Diabetes Care — A1C screenings, meds, coverage; (2) Obesity Care — GLP-1s, bariatric, counseling, coverage; (3) Claims & Appeals — Medicare data + appeal letters. Section header: "Tailored guidance from your Medicare data" + "Pre-diabetes, Diabetes and Obesity" (accent color). Cards: `rounded-xl`, monospace step labels (`01`/`02`/`03`), monochromatic tags, subtle border hover.
- **Conditions** (`LandingConditions.tsx`): 2-column × 3-row alternating image/text section. Header: "Analysis grounded in your **Medicare** data". Three rows: Pre-Diabetes (image left), Diabetes (image right), Obesity (image left). ~30-word descriptions grounded in actual Blue Button data capabilities (R73 codes, Part D meds, DME, screening CPTs, GLP-1 tracking, obesity counseling). Images: `PreDiabetes.png`, `Diabetes.png`, `Obesity.png` in `public/`. Next.js `Image` with `fill` + `object-cover`, intersection observer fade-in.
- **Illustrations** (`illustrations/`): Static SVGs (no animation classes). `DiabetesCareIllustration`, `WeightManagementIllustration` (scale + gauge + trend + capsule), `HealthRecordsIllustration`.
- **HowItWorks** (`LandingHowItWorks.tsx`): Clean typographic steps with monospace numbers, serif labels, sans hints. Steps: Connect Medicare, Ask Denali ("Grounded analysis"), Appeal Denials. Vertical separators on desktop, horizontal on mobile. Hover `-translate-y-1`.
- **Pricing** (`LandingPricing.tsx`): Hardcoded 4 tiers (Free Trial / Starter $10 / Plus $20 / Unlimited $60). No DB dependency. Free Trial CTA → `/app/chat` (sign-in required). Plus has "Most Popular" badge + accent ring. Features show msgs/day + days/week limits. Serif plan names, monospace prices (`--font-mono`), warm amber check icons.
- **Testimonials** (`LandingTestimonials.tsx`): Serif italic quotes, warm amber stars, flat avatars.
- Section bg alternation: Hero `bg-primary`, Features `bg-secondary`, Conditions `bg-primary`, HowItWorks `bg-secondary`, Pricing default, Testimonials `bg-secondary`, Footer `bg-secondary`.

**Health Hub** (`src/app/app/health/page.tsx`) — 7 collapsible accordion cards replacing 11-section scroll:

- Each card: `HealthHubCard` — status dot (red/amber/green) + title + one-line summary + chevron toggle
- Cards: Needs Attention (auto-expanded, conditional), Coverage Status, Diabetes Care (conditional), Weight Management (conditional, obesity), Health Conditions (conditional), Claims & Providers, Medicare Account
- Status dots computed via `computeCardStatuses()` (useMemo) — checks denied claims, overdue screenings, med refill gaps (diabetes + obesity), severity classification, sync age, obesity screenings/meds
- `ObesityCareExpanded` component: classification badge, weight-management medications with refill gap indicators, overdue obesity counseling screenings (G0447/G0473), Medicare coverage info box (IBT/nutrition/bariatric), "Discuss Weight Management" CTA → chat
- Needs Attention `overdueMeds` filter includes both `isDiabetesMed` and `isObesityMed` medications
- Multiple cards can be open simultaneously. `expandedCards` as `Set<string>` state
- Existing child components (`CoverageCards`, `ClaimsTimeline`, `DiagnosisSummaryCard`, etc.) reused as-is inside card bodies

**Icons** (`src/components/icons/index.tsx`):

- `DiabetesIcon`: chart/monitoring icon (trend line + dot) — NOT blood drop
- `WeightScaleIcon`: weight scale with circular gauge, needle, tick marks, handle — used by Weight Management card
- `HeartPulseIcon`, `ChatBubbleIcon`, `DocumentTextIcon`, `GearIcon`, `HomeIcon`, `MountainIcon`

### Typography

- Greeting: 28px Bold
- Body: 16px min Regular
- Labels: 11-12px Semibold
- Font: Instrument Serif (headings, via `--font-serif`) + DM Sans (body, via `--font-sans-dm`) + Monospace (step labels, prices, via `--font-mono`). Loaded via `next/font/google` in root layout. Warm, trustworthy feel — not techy

### Theme

Premium warm medical reference palette — applied across the **entire app**, not just landing page.

- Default: Follow system preference
- **Light**: Warm cream/stone — `--bg-primary: #FEFCF8`, `--bg-secondary: #FFFEFA`, `--bg-tertiary: #F5F0E8`, `--text-primary: #2C1810`, `--accent-primary: #C26A3E` (warm amber), `--border: #E8DFD3`
- **Dark**: Warm dark — `--bg-primary: #1A1612`, `--bg-secondary: #241F1A`, `--accent-primary: #D4845A`
- **Brand**: `--brand-purple: #7c3aed` — dedicated variable for "Health" text in DenaliHealth logo (independent of warm accent palette)
- Feature colors: muted earth tones — sage (`--check-teal: #5A8A6E`), terracotta (`--health-red: #B3695A`), plum (`--diabetes-violet: #7B6B8A`), rust (`--appeal-coral: #B8704E`)
- Landing page animations removed (float, pulse-gentle, draw-in, shimmer, sway, pulse-line, flow-move). Dashboard animations preserved (popover-in, fade-up, slide-down-fade, card-enter)

### Accessibility

- Minimum 16px font size
- High contrast mode option
- Screen reader compatible
- Touch targets minimum 44x44px
- No time-limited interactions

