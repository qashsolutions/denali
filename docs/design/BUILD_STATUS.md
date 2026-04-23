# Denali Build Status

Live tracker for design doc execution. Source of truth for
stage-by-stage progress and current environment state deltas.
For scope/architecture decisions, see
docs/design/denali-design-v1.1.md.

**Last updated:** 2026-04-22

---

## Current Phase

**Phase 0** — Pre-build audit + hygiene ✅ COMPLETE
**Phase 1** — Foundation Stage 1 (Prerequisites schema) — queued, ready to start

---

## Phase Schedule

| Phase | Content | Status |
|-------|---------|--------|
| 0 | Pre-build audit + working-tree hygiene | ✅ Complete (2026-04-22) |
| 1 | Foundation Stage 1 — Prerequisites schema (birth_year, is_on_medicare, user_conditions) | Queued |
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

### Phase 1 — Foundation Stage 1 (queued)

**Prerequisites:**
- Clean working tree ✓
- develop branch with staging pipeline ✓
- Design doc v1.2 as source of truth ✓
- Staging smoke-tested ✓

**Stage 1 scope** (per Claude Code's 10-stage plan and design
doc Part 9 Prerequisites):
- Add `users.birth_year INTEGER NULL` (prompt legacy users on
  next sign-in)
- Add `users.is_on_medicare BOOLEAN NOT NULL DEFAULT false`
  (auto-backfill true for users with active BB connections)
- Create `user_conditions` table

**Pre-Stage-1 open questions:** none blocking — earlier Q1/Q2
answers stand (NOT NULL for new signups with prompt for legacy;
auto-backfill via BB connection; no new design-doc-compliance
subagent).

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
- `origin/main` at `1307f0e` (3 hygiene commits + doc bumps)
- `origin/develop` at `c46b6db` (6 commits ahead of main:
  workflow + 4 Bucket A + 1 Bucket B)

---

## Open Questions Log

_Phase 0 questions all resolved (see Phase 0 per-stage notes
above). No active open questions blocking Phase 1._

_New questions will be logged here as they arise during Stage 1
and beyond._

---
