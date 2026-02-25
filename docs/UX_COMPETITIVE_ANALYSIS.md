# Design & UX Findings — Feb 14, 2026

Competitive analysis of **legionhealth.com** and **giga.ai** for layout, visual hierarchy, navigation, and readability improvements applicable to Denali.

---

## 1. Legion Health (legionhealth.com)

**What they are**: Online psychiatry / telehealth for ADHD, anxiety, depression. Insurance-covered. Y Combinator backed.

### Layout & Structure
- **Single-column, full-width sections** that alternate between white and soft blue backgrounds
- Each section is ONE idea — hero → social proof → conditions → testimonials → why us → how it works → FAQ → CTA footer
- Massive whitespace between sections (80-120px padding)
- Content is center-aligned with generous max-widths (~900px for text)

### Navigation
- **Sticky header**: Logo left, 5 flat nav items center, Login + "Get Started" button right
- No dropdowns — all top-level links
- Primary CTA ("Get Started") is a filled blue pill button, always visible
- "Login" is plain text link, secondary emphasis
- **Only 5 nav items**: Testimonials, Why Legion, How It Works, FAQ, Blog

### Visual Design
- **Color palette**: White + soft blue (#D1E3F0-ish) + dark navy text + blue (#4F6BF0) CTAs
- Only ONE accent color (blue) — used for all interactive elements
- Human photography (hero image of smiling woman) — warm, approachable
- Rounded corners everywhere (16-20px radius on cards/sections)
- Very large typography: Hero ~60px, section headers ~36px, body ~18px

### Content Patterns
- **"Conditions We Support"**: Grid of condition cards (ADHD, Anxiety, Depression, etc.) — each is a title + 2-line description. Click to expand details
- **Testimonial carousel**: Real names, ages, cities, star ratings, long-form quotes
- **"How It Works" — 4 steps**: Step One → Step Two → Step Three → Step Four, each in a rounded card on the right side with short description
- **FAQ as accordion**: Clean Q&A format, nothing fancy
- **Insurance logo bar**: Scrolling marquee of Aetna, Anthem, BlueCross, Cigna, United

### Footer
- Dark navy background with white text
- "Ready for Your Next Step?" CTA section above footer
- Two buttons: "Book Now" (filled) + "Discover Your Provider" (outline)
- Phone number and email prominently displayed
- Simple link row: Privacy, Terms, FAQ, nav items

### Key Takeaways for Denali
1. **One accent color** — Legion uses only blue. Denali uses blue, purple, red, green, rose, violet across different nav items and sections. This creates visual noise.
2. **Massive whitespace** — sections breathe. Denali's landing page sections feel tighter.
3. **Human photography** — Legion's hero has a real person. Denali has no imagery, just gradients.
4. **Simple nav** — 5 items, no dropdowns. Denali is similar but the tagline below the logo adds visual weight.
5. **Testimonial carousel** — social proof with real names/cities. Denali has none.
6. **Conditions grid → Feature grid** — clear "what we help with" at a glance. Denali's 4 feature cards are good but could be more visual.
7. **Insurance logo bar** — "120M+ covered" with scrolling logos builds trust. Denali could have a "Works with Medicare" trust bar.

---

## 2. Giga.ai

**What they are**: Enterprise AI agent platform for customer support (voice + chat). Used by DoorDash, Postman.

### Layout & Structure
- **Dark mode by default** for product sections, light mode for social proof/CTA
- Full-bleed hero with dramatic landscape photography as background
- Sections are very tall (100vh feel) — one concept per screen
- Left-side big text + right-side feature pills pattern (icon + label + description)
- Product screenshots embedded in landscape photos (screenshot overlaid on scenic canyon/mountains)

### Navigation
- **Minimal sticky header**: Logo left, 2 dropdown items (Product, Company) center-left, Sign In + "Talk to us" button right
- **Dropdown menus are elegant**: Simple list of 3-4 items, each with bold title + one-line description. No icons. Clean left-aligned. White background with subtle shadow
  - Product: Agent Canvas, Insights, Voice Experience, Browser Agent
  - Company: Careers, News, Trust Center
- Dropdown appears on hover, not click
- Only 2 nav groups — everything else lives in the footer

### Visual Design
- **Dual-tone**: Dark charcoal (#1A1A1A) for product sections → warm off-white (#F9F9F9) for social proof
- Single accent: warm orange dot (●) used as section category markers
- **Serif + sans-serif mix**: Large headings in serif (editorial feel), body in clean sans
- Dramatic nature photography as section backgrounds — mountains, canyons, lakes
- Product UI screenshots overlaid on the nature backgrounds (glassy card effect)
- Very large type: Hero ~64px, section headers ~48px
- **Section labels**: Small caps tracking ("CUSTOM AGENTS", "SMART SUGGESTIONS", "NATURAL VOICE") with orange dot prefix

### Content Patterns
- **Hero stats**: Deflection rate, supported languages — big numbers, labels above
- **Feature triptych**: Three equal columns with icon + bold title + one-line description per section
- **Product deep-dive cards**: Full-width rounded cards with description left + embedded UI screenshot right
- **Customer spotlight**: Full case study card with brand logo, testimonial quote, photo, real name + title
- **Compliance badges**: SOC2, ISO 42001, ISO 27001 in footer — visual trust signals

### Footer
- Light background, 3-column link grid: Product, Company, Resources
- Compliance badge row with "Compliant" label
- Social links (X, LinkedIn) bottom-right
- Copyright bottom-left

### Key Takeaways for Denali
1. **Section category labels** — the "● SECTION NAME" pattern (small caps + dot) is brilliant for scannability. Denali uses "01 — FOR EVERYONE" etc. which is similar but less punchy.
2. **Feature triptych** — icon + title + one-line description in 3 columns. Instantly scannable. Denali could use this for "What Denali Does" instead of the current 4-card layout.
3. **Dropdown nav with descriptions** — Giga's dropdowns have title + subtitle for each item. If Denali adds more pages, this is the pattern to use instead of flat links.
4. **Serif headings for warmth** — the serif/sans mix gives Giga editorial authority AND readability. Denali's current sans-serif-only feels more "app" than "trusted health guide."
5. **Section backgrounds for visual interest** — Giga uses landscape photography. Denali could use subtle health/nature imagery or illustrations.
6. **Compliance badges in footer** — SOC2/ISO icons. Denali should show CMS pledge badges similarly.
7. **Big stat numbers** — "4% deflection rate", "2 languages." Denali could show "120-day appeal deadline", "5 appeal levels", "500+ LCD policies searched."
8. **Dual-tone page design** — alternating dark/light sections creates clear visual separation.

---

## 3. Denali Current State (for comparison)

### Landing Page (denali.health)
- Hero: "Your Medicare, Made Simple" — center-aligned, gradient bg (light blue-purple)
- Two CTAs: "Get Started Free" (filled purple) + "Learn How It Works" (outline)
- "Connect. Understand. Prevent. Appeal." — multi-color text (red, blue, green, purple)
- 4 feature cards in a row with small illustrations
- "How It Works" — 4 icon steps in a horizontal flow
- Pricing table (3 columns)
- Footer with legal links

### App Interior
- Home hub: greeting + 3 feature cards (My Health, Ask Denali, Diabetes Care)
- Chat page: sidebar + center chat area with 6 topic cards + input at bottom
- Health page: accordion cards with status dots

### What Denali Does Well
- Chat empty state with 6 clear topic cards is excellent
- Pricing transparency on landing page
- App hub is simple and focused
- Health page accordion cards with status dots are well-designed

### Where Denali Could Improve (based on Legion + Giga patterns)
- Landing page feels text-heavy — no imagery, no social proof
- Multi-color scheme creates visual noise (hero uses 4 different colors)
- No trust signals (no "Works with Medicare", no CMS pledge badges, no testimonials)
- Feature cards could be more visual (icons are small, descriptions are long)
- "How It Works" flow icons are barely visible (light colors)
- No human element — no photos, no testimonials, no real-world context
- Header tagline adds visual complexity ("Your Medicare health companion — for the communities...")

---

## 4. Recommended Actionable Changes

### Priority 1 — Quick Wins (visual clarity)

| # | Change | Inspiration | Impact |
|---|--------|-------------|--------|
| 1 | **Reduce to one accent color** — use blue consistently for all CTAs and interactive elements. Remove the 4-color "Connect. Understand. Prevent. Appeal." treatment | Legion: single blue | Less visual noise, more professional |
| 2 | **Increase section whitespace** — add 80-100px padding between landing page sections | Both sites | Easier to scan, less overwhelming |
| 3 | **Make "How It Works" steps more visible** — larger icons, bolder step numbers, more contrast | Legion's Step 1-4 cards | Users can actually see the flow |
| 4 | **Remove tagline from header** — just "DenaliHealth" logo. Move tagline to hero section | Legion (logo only in header) | Cleaner header, faster recognition |
| 5 | **Add section labels** — "FOR MEDICARE PATIENTS", "HOW IT WORKS", "PRICING" as small-caps labels above headings | Giga's "● CATEGORY" pattern | Better scannability |

### Priority 2 — Trust & Social Proof

| # | Change | Inspiration | Impact |
|---|--------|-------------|--------|
| 6 | **Add a trust bar** — "Works with Medicare.gov" + CMS pledge icon + Blue Button logo in a horizontal strip below hero | Legion's insurance logo bar | Instant credibility |
| 7 | **Add testimonial section** — even 3 quotes from real users (with first name, state, age) | Legion's carousel | Social proof, relatability for Medicare audience |
| 8 | **Show compliance badges in footer** — CMS Health AI Pledge + Diabetes Pledge icons | Giga's SOC2/ISO badges | Trust signals without cluttering |
| 9 | **Add stat highlights** — "120-day appeal deadline tracked", "500+ Medicare policies searched", "5 appeal levels supported" as big numbers | Giga's hero stats | Concrete value demonstration |

### Priority 3 — Deeper Redesign (if pursuing)

| # | Change | Inspiration | Impact |
|---|--------|-------------|--------|
| 10 | **Add human imagery** — a warm photo of a senior/caregiver on the hero, or soft illustrations | Legion's hero photo | Emotional connection for Medicare audience |
| 11 | **Consider serif headings** — use a serif font for landing page H1/H2 for warmth and authority | Giga's serif/sans mix | More "trusted guide" feel vs "tech app" |
| 12 | **Redesign feature section** — 3-column triptych with larger icons + bold titles + one-liners instead of current 4 cards with tags | Both sites | Faster scanning |
| 13 | **Add hover-reveal dropdowns to nav** — if/when adding more pages (e.g., separate Diabetes, Appeals, Coverage pages), group under "Features" dropdown with title + description | Giga's Product dropdown | Scalable navigation without clutter |
| 14 | **Dark/contrasting CTA section at bottom** — dark navy/charcoal background with "Ready to take control of your Medicare?" + CTA buttons | Legion's dark footer CTA | Strong visual close, clear next step |

---

## 5. What NOT to Copy

- Giga's dark mode default — wrong for a healthcare/Medicare audience (readability concerns for elderly users)
- Giga's abstract nature photography — doesn't match Denali's Medicare context
- Legion's extensive FAQ on the landing page — Denali already has a separate `/faq` page
- Over-animation — both sites use scroll-triggered fade-ins; Denali should keep animations minimal for performance on older devices

---

## Summary

The core theme across both sites: **simplicity through visual hierarchy, not through removing content.** Both sites have lots of information but it feels light because:

1. **One section = one idea** (never combine concepts)
2. **One accent color** (not a rainbow)
3. **Massive whitespace** (sections breathe)
4. **Visual anchors** (photos, stats, logos, badges) break up text
5. **Scannable patterns** (icon + title + one-liner triptych)

Denali's content is already good — the improvement opportunity is in how it's presented, not what's presented.
