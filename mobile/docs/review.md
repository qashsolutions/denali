# review.md — pre-task gate + step Definition of Done

Operational checklist distilled from SELF-PROMPTING RULES v2. Read in full
BEFORE writing any plan or code for a fresh task, and again BEFORE delivering
the step report. This file is the checklist; the rules' intent lives with
Venkata. CC may propose edits here but never weakens a gate on its own.

---

## A. Before the task (run every item, in order)

- [ ] **A1. Branch confirmation.** `git branch --show-current` and state it in
      the first status line. Do this before reading any infrastructure files.
- [ ] **A2. Objective anchor.** Open `mobile/docs/OBJECTIVE.md`.
      - If it does not exist: creating it from the approved specs is the FIRST
        task — draft it and STOP for approval. No other work starts.
      - If it exists: name which OBJECTIVE.md items this task serves. A task
        serving no item is a scope question — STOP and ask.
- [ ] **A3. PLAN-FIRST trigger scan.** Does the work touch ANY of:
      clinical display surface (strings, bands, pills, disclaimers, 988 path) ·
      schema or migrations · auth/security/env · anything adjacent to
      `mobile/src/contracts/` · data deletion · a new dependency?
      → If yes: plan only, STOP for approval before code. Auto-invoke the
      matching read-only reviewer subagent(s) when they exist
      (clinical-boundary-reviewer / security-reviewer).
- [ ] **A4. Re-read the step prompt and extract the acceptance matrix rows**
      (quote each requirement verbatim — these become the report's closing
      table). One step per prompt; anything beyond spec goes in the report as
      a proposal, never as code.
- [ ] **A5. Standing constraints check** (the DON'TS that most often bite):
      no `mobile/src/contracts/` edits · no render-time/LLM-generated or
      live-retrieval clinical content · no rewording/moving/removing
      disclaimers, ‡ marks, LOINC/provenance, 988 routing unless the
      instruction names them · no advice phrasing, no population comparisons ·
      no new deps without flagged approval · no eslint-disable · no PHI
      through MCP connectors · cwd = `mobile/` for all mobile tooling.

## B. During the task

- New user-facing copy enters ONLY via the versioned string/band tables, with
  provenance `{ source, pmid_or_code_system_version, retrieved_at,
  review_status }`; `review_status` starts `pending_clinical_review`; the ‡
  mark renders until a human clears it — CC never clears it.
- Band/vocabulary changes trigger the terminology-verifier subagent (PubMed
  citation per cutoff; unsourceable cutoffs FLAGGED, never invented; ICD-10
  validity per vocabulary code).
- Hook/closure bugs: structural fix (pure helpers, live state as explicit
  args) + regression test. Never suppression.
- Preserve every existing testID; every new interactive element gets one.
- Repo is source of truth for what's shipped; external references are
  decision inputs — mismatches surfaced for review, never silently corrected.

## C. Definition of Done (before the report goes out)

- [ ] **C1. Gates green with output captured:** `tsc --noEmit` 0 errors ·
      `eslint .` 0 errors · `vitest run` green — run from `mobile/`.
- [ ] **C2. On-device:** rebuild installed; bundle-freshness grep for ≥1 new
      identifier from this step; every changed screen exercised on the
      emulator — happy path AND the riskiest negative path (severe-band
      rendering, n=0/n=1 states, font-load failure, offline open — whichever
      apply). Unit tests never substitute for on-device confirmation; the
      report says which evidence is which.
- [ ] **C3. Invariant greps in the served bundle:** disclaimer lines, ‡
      provisional marks, 988 strings present.
- [ ] **C4. Acceptance matrix:** every requirement of the step prompt, quoted
      → named evidence (command, test name, or on-device action) → PASS /
      FAIL / DEFERRED-with-named-owner-decision. No PASS without evidence; no
      PASS by inference from adjacent work; nothing omitted.
- [ ] **C5. Acceptance audit (MANDATORY):** invoke the `acceptance-auditor`
      subagent (`.claude/agents/acceptance-auditor.md`) BEFORE the report
      ships, passing: the step prompt verbatim, the draft matrix, the new
      identifiers for bundle greps, and the changed paths. The author never
      passes its own matrix. The report carries the auditor's verdict table
      and overall gate; a BLOCKED gate means the report does not ship until
      the discrepancies are resolved or explicitly accepted by Venkata.
- [ ] **C6. Objective alignment:** which OBJECTIVE.md items advanced /
      untouched / regressed. Regressions are never silent.
- [ ] **C7. Report ends with** Confidence ratings · Assumptions · Deviations —
      each section present even if "none".
- [ ] **C8. STOP.** Honor the step gate. Do not start the next step. Do not
      commit unless the prompt says to.

---

*Invocation: `mobile/CLAUDE.md` (auto-loaded for any work under `mobile/`)
points here as a mandatory first read; a SessionStart hook can additionally
inject this file deterministically — see the wiring note in mobile/CLAUDE.md.*
