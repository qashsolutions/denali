# Staging vs Prod — Architectural Divergence

**Last updated:** 2026-04-29
**Status:** Active — read this before drafting any commit that touches cohort, longitudinal, or 55+ surfaces.

## Context

Denali was originally built as a single-environment product on the `main` branch, deployed to the `denali` ECS cluster. The original product scope was:

- **User cohort:** Medicare enrollees (65+)
- **Conditions:** pre-diabetes, diabetes, obesity
- **Surfaces:** chat-based Medicare coverage Q&A, appeal letter generation, Blue Button data ingestion (sandbox)

A `develop` branch and `denali-staging` cluster were stood up during Phase 0 (2026-04-22) so that ongoing changes could be validated before reaching prod. At that time, staging was a faithful replica of prod.

## The pivot

After CMS Blue Button team feedback and product-side review, the scope expanded to a longitudinal pre-Medicare → Medicare platform for adults 55+ — see `denali-design-v1.1.md` Parts 1, 2, and 4. This expansion is not an iterative improvement of the existing Medicare product; it is a substantially larger product surface (voice intake, EHR/labs/pharmacy integrations, longitudinal record assembly, prognostic trajectories) that converges on Blue Button at age 65.

CMS Blue Button **production** access was granted 2026-04-29 (approximately one hour before this doc was written). Most other CMS-related docs in the repo (`docs/cms-demo-qa.md`, `docs/BLUE_BUTTON_INTEGRATION.md`, `CLAUDE.md` Quick Reference) are pre-grant and have not yet been updated to reflect post-grant state.

## The decision

**Staging is the forward-development branch for the 55+ platform. After thorough testing in staging, the 55+ platform will migrate to prod, where it will join (not replace) the existing Medicare surface — making prod a unified product that serves both 55+ pre-Medicare users and 65+ Medicare users.**

This is a temporary divergence, not a permanent fork. The intent is reunification:

- **Prod (`main`, `denali` cluster) today:** Medicare-only product. Stable. No new feature work happens here. Receives only critical bug fixes and compliance changes.
- **Staging (`develop`, `denali-staging` cluster) today:** longitudinal 55+ platform under construction, layered alongside the cohort-routing infrastructure shipped 2026-04-29.
- **Prod after migration (timing TBD):** the 55+ platform code, fully tested in staging, promotes to prod. Cohort routing already in place means existing Medicare users continue to receive the Medicare experience while new 55+ users get the longitudinal-platform experience. One codebase, two cohorts, one prod environment.

The "after thorough testing" qualifier is load-bearing. Promotion is not a calendar event; it's gated on the 55+ platform reaching production-quality across the dimensions that matter: feature completeness for the initial 55+ scope, test coverage at all layers, observability and rollback story, HIPAA review of new data surfaces (EHR, labs, voice), and operator confidence that promotion will not regress the existing Medicare experience.

## Promotion semantics

Promotion of staging→prod is the planned outcome. The path and trigger are not yet defined and will be decided closer to readiness.

What's true today:

- `develop` → `main` merges are not part of any current cadence. No PRs are being opened.
- The IAM split (`denali-prod-deploy-role` trusts `refs/heads/main` only) is the technical guardrail enforcing the "no accidental promotion" rule. This guardrail stays in place through migration; it's not removed when promotion happens, just exercised deliberately.
- Each commit on `develop` from now through migration is implicitly destined for prod eventually, but the migration itself will be a deliberate, scoped event — not a continuous rolling promotion of every commit.

What's not yet decided (pre-migration):

- Whether migration is a single bulk merge of `develop` into `main`, or a curated cherry-pick of validated commits.
- Whether migration ships behind a feature flag (so 55+ surfaces are dark on prod until explicitly enabled) or hot (live on first deploy).
- Whether the migration deploy is a normal blue/green ECS rollout on the existing `denali` cluster, or whether the cluster itself is replaced.
- The cutover plan for existing Medicare users — whether their experience changes at all on migration day, or whether the cohort router preserves their existing UX exactly while only the 55+ surface is added.

What this means for any commit drafted today: write it as if it will run in prod someday, because it will. "Staging-only" today does not mean "never promoted"; it means "not promoted until the operator decides the platform is ready."

## What this means for any new commit

Before drafting a commit, identify which surface it touches:

- **Medicare-product bug fix or compliance change** → may eventually promote to prod via the existing per-stage review. Examples: rate-limit fail-open (Part 10 #16), appeal credit enforcement (Part 10 #17).
- **Longitudinal / 55+ / cohort / EHR / labs / pharmacy / voice intake / prognostic** → staging only until migration; ultimately destined for prod as part of the unified product. Examples: cohort-routing infrastructure (Stage 1.C, shipped 2026-04-29), upcoming voice Q&A intake, EHR aggregator integration.
- **Cross-cutting (touches both surfaces)** → discuss before drafting. Treat as longitudinal-only by default; only flag for early prod-promotion if the operator explicitly says so.

## Design debt for the 55+ platform

The current design doc (`denali-design-v1.1.md`) carries the product **vision** for 55+ (Parts 1, 2, 4) but does not yet specify the infrastructure that will deliver it. The Stage 1.C cohort-routing work shipped 2026-04-29 was the first concrete piece — distinguishing pre-Medicare from Medicare users. The next pieces are not yet designed:

**Agents and subagents** (dev-time and runtime):
- Existing dev-time subagents (`cohort-test-author`, `negative-test-validator`, `hipaa-security-reviewer`, etc.) are scoped to the existing Medicare surface and to suppression of Medicare features for non-Medicare users. None are scoped to authoring tests for the new 55+ feature surfaces.
- The runtime agents specified in `denali-design-v1.1.md` Part 5 (scope-guard, safety-trigger) are aligned to the existing product. New runtime agents may be needed for voice intake (real-time symptom triage), EHR data normalization, and prognostic synthesis. None are designed yet.

**Skills:**
- The current skill inventory (`app/src/skills/` and `app/src/lib/skills/`) is 23 files, of which 19 are Medicare-specific and suppressed for non-Medicare users. The 4 cohort-agnostic skills (counselor, provider lookup, red-flag, prompting) are not enough surface to support voice symptom intake, EHR-data interpretation, lab-trend analysis, or prognostic generation.
- New skill categories needed for the 55+ platform: symptom-intake (voice + structured), EHR-record interpretation (Epic/Cerner FHIR), lab-direct interpretation (Quest/LabCorp), longitudinal-trend analysis, prognostic-trajectory synthesis. Each needs its own design before any code lands.

**Test strategy:**
- The cohort-test-author subagent shipped 2026-04-29 is scoped to authoring tests for code that branches on `is_on_medicare` or `birth_year`. It is NOT scoped to authoring tests for new 55+ features whose code does not yet exist.
- The 55+ platform will need its own test strategy: how voice intake is exercised in CI (recorded audio fixtures? transcripts only?), how EHR/lab integrations are tested without real PHI, how prognostic outputs are validated (deterministic? snapshot? bounded-range assertions?). None of this is designed yet.
- Because the 55+ platform is destined for prod, the test bar must be the prod bar — not a "good enough for staging" bar.

**Action implied:** before any 55+ feature code is drafted, the next step is to design the agent/subagent/skill/test infrastructure that will support it, and to capture that design either as additions to `denali-design-v1.1.md` or as companion docs alongside it. Building the first 55+ feature without this infrastructure design risks repeating the cohort-routing pattern (scaffolding shipped first, then tests bolted on after) at a much larger scale.

## Open questions deferred

These need answers before migration. Not blocking current work; tracked here so they aren't forgotten:

1. **Migration mechanics:** bulk merge `develop`→`main`, or curated cherry-pick of commits validated as production-ready?
2. **Feature-flag strategy:** does the 55+ platform ship dark on prod (gated behind a flag) or live on first deploy?
3. **Cluster strategy:** does the unified product stay on the existing `denali` cluster, move to a new cluster, or run side-by-side during cutover?
4. **Existing-user impact:** on migration day, does the experience for current Medicare users change at all? The cohort router shipped 2026-04-29 is designed to preserve their experience exactly — confirm this holds end-to-end.
5. **Migration verification:** what's the test plan for the migration itself? (Distinct from the per-feature test coverage already being built — this is testing that the migration *event* doesn't regress prod.)
6. **Rollback plan:** if the migration goes wrong, what's the path back? IAM-level prevention of bad deploys is in place; what about the case where a deploy succeeds but the prod behavior is wrong?

## References

- Build status: `docs/design/BUILD_STATUS.md`
- Design doc: `docs/design/denali-design-v1.1.md` (Parts 1, 2, 4 cover the 55+ vision)
- Cohort scaffolding shipped 2026-04-29: commits f91a454 through fea8f0c on develop
- Blue Button integration plan: `docs/BLUE_BUTTON_INTEGRATION.md` (note: pre-prod-grant — does not yet reflect 2026-04-29 grant)
