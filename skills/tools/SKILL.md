---
name: tools
description: Healthcare API usage patterns for ICD-10, CPT, NPI, NCD/LCD, and PubMed
version: 1.0.0
context: infrastructure
---

# Tools Skill

This skill defines how to use healthcare APIs and MCPs (Model Context Protocol servers) to access medical data.

## Available Tools

| Tool | Source | Purpose | Status |
|------|--------|---------|--------|
| ICD-10 | ICD-10 Codes MCP | Diagnosis code lookup | ✅ Full access |
| CPT | AMA API | Procedure code lookup | ⚠️ Dev only |
| NPI | NPI Registry MCP | Provider validation | ✅ Full access |
| NCD/LCD | CMS Coverage MCP | Medicare coverage policies | ✅ Full access |
| SAD | CMS Coverage MCP | Part B/D exclusion check | ✅ Full access |
| PubMed | PubMed MCP | Clinical evidence | ✅ Full access |

## ICD-10 Search

### Purpose
Map symptoms and conditions to diagnosis codes.

### Usage

```typescript
// Search by keyword
const results = await icd10.search({
  query: "low back pain",
  limit: 10
});

// Response
{
  codes: [
    {
      code: "M54.5",
      description: "Low back pain",
      category: "Dorsalgia",
      chapter: "Diseases of the musculoskeletal system"
    },
    {
      code: "M54.50",
      description: "Low back pain, unspecified",
      ...
    }
  ]
}
```

### Best Practices

1. **Start broad, then narrow**: Search "back pain" then refine to "lumbar"
2. **Check specificity**: Use most specific code available (M54.51 > M54.5)
3. **Consider laterality**: Left vs right when applicable
4. **Check excludes**: Some codes exclude others

### Common Searches

| Symptom | Likely Codes |
|---------|--------------|
| Back pain | M54.5, M54.50, M54.51 |
| Back pain with leg pain | M54.4, M54.41, M54.42 |
| Knee pain | M25.56, M25.561, M25.562 |
| Dizziness | R42, H81.1 |
| Shortness of breath | R06.02, R06.00 |
| Chest pain | R07.9, R07.89 |
| Fatigue | R53.83, R53.1 |

## CPT Lookup

### Purpose
Map procedures to CPT codes. **Dev environment only** (AMA license required for production).

### Usage

```typescript
// Search by description
const results = await cpt.search({
  query: "MRI lumbar spine",
  limit: 10
});

// Response
{
  codes: [
    {
      code: "72148",
      description: "MRI lumbar spine without contrast",
      category: "Radiology",
      rvu: 1.52
    },
    {
      code: "72149",
      description: "MRI lumbar spine with contrast",
      ...
    }
  ]
}
```

### Best Practices

1. **Include modifiers**: -RT (right), -LT (left), -50 (bilateral)
2. **Check for bundling**: Some codes include others
3. **Verify category**: Professional vs technical component

### Common Procedures

| Description | CPT |
|-------------|-----|
| MRI lumbar w/o contrast | 72148 |
| MRI lumbar w/ contrast | 72149 |
| MRI knee w/o contrast | 73721 |
| CT head w/o contrast | 70450 |
| Chest X-ray 2 views | 71046 |
| Office visit, established | 99213/99214 |
| Physical therapy eval | 97163 |
| Sleep study (polysomnography) | 95810 |

## NPI Registry

### Purpose
Search and validate healthcare providers.

### Usage

```typescript
// Search by name and location
const results = await npi.search({
  last_name: "Smith",
  first_name: "John",
  state: "CA",
  city: "Los Angeles",
  specialty: "Orthopedic Surgery",
  limit: 10
});

// Response
{
  providers: [
    {
      npi: "1234567890",
      name: {
        first: "John",
        last: "Smith",
        credential: "MD"
      },
      specialty: {
        primary: "Orthopedic Surgery",
        secondary: []
      },
      address: {
        line1: "123 Medical Center Dr",
        city: "Los Angeles",
        state: "CA",
        zip: "90001"
      },
      phone: "310-555-1234",
      accepts_medicare: true
    }
  ]
}
```

### Search Strategies

1. **Start with name + state**: Most reliable combination
2. **Add city if too many results**: Narrow down location
3. **Try without first name**: Sometimes only last name is known
4. **Search by practice name**: For clinics/hospitals

### Validation

```typescript
// Validate specific NPI
const provider = await npi.lookup({
  npi: "1234567890"
});

// Check if valid and active
if (provider.status === "active") {
  // Use provider info
}
```

## CMS Coverage (NCD/LCD)

### Purpose
Search Medicare coverage policies to determine if a service is covered.

### Usage

```typescript
// Search NCDs (National)
const ncdResults = await cms.searchNCD({
  procedure_code: "72148",
  diagnosis_code: "M54.5"
});

// Search LCDs (Regional)
const lcdResults = await cms.searchLCD({
  procedure_code: "72148",
  diagnosis_code: "M54.5",
  state: "CA"
});

// Response
{
  policies: [
    {
      type: "LCD",
      id: "L35047",
      title: "MRI of the Spine",
      contractor: "Noridian",
      effective_date: "2023-10-01",
      coverage_criteria: [
        "Pain duration > 6 weeks",
        "Failed conservative treatment",
        "Neurological deficit on examination"
      ],
      covered_diagnoses: ["M54.5", "M54.4", "M47.816"],
      covered_procedures: ["72148", "72149"],
      documentation_requirements: [
        "Duration of symptoms",
        "Prior treatments attempted",
        "Physical examination findings"
      ]
    }
  ]
}
```

### Search Strategy

1. **Check NCDs first**: They apply nationally
2. **Then check LCDs**: They're regional, more specific
3. **No policy found**: Not necessarily not covered — at contractor discretion

### Medicare Administrative Contractors (MACs)

| Region | Contractor | States |
|--------|-----------|--------|
| 1 | Noridian | CA, NV, HI, AS, GU, MP |
| 5 | WPS | IA, KS, MO, NE |
| 6 | NGS | CT, IL, MA, ME, MN, NH, NY, RI, VT, WI |
| ... | ... | ... |

## SAD List Check

### Purpose
Determine if a drug/biologic is Part B (medical) or Part D (pharmacy).

### Usage

```typescript
// Check if drug is on Self-Administered Drug exclusion list
const sadResult = await cms.checkSAD({
  hcpcs_code: "J1234"
});

// Response
{
  hcpcs: "J1234",
  drug_name: "Example Drug",
  on_sad_list: true,
  effective_date: "2024-01-01",
  coverage: "Part D",
  reason: "Self-administered drug, not incident-to physician service"
}
```

### Interpretation

- **On SAD list** → Part D (pharmacy benefit)
- **Not on SAD list** → Part B (medical benefit, may need medical necessity)

## PubMed Search

### Purpose
Find clinical evidence to support medical necessity.

### Usage

```typescript
// Search for clinical evidence
const results = await pubmed.search({
  condition: "low back pain",
  intervention: "MRI",
  outcome: "diagnosis",
  limit: 5
});

// Response
{
  articles: [
    {
      pmid: "12345678",
      title: "Diagnostic Value of MRI in Low Back Pain",
      authors: ["Smith J", "Jones M"],
      journal: "Spine",
      year: 2023,
      abstract: "...",
      doi: "10.1000/example",
      citation: "Smith J, Jones M. Diagnostic Value of MRI in Low Back Pain. Spine. 2023;48(5):301-310."
    }
  ]
}
```

### Search Strategies

1. **Use MeSH terms**: More precise than keywords
2. **Filter by recency**: Prefer recent studies (last 5-10 years)
3. **Filter by study type**: RCTs > observational > case reports
4. **Focus on outcomes**: What does the literature support?

### For Appeals

When generating appeal letters, cite:
- Systematic reviews / meta-analyses
- Clinical guidelines (AHRQ, specialty societies)
- Large RCTs
- Cohort studies with clear outcomes

## Tool Error Handling

### Retry Logic

```typescript
async function callWithRetry(tool, params, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await tool(params);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1)); // Exponential backoff
    }
  }
}
```

### Fallback Behavior

| Tool | Fallback |
|------|----------|
| ICD-10 | Use cached common mappings |
| CPT | Describe procedure without code |
| NPI | Continue without provider validation |
| NCD/LCD | Note "no specific policy found" |
| PubMed | Generate letter without citations |

### Error Messages

```typescript
// User-friendly error handling
if (error.code === 'TOOL_UNAVAILABLE') {
  return "I'm having trouble accessing Medicare's policy database right now. Let me give you general guidance based on what I know...";
}

if (error.code === 'NO_RESULTS') {
  return "I couldn't find a specific Medicare policy for this combination. That doesn't mean it's not covered — the decision may be made case-by-case...";
}
```

## Tool Caching

### Cache Durations

| Tool | Cache TTL | Reason |
|------|-----------|--------|
| ICD-10 | 30 days | Codes updated annually |
| CPT | 30 days | Codes updated annually |
| NPI | 7 days | Providers can move/change |
| NCD/LCD | 24 hours | Policies can update |
| PubMed | 7 days | Articles don't change |

### Cache Keys

```typescript
// ICD-10
`icd10:${query}`

// NPI
`npi:${lastName}:${state}:${specialty}`

// Coverage
`coverage:${icd10}:${cpt}:${state}`

// PubMed
`pubmed:${condition}:${intervention}`
```

## Rate Limits

| Tool | Rate Limit | Strategy |
|------|------------|----------|
| NPI Registry | 20/sec | Queue requests |
| CMS Coverage | 10/sec | Cache aggressively |
| PubMed | 3/sec | Batch searches |

## Security

- API keys stored in environment variables
- Never expose keys to client
- All tool calls go through Edge Functions
- Log tool usage for monitoring (no PII)
