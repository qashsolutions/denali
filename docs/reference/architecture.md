# Architecture

Full topic doc — extracted from CLAUDE.md during the 2026-05-13 doc refactor.

---

## Architecture

```
User (Chat UI) ──> Claude Agent (Brain) ──> Tools (APIs + RDS)
                          │
                          v
                    RDS PostgreSQL (Memory)
                    Cognito (Auth/Sessions)
```

- **Frontend is dumb** — just renders what Claude returns
- All intelligence lives in Claude + skills + tools
- Domain skills are implemented via Claude tool calling in `/api/chat`, NOT separate edge functions
- Tools are interchangeable (swap APIs without frontend changes)
- **Auth** = Cognito + httpOnly cookies. **DB** = RDS via `query()`. No browser SDK.

### Tool System

All tools are local executors handled by `processToolCalls()` in the chat loop. Claude requests a `tool_use`, our server executes the function, and returns a `tool_result`. Government API tools (ICD-10, CMS Coverage, NPI) call free public endpoints with generic search terms — no patient data sent. Previously used MCP servers at `mcp.deepsense.ai` (migrated to local executors 2026-03-04).

### Session State

Tracked across the conversation in `SessionState` (defined in `claude.ts`):

```
User-facing (plain English):        Internal (codes, never shown):
  name, ZIP, symptoms, duration        diagnosisCodes (ICD-10)
  priorTreatments, provider            procedureCodes (CPT)
  requirementAnswers                   denialCodes (CARC/RARC)
  redFlags                             coverageCriteria, policyReferences
  maPlanName (from Blue Button)        denialDate, priorAuthRequired
```

**Population sources** — how fields get populated during the chat loop:

| Field               | Populated By                                             | Mechanism                                                                                                                                                  |
| ------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `diagnosisCodes`    | MCP `search_icd10` / Local `generate_appeal_letter`      | Regex from Claude text / `updateSessionFromToolResults()`                                                                                                  |
| `procedureCodes`    | Local `search_cpt` / `generate_appeal_letter`            | `updateSessionFromToolResults()`                                                                                                                           |
| `denialCodes`       | Local `lookup_denial_code` / User message                | `updateSessionFromToolResults()` + `extractUserInfo()` regex (CO-50, PR-1, CARC 167, RARC N56 patterns — gated on appeal context to avoid false positives) |
| `policyReferences`  | MCP `search_local_coverage` / `search_national_coverage` | Regex from Claude text (LCD L\d{5}, NCD patterns)                                                                                                          |
| `priorAuthRequired` | Local `check_prior_auth`                                 | `updateSessionFromToolResults()`                                                                                                                           |
| `denialDate`        | User message                                             | `extractUserInfo()` regex                                                                                                                                  |
| `isAppeal`          | User message                                             | `extractUserInfo()` keyword detection                                                                                                                      |
| `maPlanName`        | Blue Button coverage / User message                      | Auto-detected from Part C coverage in `chat/page.tsx` / `extractUserInfo()`                                                                                |

---

