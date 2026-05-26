# Merge Patterns Reference

Operational playbook for merging long-lived branches into main. Captures
the audit → resolution → deploy pattern used for the 2026-05-25
develop→main merge. Reusable for future long-lived branch reconciliation.

For schema migration application via ECS exec: § 2 below.
For deploy.yml structure: docs/reference/infrastructure.md.

---

**When this applies**: long-lived branch reconciliation — typically 4+ weeks
of divergence with substantive runtime work on both sides. Routine PR-shaped
feature branches don't need this ceremony; merge them normally via PR review
+ CI gates. Use this playbook when the source branch has its own deploy
stream (e.g., develop → staging), schema migrations or env vars differ
between sides, or the conflict count exceeds 5 files.

---

### 1. Pre-merge audit (5-blocker checklist)

Run all five before touching git. Failures here are blockers — fix before
merging, not after.

| # | Check | Command |
|---|-------|---------|
| 1 | Schema migrations only on source | `git diff main..develop --name-only -- 'scripts/migrate-*.sql' '*.sql'` |
| 2 | Env vars only on source | `diff <(git grep -h 'process\.env\.' main -- 'app/src/**/*.ts' \| grep -oE 'process\.env\.[A-Z_]+' \| sort -u) <(git grep -h 'process\.env\.' develop -- 'app/src/**/*.ts' \| grep -oE 'process\.env\.[A-Z_]+' \| sort -u)` |
| 3 | New AWS SDK clients (IAM implication) | `git grep -l 'CloudWatchClient\|SecretsManagerClient\|S3Client' develop main -- 'app/src/**/*.ts'` |
| 4 | Package dependency drift | `git diff main..develop -- app/package.json app/package-lock.json` |
| 5 | Conflict surface (dry-run) | `git merge-tree --write-tree main develop` |

**Blocker #1**: each migration must be applied to the target environment's
database **before** code deploys. If develop's code references a column
that prod RDS doesn't have, every request hitting that route 500s on
`column "X" of relation "users" does not exist`.

**Blocker #3**: new AWS SDK usage requires task-role IAM grants. Check:
```bash
aws iam get-role-policy --role-name denali-ecs-task-role --policy-name denali-task-policy --query 'PolicyDocument'
```
Look for the relevant action (e.g., `cloudwatch:PutMetricData`) with
matching resource/condition scoping.

**Blocker #4**: if `package-lock.json` drifted, post-merge resolution may
yield different transitive deps than either side. Check `npm ci` output
locally after merge for surprises.

**Blocker #5**: `git merge-tree --write-tree` produces a tree object and
prints CONFLICT lines without modifying the working tree. Use this to
preview the conflict surface before committing to the merge.

---

### 2. Schema migration via ECS exec (no bastion needed)

When prod RDS is private (`PubliclyAccessible: false`), the running ECS
container already has DB credentials and network access. Use ECS exec
with an inline Node script — no bastion, no new credentials, no tunnel.

Safety preconditions:
- Migration is **additive only** (no `DROP`, no `NOT NULL` without `DEFAULT`)
- **Idempotent**: every operation uses `IF NOT EXISTS`
- Migration wraps its own `BEGIN; ... COMMIT;`
- Verify these with `grep -iE 'DROP\s|TRUNCATE|DELETE\s+FROM' <file>` (any
  matches outside comments are a stop-and-investigate signal)

Pattern (one-shot, ~30 seconds end-to-end):

```bash
SQL_B64=$(base64 < /tmp/migration.sql | tr -d '\n')
SCRIPT="const{Client}=require('pg');const sql=Buffer.from('$SQL_B64','base64').toString('utf8');(async()=>{const c=new Client({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:parseInt(process.env.DB_PORT||'5432'),ssl:{rejectUnauthorized:false}});try{await c.connect();await c.query(sql);console.log('MIGRATION_SUCCESS')}catch(e){console.error('FAILED:',e.message);process.exit(1)}finally{await c.end()}})()"
SCRIPT_B64=$(printf '%s' "$SCRIPT" | base64)

# Simpler --service form (works when the service has exactly one task —
# the common case for denali-web and denali-staging-web):
aws ecs execute-command --cluster denali --service denali-web --container denali \
  --command "/bin/sh -c 'echo $SCRIPT_B64 | base64 -d | node'" \
  --interactive --region us-east-1

# Explicit --task form (use when the service has multiple tasks or you want
# deterministic targeting):
TASK_ID=$(aws ecs list-tasks --cluster denali --service-name denali-web --region us-east-1 --query 'taskArns[0]' --output text | awk -F'/' '{print $NF}')
aws ecs execute-command --cluster denali --task $TASK_ID --container denali \
  --command "/bin/sh -c 'echo $SCRIPT_B64 | base64 -d | node'" \
  --interactive --region us-east-1
```

The double base64 encoding (script + SQL) avoids quoting pain through
the SSM Session pipeline. The container's `pg` module + injected
`DB_*` env vars do all the work.

Verification queries (run before AND after migration via the same pattern,
substituting the SQL):

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name IN ('birth_year', 'is_on_medicare');
SELECT to_regclass('public.user_conditions');
```

Worked example: 2026-05-25 applied `migrate-user-prerequisites.sql` and
`migrate-birth-year-modal-cadence.sql` to prod RDS via this pattern.
Total elapsed: ~2 min including pre/post verification. ECS task continued
serving traffic throughout — the exec session uses a separate pg client
that doesn't touch the request-handling pool.

---

### 3. Conflict bucketing (Easy / Medium / Hard)

Don't try to resolve all conflicts uniformly. Sort first, apply the right
resolution per bucket.

**Bucket A — mechanical (one side is canonically correct):**
```bash
git checkout --ours <file>     # target's version wins
git checkout --theirs <file>   # source's version wins
git rm <file>                  # modify/delete pair (both intend removal)
```
When: target has B.16-style alignment vs source's raw assertions; target's
deploy.yml has B.15 gates vs source's older SHA pinning; one side archived
a file the other side deleted.

**Bucket B — 2-way merge (both sides have meaningful content):**
- Use `Edit`/`str_replace` to remove conflict markers while preserving both contributions
- Typical case: source adds a new check block to a route the target already extends elsewhere
- Take target's base structure, splice source's additions at the right anchor

When: send-otp absorbing develop's `STAGING_EMAIL_ALLOWLIST` block; a route
extending an existing endpoint shape.

**Bucket C — hand-merge per region:**
- View each `<<<<<<<` region with surrounding context (3-5 lines either side)
- Decide per region: take HEAD, take develop, or hand-merge content
- Use one Edit per region — preserves auto-merged sections elsewhere in the
  same file (matters when both sides have additive changes outside the
  conflict regions)

When: CLAUDE.md with 5 independent conflict regions; both sides have correct
content at different points.

**Decision rule**: if both sides updated the same fact and target has the
newer/corrected version → take HEAD. If source has runtime work the target
lacks → take theirs. If both sides have meaningful changes at the same line
→ hand-merge.

---

### 4. Backup branch strategy

Always create one before destructive operations (merge, reset, force-push).

Naming convention:
```
backup/<branch>-pre-<event>-<date>
```

Examples from 2026-05-25:
- `backup/main-pre-develop-merge-2026-05-25` @ `d17cf31`
- `backup/develop-pre-reset-2026-05-25` @ `a5c0030`

**Always push to origin** — local-only is one hard-drive failure away from
losing the rollback:
```bash
git branch backup/main-pre-develop-merge-2026-05-25
git push origin backup/main-pre-develop-merge-2026-05-25
```

Pair with the ECR `prod-stable` tag (image-level rollback) for full
coverage:
- **Git rollback** restores the code state via `git reset --hard <backup>` + force-push
- **ECR rollback** restores the running image via repointing `prod-stable` + `workflow_dispatch`

When **both** are needed: a bad deploy reaches prod and you need to revert
code AND repoint the ECS image. Backup branch + prod-stable cover both
axes independently.

When **one is enough**: code-only changes (docs, tests, CI workflows) where
no new image was built → backup branch alone suffices.

Cleanup: keep backup branches for ~30 days post-merge as a safety net.
Delete via `git push origin --delete backup/...` when no longer needed.

---

### 5. The GitHub Actions skip-CI directive footgun

GitHub Actions checks commit messages for the literal substring `[skip ci]`
and skips workflow runs if found — **anywhere** in the message, including
within negation phrases.

**Symptom**: push to main, no CI run appears. Prod stays on the prior task
definition; new code never deploys.

**Common unintentional triggers** in commit bodies:
- "NO `[skip ci]` — this commit triggers a real deploy."
- "Removed the `[skip ci]` marker from CI workflow."
- "Discussion of when to use `[skip ci]` vs not."
- Pasting a prior commit's message that contained the directive.

Any of these silently suppresses the workflow.

**Recovery** — fire the workflow manually against current main:
```bash
gh workflow run deploy.yml --ref main
```
This produces the same outcome as a push trigger would have. The deploy
runs against `HEAD`, image gets built and pushed, ECS rolls forward.

**Prevention** — paraphrases to use in commit bodies when discussing the
directive:
- "the GitHub Actions skip-CI directive" (this doc's convention)
- "the skip-CI substring"
- "the bracketed CI-skip token"
- "deploy enabled — no skip marker"

The hard rule: the directive belongs only in commit **titles**, where its
presence is a deliberate signal everyone understands. Never in bodies.

**Meta-note on this doc**: file content includes the literal substring in
prose and code blocks. That is safe — GitHub Actions parses **commit
messages only**, not files in the repo tree. The rule applies to
`git commit -m "..."` text, never to `.md` files. A future commit message
that references this doc by path is also safe (paths don't contain the
substring).

**The directive is per-commit, not per-workflow.** A skip directive in a
commit message suppresses workflows on every branch that ever contains
that commit, not just the branch where the commit originally landed.
Fast-forwarding `develop` to a `main` commit that carried the directive
will also skip `develop`'s staging workflow on push. Implication: think
twice before using the directive on commits you intend to propagate. If
only the source-branch workflow needs to be skipped, prefer per-workflow
path filters in the YAML over the global commit-message directive.

Lesson: 2026-05-25 develop→main merge skipped CI due to "NO [skip ci]" in
the merge commit body; recovered via `workflow_dispatch` (run
26430453876). Second occurrence in the work stream — also tripped during
B.18 prep on 2026-05-18.

---

### 6. ECR rollback floors

The `prod-stable` ECR tag points at the last successfully-deployed image.
It moves forward on every successful deploy (deploy.yml step "Tag
successful deploy as prod-stable").

**Image SHA tags persist independently of `prod-stable`.** After a deploy,
the prior image is still in ECR, addressable by its commit SHA:

```
denali:9439e6b...   ← prior good image (kept; SHA-tagged)
denali:e17597d...   ← current image (SHA-tagged)
denali:prod-stable  ← moving pointer; now → e17597d
denali:latest       ← also → current
```

`prod-stable` is mutable; SHA tags are immutable. To roll back to a prior
image without re-deploying code, repoint `prod-stable` to the prior SHA:

```bash
MANIFEST=$(aws ecr batch-get-image --repository-name denali --region us-east-1 \
  --image-ids imageTag=9439e6b6df49cc041c6eac335d94051f5a838df3 \
  --query 'images[0].imageManifest' --output text)
aws ecr put-image --repository-name denali --image-tag prod-stable \
  --image-manifest "$MANIFEST" --region us-east-1
```

Then either trigger `workflow_dispatch` against the prior commit, or
re-deploy the ECS service forcing a new task with the now-repointed image.

**When to repoint**: rolling back a current bad deploy. Repoint
`prod-stable` to the prior good SHA + re-task ECS.

**When to new-build**: forward fix. Write a new commit, let it deploy
normally; deploy.yml advances `prod-stable` automatically.

Verification:
```bash
aws ecr describe-images --repository-name denali --region us-east-1 \
  --image-ids imageTag=prod-stable \
  --query 'imageDetails[0].{tags:imageTags,pushedAt:imagePushedAt}'
```

---

### 7. CI gates as a deploy safety net

The B.15 pattern (added 2026-05-24): tsc + vitest run as gates BEFORE
docker build/push in `deploy.yml`:

```yaml
- name: Type check
  working-directory: app
  run: npx tsc --noEmit

- name: Unit tests
  working-directory: app
  run: npx vitest run
```

Failure at either step stops the deploy at the CI level — no image
hits ECR, no task definition updates, no ECS rollout. The prior task
definition keeps serving traffic. Zero user impact.

**Why this matters for merges**: a merge can introduce type errors or
test failures that local artifacts hide. CI catches the regression on
clean machines and prevents the bad image from ever reaching ECR.

**Verify gates actually fire before relying on them**: every time the
gates change, run a deliberate test:
1. Commit a known-failing test or `tsc` error
2. Push, watch the workflow
3. Confirm the failing step blocks the docker build
4. Revert the failing commit; confirm next push succeeds

The 2026-05-24 B.15 deploy itself exercised this — gates passed first
try with 720/720 tests including develop's additions (run 26376561249).

---

### 8. Verify post-deploy metrics with data, not namespace presence

When verifying CloudWatch metrics after a deploy that touches the metrics
layer, query for ACTUAL DATA in a current time window — never trust
`list-metrics` to tell you "publishing works." Metric names linger in the
namespace for ~2 weeks after the last publish, so `list-metrics` returns
old metric definitions long after publishing has died.

**Wrong** — false-positive verification:
```bash
aws cloudwatch list-metrics --namespace Denali/App --region us-east-1
# Returns: RequestLatency, ErrorCount, ... (from days ago, still indexed)
# → conclusion: "metrics are flowing" → WRONG
```

**Right** — query data with timestamps:
```bash
aws cloudwatch get-metric-data --region us-east-1 \
  --start-time "$(date -u -v-5M +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
  --metric-data-queries '[{"Id":"p","Expression":"SELECT SUM(\"RequestLatency\") FROM \"Denali/App\"","Period":60,"ReturnData":true}]'
# Values: [12, 8, 7, ...] with timestamps in the last 5 min → confirmed.
# Values: [] → NOT publishing right now, regardless of what list-metrics shows.
```

`get-metric-data` has lower index lag than `list-metrics` — typically
1–2 min vs 5–15 min. Use it for fresh-publish verification.

**Also: confirm the timestamps post-date your deploy.** A non-empty result
could be from a long-lived container that started before your deploy.
Cross-reference with the ECS deployment "reached steady state" event
timestamp.

Lesson: 2026-05-26 verified the cloudwatch namespace migration on staging
and saw `list-metrics` return `RequestLatency` entries — but
`get-metric-data` returned `Values: []`. The metric names were stale
from a prior container. ~3 hours of root-causing avoided ONLY because
we eventually ran `get-metric-data` and noticed the publish path was
genuinely dead.

---

### 9. Next.js 16 + Turbopack: singletons via globalThis

When a module holds runtime state (buffer, timer, client) that's accessed
from BOTH a static import chain (route handler → barrel → module) AND a
dynamic import (`instrumentation.ts`'s `await import()`), Turbopack in
Next.js 16+ instantiates the module **twice**. Module-scope `let buffer = []`
becomes two independent arrays. State written through one import path is
invisible through the other.

**Symptom**: a buffer fills, a timer reads from a buffer, but the timer
always sees length=0 even though pushes are happening every second. No
errors, no warnings — silent loss.

**Diagnosis** (via probes added to both writer + reader):
```typescript
// In recordMetric: console.log("pushed, len=", buffer.length);
// In timer tick:    console.log("tick,  len=", buffer.length);
//
// Output:
//   pushed, len= 1, 6, 11, 16...   ← writer's buffer
//   tick,  len= 0                   ← timer's buffer
// → two different arrays.
```

Routing the dynamic import through the same barrel that route handlers use
does NOT fix this. Turbopack still creates separate instances per dynamic
vs static load.

**Fix**: hold state on `globalThis` under a `Symbol.for()` key. All module
instantiations resolve to the same object.

```typescript
type State = { buffer: T[]; timer: NodeJS.Timeout | null; client: Client | null };
const KEY = Symbol.for("denali.metrics.cloudwatch.state");
type WithState = typeof globalThis & { [KEY]?: State };
const g = globalThis as WithState;
if (!g[KEY]) {
  g[KEY] = { buffer: [], timer: null, client: null };
}
const state: State = g[KEY];
// Then: state.buffer, state.timer, state.client everywhere.
```

This is the standard Next.js singleton pattern (mirrors how `PrismaClient`,
Redis clients, etc. are usually configured to survive hot-reload and
chunking).

**When to reach for it**: any module that holds long-lived mutable state
AND is touched by `instrumentation.ts` register() OR by side-effect
imports from a server boot context. Pure utility modules (stateless
functions) don't need it.

**Related Turbopack quirk worth knowing**: `process.env.NEXT_RUNTIME` is
NOT injected by Turbopack at build time and is NOT set on the Node
process at runtime. The standard Next.js docs pattern
`if (process.env.NEXT_RUNTIME === "nodejs")` always evaluates false.
Use `typeof process !== "undefined" && process.versions?.node` instead —
set by Node itself, absent in Edge runtime.

Lesson: 2026-05-26 the CloudWatch metrics module had both bugs stacked.
Pre-fix: prod ran 6+ hours, zero metrics published. Post-fix: data
flowing within 70s of deploy.

---

That's the full pattern across 9 sections. Run all 5 audits before merging,
use ECS exec for migrations, bucket conflicts before resolving, keep backups
+ ECR floors paired, watch out for the substring trap in commit bodies
(and remember the directive propagates across every branch that inherits
the commit), trust the CI gates to catch what local builds miss, and after
touching the metrics layer verify with `get-metric-data` (not `list-metrics`)
— plus watch for Turbopack module duplication if state seems to vanish.
