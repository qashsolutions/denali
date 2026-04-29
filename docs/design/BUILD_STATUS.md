# Denali Build Status

Live tracker for design doc execution. Source of truth for
stage-by-stage progress and current environment state deltas.
For scope/architecture decisions, see
docs/design/denali-design-v1.1.md.

**Last updated:** 2026-04-29

---

## Current Phase

**Phase 0** — Pre-build audit + hygiene ✅ COMPLETE
**Phase 1** — Foundation Stage 1 (Prerequisites schema + cohort orchestration + C.7 tests) ✅ COMPLETE
**Phase 2** — Foundation Stages 2, 3, 4 — queued, ready to start

---

## Phase Schedule

| Phase | Content | Status |
|-------|---------|--------|
| 0 | Pre-build audit + working-tree hygiene | ✅ Complete (2026-04-22) |
| 1 | Foundation Stage 1 — Prerequisites schema + cohort orchestration + C.7 tests | ✅ Complete (2026-04-29) |
| 2 | Foundation Stages 2, 3, 4 — low-risk fixes | Queued |
| 3 | Foundation Stages 5, 6 — Guardrail Layer 1 + Safety Triggers | Queued |
| 4 | Foundation Stage 7 — BASE_PROMPT hardening | Queued |
| 5 | Foundation Stage 8 — HealthRecord canonical schema | Queued |
| 6 | Foundation Stage 9 — HTN + dyslipidemia activation | Queued |
| 7 | Foundation Stage 10 — diabetes_snapshots cleanup | Queued |
| 8+ | Vertical Slices, Input Expansion, Scope Wave 2 | Not planned yet |

---

## Per-Stage Progress

### Phase 0 — Pre-build audit + hygiene ✅ COMPLETE

**Started:** 2026-04-22
**Completed:** 2026-04-22 (same session)

**Deliverables:**

1. **Pre-build audit** identified 3 blockers and working-tree
   triage (101 entries across 4 buckets):
   - Blocker: no staging CI workflow (every push to main
     auto-deploys prod)
   - Blocker: 70 test files existed but none ran in CI
   - Blocker: working tree had 101 dirty entries

2. **Staging CI/CD pipeline established:**
   - Created `develop` branch from clean `main` at 1307f0e
   - IAM trust policy extended to allow refs/heads/develop
     alongside refs/heads/main
   - GitHub repo secrets added:
     NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_STAGING,
     NEXT_PUBLIC_APP_URL_STAGING
   - `.github/workflows/deploy-staging.yml` created (89 lines,
     mirrors prod with documented deltas)
   - First staging pipeline run succeeded end-to-end:
     commit ad65124 → ECR tag staging-ad65124d →
     denali-staging:3 → /api/health 200

3. **Working-tree hygiene completed across 10 commits:**

   On main (preamble):
   - 0a `ff5f72b` — .gitignore extension (5 patterns)
   - 0b `2cd198e` — Bucket C discards (6 untracked files:
     duplicate PNGs, regeneratable PDFs)
   - 0c `1307f0e` — Appeal snapshot preserved at
     docs/reference/appeal-process-2026-03-28.md; scratch
     docs discarded (seed-blog-posts.sql, features_*.md,
     tests_mar7.md)

   On develop (Bucket A):
   - 0d `ad65124` — Staging deploy workflow
   - A1 `3aec9c2` — 17 untracked tests + vitest coverage
     thresholds (21 files, +6,478 / -37)
   - A2 `f855322` — 44-file pre-demo hardening cohort from
     2026-04-17 (+763 / -532)
   - A3 `83b8bd4` — Infra-as-code: CFN templates, deploy
     scripts, monitor Lambda (8 files, +938)
   - A4 `31922d3` — CMS demo evidence PDFs, BAA relocated
     to docs/compliance/aws-baa-2026-02-25.pdf, legal-PDF
     generator scripts (11 files)

   On develop (Bucket B):
   - B `c46b6db` — test-runner split: AGENT.md + README.md +
     chunks/ preserved to docs/qa/test-runner/; results/,
     .DS_Store, {chunks,results} shell-mishap dir discarded;
     obesity-gap-analysis.docx discarded (22 files)

4. **Staging smoke tests passed:**
   - OTP sign-in flow (send-otp → verify-otp → session)
   - Chat message to Sonnet 4.6 via /api/chat (Medicare
     diabetes coverage response correctly generated)
   - Appeal letter generation via Opus 4.6 (Level 1
     Redetermination template populated)

**Staging progression during Phase 0:**
- Pipeline runs: 9 (all succeeded, 100% pass rate)
- Task def: :2 (pre-Phase-0) → :3 → :4 → :5 → :6 → :7 → :8
- Working tree: 101 entries → 0 (clean)

**Prod impact during Phase 0:** None. Prod deploys triggered
only by the main-branch doc commits (v1.2, v1.3 design doc
updates), all no-ops for functional behavior.

**Open questions resolved:**
- Q1 (staging strategy): Option A — feature branches with
  develop→staging auto-deploy, main→prod unchanged ✓
- Q2 (hygiene scope): Split into 4 Bucket A commits by
  semantic grouping ✓
- Q3 (app/.claude/ policy): Added to .gitignore as per-developer
  local state ✓
- Q4 (BAA destination): Tracked in docs/compliance/ with dated
  filename ✓
- Q5 (test-runner split): Preserve docs, discard results/ ✓
- Q6 (appeal process snapshot): Preserve as dated reference ✓
- Q7 (Bucket A commit strategy): 4-commit split confirmed ✓

### Phase 1 — Foundation Stage 1 ✅ COMPLETE

**Started:** 2026-04-23 (approx — migration 3039b05)
**Completed:** 2026-04-29

**Sub-stages shipped:**

- **1.A** — Prerequisites schema migration (`users.birth_year`,
  `users.is_on_medicare`, `user_conditions` table). Migration
  applied to staging RDS via Fargate task pattern. Idempotent.
- **1.B** — Profile API + UI extension. `User` type extended,
  `/api/profile` returns new fields, `ProfileCompletionModal`
  shipped (237 lines).
- **1.C.1–C.5** — Birth-year reminder cadence: 3 endpoints
  (dismiss/disable/enable), `profile-cadence.ts` helper,
  Settings → Profile section, modal cadence UX with three-button
  pattern (Save / Not now / Don't show again).
- **1.C.6** — Non-Medicare orchestration activated:
  `base.ts` split into `base-core` + `medicare-overlay`,
  `skills-loader-router.ts` introduced, `skills-loader-non-medicare.ts`
  added with 19 Medicare-specific skill suppressions and 4
  cohort-agnostic skills retained, non-Medicare acknowledgment
  overlay (`non-medicare-acknowledgment.ts`).
- **1.C.7** — Test coverage for the cohort/cadence surface:
  6 unit-test files (146 tests), 1 e2e harness self-test
  (4 tests). Cohort-test-author subagent + `app/e2e/fixtures/cohorts.ts`
  shipped as supporting infrastructure.

**C.7 test inventory:**

| File | Tests | Commit |
|------|-------|--------|
| `birth-year-reminder/dismiss/__tests__/route.test.ts` | 10 | 40ec05b |
| `birth-year-reminder/disable/__tests__/route.test.ts` | 10 | b64b5a7 |
| `birth-year-reminder/enable/__tests__/route.test.ts` | 10 | c29cfb6 |
| `lib/__tests__/profile-cadence.test.ts` | 27 | af294c5 |
| `lib/__tests__/skills-loader-router.test.ts` | 39 | 889e253 |
| `lib/__tests__/skills-loader-non-medicare.test.ts` | 46 | 52bb867 |
| `e2e/__mock-self-test.spec.ts` | 4 | 37c456c |

**E2E feature spec — scoped out, with rationale:** The non-Medicare
cohort divergence has no browser-observable surface. The 19-skill
suppression and acknowledgment overlay live entirely in the LLM
system prompt constructed server-side at `chat/route.ts:456` and
sent to Bedrock; the browser never sees it. No UI component
branches on `isOnMedicare === false`. The cohort behavior is fully
covered by the 85 unit tests in `skills-loader-router.test.ts`
and `skills-loader-non-medicare.test.ts`. A traditional Playwright
spec would have to assert against either client-sent state (which
the server overrides at `chat/route.ts:345`) or non-deterministic
model output — neither is meaningful. Test pyramid for this
feature is correctly capped at the unit layer.

**Findings logged for follow-up (not blockers):**

1. `MEDICARE_SUPPRESSED_SKILLS` is not exported as a named constant
   from `skills-loader-non-medicare.ts`. Test mirrors the list
   locally with a sync comment. Future change to the production
   list will not auto-fail the test. One-line export would close
   the gap.
2. Two skill-tree roots exist (`app/src/lib/skills/` 5 files,
   `app/src/skills/` 23 files including `core/base-core.ts` and
   `core/medicare-overlay.ts`). Grep-by-convention will miss one
   tree. Consolidation deferred.
3. Design doc Part 10 cleanup items #16 (rate-limit fail-open)
   and #17 (appeal credit client-only enforcement) remain open
   from pre-Phase-1 audit. Pre-existing in prod and staging;
   independent of cohort work.

**Staging progression during Phase 1:**
- Task def: :8 (post-Phase-0) → :51 (current)
- All staging deploys green; zero promotion to main during Phase 1.

**Prod impact during Phase 1:** None. All Phase 1 work shipped
to develop/staging only. Prod still at the post-Phase-0 state.

---

## Deployment Cadence

**Default target:** staging only (denali-staging-web,
https://staging.denali.health)

**Prod promotion policy:** Requires explicit operator approval
per stage. Default is staging-only until the operator says
otherwise.

**Feature flags:** Used for in-progress work where the staging
deploy should ship the code but keep the feature gated off
until ready.

**Current branch state:**
- `origin/main` at `1307f0e` (unchanged since Phase 0)
- `origin/develop` at `37c456c` (Phase 1 complete; 38+ commits
  ahead of main covering migration, profile UI, cadence
  endpoints, non-Medicare orchestration, and C.7 test coverage)

---

## Open Questions Log

_Phase 0 questions all resolved (see Phase 0 per-stage notes
above). No active open questions blocking Phase 1._

_New questions will be logged here as they arise during Stage 1
and beyond._

---
