# Component Architecture

Denali's frontend is intentionally simple -- the UI renders what Claude returns. All intelligence lives in the AI layer, not in the components.

---

## Layout Components

### AppHeader (`src/components/layout/AppHeader.tsx`)

Universal header rendered in the root layout (`src/app/layout.tsx`). Appears on every page (landing, blog, app).

| Viewport | Left | Center | Right |
|----------|------|--------|-------|
| **Desktop** | Logo (MountainIcon) links to `/` | Nav: Health (rose), Ask Denali (blue), Blog (violet) | Sign In button (unauthenticated) / Gear icon (authenticated) |
| **Mobile** | Logo links to `/` | -- | Sign In / Gear + Hamburger menu |

- Auth-aware via `createClient().auth.getSession()` + `onAuthStateChange`
- Nav icons have per-item Tailwind colors (e.g., `text-rose-500`); active state uses `--accent-primary`
- Sign In links to `/app/settings` (email OTP flow); Gear navigates to `/app/settings`
- Hamburger dropdown shows nav items on mobile
- Note: `LandingHeader` component still exists in codebase but is not rendered by any page

### BottomTabs (`src/components/layout/BottomTabs.tsx`)

Mobile-only bottom navigation for `/app/*` pages. Fixed to bottom of viewport.

| Tab | Icon | Route |
|-----|------|-------|
| Home | HomeIcon | `/app` |
| Health | HeartPulseIcon | `/app/health` |
| Ask Denali | ChatBubbleIcon | `/app/chat` |
| Settings | GearIcon | `/app/settings` |

### App Footer (inline in `src/app/app/layout.tsx`)

Desktop-only footer for `/app/*` pages. Single horizontal row:
- **Left**: Logo + Disclaimer + Copyright (from `BRAND` config)
- **Right**: FAQ, Privacy, HIPAA links

### LandingFooter (`src/components/landing/LandingFooter.tsx`)

Footer for landing page and blog pages:
- **Top row**: Logo + company name (left), FAQ / Privacy Policy / HIPAA links (right)
- **Bottom row**: Disclaimer (left), Copyright (right), separated by `border-t`

---

## Page Structure

### Landing Page (`/`)

Public marketing page. Hero section + feature highlights + LandingFooter.

### App Hub (`/app`)

Authenticated home screen. Greeting with time-of-day personalization ("Evening, Venkata") + 3 feature cards:

| Card | Icon | Route | Description |
|------|------|-------|-------------|
| Health | HeartPulseIcon (rose) | `/app/health` | Medicare health data |
| Ask Denali | ChatBubbleIcon (blue) | `/app/chat` | Chat with AI |
| Diabetes | DiabetesIcon (emerald) | `/app/diabetes` | Diabetes care reference |

### Chat (`/app/chat`)

Core product. Chat interface with Claude. Components:
- Message list with `SparkleIcon` + "AI-generated" disclaimer on assistant messages
- `ChatInput` with smart suggestions (tappable)
- `AppealLetterModal` for viewing/printing/downloading appeal letters
- `PrintableChecklist` for coverage guidance checklists
- Inline prompts (`EmailPrompt`, `AppealOutcomePrompt`) for contextual actions

### Health (`/app/health`)

Blue Button data display. Components:
- `ConnectMedicare` -- OAuth connection button + status
- `PatientCard` -- demographics (name, DOB, Medicare ID masked)
- `CoverageCards` -- active coverage plans
- `ClaimsList` + `ClaimDetail` -- EOB data with expandable details
- `ConnectionStatus` -- connection state indicator

### Diabetes (`/app/diabetes`)

Reference page (not in main desktop nav). Content:
- Quick action buttons (redirect to chat with topic param)
- A1C guide with 3 ranges (normal, pre-diabetic, diabetic)
- Medicare coverage reference table (6 covered items)
- MDPP button
- `CmsPledge` component (Diabetes & Obesity pledge)

### Settings (`/app/settings`)

Account management. Sections:
1. **Account** -- email OTP sign-in/sign-out, plan display
2. **Subscription** -- plan name, usage info, upgrade button
3. **Appearance** -- theme toggle (light/dark/system)
4. **Accessibility** -- text size adjustment
5. **Security** -- TOTP authenticator app enrollment
6. **Privacy & Data** -- consent toggles (health_data_ai, health_data_storage, analytics)
7. **Danger Zone** -- account deletion (2-step confirmation)
8. **Reset** -- clear local settings

---

## Navigation

| Context | Type | Items |
|---------|------|-------|
| Desktop (all pages) | AppHeader nav | Health (rose), Ask Denali (blue), Blog (violet) |
| Mobile (all pages) | AppHeader hamburger | Same 3 items in dropdown |
| Mobile (`/app/*`) | BottomTabs | Home, Health, Ask Denali, Settings (4 tabs) |

Diabetes page is accessible from the app hub cards and BottomTabs but is not in the desktop header nav. It is treated as a reference/supplemental page.

---

## Key Patterns

### CSS Variables for Theming

All colors use CSS custom properties. Never hardcode colors.

```css
var(--bg-primary)        /* Main background */
var(--bg-secondary)      /* Card/section background */
var(--text-primary)       /* Primary text */
var(--text-secondary)     /* Muted text */
var(--accent-primary)     /* Brand accent (active states) */
var(--border-primary)     /* Border color */
```

### Class Merging with `cn()`

Utility function for conditional Tailwind class merging:

```typescript
import { cn } from '@/lib/utils';
<div className={cn('base-classes', isActive && 'active-classes')} />
```

### Modal Pattern (PrintableChecklist)

Modals follow a consistent pattern:

```
fixed inset-0 z-50
  -> backdrop (bg-black/50)
  -> centered container (max-w-2xl)
  -> white bg with overflow-auto
  -> close button (top-right)
  -> scrollable content area
```

### Inline Prompt Pattern

Contextual prompts (email collection, appeal outcome) render as cards within the chat flow:

```
bg-[var(--bg-secondary)] with border
  -> icon + heading
  -> brief explanation
  -> input/action area
  -> dismiss option
```

### ChatAction Union Type

The chat page uses a `ChatAction` union type to drive conditional rendering of different UI states (loading, error, prompt, appeal letter, etc.).

### Barrel Exports

Component directories use `index.ts` barrel exports for clean imports:

```typescript
// components/chat/index.ts
export { Message } from './Message';
export { ChatInput } from './ChatInput';
```

---

## Icons (`src/components/icons/index.tsx`)

| Icon | Visual | Usage |
|------|--------|-------|
| `MountainIcon` | Mountain peak | Brand logo |
| `HeartPulseIcon` | Heart with pulse line | Health feature |
| `ChatBubbleIcon` | Speech bubble | Chat/Ask Denali |
| `DiabetesIcon` | Chart with trend line + dot | Diabetes feature (NOT a blood drop) |
| `DocumentTextIcon` | Document with lines | Appeal letters, documents |
| `GearIcon` | Gear/cog | Settings |
| `HomeIcon` | House | Home/hub |
| `SparkleIcon` | Sparkle/star | AI-generated indicator |

---

## Accessibility

| Rule | Spec |
|------|------|
| Minimum font size | 16px body text |
| Touch targets | Minimum 44x44px |
| High contrast | Optional mode in settings |
| Screen reader | Compatible (semantic HTML, ARIA labels) |
| Time limits | No time-limited interactions |
| Text sizing | Adjustable in Settings > Accessibility |
