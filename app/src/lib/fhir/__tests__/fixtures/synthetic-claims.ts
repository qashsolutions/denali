/**
 * Synthetic ClaimSummary fixtures for testing eob-clinical.ts extractors.
 *
 * 7 claims designed to exercise all 5 extractors:
 *   1. Carrier — Type 2 diabetes diagnosis (E11.9)
 *   2. Outpatient — Pre-diabetic (R73.03) + Obesity (E66.01)
 *   3. Part D — Metformin with PDE info
 *   4. PDE — Insulin Glargine (brand) with 90-day supply
 *   5. Carrier — A1C test (83036) + office visit (99214)
 *   6. Outpatient — Eye exam (92250) with careTeam
 *   7. Inpatient — 5-day stay with admission/discharge details
 */

import type { ClaimSummary } from "../../transforms";

/** Recent date for "active" medications and recent screenings */
const RECENT_DATE = new Date();
RECENT_DATE.setMonth(RECENT_DATE.getMonth() - 2);
const RECENT = RECENT_DATE.toISOString().split("T")[0];

/** Older date for testing dedup (keeps most recent) */
const OLDER_DATE = new Date();
OLDER_DATE.setMonth(OLDER_DATE.getMonth() - 8);
const OLDER = OLDER_DATE.toISOString().split("T")[0];

/** Very recent discharge for hospitalization follow-up testing */
const RECENT_ADMISSION = new Date();
RECENT_ADMISSION.setDate(RECENT_ADMISSION.getDate() - 15);
const ADMISSION_DATE = RECENT_ADMISSION.toISOString().split("T")[0];

const RECENT_DISCHARGE = new Date();
RECENT_DISCHARGE.setDate(RECENT_DISCHARGE.getDate() - 10);
const DISCHARGE_DATE = RECENT_DISCHARGE.toISOString().split("T")[0];

// Claim 1: Carrier — Type 2 diabetes diagnosis
const carrierDiabetes: ClaimSummary = {
  id: "claim-001",
  type: "Carrier",
  serviceDate: RECENT,
  provider: "Dr. Smith",
  diagnosis: ["Type 2 diabetes mellitus without complications"],
  diagnosisCodes: ["E11.9"],
  procedures: ["Office visit"],
  procedureCodes: [],
  totalCharged: "$150.00",
  medicarePaid: "$120.00",
  youOwe: "$30.00",
  status: "Paid",
};

// Claim 2: Outpatient — Pre-diabetic + Obesity (tests multi-category + dedup)
const outpatientPreDiabetic: ClaimSummary = {
  id: "claim-002",
  type: "Outpatient",
  serviceDate: OLDER,
  provider: "Community Hospital",
  diagnosis: ["Prediabetes", "Morbid obesity due to excess calories"],
  diagnosisCodes: ["R73.03", "E66.01"],
  procedures: ["Metabolic panel"],
  procedureCodes: [],
  totalCharged: "$200.00",
  medicarePaid: "$160.00",
  youOwe: "$40.00",
  status: "Paid",
};

// Claim 3: Part D — Metformin with PDE enrichment
const partDMetformin: ClaimSummary = {
  id: "claim-003",
  type: "Part D",
  serviceDate: RECENT,
  provider: "CVS Pharmacy",
  diagnosis: [],
  procedures: ["Metformin 500mg"],
  procedureCodes: [],
  totalCharged: "$15.00",
  medicarePaid: "$12.00",
  youOwe: "$3.00",
  status: "Paid",
  pdeInfo: {
    daysSupply: 30,
    refillNumber: 3,
    totalRefillsAuthorized: 12,
    isBrandName: false,
    quantityDispensed: 60,
  },
};

// Claim 4: PDE — Insulin Glargine (brand, 90-day supply)
const pdeInsulin: ClaimSummary = {
  id: "claim-004",
  type: "PDE",
  serviceDate: RECENT,
  provider: "Walgreens",
  diagnosis: [],
  procedures: ["Insulin Glargine 100u/ml"],
  procedureCodes: [],
  totalCharged: "$350.00",
  medicarePaid: "$315.00",
  youOwe: "$35.00",
  status: "Paid",
  pdeInfo: {
    daysSupply: 90,
    refillNumber: 1,
    totalRefillsAuthorized: 4,
    isBrandName: true,
    quantityDispensed: 3,
  },
};

// Claim 5: Carrier — A1C test + office visit (screenings)
const carrierScreenings: ClaimSummary = {
  id: "claim-005",
  type: "Carrier",
  serviceDate: RECENT,
  provider: "Dr. Johnson",
  diagnosis: ["Type 2 diabetes mellitus without complications"],
  diagnosisCodes: ["E11.9"],
  procedures: ["Hemoglobin A1C", "Office visit level 4"],
  procedureCodes: ["83036", "99214"],
  totalCharged: "$250.00",
  medicarePaid: "$200.00",
  youOwe: "$50.00",
  status: "Paid",
};

// Claim 6: Outpatient — Eye exam with careTeam (screenings + providers)
const outpatientEyeExam: ClaimSummary = {
  id: "claim-006",
  type: "Outpatient",
  serviceDate: RECENT,
  provider: "Vision Center",
  diagnosis: ["Diabetic retinopathy screening"],
  diagnosisCodes: [],
  procedures: ["Fundus photography"],
  procedureCodes: ["92250"],
  totalCharged: "$175.00",
  medicarePaid: "$140.00",
  youOwe: "$35.00",
  status: "Paid",
  careTeam: [
    { npi: "1234567890", name: "Dr. Eye Specialist", role: "Performing", specialty: "Ophthalmology" },
    { npi: "0987654321", name: "Dr. Referring Doc", role: "Referring", specialty: "Internal Medicine" },
  ],
};

// Claim 7: Inpatient — 5-day hospital stay (recent discharge for follow-up)
const inpatientStay: ClaimSummary = {
  id: "claim-007",
  type: "Inpatient",
  serviceDate: ADMISSION_DATE,
  provider: "General Hospital",
  diagnosis: ["Diabetic ketoacidosis", "Type 2 diabetes mellitus"],
  diagnosisCodes: ["E11.10", "E11.9"],
  procedures: ["Inpatient care"],
  procedureCodes: [],
  totalCharged: "$12,000.00",
  medicarePaid: "$10,800.00",
  youOwe: "$1,200.00",
  status: "Paid",
  dischargeDate: DISCHARGE_DATE,
  admissionType: "Emergency",
  dischargeStatus: "Home",
  careTeam: [
    { npi: "5555555555", name: "Dr. Hospital", role: "Attending", specialty: "Hospitalist" },
  ],
};

/** All 7 synthetic claims */
export const syntheticClaims: ClaimSummary[] = [
  carrierDiabetes,
  outpatientPreDiabetic,
  partDMetformin,
  pdeInsulin,
  carrierScreenings,
  outpatientEyeExam,
  inpatientStay,
];

/** Re-export individual claims for targeted tests */
export {
  carrierDiabetes,
  outpatientPreDiabetic,
  partDMetformin,
  pdeInsulin,
  carrierScreenings,
  outpatientEyeExam,
  inpatientStay,
  RECENT,
  OLDER,
  ADMISSION_DATE,
  DISCHARGE_DATE,
};
