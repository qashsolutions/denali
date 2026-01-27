---
name: ui-ux
description: Frontend patterns, components, design system, and accessibility guidelines
version: 1.0.0
context: infrastructure
---

# UI/UX Skill

This skill defines the user interface patterns, design system, and accessibility requirements for the denali.health PWA.

## Design Philosophy

### 1. Minimal Interface

- Just a chat box — no complex forms
- Information appears as conversation
- Actions are suggestions, not menus
- Progressive disclosure of complexity

### 2. Mobile-First

- Medicare patients often use phones/tablets
- Touch-friendly targets (44x44px minimum)
- Readable fonts (16px minimum)
- Works offline (PWA)

### 3. Accessible by Default

- High contrast option
- Scalable text (0.8x - 1.5x)
- Screen reader compatible
- No time-limited interactions

## Design System

### Color Palette

#### Dark Theme (Default)

```css
/* Backgrounds */
--bg-primary: #0f172a;     /* Slate 900 */
--bg-secondary: #1e293b;   /* Slate 800 */
--bg-tertiary: #334155;    /* Slate 700 */

/* Text */
--text-primary: #ffffff;    /* White */
--text-secondary: #94a3b8;  /* Slate 400 */
--text-muted: #64748b;      /* Slate 500 */

/* Accents */
--accent-primary: #3b82f6;  /* Blue 500 */
--accent-secondary: #8b5cf6; /* Violet 500 */

/* Semantic */
--success: #10b981;         /* Emerald 500 */
--warning: #f59e0b;         /* Amber 500 */
--error: #ef4444;           /* Red 500 */

/* Components */
--user-bubble: linear-gradient(135deg, #3b82f6, #2563eb);
--assistant-bubble: #1e293b;
--border: #334155;
```

#### Light Theme

```css
/* Backgrounds */
--bg-primary: #f8fafc;     /* Slate 50 */
--bg-secondary: #ffffff;   /* White */
--bg-tertiary: #f1f5f9;    /* Slate 100 */

/* Text */
--text-primary: #0f172a;   /* Slate 900 */
--text-secondary: #475569; /* Slate 600 */
--text-muted: #94a3b8;     /* Slate 400 */

/* Accents */
--accent-primary: #2563eb;  /* Blue 600 */
--accent-secondary: #7c3aed; /* Violet 600 */

/* Semantic */
--success: #059669;         /* Emerald 600 */
--warning: #d97706;         /* Amber 600 */
--error: #dc2626;           /* Red 600 */

/* Components */
--user-bubble: linear-gradient(135deg, #2563eb, #1d4ed8);
--assistant-bubble: #ffffff;
--border: #e2e8f0;
```

### Typography

```css
/* Font Stack */
font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

/* Sizes */
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
--text-3xl: 1.875rem;  /* 30px */

/* Weights */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

| Element | Size | Weight |
|---------|------|--------|
| Greeting | 28px | Bold (700) |
| Body | 16px | Regular (400) |
| Labels | 12px | Semibold (600) |
| Buttons | 15px | Semibold (600) |
| Suggestions | 14px | Medium (500) |

### Spacing

```css
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-5: 1.25rem;   /* 20px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-10: 2.5rem;   /* 40px */
--space-12: 3rem;     /* 48px */
```

### Border Radius

```css
--radius-sm: 0.375rem;  /* 6px */
--radius-md: 0.5rem;    /* 8px */
--radius-lg: 0.75rem;   /* 12px */
--radius-xl: 1rem;      /* 16px */
--radius-full: 9999px;  /* Pill shape */
```

## Components

### Chat Input

```jsx
<div className="chat-input">
  <textarea
    placeholder="Type your message..."
    rows={1}
    autoFocus
  />
  <button type="submit" aria-label="Send message">
    <SendIcon />
  </button>
</div>
```

**Styles**:
- Full width with padding
- Auto-expanding textarea
- Send button aligned right
- Disabled state when empty

### Message Bubble

```jsx
// User message
<div className="message message--user">
  <div className="message__content">
    {content}
  </div>
</div>

// Assistant message
<div className="message message--assistant">
  <div className="message__content">
    {content}
  </div>
  <div className="message__feedback">
    <button aria-label="Helpful">👍</button>
    <button aria-label="Not helpful">👎</button>
  </div>
</div>
```

**Styles**:
- User: Right-aligned, blue gradient background
- Assistant: Left-aligned, card background
- Max width 85% of container
- Rounded corners (more on opposite side)

### Suggestions

```jsx
<div className="suggestions">
  <button className="suggestion-chip">
    Print this checklist
  </button>
  <button className="suggestion-chip">
    What if it's denied?
  </button>
</div>
```

**Styles**:
- Horizontal scroll on mobile
- Pill-shaped buttons
- Subtle border, no fill
- Hover/tap feedback

### Checklist

```jsx
<div className="checklist">
  <h3>What the doctor needs to document:</h3>
  <ul>
    <li className="checklist__item">
      <span className="checklist__checkbox">□</span>
      <span className="checklist__text">Pain has lasted more than 6 weeks</span>
    </li>
    <li className="checklist__item checklist__item--checked">
      <span className="checklist__checkbox">✓</span>
      <span className="checklist__text">Radiating symptoms</span>
    </li>
  </ul>
</div>
```

### Loading States

```jsx
// Inline loading
<div className="loading-dots">
  <span>.</span><span>.</span><span>.</span>
</div>

// Full message loading
<div className="message message--assistant message--loading">
  <div className="loading-indicator">
    Checking Medicare policies...
  </div>
</div>
```

### Theme Toggle

```jsx
<button
  className="theme-toggle"
  onClick={toggleTheme}
  aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
>
  {isDark ? '☀️' : '🌙'}
</button>
```

## Screen Layouts

### Welcome Screen

```
┌─────────────────────────────────────────────────┐
│  🏔️ Evening, [Name]              [☀️/🌙]       │
│                                                 │
│  What can I help you with today?                │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Type your question...              [→]  │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────┐ ┌──────────────────────┐  │
│  │ 📋 Past questions│ │ ❓ How does this work │  │
│  └─────────────────┘ └──────────────────────┘  │
└─────────────────────────────────────────────────┘
```

### Conversation Screen

```
┌─────────────────────────────────────────────────┐
│  ← Back                          [☀️/🌙]       │
│─────────────────────────────────────────────────│
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ I'd be happy to help with your mom's    │   │
│  │ back scan. A few quick questions...     │   │
│  │                                         │   │
│  │ How long has she been having back       │   │
│  │ problems?                               │   │
│  │                                 👍 👎    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│                          ┌─────────────────────┐│
│                          │ About 3 months      ││
│                          └─────────────────────┘│
│                                                 │
│  ┌─────────────────┐ ┌──────────────────────┐  │
│  │ Yes, into her leg│ │ No, just her back    │  │
│  └─────────────────┘ └──────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ Type your message...              [→]   │   │
│  └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

### Guidance Output Screen

```
┌─────────────────────────────────────────────────┐
│  ← Back                          [☀️/🌙]       │
│─────────────────────────────────────────────────│
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ ✅ Good news — Medicare typically covers │   │
│  │ a lumbar MRI for your mom's situation.  │   │
│  │                                         │   │
│  │ Here's what the doctor needs to         │   │
│  │ document:                               │   │
│  │                                         │   │
│  │ □ Pain has lasted more than 6 weeks     │   │
│  │ □ She's tried medication or PT first    │   │
│  │ □ Neurological symptoms (leg tingling)  │   │
│  │                                         │   │
│  │ Print this and bring it to her          │   │
│  │ appointment.                            │   │
│  │                                 👍 👎    │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  ┌─────────────────┐ ┌──────────────────────┐  │
│  │ 🖨️ Print this   │ │ 🆕 New question       │  │
│  └─────────────────┘ └──────────────────────┘  │
│                                                 │
│  Was this helpful?                              │
└─────────────────────────────────────────────────┘
```

## Accessibility

### Requirements

| Requirement | Implementation |
|-------------|----------------|
| Minimum font size | 16px base, scalable 0.8x-1.5x |
| Color contrast | 4.5:1 minimum (WCAG AA) |
| Touch targets | 44x44px minimum |
| Focus indicators | Visible focus ring on all interactive elements |
| Screen readers | ARIA labels on all controls |
| Motion | Respect `prefers-reduced-motion` |
| Time limits | No auto-dismissing content |

### ARIA Labels

```jsx
// Good
<button aria-label="Send message">
  <SendIcon />
</button>

// Good
<div role="alert" aria-live="polite">
  Checking Medicare policies...
</div>

// Good
<input
  aria-label="Type your message"
  aria-describedby="input-hint"
/>
```

### Keyboard Navigation

- Tab: Move between interactive elements
- Enter/Space: Activate buttons
- Escape: Close modals, cancel actions
- Arrow keys: Navigate suggestions

### High Contrast Mode

```css
[data-high-contrast="true"] {
  --text-primary: #000000;
  --text-secondary: #333333;
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --border: #000000;
  --accent-primary: #0000cc;
}
```

### Text Scaling

```css
:root {
  --text-scale: 1;
}

body {
  font-size: calc(16px * var(--text-scale));
}

/* Settings: 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5 */
```

## Animations

### Allowed Animations

- Message fade-in (subtle)
- Loading dots pulse
- Button press feedback
- Smooth scrolling

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Responsive Breakpoints

```css
/* Mobile first */
--breakpoint-sm: 640px;   /* Small tablets */
--breakpoint-md: 768px;   /* Tablets */
--breakpoint-lg: 1024px;  /* Laptops */
--breakpoint-xl: 1280px;  /* Desktops */
```

### Mobile (< 640px)
- Full-width chat
- Stacked suggestions
- Bottom-aligned input

### Tablet (768px+)
- Centered chat container (max 600px)
- Horizontal suggestions
- Floating input

### Desktop (1024px+)
- Sidebar for history (optional)
- Two-column layout possible
- Same chat experience

## PWA Requirements

### Manifest

```json
{
  "name": "Denali Health",
  "short_name": "Denali",
  "description": "Medicare coverage guidance",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#3b82f6",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

### Offline Support

- Cache app shell
- Show offline indicator
- Queue messages for retry
- Store conversation locally

## Print Styles

```css
@media print {
  /* Hide non-essential elements */
  .chat-input,
  .suggestions,
  .feedback,
  .theme-toggle,
  nav {
    display: none !important;
  }

  /* Format checklist for printing */
  .checklist {
    border: 1px solid #000;
    padding: 1rem;
    break-inside: avoid;
  }

  /* Add footer */
  body::after {
    content: "Generated by denali.health";
    display: block;
    text-align: center;
    margin-top: 2rem;
    font-size: 12px;
    color: #666;
  }
}
```
