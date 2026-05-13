# Tools & Data Sources

Full topic doc — extracted from CLAUDE.md during the 2026-05-13 doc refactor.

---

## Tools & Data Sources

### Government API Tools (local executors, replaced MCP servers)

These tools are local executors in `tools/index.ts` that call free public government APIs directly. No patient data is sent — only generic search terms. Previously used MCP servers at `mcp.deepsense.ai` (removed 2026-03-04).

| Tool                                                                         | API Endpoint                                                     | Data                                     |
| ---------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `search_icd10`                                                               | `clinicaltables.nlm.nih.gov/api/icd10cm/v3/search` (NLM, public) | ICD-10 diagnosis codes                   |
| `search_local_coverage`, `search_national_coverage`, `get_coverage_document` | `api.coverage-finder.medicare.gov/api/v1` (CMS, public)          | LCD/NCD coverage policies                |
| `npi_search`, `npi_lookup`                                                   | `npiregistry.cms.hhs.gov/api` (NPPES, public)                    | Provider NPI, specialty, Medicare status |

### Other Local Tools (defined in `src/lib/tools/index.ts`)

| Tool                     | Purpose                                                                                                                                                                                                                     | Data Source                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `search_cpt`             | Map procedure descriptions to CPT codes                                                                                                                                                                                     | AMA API (dev only)                                                      |
| `get_related_diagnoses`  | CPT -> related ICD-10 codes                                                                                                                                                                                                 | Local mappings                                                          |
| `get_related_procedures` | ICD-10 -> related CPT codes                                                                                                                                                                                                 | Local mappings                                                          |
| `check_prior_auth`       | Check if CPT requires prior auth (CMS PA Model + expanded list)                                                                                                                                                             | Local rules + CMS PA Model categories                                   |
| `check_preventive`       | Check if service is preventive (no cost-sharing)                                                                                                                                                                            | Local rules                                                             |
| `search_pubmed`          | Clinical evidence search (rate-limited)                                                                                                                                                                                     | NCBI E-utilities                                                        |
| `generate_appeal_letter` | Build appeal letter (Level 1 Redetermination for Original Medicare, Request for Reconsideration for MA) with inline codes + policy refs + PubMed citations. Accepts `medicare_type` and `plan_name` params for MA branching | Combines multiple sources + policy_references + pubmed_citations inputs |
| `check_sad_list`         | Part B (physician) vs Part D (self-administered) drug routing                                                                                                                                                               | CMS SAD list                                                            |
| `lookup_denial_code`     | CARC/RARC code lookup + appeal strategy                                                                                                                                                                                     | RDS `carc_codes`, `rarc_codes`, `eob_denial_mappings`                   |
| `get_common_denials`     | Top denial reasons for a procedure + prevention tips                                                                                                                                                                        | RDS (`denial_patterns` + `carc_codes`)                                  |

### Data Inventory

| Dataset                   | Status                                   | Source                               |
| ------------------------- | ---------------------------------------- | ------------------------------------ |
| ICD-10                    | Full                                     | MCP server                           |
| CPT                       | Dev only (AMA license required for prod) | Local AMA API                        |
| NPI                       | Full                                     | MCP server                           |
| NCD/LCD                   | Full                                     | MCP server                           |
| PubMed                    | Full                                     | NCBI API                             |
| CARC codes                | 90 codes                                 | RDS (from CMS, effective 2025-12-10) |
| RARC codes                | 195 codes                                | RDS (from CMS, effective 2025-12-10) |
| EOB-to-CARC/RARC mappings | 1,873 mappings                           | RDS (from CMS, effective 2025-12-10) |

---

