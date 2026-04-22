# Denali Build Status

Live tracker for design doc execution. Source of truth for
stage-by-stage progress and current environment state deltas.
For scope/architecture decisions, see
docs/design/denali-design-v1.1.md.

**Last updated:** 2026-04-22

---

## Current Phase

**Phase 0** — Pre-build audit + hygiene (audit complete; hygiene commit pending)

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
**Audit completed:** 2026-04-22

#### Step 1 — Working-tree triage
- 48 tracked files modified, +911/−569; 2 deletions; 30+ untracked paths.
- Dominant cohort: auth + API route edits dated 2026-04-17 (`middleware.ts`, all `/api/auth/*`, `/api/chat/*`, `/api/fhir/*`, `/api/health-report/*`, `/api/diabetes/*`, `/api/webhooks/stripe/*`) — residue of pre-demo security-hardening session that never committed.
- 25 new unit tests + 1 new E2E spec (`appeal-levels.spec.ts`) untracked.
- `vitest.config.ts` modified (+120 lines coverage thresholds) but uncommitted.
- `scripts/seed-blog-posts.sql` untracked — matches design doc Cleanup #18; do not stage.
- Build/tooling droppings (`.next/`, `denali-monitor/`, `sessionmanager-bundle/`, `test-runner/`, `app/.claude/`, zip archives) should move to `.gitignore`.
- Recommendation: one "pre-foundation hygiene" commit covering tracked-edit cohort + 26 untracked tests + vitest config + deletions before Stage 1.

#### Step 2 — Staging deployment pipeline
- Only workflow: `.github/workflows/deploy.yml`. Runs on every push to `main`; deploys to **prod** (`denali` / `denali-web`). Image tag = full git SHA.
- **No staging workflow exists.** Staging deploys are manual (build → ECR push → `update-service --force-new-deployment` against `denali-staging-web`).
- Task def state right now: prod = `denali:165`, staging = `denali-staging:2`.
- Recent 5 deploy.yml runs all SUCCESS; latest triggered by the v1.2 design-doc commit itself 4m23s ago (raised prod from `:164` → `:165`).
- **This blocks the "staging-only default" deployment cadence policy** until resolved.

#### Step 3 — Test inventory
- Vitest (unit, 25 files) + Playwright (E2E, 45 files) = 70 total.
- CI has **no test step** — deploy.yml is build-only. Recent SUCCESS runs reflect build compilation, not test results.
- 26 test files untracked in git (25 unit + 1 E2E).
- Critical-path unit coverage present: `/api/chat` (37), `/api/auth/refresh` (13), `/api/auth/cognito` (25), `/api/health`, `/api/consent`, `/api/account/delete`, `/api/webhooks/stripe`, plus `claude.test.ts` (40 tests, extraction pipeline). No dedicated `skills-loader.test.ts` or `/api/auth/send-otp` unit test.
- No `__fixtures__` directory pattern yet — to be introduced in Foundation Stage 6 for safety triggers.

#### Step 4 — Branch / deploy strategy
- Local branches: `main` (active, 1 unpushed commit = `4eabe67` BUILD_STATUS.md add), `aws-migration` (stale, migration complete).
- Remote: `origin/main` at `6f3f929`; `origin/add-claude-github-actions-1776046832127` (stale helper branch, prune candidate).
- No Foundation branches exist. Path forward depends on staging-deploy decision (see Open Questions).

#### Step 5 — Foundation Stage 1 preconditions
- Source of truth: `sql/001-schema.sql` (fresh prod pg_dump, 2026-04-21 21:32).
- `users.birth_year` — **does not exist**.
- `users.is_on_medicare` — **does not exist**.
- `user_conditions` table — **does not exist**.
- `scripts/migrate-prod-drift-recovery.sql` is the staging-bootstrap catch-up; idempotent (`IF NOT EXISTS` everywhere); already schema-applied to staging per Part 14. Not a Stage 1 concern.
- **Stage 1 is UNBLOCKED.** Migration is purely additive, no backfill required on Day 1, no name conflicts.

#### Design doc updates applied (v1.2 → v1.3)
- Part 10 Cleanup Backlog: added #21 (no staging CI workflow) and #22 (tests not wired into CI).
- Part 14 Production: prod task def bumped :164 → :165.
- Part 14 Known Gaps: added CI staging + test-in-CI deficits.
- Part 14 new subsection "Pre-Foundation Audit — 2026-04-22" with preconditions result.
- Part 13 Versioning: v1.3 changelog entry.

---

## Deployment Cadence

**Default target:** staging only (denali-staging-web, https://staging.denali.health)

**Prod promotion policy:** Requires explicit operator approval per stage. Default is staging-only until the operator says otherwise.

**Feature flags:** Used for in-progress work where the staging deploy should ship the code but keep the feature gated off until ready.

---

## Open Questions Log

(Design-doc-scope questions that arise during build. Resolved questions move out of this section into the design doc proper or are answered inline in per-stage notes.)

### Blocking Stage 1
1. **Staging deploy strategy.** Three options, pick one before Stage 1:
   (a) Add a staging workflow gated on branch pattern `foundation/*` or `workflow_dispatch` with env selector.
   (b) Work Foundation stages on non-`main` branches; staging deploys done manually (ECS force-new-deployment); promote to prod via merge to `main` only when explicitly approved.
   (c) Temporarily disable `.github/workflows/deploy.yml` `main` trigger until a staging workflow lands.
   **Recommendation:** (b) for minimal infra churn — can ship Stage 1 next; add a real staging workflow later as its own stage. But operator decides.

2. **Pre-foundation hygiene commit scope.** Confirm the commit should include cohorts #1–5 + #11 from Step 1 triage (tracked edits + 26 untracked tests + vitest config + 2 deletions), and leave #6–10, #12 for separate handling.

3. **Untracked `app/.claude/` directory.** Likely local Claude Code configuration — should this be gitignored project-wide or committed?

### Non-blocking but worth recording
4. The "575 unit tests" figure cited in CLAUDE.md depends on the 25 untracked unit test files being committed. Once they land, re-verify the count and update CLAUDE.md Testing section if it drifts.
5. Foundation Stage 1 H#1 (birth_year NOT NULL strategy) and H#2 (is_on_medicare backfill) from the prior planning pass remain open but do not block the initial additive migration. Decide before the second Stage 1 sub-step that would enforce NOT NULL.

---
