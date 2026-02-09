/**
 * FHIR R4 → Plain English Transforms
 *
 * Converts raw FHIR resources into user-friendly summaries.
 * Raw FHIR never reaches the UI or Claude — only these summaries.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Output Types (what the UI + Claude see)
// ─────────────────────────────────────────────────────────────────────────────

export interface PatientSummary {
  name: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  medicareId: string; // masked: "***1234"
  address?: { city: string; state: string; zip: string };
}

export interface CoverageSummary {
  type: string; // "Medicare Part A", "Part B", "Part D"
  status: string; // "Active" / "Cancelled"
  startDate: string;
  planName?: string;
}

export interface ClaimSummary {
  id: string;
  type: string; // "Outpatient", "Carrier", "Part D", etc.
  serviceDate: string;
  provider: string;
  diagnosis: string[];
  procedures: string[];
  totalCharged: string;
  medicarePaid: string;
  youOwe: string;
  status: string; // "Paid", "Denied", "Partially Paid"
  denialReasons?: string[];
  carcCodes?: string[];  // CARC codes from adjudication (for richer denial context)
  rarcCodes?: string[];  // RARC codes from adjudication
}

// ─────────────────────────────────────────────────────────────────────────────
// FHIR Resource Shapes (minimal — only fields we need)
// ─────────────────────────────────────────────────────────────────────────────

interface FhirPatient {
  resourceType: "Patient";
  id: string;
  name?: Array<{ given?: string[]; family?: string; use?: string }>;
  birthDate?: string;
  gender?: string;
  identifier?: Array<{ system?: string; value?: string }>;
  address?: Array<{ city?: string; state?: string; postalCode?: string }>;
}

interface FhirCoverage {
  resourceType: "Coverage";
  id: string;
  status?: string;
  type?: { coding?: Array<{ code?: string; display?: string }> };
  period?: { start?: string; end?: string };
  payor?: Array<{ display?: string }>;
  class?: Array<{ type?: { coding?: Array<{ code?: string }> }; value?: string; name?: string }>;
}

interface FhirEOB {
  resourceType: "ExplanationOfBenefit";
  id: string;
  type?: { coding?: Array<{ code?: string; display?: string }> };
  status?: string;
  outcome?: string;
  billablePeriod?: { start?: string; end?: string };
  provider?: { display?: string };
  facility?: { display?: string };
  diagnosis?: Array<{
    diagnosisCodeableConcept?: { coding?: Array<{ code?: string; display?: string }> };
  }>;
  item?: Array<{
    productOrService?: { coding?: Array<{ code?: string; display?: string }> };
    adjudication?: Array<{
      category?: { coding?: Array<{ code?: string }> };
      amount?: { value?: number; currency?: string };
      reason?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
    }>;
  }>;
  total?: Array<{
    category?: { coding?: Array<{ code?: string }> };
    amount?: { value?: number; currency?: string };
  }>;
  payment?: { amount?: { value?: number } };
}

// ─────────────────────────────────────────────────────────────────────────────
// Transform Functions
// ─────────────────────────────────────────────────────────────────────────────

export function transformPatient(patient: FhirPatient): PatientSummary {
  // Name: prefer "official" use, fall back to first
  const nameEntry = patient.name?.find((n) => n.use === "official") ?? patient.name?.[0];
  const given = nameEntry?.given?.join(" ") ?? "";
  const family = nameEntry?.family ?? "";
  const name = `${given} ${family}`.trim() || "Unknown";

  // Date of birth
  const dob = patient.birthDate ?? "";
  const dateOfBirth = dob ? formatDate(dob) : "Unknown";
  const age = dob ? calculateAge(dob) : 0;

  // Gender
  const gender = capitalize(patient.gender ?? "Unknown");

  // Medicare ID — mask all but last 4 chars
  const medicareIdentifier = patient.identifier?.find(
    (id) => id.system?.includes("medicare") || id.system?.includes("bene_id")
  );
  const rawId = medicareIdentifier?.value ?? "";
  const medicareId = rawId.length > 4
    ? "***" + rawId.slice(-4)
    : rawId || "Not available";

  // Address
  const addr = patient.address?.[0];
  const address = addr?.city
    ? { city: addr.city, state: addr.state ?? "", zip: addr.postalCode ?? "" }
    : undefined;

  return { name, dateOfBirth, age, gender, medicareId, address };
}

export function transformCoverage(coverage: FhirCoverage): CoverageSummary {
  // Type: map coding to human-readable
  const typeCode = coverage.type?.coding?.[0]?.code ?? "";
  const type = mapCoverageType(typeCode, coverage);

  // Status
  const status = coverage.status === "active" ? "Active" : capitalize(coverage.status ?? "Unknown");

  // Start date
  const startDate = coverage.period?.start ? formatDate(coverage.period.start) : "Unknown";

  // Plan name
  const planClass = coverage.class?.find((c) =>
    c.type?.coding?.some((cod) => cod.code === "plan")
  );
  const planName = planClass?.name ?? coverage.payor?.[0]?.display ?? undefined;

  return { type, status, startDate, planName };
}

export function transformEOB(eob: FhirEOB): ClaimSummary {
  const id = eob.id;

  // Claim type
  const typeCode = eob.type?.coding?.[0]?.code ?? "";
  const type = mapClaimType(typeCode);

  // Service date
  const serviceDate = eob.billablePeriod?.start
    ? formatDate(eob.billablePeriod.start)
    : "Unknown";

  // Provider
  const provider = eob.provider?.display ?? eob.facility?.display ?? "Unknown provider";

  // Diagnoses
  const diagnosis = (eob.diagnosis ?? [])
    .map((d) => {
      const coding = d.diagnosisCodeableConcept?.coding?.[0];
      return coding?.display ?? coding?.code ?? null;
    })
    .filter((d): d is string => d !== null);

  // Procedures from line items
  const procedures = (eob.item ?? [])
    .map((item) => {
      const coding = item.productOrService?.coding?.[0];
      return coding?.display ?? coding?.code ?? null;
    })
    .filter((p): p is string => p !== null);

  // Amounts
  const totals = extractAmounts(eob);

  // Status/outcome
  const status = mapClaimStatus(eob.outcome, eob.status);

  // Denial detection + CARC/RARC extraction
  const { denialReasons, carcCodes, rarcCodes } = extractDenials(eob);

  return {
    id,
    type,
    serviceDate,
    provider,
    diagnosis,
    procedures,
    totalCharged: formatCurrency(totals.charged),
    medicarePaid: formatCurrency(totals.paid),
    youOwe: formatCurrency(totals.patientOwes),
    status,
    denialReasons: denialReasons.length > 0 ? denialReasons : undefined,
    carcCodes: carcCodes.length > 0 ? carcCodes : undefined,
    rarcCodes: rarcCodes.length > 0 ? rarcCodes : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Diabetes Lab Extraction (CMS Diabetes & Obesity criteria)
// ─────────────────────────────────────────────────────────────────────────────

export interface LabResult {
  name: string;
  value: number;
  unit: string;
  date: string;
  loincCode: string;
}

interface FhirObservation {
  resourceType: "Observation";
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
  valueQuantity?: { value?: number; unit?: string };
  effectiveDateTime?: string;
  status?: string;
}

/** LOINC codes for diabetes-relevant labs */
const DIABETES_LOINC: Record<string, string> = {
  "4548-4": "Hemoglobin A1C",
  "2345-7": "Glucose (Fasting)",
  "2339-0": "Glucose (Random)",
  "14771-0": "Fasting Glucose",
  "59261-8": "Hemoglobin A1C (IFCC)",
  "39156-5": "BMI",
  "55284-4": "Blood Pressure (Systolic)",
  "8462-4": "Blood Pressure (Diastolic)",
  "1558-6": "Fasting Glucose (Alt)",
};

// ─────────────────────────────────────────────────────────────────────────────
// Condition & Medication Types (CMS Diabetes & Obesity)
// ─────────────────────────────────────────────────────────────────────────────

export interface DiagnosisSummary {
  code: string;        // ICD-10 (e.g., "E11.9")
  name: string;        // "Type 2 diabetes mellitus"
  category: "type1" | "type2" | "pre-diabetic" | "other-diabetes" | "obesity" | "other";
  recordedDate: string;
}

export interface MedicationSummary {
  name: string;         // "Metformin 500mg"
  status: string;       // "Active", "Completed", "Stopped"
  dosage: string;       // "500mg twice daily"
  startDate: string;
  isDiabetesMed: boolean;
}

interface FhirCondition {
  resourceType: "Condition";
  code?: { coding?: Array<{ system?: string; code?: string; display?: string }> };
  clinicalStatus?: { coding?: Array<{ code?: string }> };
  onsetDateTime?: string;
  recordedDate?: string;
}

interface FhirMedicationRequest {
  resourceType: "MedicationRequest";
  medicationCodeableConcept?: { coding?: Array<{ system?: string; code?: string; display?: string }>; text?: string };
  status?: string;
  dosageInstruction?: Array<{ text?: string }>;
  authoredOn?: string;
}

export type DiabetesClassification = "diabetic" | "pre-diabetic" | "at-risk" | "none";

export function extractDiabetesLabs(observations: FhirObservation[]): LabResult[] {
  const results: LabResult[] = [];

  for (const obs of observations) {
    if (obs.status === "cancelled" || obs.status === "entered-in-error") continue;

    for (const coding of obs.code?.coding ?? []) {
      const code = coding.code ?? "";
      if (code in DIABETES_LOINC && obs.valueQuantity?.value != null) {
        results.push({
          name: DIABETES_LOINC[code],
          value: obs.valueQuantity.value,
          unit: obs.valueQuantity.unit ?? "%",
          date: obs.effectiveDateTime ? formatDate(obs.effectiveDateTime) : "Unknown",
          loincCode: code,
        });
        break; // Only count each observation once
      }
    }
  }

  // Sort by date descending (most recent first)
  // Parse formatted dates back to Date objects for correct chronological ordering
  return results.sort((a, b) => {
    const da = new Date(a.date).getTime();
    const db = new Date(b.date).getTime();
    if (isNaN(da) || isNaN(db)) return 0;
    return db - da;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Condition Extraction (Diabetes / Obesity diagnoses)
// ─────────────────────────────────────────────────────────────────────────────

/** ICD-10 prefix → category mapping for diabetes-related conditions */
const DIABETES_ICD10_PREFIXES: Array<[string, DiagnosisSummary["category"]]> = [
  ["E10", "type1"],
  ["E11", "type2"],
  ["E13", "other-diabetes"],
  ["R73.03", "pre-diabetic"],
  ["R73.09", "pre-diabetic"],
  ["E66", "obesity"],
];

export function extractDiabetesConditions(conditions: FhirCondition[]): DiagnosisSummary[] {
  const results: DiagnosisSummary[] = [];

  for (const cond of conditions) {
    // Skip resolved/inactive
    const clinicalStatus = cond.clinicalStatus?.coding?.[0]?.code;
    if (clinicalStatus === "resolved" || clinicalStatus === "inactive") continue;

    for (const coding of cond.code?.coding ?? []) {
      const code = coding.code ?? "";
      const display = coding.display ?? code;

      // Match diabetes-related ICD-10 codes
      const match = DIABETES_ICD10_PREFIXES.find(([prefix]) => code.startsWith(prefix));
      if (match) {
        results.push({
          code,
          name: display,
          category: match[1],
          recordedDate: cond.recordedDate
            ? formatDate(cond.recordedDate)
            : cond.onsetDateTime
            ? formatDate(cond.onsetDateTime)
            : "Unknown",
        });
        break; // One match per condition
      }
    }
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Medication Extraction (Diabetes drugs)
// ─────────────────────────────────────────────────────────────────────────────

/** Drug class keywords for diabetes medications */
const DIABETES_DRUG_PATTERNS = /metformin|insulin|glipizide|glyburide|glimepiride|pioglitazone|rosiglitazone|sitagliptin|saxagliptin|linagliptin|alogliptin|canagliflozin|dapagliflozin|empagliflozin|ertugliflozin|liraglutide|semaglutide|dulaglutide|exenatide|tirzepatide|acarbose|miglitol|nateglinide|repaglinide|colesevelam|bromocriptine|pramlintide/i;

export function extractDiabetesMedications(medRequests: FhirMedicationRequest[]): MedicationSummary[] {
  const results: MedicationSummary[] = [];

  for (const med of medRequests) {
    const display = med.medicationCodeableConcept?.text
      ?? med.medicationCodeableConcept?.coding?.[0]?.display
      ?? med.medicationCodeableConcept?.coding?.[0]?.code
      ?? "";

    if (!display) continue;

    const isDiabetesMed = DIABETES_DRUG_PATTERNS.test(display);
    const status = med.status === "active" ? "Active"
      : med.status === "completed" ? "Completed"
      : capitalize(med.status ?? "Unknown");

    results.push({
      name: display,
      status,
      dosage: med.dosageInstruction?.[0]?.text ?? "",
      startDate: med.authoredOn ? formatDate(med.authoredOn) : "Unknown",
      isDiabetesMed,
    });
  }

  // Diabetes meds first, then alphabetical
  return results.sort((a, b) => {
    if (a.isDiabetesMed !== b.isDiabetesMed) return a.isDiabetesMed ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Diabetes Classification
// ─────────────────────────────────────────────────────────────────────────────

export function classifyDiabetesStatus(
  conditions: DiagnosisSummary[],
  labs: LabResult[],
  medications: MedicationSummary[]
): { classification: DiabetesClassification; evidence: string[] } {
  const evidence: string[] = [];

  // 1. Explicit diabetes diagnosis
  const diabetesDx = conditions.find(c => c.category === "type1" || c.category === "type2" || c.category === "other-diabetes");
  if (diabetesDx) {
    evidence.push(`Diagnosis: ${diabetesDx.name} (${diabetesDx.code})`);
    return { classification: "diabetic", evidence };
  }

  // 2. Lab values indicating diabetes
  const latestA1C = labs.find(l => l.name.toLowerCase().includes("a1c"));
  const latestFastingGlucose = labs.find(l =>
    l.name.toLowerCase().includes("fasting") && l.name.toLowerCase().includes("glucose")
  );

  if (latestA1C && latestA1C.value >= 6.5) {
    evidence.push(`A1C: ${latestA1C.value}% (diabetic range)`);
    return { classification: "diabetic", evidence };
  }
  if (latestFastingGlucose && latestFastingGlucose.value >= 126) {
    evidence.push(`Fasting glucose: ${latestFastingGlucose.value} mg/dL (diabetic range)`);
    return { classification: "diabetic", evidence };
  }

  // 3. Explicit pre-diabetes diagnosis
  const preDiabetesDx = conditions.find(c => c.category === "pre-diabetic");
  if (preDiabetesDx) {
    evidence.push(`Diagnosis: ${preDiabetesDx.name} (${preDiabetesDx.code})`);
    return { classification: "pre-diabetic", evidence };
  }

  // 4. Lab values indicating pre-diabetes
  if (latestA1C && latestA1C.value >= 5.7) {
    evidence.push(`A1C: ${latestA1C.value}% (pre-diabetic range)`);
    return { classification: "pre-diabetic", evidence };
  }
  if (latestFastingGlucose && latestFastingGlucose.value >= 100) {
    evidence.push(`Fasting glucose: ${latestFastingGlucose.value} mg/dL (pre-diabetic range)`);
    return { classification: "pre-diabetic", evidence };
  }

  // 5. Active diabetes medication but no diagnosis → infer diabetic
  const activeDiabetesMed = medications.find(m => m.isDiabetesMed && m.status === "Active");
  if (activeDiabetesMed) {
    evidence.push(`Active diabetes medication: ${activeDiabetesMed.name}`);
    return { classification: "diabetic", evidence };
  }

  // 6. At-risk indicators (BMI >= 25, obesity diagnosis)
  const bmi = labs.find(l => l.name === "BMI");
  const obesityDx = conditions.find(c => c.category === "obesity");
  if (bmi && bmi.value >= 25) {
    evidence.push(`BMI: ${bmi.value} (overweight/obese)`);
    return { classification: "at-risk", evidence };
  }
  if (obesityDx) {
    evidence.push(`Diagnosis: ${obesityDx.name}`);
    return { classification: "at-risk", evidence };
  }

  return { classification: "none", evidence: ["No diabetes indicators found"] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function mapCoverageType(code: string, coverage: FhirCoverage): string {
  // Blue Button coverage types
  const partMap: Record<string, string> = {
    PART_A: "Medicare Part A (Hospital)",
    PART_B: "Medicare Part B (Medical)",
    PART_C: "Medicare Part C (Advantage)",
    PART_D: "Medicare Part D (Prescription)",
  };

  // Check class codes for part type
  for (const cls of coverage.class ?? []) {
    const classCode = cls.value?.toUpperCase() ?? "";
    if (classCode in partMap) return partMap[classCode];
  }

  return partMap[code.toUpperCase()] ?? `Medicare (${code || "Unknown"})`;
}

function mapClaimType(code: string): string {
  const typeMap: Record<string, string> = {
    "71": "Outpatient",
    "40": "Outpatient",
    CARRIER: "Carrier (Doctor visits)",
    PDE: "Part D (Prescription)",
    DME: "DME (Equipment)",
    HHA: "Home Health",
    HOSPICE: "Hospice",
    SNF: "Skilled Nursing",
    "": "Unknown",
  };
  return typeMap[code.toUpperCase()] ?? (code || "Claim");
}

function mapClaimStatus(outcome?: string, status?: string): string {
  if (outcome === "complete" || status === "active") return "Paid";
  if (outcome === "partial") return "Partially Paid";
  if (outcome === "error" || outcome === "denied") return "Denied";
  return capitalize(outcome ?? status ?? "Unknown");
}

function extractAmounts(eob: FhirEOB): {
  charged: number;
  paid: number;
  patientOwes: number;
} {
  let charged = 0;
  let paid = 0;
  let deductible = 0;
  let coinsurance = 0;

  // Check totals first
  for (const total of eob.total ?? []) {
    const code = total.category?.coding?.[0]?.code ?? "";
    const amount = total.amount?.value ?? 0;
    if (code === "submitted" || code === "benefit") {
      if (code === "submitted") charged = amount;
      if (code === "benefit") paid = amount;
    }
  }

  // Payment amount as fallback for paid
  if (paid === 0 && eob.payment?.amount?.value) {
    paid = eob.payment.amount.value;
  }

  // Sum adjudication amounts across items
  for (const item of eob.item ?? []) {
    for (const adj of item.adjudication ?? []) {
      const code = adj.category?.coding?.[0]?.code ?? "";
      const amount = adj.amount?.value ?? 0;
      if (code === "submitted" && charged === 0) charged = amount;
      if (code === "benefit" && paid === 0) paid = amount;
      if (code === "deductible") deductible += amount;
      if (code === "coinsurance" || code === "copay") coinsurance += amount;
    }
  }

  const patientOwes = deductible + coinsurance;

  return { charged, paid, patientOwes };
}

function extractDenials(eob: FhirEOB): {
  denialReasons: string[];
  carcCodes: string[];
  rarcCodes: string[];
} {
  const reasons = new Set<string>();
  const carcCodes = new Set<string>();
  const rarcCodes = new Set<string>();

  // Check if outcome indicates denial
  if (eob.outcome === "denied" || eob.outcome === "error") {
    reasons.add("Claim was denied");
  }

  // Check item-level adjudication for denial indicators and CARC/RARC codes
  for (const item of eob.item ?? []) {
    for (const adj of item.adjudication ?? []) {
      const code = adj.category?.coding?.[0]?.code ?? "";
      // Amount of 0 on benefit with submitted > 0 may indicate partial denial
      if (code === "benefit" && adj.amount?.value === 0) {
        const submitted = item.adjudication?.find(
          (a) => a.category?.coding?.[0]?.code === "submitted"
        );
        if (submitted?.amount?.value && submitted.amount.value > 0) {
          reasons.add("No benefit paid for this service");
        }
      }

      // Extract CARC/RARC from adjudication reason codes
      for (const coding of adj.reason?.coding ?? []) {
        if (!coding.code) continue;
        const system = coding.system ?? "";
        if (system.includes("adjudication") || system.includes("CARC") || system.includes("claim-adjustment")) {
          carcCodes.add(coding.code);
        } else if (system.includes("remark") || system.includes("RARC")) {
          rarcCodes.add(coding.code);
        } else if (coding.code) {
          // Unknown system — treat numeric codes as potential CARC
          carcCodes.add(coding.code);
        }
      }
    }
  }

  return {
    denialReasons: [...reasons],
    carcCodes: [...carcCodes],
    rarcCodes: [...rarcCodes],
  };
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function calculateAge(birthDate: string): number {
  const today = new Date();
  const birth = new Date(birthDate + "T00:00:00");
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}
