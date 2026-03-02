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
  diagnosisCodes?: string[];  // ICD-10 codes parallel to diagnosis[] (for clinical extraction)
  procedures: string[];
  procedureCodes?: string[];  // CPT/HCPCS/NDC codes parallel to procedures[] (for clinical extraction)
  totalCharged: string;
  medicarePaid: string;
  youOwe: string;
  status: string; // "Paid", "Denied", "Partially Paid"
  denialReasons?: string[];
  carcCodes?: string[];  // CARC codes from adjudication (for richer denial context)
  rarcCodes?: string[];  // RARC codes from adjudication
  // P1: PDE enrichment
  pdeInfo?: {
    daysSupply?: number;
    refillNumber?: number;
    totalRefillsAuthorized?: number;
    isBrandName?: boolean;
    quantityDispensed?: number;
  };
  // P2: Carrier enrichment
  careTeam?: Array<{ npi?: string; name: string; role: string; specialty?: string }>;
  placeOfService?: string;  // "Office", "Emergency Room", etc.
  // P3: Inpatient enrichment
  dischargeDate?: string;
  admissionType?: string;
  drgCode?: string;
  dischargeStatus?: string;
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
  provider?: { display?: string; reference?: string };
  facility?: { display?: string };
  diagnosis?: Array<{
    diagnosisCodeableConcept?: { coding?: Array<{ code?: string; display?: string }> };
    type?: Array<{ coding?: Array<{ code?: string }> }>;
  }>;
  item?: Array<{
    productOrService?: { coding?: Array<{ code?: string; display?: string }> };
    servicedDate?: string;
    quantity?: { value?: number; unit?: string };
    locationCodeableConcept?: { coding?: Array<{ code?: string; display?: string }> };
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
  supportingInfo?: Array<{
    category?: { coding?: Array<{ code?: string }> };
    code?: { coding?: Array<{ code?: string; display?: string }> };
    timingDate?: string;
    timingPeriod?: { start?: string; end?: string };
    valueQuantity?: { value?: number; unit?: string };
  }>;
  careTeam?: Array<{
    provider?: { display?: string; reference?: string };
    role?: { coding?: Array<{ code?: string; display?: string }> };
    qualification?: { coding?: Array<{ code?: string; display?: string }> };
  }>;
  procedure?: Array<{
    procedureCodeableConcept?: { coding?: Array<{ code?: string; display?: string }> };
    date?: string;
  }>;
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

  // Diagnoses (display names + ICD-10 codes, kept parallel)
  const diagnosisEntries = (eob.diagnosis ?? [])
    .map((d) => {
      const coding = d.diagnosisCodeableConcept?.coding?.[0];
      return {
        display: coding?.display ?? coding?.code ?? null,
        code: coding?.code ?? null,
      };
    })
    .filter((d) => d.display !== null);
  const diagnosis = diagnosisEntries.map((d) => d.display as string);
  // Parallel to diagnosis[] — "" where ICD-10 code is unavailable
  const diagnosisCodes = diagnosisEntries.map((d) => d.code ?? "");

  // Procedures from line items (display names + CPT/HCPCS/NDC codes, kept parallel)
  const procedureEntries = (eob.item ?? [])
    .map((item) => {
      const coding = item.productOrService?.coding?.[0];
      return {
        display: coding?.display ?? coding?.code ?? null,
        code: coding?.code ?? null,
      };
    })
    .filter((p) => p.display !== null);
  const procedures = procedureEntries.map((p) => p.display as string);
  // Parallel to procedures[] — "" where CPT/NDC code is unavailable
  const procedureCodes = procedureEntries.map((p) => p.code ?? "");

  // Amounts
  const totals = extractAmounts(eob);

  // Status/outcome
  const status = mapClaimStatus(eob.outcome, eob.status);

  // Denial detection + CARC/RARC extraction
  const { denialReasons, carcCodes, rarcCodes } = extractDenials(eob);

  // P1: PDE info (Part D claims)
  const pdeInfo = extractPDEInfo(eob);

  // P2: Care team + place of service
  const careTeam = extractCareTeam(eob);
  const placeOfService = extractPlaceOfService(eob);

  // P3: Inpatient fields
  const dischargeDate = eob.billablePeriod?.end ? formatDate(eob.billablePeriod.end) : undefined;
  const admissionType = extractAdmissionType(eob);
  const drgCode = extractDRGCode(eob);
  const dischargeStatus = extractDischargeStatus(eob);

  return {
    id,
    type,
    serviceDate,
    provider,
    diagnosis,
    diagnosisCodes: diagnosis.length > 0 ? diagnosisCodes : undefined,
    procedures,
    procedureCodes: procedures.length > 0 ? procedureCodes : undefined,
    totalCharged: formatCurrency(totals.charged),
    medicarePaid: formatCurrency(totals.paid),
    youOwe: formatCurrency(totals.patientOwes),
    status,
    denialReasons: denialReasons.length > 0 ? denialReasons : undefined,
    carcCodes: carcCodes.length > 0 ? carcCodes : undefined,
    rarcCodes: rarcCodes.length > 0 ? rarcCodes : undefined,
    pdeInfo: pdeInfo ?? undefined,
    careTeam: careTeam.length > 0 ? careTeam : undefined,
    placeOfService,
    dischargeDate: isInpatientType(typeCode) ? dischargeDate : undefined,
    admissionType: isInpatientType(typeCode) ? admissionType : undefined,
    drgCode: isInpatientType(typeCode) ? drgCode : undefined,
    dischargeStatus: isInpatientType(typeCode) ? dischargeStatus : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Clinical Types (used by eob-clinical.ts, diabetes page, chat context)
// ─────────────────────────────────────────────────────────────────────────────

export interface LabResult {
  name: string;
  value: number;
  unit: string;
  date: string;
  loincCode: string;
}

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
  isObesityMed: boolean;
  // PDE enrichment (P1) — all optional, populated from Part D claims
  daysSupply?: number;
  refillNumber?: number;
  totalRefillsAuthorized?: number;
  quantityDispensed?: number;
  isBrandName?: boolean;
  lastFillDate?: string;
  estimatedRunOutDate?: string;
  gapDays?: number;     // positive = overdue by this many days
}

export type DiabetesClassification = "diabetic" | "pre-diabetic" | "at-risk" | "none";

export interface ScreeningHistory {
  screeningType: "a1c" | "eye-exam" | "metabolic-panel" | "kidney" | "ecg" | "office-visit" | "nutrition" | "dsmt" | "obesity-counseling";
  displayName: string;
  lastDate: string;
  monthsSinceLast: number;
  isOverdue: boolean;
  recommendedFrequency: string;
  cptCodes: string[];  // matched CPT codes (never shown to user)
}

export interface ProviderDetail {
  npi: string;
  name: string;
  role: string;
  specialty?: string;
  visitCount: number;
  lastSeen: string;
  claimTypes: string[];
}

export interface HospitalizationSummary {
  admissionDate: string;
  dischargeDate: string;
  lengthOfStay: number;
  admissionType?: string;      // "Emergency", "Urgent", "Elective"
  dischargeStatus?: string;    // "Home", "Skilled Nursing", etc.
  drgDescription?: string;     // Plain English (never show DRG code)
  diagnoses: string[];
  provider: string;
  totalCharged: string;
  medicarePaid: string;
  youOwe: string;
  daysSinceDischarge: number;
  needsFollowUp: boolean;     // < 30 days since discharge
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
// Obesity Classification
// ─────────────────────────────────────────────────────────────────────────────

export type ObesityClassification = "obese" | "at-risk" | "none";

/**
 * Classify obesity status from conditions and medications.
 * Note: Blue Button doesn't provide BMI/weight vitals — relies on E66 ICD-10 codes and Part D drug data.
 */
export function classifyObesityStatus(
  conditions: DiagnosisSummary[],
  medications: MedicationSummary[]
): { classification: ObesityClassification; evidence: string[] } {
  const evidence: string[] = [];

  // 1. Explicit obesity diagnosis (E66.x ICD-10)
  const obesityDx = conditions.find(c => c.category === "obesity");
  if (obesityDx) {
    evidence.push(`Diagnosis: ${obesityDx.name} (${obesityDx.code})`);
    return { classification: "obese", evidence };
  }

  // 2. Active obesity/weight-loss medication → likely obese
  const activeObesityMed = medications.find(m => m.isObesityMed && m.status === "Active");
  if (activeObesityMed) {
    evidence.push(`Active weight-management medication: ${activeObesityMed.name}`);
    return { classification: "obese", evidence };
  }

  // 3. At-risk: pre-diabetic + no explicit obesity but diabetes at-risk indicators
  // (BMI ≥ 25 is an at-risk factor, but Blue Button doesn't provide BMI values)
  const preDiabetesDx = conditions.find(c => c.category === "pre-diabetic");
  if (preDiabetesDx) {
    evidence.push(`Pre-diabetes diagnosis may indicate elevated BMI: ${preDiabetesDx.name}`);
    return { classification: "at-risk", evidence };
  }

  return { classification: "none", evidence: ["No obesity indicators found"] };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// P1: PDE Info Extraction
// ─────────────────────────────────────────────────────────────────────────────

function extractPDEInfo(eob: FhirEOB): ClaimSummary["pdeInfo"] | null {
  const typeCode = eob.type?.coding?.[0]?.code?.toUpperCase() ?? "";
  if (typeCode !== "PDE") return null;

  let daysSupply: number | undefined;
  let refillNumber: number | undefined;
  let totalRefillsAuthorized: number | undefined;
  let isBrandName: boolean | undefined;

  for (const info of eob.supportingInfo ?? []) {
    const catCode = info.category?.coding?.[0]?.code?.toLowerCase() ?? "";
    if (catCode === "dayssupply" && info.valueQuantity?.value != null) {
      daysSupply = info.valueQuantity.value;
    } else if (catCode === "refillnum" && info.valueQuantity?.value != null) {
      refillNumber = info.valueQuantity.value;
    } else if (catCode === "refillsauthorized" && info.valueQuantity?.value != null) {
      totalRefillsAuthorized = info.valueQuantity.value;
    } else if (catCode === "brandgenericindicator" || catCode === "brandgenericcode") {
      const code = info.code?.coding?.[0]?.code?.toLowerCase() ?? "";
      isBrandName = code === "b" || code === "brand";
    }
  }

  // Quantity from first item
  const quantityDispensed = eob.item?.[0]?.quantity?.value;

  if (daysSupply == null && refillNumber == null && quantityDispensed == null) return null;

  return { daysSupply, refillNumber, totalRefillsAuthorized, isBrandName, quantityDispensed };
}

// ─────────────────────────────────────────────────────────────────────────────
// P2: Care Team + Place of Service Extraction
// ─────────────────────────────────────────────────────────────────────────────

const POS_CODE_MAP: Record<string, string> = {
  "11": "Office",
  "12": "Patient Home",
  "21": "Inpatient Hospital",
  "22": "Outpatient Hospital",
  "23": "Emergency Room",
  "31": "Skilled Nursing Facility",
  "32": "Nursing Facility",
  "41": "Ambulance (Land)",
  "42": "Ambulance (Air/Water)",
  "50": "Federally Qualified Health Center",
  "51": "Inpatient Psychiatric",
  "61": "Comprehensive Inpatient Rehab",
  "65": "End-Stage Renal Disease Facility",
  "71": "State/Local Public Health Clinic",
  "81": "Independent Laboratory",
};

function extractCareTeam(eob: FhirEOB): NonNullable<ClaimSummary["careTeam"]> {
  if (!eob.careTeam || eob.careTeam.length === 0) return [];

  return eob.careTeam
    .map((member) => {
      const name = member.provider?.display ?? "Unknown";
      const role = member.role?.coding?.[0]?.display ?? member.role?.coding?.[0]?.code ?? "Provider";
      const specialty = member.qualification?.coding?.[0]?.display ?? undefined;
      // Extract NPI from reference (e.g., "Practitioner/1234567890")
      const ref = member.provider?.reference ?? "";
      const npi = ref.includes("/") ? ref.split("/").pop() : undefined;
      return { npi, name, role, specialty };
    })
    .filter((m) => m.name !== "Unknown");
}

function extractPlaceOfService(eob: FhirEOB): string | undefined {
  // Check item-level location first
  for (const item of eob.item ?? []) {
    const locCode = item.locationCodeableConcept?.coding?.[0]?.code;
    if (locCode && POS_CODE_MAP[locCode]) return POS_CODE_MAP[locCode];
    const locDisplay = item.locationCodeableConcept?.coding?.[0]?.display;
    if (locDisplay) return locDisplay;
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// P3: Inpatient Field Extraction
// ─────────────────────────────────────────────────────────────────────────────

function isInpatientType(typeCode: string): boolean {
  const upper = typeCode.toUpperCase();
  return upper === "71" || upper === "60" || upper === "SNF" || upper === "HOSPICE";
}

function extractAdmissionType(eob: FhirEOB): string | undefined {
  for (const info of eob.supportingInfo ?? []) {
    const catCode = info.category?.coding?.[0]?.code?.toLowerCase() ?? "";
    if (catCode === "admtype" || catCode === "typeofadmission" || catCode === "admissiontype") {
      const code = info.code?.coding?.[0]?.code ?? "";
      const display = info.code?.coding?.[0]?.display;
      if (display) return display;
      const admMap: Record<string, string> = { "1": "Emergency", "2": "Urgent", "3": "Elective", "4": "Newborn", "9": "Unknown" };
      return admMap[code] ?? undefined;
    }
  }
  return undefined;
}

function extractDRGCode(eob: FhirEOB): string | undefined {
  for (const info of eob.supportingInfo ?? []) {
    const catCode = info.category?.coding?.[0]?.code?.toLowerCase() ?? "";
    if (catCode === "drg" || catCode === "clmdrg") {
      return info.code?.coding?.[0]?.code ?? undefined;
    }
  }
  return undefined;
}

const DISCHARGE_STATUS_MAP: Record<string, string> = {
  "01": "Home",
  "02": "Short-Term Hospital",
  "03": "Skilled Nursing Facility",
  "04": "Intermediate Care Facility",
  "05": "Another Institution",
  "06": "Home Under Care of Home Health",
  "07": "Left Against Medical Advice",
  "20": "Expired",
  "30": "Still a Patient",
  "43": "Federal Health Care Facility",
  "50": "Hospice — Home",
  "51": "Hospice — Medical Facility",
  "61": "Swing Bed",
  "62": "Inpatient Rehab",
  "63": "Long-Term Care Hospital",
  "65": "Psychiatric Hospital",
};

function extractDischargeStatus(eob: FhirEOB): string | undefined {
  for (const info of eob.supportingInfo ?? []) {
    const catCode = info.category?.coding?.[0]?.code?.toLowerCase() ?? "";
    if (catCode === "discharge-status" || catCode === "dischargestatus" || catCode === "ptntdschrgsttscd") {
      const code = info.code?.coding?.[0]?.code ?? "";
      const display = info.code?.coding?.[0]?.display;
      if (display) return display;
      return DISCHARGE_STATUS_MAP[code] ?? undefined;
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Coverage + Claim Helpers
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
