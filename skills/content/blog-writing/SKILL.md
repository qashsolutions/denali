# Blog Writing — Voice & Style Guide

## Purpose
SEO-driven blog posts for Denali.health. Each post helps Medicare patients understand denial codes, coverage questions, appeals, and prior authorization — in plain, warm language.

## Voice
- 8th grade reading level
- Warm, empathetic, encouraging — never clinical or bureaucratic
- Story-form: open with a real scenario ("Margaret just got a letter from Medicare...")
- Short sentences. Short paragraphs. No jargon.
- Speak directly to the reader: "you," "your"

## Structure

Every post follows this format:

1. **Headline** — Clear, searchable (e.g., "What Does Medicare Denial Code CO-50 Mean?")
2. **Kicker** — 1-line hook below headline (e.g., "This is the most common Medicare denial — and it's often fixable.")
3. **Key Message** — Core takeaway in 1-2 sentences (shown as callout)
4. **Body** — ~100 words, story-form:
   - Open with a scenario (real-sounding person + situation)
   - Explain the topic simply
   - Give the reader a clear action to take
5. **CTA** — Link to Denali.health chat

## Word Count
Target ~100 words for the body. Brevity is the goal — every sentence earns its place.

## Categories
- `denial-codes` — What specific denial codes mean and what to do
- `coverage` — Whether Medicare covers specific procedures
- `appeals` — How to appeal denials
- `prior-auth` — Prior authorization requirements

## CTA Options
- "Check your coverage on Denali.health" → `/chat`
- "Generate your appeal letter now" → `/chat`
- "Ask Denali about your denial" → `/chat`

## Attribution
- Cite CMS data, LCD/NCD policy numbers, real statistics
- Use `sources` array: `["CMS.gov", "LCD L35936", "Medicare Claims Processing Manual Ch. 1"]`
- Never fabricate statistics

## SEO
- `meta_title`: Include primary keyword, max 60 chars
- `meta_description`: Include keyword + benefit, max 155 chars
- Headline should match common Google searches

## Tone Examples

**Good:** "Margaret just got a letter from Medicare saying her MRI was denied. The code on the letter — CO-50 — means Medicare didn't think the MRI was medically necessary. That sounds scary, but it's actually the most common denial reason, and it's often overturned on appeal."

**Bad:** "Claim Adjustment Reason Code 50 indicates that the services rendered were deemed not medically necessary per the payer's clinical coverage determination policies."
