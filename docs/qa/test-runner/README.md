# DenaliHealth Test Runner — How to Use with Claude Code

## The Problem

When you give Claude Code the full 310-test plan, it "optimizes" — cherry-picking critical paths instead of executing every test. This defeats the purpose.

## The Solution: Agent + Chunked Prompts

Three components work together to force exhaustive execution:

```
test-runner/
├── AGENT.md                          ← Master rules (read every time)
├── README.md                         ← This file
├── chunks/
│   ├── chunk-01-public-pages.md      ← 22 tests
│   ├── chunk-02-auth-otp.md          ← 18 tests
│   ├── chunk-03-mfa-totp.md          ← 14 tests
│   ├── chunk-04-session-idle.md      ← 10 tests
│   ├── chunk-05-settings.md          ← 20 tests
│   ├── chunk-06-consent-privacy.md   ← 14 tests
│   ├── chunk-07-pricing-stripe.md    ← 16 tests
│   ├── chunk-08-chat-engine.md       ← 20 tests
│   ├── chunk-09-tool-system.md       ← 22 tests
│   ├── chunk-10-bluebutton-fhir.md   ← 14 tests
│   ├── chunk-11-health-report.md     ← 16 tests
│   ├── chunk-12-diabetes-obesity.md  ← 18 tests
│   ├── chunk-13-appeals.md           ← 16 tests
│   ├── chunk-14-blog-content.md      ← 12 tests
│   ├── chunk-15-email-alerts.md      ← 14 tests
│   ├── chunk-16-admin.md             ← 12 tests
│   ├── chunk-17-pwa-offline.md       ← 14 tests
│   ├── chunk-18-api-security.md      ← 16 tests
│   ├── chunk-19-infrastructure.md    ← 14 tests
│   └── chunk-20-account-deletion.md  ← 8 tests
└── results/                          ← Claude writes results here
    ├── chunk-01-results.md
    ├── chunk-02-results.md
    └── ...
```

## Step-by-Step Workflow

### BEFORE YOU START: Fill in AGENT.md

Open `AGENT.md` and fill in:
- **Base URL**: Your app URL (e.g., `https://app.denali.health`)
- **Stripe test mode**: Confirm yes/no

### For Each Chunk

**Step 1** — Paste this EXACT prompt into Claude Code:

```
Read the file AGENT.md first. Then read the file chunks/chunk-XX-FILENAME.md. 
Follow AGENT.md rules exactly. Execute every test in the chunk sequentially. 
Do not skip any tests. Do not combine tests. Do not optimize. 
Start now.
```

Replace `XX-FILENAME` with the actual chunk filename.

**Step 2** — Claude Code will:
1. Read AGENT.md (rules)
2. Read the chunk file
3. Say "Starting Chunk XX. N tests to execute."
4. Execute test #1, log result
5. Execute test #2, log result
6. ... (pause for OTP when needed)
7. Write `results/chunk-XX-results.md`
8. Report: "Chunk XX complete. X/Y passed. Ready for next chunk."

**Step 3** — Review the results file. Then proceed to next chunk.

### Key Prompt Patterns That FORCE Execution

These phrases in AGENT.md are specifically chosen to counter Claude's optimization instinct:

| Claude's instinct | Counter-prompt in AGENT.md |
|---|---|
| "I'll focus on critical tests" | "You are NOT a strategist. You are an EXECUTOR." |
| "These are similar, I'll combine" | "You CANNOT combine multiple tests into one action" |
| "The positive test covered this" | "You CANNOT skip negative tests because positive passed" |
| "Let me be more efficient" | "You CANNOT rewrite test steps to be more efficient" |
| Runs 3 tests then summarizes | Each test has explicit "Log: [what to record]" |

### If Claude Code Still Skips Tests

Escalation prompts (paste these if it starts optimizing):

```
STOP. You skipped tests [IDs]. Go back to AGENT.md Rule 1. 
You MUST execute every test. Resume from test [ID] now.
```

```
You are not following AGENT.md. Re-read it. 
You executed 5 out of 22 tests. That is unacceptable. 
Execute the remaining 17 tests starting with [next ID].
```

```
Do not summarize. Do not skip. Execute test [ID] right now, 
then test [next ID], then [next ID]. One at a time.
```

### OTP Handling

When Claude Code encounters an OTP-requiring test, it should:
1. Say: "OTP needed for [email]. Please check your email and provide the code."
2. Wait for your response
3. Use the code and continue

For TOTP (MFA) tests:
1. Say: "TOTP code needed for [email]. Please provide the current authenticator code."
2. Wait for your response

### Test Account Allocation

| Email | Purpose |
|-------|---------|
| `ramanac@gmail.com` | Admin, MFA enabled |
| `ramanac+a@gmail.com` | Standard user |
| `ramanac+b@gmail.com` | MFA enrollment tests |
| `ramanac+c@gmail.com` | Trial plan tests |
| `ramanac+d@gmail.com` | Stripe/checkout tests |
| `ramanac+e@gmail.com` | Account deletion (throwaway) |
| `ramanac+f@gmail.com` | Expired trial tests |
| `ramanac+g@gmail.com` | Rate limit tests |

### Chunk Order (sequential, not parallel)

```
01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10
→ 11 → 12 → 13 → 14 → 15 → 16 → 17 → 18 → 19 → 20
```

Each builds on the previous. Do NOT skip ahead.
Chunk 20 (deletion) is ALWAYS last.
