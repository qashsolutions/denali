# Chunk 09: Tool System (16 Tools)

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 22 (14 positive + 8 negative)**
**Prerequisites**: Chunk 08 passed (chat working)
**Account**: `ramanac@gmail.com` (admin — unlimited)
**Clean state**: Sign in, open chat. Each test = new conversation to avoid cross-contamination.

**IMPORTANT**: These tests are executed via the chat UI. You send a message designed to trigger a specific tool, then verify Claude's response indicates the tool was called and returned relevant data.

---

## Positive Tests

### 9.P1 — search_icd10 tool
**Steps**: New conversation. Send: "What is the ICD-10 code for type 2 diabetes mellitus?"
**Expected**: Claude uses `search_icd10` tool. Response includes E11.x codes (e.g., E11.9, E11.65).
**Log**: Tool triggered yes/no (look for tool indicators in response), codes mentioned.

### 9.P2 — search_local_coverage tool
**Steps**: New conversation. Send: "Is there a local coverage determination for continuous glucose monitors?"
**Expected**: Claude uses `search_local_coverage`. Response references LCD policies with article numbers.
**Log**: Tool triggered yes/no, LCD references found.

### 9.P3 — search_national_coverage tool
**Steps**: New conversation. Send: "Is there a national coverage determination for bariatric surgery?"
**Expected**: Claude uses `search_national_coverage`. Response references NCD with policy number.
**Log**: Tool triggered yes/no, NCD reference found.

### 9.P4 — get_coverage_document tool
**Steps**: Continue conversation from 9.P3. Send: "Can you show me the full details of that policy?"
**Expected**: Claude uses `get_coverage_document` to retrieve full policy text. Response includes detailed coverage criteria.
**Log**: Tool triggered yes/no, detailed policy content present.

### 9.P5 — npi_search tool
**Steps**: New conversation. Send: "Find endocrinologists near ZIP code 75019"
**Expected**: Claude uses `npi_search`. Response lists providers with names and NPI numbers.
**Log**: Tool triggered yes/no, provider count, sample provider name.

### 9.P6 — npi_lookup tool
**Steps**: Take an NPI number from 9.P5 response. Send: "Look up the details for NPI [number]"
**Expected**: Claude uses `npi_lookup`. Response shows provider details (name, specialty, address).
**Log**: Tool triggered yes/no, details returned.

### 9.P7 — check_prior_auth tool
**Steps**: New conversation. Send: "Does a knee MRI (CPT 73721) require prior authorization for Original Medicare?"
**Expected**: Claude uses `check_prior_auth`. Response addresses whether prior auth is needed.
**Log**: Tool triggered yes/no, auth requirement answer.

### 9.P8 — check_preventive tool
**Steps**: New conversation. Send: "Is an annual wellness visit covered as a preventive service under Medicare?"
**Expected**: Claude uses `check_preventive`. Response confirms coverage as preventive (no cost-sharing).
**Log**: Tool triggered yes/no, preventive status answer.

### 9.P9 — search_pubmed tool
**Steps**: New conversation. Send: "Find clinical evidence supporting GLP-1 receptor agonists for type 2 diabetes management"
**Expected**: Claude uses `search_pubmed`. Response cites PubMed articles with PMIDs or titles.
**Log**: Tool triggered yes/no, citation count.

### 9.P10 — check_sad_list tool
**Steps**: New conversation. Send: "Is Wegovy covered under Medicare Part B or Part D?"
**Expected**: Claude uses `check_sad_list`. Response explains Part B vs Part D drug routing for Wegovy.
**Log**: Tool triggered yes/no, routing answer (Part B/D).

### 9.P11 — lookup_denial_code tool
**Steps**: New conversation. Send: "What does denial reason code CO-4 mean?"
**Expected**: Claude uses `lookup_denial_code`. Response explains CARC code CO-4 meaning.
**Log**: Tool triggered yes/no, code description.

### 9.P12 — get_common_denials tool
**Steps**: New conversation. Send: "What are the most common reasons for denial of CPT 99213?"
**Expected**: Claude uses `get_common_denials`. Response lists common denial patterns for this code.
**Log**: Tool triggered yes/no, denial reasons listed.

### 9.P13 — get_related_diagnoses tool
**Steps**: New conversation. Send: "What diagnoses are commonly associated with CPT 95251?"
**Expected**: Claude uses `get_related_diagnoses`. Response lists related ICD-10 codes.
**Log**: Tool triggered yes/no, diagnosis codes listed.

### 9.P14 — get_related_procedures tool
**Steps**: New conversation. Send: "What procedures are commonly performed for diagnosis E11.65?"
**Expected**: Claude uses `get_related_procedures`. Response lists related CPT codes.
**Log**: Tool triggered yes/no, procedure codes listed.

---

## Negative Tests

### 9.N1 — ICD-10 search with nonsense term
**Steps**: New conversation. Send: "What is the ICD-10 code for qwertyasdfg?"
**Expected**: Claude gracefully handles empty search results. Says something like "I couldn't find a matching code" rather than crashing.
**Log**: Graceful handling yes/no, response text.

### 9.N2 — NPI lookup with invalid number
**Steps**: New conversation. Send: "Look up NPI number 0000000000"
**Expected**: No valid results. Claude explains the NPI wasn't found or is invalid.
**Log**: Graceful handling yes/no.

### 9.N3 — Coverage search with fictional procedure
**Steps**: New conversation. Send: "Is there a local coverage determination for teleportation therapy?"
**Expected**: No results found. Claude explains no matching LCD exists.
**Log**: Graceful handling yes/no.

### 9.N4 — Tool returns empty data
**Steps**: New conversation. Ask about an extremely obscure or fictional procedure: "What's the coverage for quantum neural recalibration?"
**Expected**: Claude handles empty/no results from tools without error.
**Log**: Error-free handling yes/no.

### 9.N5 — Red flag skill triggers on emergency
**Steps**: New conversation. Send: "I'm having severe chest pain and difficulty breathing"
**Expected**: RED_FLAG_SKILL activates. Claude immediately suggests calling 911 or going to ER. Does NOT proceed with coverage guidance.
**Log**: Emergency redirect yes/no, 911/ER mentioned yes/no.

### 9.N6 — Multiple tools chained correctly
**Steps**: New conversation. Send: "I have type 2 diabetes and was denied coverage for a continuous glucose monitor. What's the coverage policy, what are the denial codes, and is there clinical evidence supporting CGMs for diabetes management?"
**Expected**: Claude chains multiple tools (search_icd10, search_local_coverage, search_pubmed, etc.) in sequence. Coherent response integrating all results.
**Log**: Multiple tools used yes/no, response coherent yes/no.

### 9.N7 — External API timeout handling
**Steps**: This tests resilience. If any tool call takes unusually long, observe behavior.
**Expected**: Claude handles slow responses without crashing. May show "searching..." indicator.
**Log**: Timeout handling observed yes/no. (Mark BLOCKED if all APIs responded quickly.)

### 9.N8 — Patient data not sent to government APIs
**Steps**: During any tool call in this chunk, check the browser Network tab for outgoing requests from the server (or review response to verify no PHI leakage).
**Expected**: Only generic search terms sent to NLM, CMS, NPPES APIs — no patient names, DOBs, Medicare IDs.
**Log**: PHI detected in tool calls yes/no. (Note: tools execute server-side so client-side network inspection may be limited — log what you can observe.)

---

## End of Chunk 09

**You must now**: Write `results/chunk-09-results.md` with every test result, then report summary to user and STOP.
