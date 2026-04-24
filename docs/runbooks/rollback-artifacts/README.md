# Rollback Artifacts

This directory contains IAM policies and configuration documents captured before deprecation, preserved for emergency rollback scenarios.

## `denali-deploy-policy.json`

**What:** The inline policy that was attached to `denali-github-actions-role` prior to 2026-04-23.

**Why preserved:** Role was disarmed (inline policy detached) in Phase C Step 13 of the 2026-04-23 infrastructure hardening session. The role shell remains at `arn:aws:iam::236823123138:role/denali-github-actions-role` with its trust policy intact as a cooling-off rollback target.

**How to use (emergency only):**

If both new roles (`denali-prod-deploy-role` and `denali-staging-deploy-role`) are simultaneously broken and CI/CD is blocked:

1. Restore the policy to the shared role:

   ```bash
   aws iam put-role-policy \
     --role-name denali-github-actions-role \
     --policy-name denali-deploy-policy \
     --policy-document file://docs/runbooks/rollback-artifacts/denali-deploy-policy.json
   ```

2. Revert workflow `role-to-assume` ARNs back to the shared role:

   `deploy.yml` (line ~32):
   ```yaml
   role-to-assume: arn:aws:iam::236823123138:role/denali-github-actions-role
   ```

   `deploy-staging.yml` (line ~32):
   ```yaml
   role-to-assume: arn:aws:iam::236823123138:role/denali-github-actions-role
   ```

3. Commit workflow changes on both `main` and `develop`.

4. After recovery, investigate why the new roles failed and fix forward. Do NOT treat the shared role as a permanent solution — its trust policy allows cross-branch access which violates least-privilege.

## Expiration

Rollback artifacts in this directory should be reviewed every 90 days. If the shared role has been rolled back to the permanent solution, delete:
- The corresponding `.json` file
- The role itself (`aws iam delete-role --role-name denali-github-actions-role`)
- This README section
