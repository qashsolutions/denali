# Denali Build Status

Live tracker for design doc execution. Source of truth for
stage-by-stage progress and current environment state deltas.
For scope/architecture decisions, see
docs/design/denali-design-v1.1.md.

**Last updated:** 2026-04-22

---

## Current Phase

**Phase 0** — Pre-build audit + hygiene (in progress)

---

## Phase Schedule

| Phase | Content | Status |
|-------|---------|--------|
| 0 | Pre-build audit + working-tree hygiene | In progress |
| 1 | Foundation Stage 1 — Prerequisites schema (birth_year, is_on_medicare, user_conditions) | Queued |
| 2 | Foundation Stages 2, 3, 4 — low-risk fixes (hipaa-security-reviewer perms, chat body-size cap, OTP rate limiter DB) | Queued |
| 3 | Foundation Stages 5, 6 — Guardrail Layer 1 + Safety Triggers (all 12) | Queued |
| 4 | Foundation Stage 7 — BASE_PROMPT hardening (Layer 2) | Queued |
| 5 | Foundation Stage 8 — HealthRecord canonical schema + CMSBlueButtonConnector rewrap | Queued |
| 6 | Foundation Stage 9 — HTN + dyslipidemia activation | Queued |
| 7 | Foundation Stage 10 — diabetes_snapshots cleanup | Queued |
| 8+ | Vertical Slices, Input Expansion, Scope Wave 2 (per design doc Part 9) | Not planned yet |

---

## Per-Stage Progress

### Phase 0 — Pre-build audit + hygiene
**Started:** 2026-04-22

_No per-stage notes yet._

---

## Deployment Cadence

**Default target:** staging only (denali-staging-web, https://staging.denali.health)

**Prod promotion policy:** Requires explicit operator approval per stage. Default is staging-only until the operator says otherwise.

**Feature flags:** Used for in-progress work where the staging deploy should ship the code but keep the feature gated off until ready.

---

## Open Questions Log

(Design-doc-scope questions that arise during build. Resolved questions move out of this section into the design doc proper or are answered inline in per-stage notes.)

_None yet._

---
