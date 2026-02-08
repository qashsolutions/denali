# Health Records Skill

## Purpose
Personalizes Claude's guidance when the user has connected their Medicare account via CMS Blue Button 2.0.

## Trigger
- `hasHealthData: true` — user has an active Blue Button connection with cached data
- `hasRecentDenials: true` — user has denied claims in their recent EOB data

## Data Flow
```
User connects Medicare → OAuth → tokens stored (encrypted) → FHIR fetch → transform → fhir_cache
Chat route reads from fhir_cache → populates sessionState health fields → skill loads
```

## SessionState Fields
- `healthDataAvailable: boolean` — whether Blue Button data exists
- `activeCoverage: string[]` — e.g., ["Medicare Part A", "Medicare Part B"]
- `recentDenials: Array<{ serviceDate, procedure, denialCode, denialReason }>` — denied claims

## Behavior
1. **Skip redundant questions** — Don't ask about coverage type when we can see it
2. **Proactive denial help** — Offer to explain/appeal denied claims
3. **Coverage-aware guidance** — Reference actual Parts A/B/D status
4. **Privacy** — Never echo back full names, Medicare IDs, or addresses

## Data Sources
- Patient demographics (name, DOB, Medicare ID — masked)
- Coverage status (Part A/B/C/D, active/cancelled)
- Claims/EOBs (service dates, providers, amounts, denial status)

## Related Files
- `src/lib/fhir/` — FHIR client, transforms, sync, tokens, crypto
- `src/lib/fhir/context.ts` — Builds prompt injection from health data
- `src/lib/skills/health-records.ts` — Skill prompt constant
- `src/hooks/useHealthData.ts` — Client hook
- `src/components/health/` — UI components
- `src/app/app/health/page.tsx` — Health page
- `src/app/api/fhir/` — OAuth routes (authorize, callback, disconnect, data)
