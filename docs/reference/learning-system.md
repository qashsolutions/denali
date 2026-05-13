# Learning System

Full topic doc — extracted from CLAUDE.md during the 2026-05-13 doc refactor.

---

## Learning System

### Layers

| Layer         | Goal                    | Storage                                  |
| ------------- | ----------------------- | ---------------------------------------- |
| Language      | Understand user phrases | `symptom_mappings`, `procedure_mappings` |
| Clinical      | Know what gets approved | `coverage_paths`, `appeal_outcomes`      |
| Conversation  | Optimal question flow   | `conversation_patterns`                  |
| Policy        | Track Medicare changes  | `policy_cache`                           |
| User Behavior | Optimize UX             | `user_events`                            |

### Triggers

| Trigger             | What Happens                                             |
| ------------------- | -------------------------------------------------------- |
| Every message       | Extract entities, queue mapping updates                  |
| Thumbs up           | Reinforce all mappings in conversation (+0.1)            |
| Thumbs down         | Penalize mappings (-0.15), learn from correction         |
| Appeal generated    | Store coverage path as pending                           |
| Outcome reported    | Update coverage path success/failure                     |
| Print/copy/download | Track user event                                         |
| Nightly batch       | Process queue, prune weak mappings, check policy updates |

### Persistence

After every chat response, `persistLearning()` runs non-blocking:

- If ICD-10 search used + symptoms extracted -> `updateSymptomMapping(phrase, code, +0.1)`
- If CPT search used + procedures extracted -> `updateProcedureMapping(phrase, code, +0.1)`
- If coverage checked + codes found -> `recordCoveragePath(icd10, cpt, policy, "pending")`

---

