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

  // Denial detection
  const { denialReasons } = extractDenials(eob);

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
  };
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
} {
  const reasons = new Set<string>();

  // Check if outcome indicates denial
  if (eob.outcome === "denied" || eob.outcome === "error") {
    reasons.add("Claim was denied");
  }

  // Check item-level adjudication for denial indicators
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
    }
  }

  return { denialReasons: [...reasons] };
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
