/**
 * Medicare CPT/ICD-10 Mapping System - Extended Codes
 *
 * Additional mappings for oncology, nephrology, neurology, ophthalmology,
 * gastroenterology, mental health, preventive care, and DME.
 */

import type { CPTCode, ICD10Code } from "./medicare-codes";

// =============================================================================
// ONCOLOGY/CANCER CODES
// =============================================================================

export const ONCOLOGY_CPT: CPTCode[] = [
  // Pathology/Biopsy
  { code: "88305", description: "Surgical pathology, gross and microscopic, level IV", category: "Oncology", subcategory: "Pathology" },
  { code: "88307", description: "Surgical pathology, gross and microscopic, level V", category: "Oncology", subcategory: "Pathology" },
  { code: "88309", description: "Surgical pathology, gross and microscopic, level VI", category: "Oncology", subcategory: "Pathology" },
  { code: "88312", description: "Special stain, Group I", category: "Oncology", subcategory: "Pathology" },
  { code: "88313", description: "Special stain, Group II", category: "Oncology", subcategory: "Pathology" },
  { code: "88342", description: "Immunohistochemistry, each antibody", category: "Oncology", subcategory: "Pathology" },

  // Radiation Therapy
  { code: "77385", description: "IMRT, simple", category: "Oncology", subcategory: "Radiation" },
  { code: "77386", description: "IMRT, complex", category: "Oncology", subcategory: "Radiation" },
  { code: "77387", description: "IGRT (image-guided radiation therapy)", category: "Oncology", subcategory: "Radiation" },
  { code: "77401", description: "Radiation treatment delivery, superficial", category: "Oncology", subcategory: "Radiation" },
  { code: "77402", description: "Radiation treatment delivery, simple", category: "Oncology", subcategory: "Radiation" },
  { code: "77407", description: "Radiation treatment delivery, intermediate", category: "Oncology", subcategory: "Radiation" },
  { code: "77412", description: "Radiation treatment delivery, complex", category: "Oncology", subcategory: "Radiation" },
  { code: "77417", description: "Therapeutic radiology port image(s)", category: "Oncology", subcategory: "Radiation" },
  { code: "77427", description: "Radiation treatment management, 5 treatments", category: "Oncology", subcategory: "Radiation" },

  // Chemotherapy
  { code: "96401", description: "Chemotherapy administration, subcutaneous or intramuscular, non-hormonal", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96402", description: "Chemotherapy administration, subcutaneous or intramuscular, hormonal", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96405", description: "Chemotherapy administration, intralesional, up to 7 lesions", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96406", description: "Chemotherapy administration, intralesional, more than 7 lesions", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96409", description: "Chemotherapy administration, IV push, single drug", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96411", description: "Chemotherapy administration, IV push, additional drug", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96413", description: "Chemotherapy administration, IV infusion, up to 1 hour", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96415", description: "Chemotherapy administration, IV infusion, each additional hour", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96416", description: "Chemotherapy administration, IV infusion, initiation of prolonged infusion", category: "Oncology", subcategory: "Chemotherapy" },
  { code: "96417", description: "Chemotherapy administration, IV infusion, each additional sequential infusion", category: "Oncology", subcategory: "Chemotherapy" },

  // IV Infusions (supportive)
  { code: "96360", description: "IV infusion, hydration, initial 31-60 minutes", category: "Oncology", subcategory: "Infusion" },
  { code: "96361", description: "IV infusion, hydration, each additional hour", category: "Oncology", subcategory: "Infusion" },
  { code: "96365", description: "IV infusion, therapeutic, initial up to 1 hour", category: "Oncology", subcategory: "Infusion" },
  { code: "96366", description: "IV infusion, therapeutic, each additional hour", category: "Oncology", subcategory: "Infusion" },
  { code: "96367", description: "IV infusion, therapeutic, additional sequential infusion", category: "Oncology", subcategory: "Infusion" },
  { code: "96368", description: "IV infusion, therapeutic, concurrent infusion", category: "Oncology", subcategory: "Infusion" },
  { code: "96369", description: "Subcutaneous infusion, up to 1 hour", category: "Oncology", subcategory: "Infusion" },
  { code: "96370", description: "Subcutaneous infusion, each additional hour", category: "Oncology", subcategory: "Infusion" },
  { code: "96371", description: "Subcutaneous infusion, additional pump", category: "Oncology", subcategory: "Infusion" },
  { code: "96372", description: "Therapeutic injection, subcutaneous or intramuscular", category: "Oncology", subcategory: "Infusion" },
  { code: "96373", description: "Therapeutic injection, intra-arterial", category: "Oncology", subcategory: "Infusion" },
  { code: "96374", description: "Therapeutic injection, IV push", category: "Oncology", subcategory: "Infusion" },
  { code: "96375", description: "Therapeutic injection, IV push, each additional", category: "Oncology", subcategory: "Infusion" },
  { code: "96376", description: "Therapeutic injection, IV push, each additional sequential", category: "Oncology", subcategory: "Infusion" },
  { code: "96377", description: "Application of chemotherapy agent to skin", category: "Oncology", subcategory: "Infusion" },
  { code: "96379", description: "Unlisted therapeutic injection", category: "Oncology", subcategory: "Infusion" },

  // Bone Marrow
  { code: "38220", description: "Bone marrow aspiration", category: "Oncology", subcategory: "Bone Marrow" },
  { code: "38221", description: "Bone marrow biopsy", category: "Oncology", subcategory: "Bone Marrow" },
  { code: "38222", description: "Bone marrow aspiration and biopsy", category: "Oncology", subcategory: "Bone Marrow" },

  // Cancer Screening
  { code: "G0101", description: "Cervical or vaginal cancer screening, pelvic and breast exam", category: "Oncology", subcategory: "Screening", medicareNotes: "Covered every 24 months, or 12 months for high-risk" },
  { code: "G0123", description: "Screening cytopathology, thin layer", category: "Oncology", subcategory: "Screening" },
  { code: "G0124", description: "Screening cytopathology, automated thin layer", category: "Oncology", subcategory: "Screening" },
  { code: "G0105", description: "Colorectal cancer screening, colonoscopy, high risk", category: "Oncology", subcategory: "Screening", medicareNotes: "Every 24 months for high-risk" },
  { code: "G0121", description: "Colorectal cancer screening, colonoscopy, not high risk", category: "Oncology", subcategory: "Screening", medicareNotes: "Once every 10 years (45 months after flex sig)" },
  { code: "77067", description: "Screening mammography, bilateral", category: "Oncology", subcategory: "Screening", medicareNotes: "Once every 12 months" },
];

export const ONCOLOGY_ICD10: ICD10Code[] = [
  // Lung Cancer
  { code: "C34.10", description: "Malignant neoplasm of upper lobe, unspecified bronchus or lung", category: "Oncology", subcategory: "Lung" },
  { code: "C34.11", description: "Malignant neoplasm of upper lobe, right bronchus or lung", category: "Oncology", subcategory: "Lung" },
  { code: "C34.12", description: "Malignant neoplasm of upper lobe, left bronchus or lung", category: "Oncology", subcategory: "Lung" },
  { code: "C34.30", description: "Malignant neoplasm of lower lobe, unspecified bronchus or lung", category: "Oncology", subcategory: "Lung" },
  { code: "C34.31", description: "Malignant neoplasm of lower lobe, right bronchus or lung", category: "Oncology", subcategory: "Lung" },
  { code: "C34.32", description: "Malignant neoplasm of lower lobe, left bronchus or lung", category: "Oncology", subcategory: "Lung" },
  { code: "C34.90", description: "Malignant neoplasm of unspecified part of unspecified bronchus or lung", category: "Oncology", subcategory: "Lung" },
  { code: "C34.91", description: "Malignant neoplasm of unspecified part of right bronchus or lung", category: "Oncology", subcategory: "Lung" },
  { code: "C34.92", description: "Malignant neoplasm of unspecified part of left bronchus or lung", category: "Oncology", subcategory: "Lung" },

  // Breast Cancer
  { code: "C50.011", description: "Malignant neoplasm of nipple and areola, right female breast", category: "Oncology", subcategory: "Breast" },
  { code: "C50.012", description: "Malignant neoplasm of nipple and areola, left female breast", category: "Oncology", subcategory: "Breast" },
  { code: "C50.111", description: "Malignant neoplasm of central portion of right female breast", category: "Oncology", subcategory: "Breast" },
  { code: "C50.112", description: "Malignant neoplasm of central portion of left female breast", category: "Oncology", subcategory: "Breast" },
  { code: "C50.411", description: "Malignant neoplasm of upper-outer quadrant of right female breast", category: "Oncology", subcategory: "Breast" },
  { code: "C50.412", description: "Malignant neoplasm of upper-outer quadrant of left female breast", category: "Oncology", subcategory: "Breast" },
  { code: "C50.911", description: "Malignant neoplasm of unspecified site of right female breast", category: "Oncology", subcategory: "Breast" },
  { code: "C50.912", description: "Malignant neoplasm of unspecified site of left female breast", category: "Oncology", subcategory: "Breast" },
  { code: "C50.919", description: "Malignant neoplasm of unspecified site of unspecified female breast", category: "Oncology", subcategory: "Breast" },

  // Prostate Cancer
  { code: "C61", description: "Malignant neoplasm of prostate", category: "Oncology", subcategory: "Prostate" },

  // Colon Cancer
  { code: "C18.0", description: "Malignant neoplasm of cecum", category: "Oncology", subcategory: "Colon" },
  { code: "C18.2", description: "Malignant neoplasm of ascending colon", category: "Oncology", subcategory: "Colon" },
  { code: "C18.4", description: "Malignant neoplasm of transverse colon", category: "Oncology", subcategory: "Colon" },
  { code: "C18.6", description: "Malignant neoplasm of descending colon", category: "Oncology", subcategory: "Colon" },
  { code: "C18.7", description: "Malignant neoplasm of sigmoid colon", category: "Oncology", subcategory: "Colon" },
  { code: "C18.9", description: "Malignant neoplasm of colon, unspecified", category: "Oncology", subcategory: "Colon" },

  // Melanoma
  { code: "C43.0", description: "Malignant melanoma of lip", category: "Oncology", subcategory: "Melanoma" },
  { code: "C43.10", description: "Malignant melanoma of unspecified eyelid", category: "Oncology", subcategory: "Melanoma" },
  { code: "C43.30", description: "Malignant melanoma of unspecified part of face", category: "Oncology", subcategory: "Melanoma" },
  { code: "C43.4", description: "Malignant melanoma of scalp and neck", category: "Oncology", subcategory: "Melanoma" },
  { code: "C43.51", description: "Malignant melanoma of anal skin", category: "Oncology", subcategory: "Melanoma" },
  { code: "C43.59", description: "Malignant melanoma of other part of trunk", category: "Oncology", subcategory: "Melanoma" },
  { code: "C43.60", description: "Malignant melanoma of unspecified upper limb", category: "Oncology", subcategory: "Melanoma" },
  { code: "C43.70", description: "Malignant melanoma of unspecified lower limb", category: "Oncology", subcategory: "Melanoma" },
  { code: "C43.9", description: "Malignant melanoma of skin, unspecified", category: "Oncology", subcategory: "Melanoma" },

  // Kidney Cancer
  { code: "C64.1", description: "Malignant neoplasm of right kidney, except renal pelvis", category: "Oncology", subcategory: "Kidney" },
  { code: "C64.2", description: "Malignant neoplasm of left kidney, except renal pelvis", category: "Oncology", subcategory: "Kidney" },
  { code: "C64.9", description: "Malignant neoplasm of unspecified kidney, except renal pelvis", category: "Oncology", subcategory: "Kidney" },

  // Bladder Cancer
  { code: "C67.0", description: "Malignant neoplasm of trigone of bladder", category: "Oncology", subcategory: "Bladder" },
  { code: "C67.1", description: "Malignant neoplasm of dome of bladder", category: "Oncology", subcategory: "Bladder" },
  { code: "C67.2", description: "Malignant neoplasm of lateral wall of bladder", category: "Oncology", subcategory: "Bladder" },
  { code: "C67.9", description: "Malignant neoplasm of bladder, unspecified", category: "Oncology", subcategory: "Bladder" },

  // Personal History
  { code: "Z85.3", description: "Personal history of malignant neoplasm of breast", category: "Oncology", subcategory: "History" },
  { code: "Z85.46", description: "Personal history of malignant neoplasm of prostate", category: "Oncology", subcategory: "History" },
  { code: "Z85.038", description: "Personal history of other malignant neoplasm of large intestine", category: "Oncology", subcategory: "History" },
  { code: "Z85.118", description: "Personal history of other malignant neoplasm of bronchus and lung", category: "Oncology", subcategory: "History" },
  { code: "Z85.820", description: "Personal history of malignant melanoma of skin", category: "Oncology", subcategory: "History" },
  { code: "Z85.9", description: "Personal history of malignant neoplasm, unspecified", category: "Oncology", subcategory: "History" },
];

// =============================================================================
// NEPHROLOGY/KIDNEY CODES
// =============================================================================

export const NEPHROLOGY_CPT: CPTCode[] = [
  // Dialysis
  { code: "90935", description: "Hemodialysis procedure with single evaluation", category: "Nephrology", subcategory: "Dialysis" },
  { code: "90937", description: "Hemodialysis procedure requiring repeated evaluation", category: "Nephrology", subcategory: "Dialysis" },
  { code: "90945", description: "Dialysis procedure other than hemodialysis, single evaluation", category: "Nephrology", subcategory: "Dialysis" },
  { code: "90947", description: "Dialysis procedure other than hemodialysis, repeated evaluation", category: "Nephrology", subcategory: "Dialysis" },
  { code: "90960", description: "ESRD-related services, per month, for patients under age 2", category: "Nephrology", subcategory: "ESRD" },
  { code: "90961", description: "ESRD-related services, per month, for patients age 2-11", category: "Nephrology", subcategory: "ESRD" },
  { code: "90962", description: "ESRD-related services, per month, for patients age 12-19", category: "Nephrology", subcategory: "ESRD" },
  { code: "90963", description: "ESRD-related services, per month, for patients age 20+, full month", category: "Nephrology", subcategory: "ESRD" },
  { code: "90964", description: "ESRD-related services, per month, for patients age 20+, partial month", category: "Nephrology", subcategory: "ESRD" },
  { code: "90965", description: "ESRD-related services, per month, less than full month", category: "Nephrology", subcategory: "ESRD" },
  { code: "90966", description: "ESRD-related services, per month, full month", category: "Nephrology", subcategory: "ESRD" },

  // Lab Tests
  { code: "82565", description: "Creatinine, blood", category: "Nephrology", subcategory: "Lab" },
  { code: "82575", description: "Creatinine clearance", category: "Nephrology", subcategory: "Lab" },
  { code: "81001", description: "Urinalysis with microscopy, automated", category: "Nephrology", subcategory: "Lab" },
  { code: "81002", description: "Urinalysis, non-automated, without microscopy", category: "Nephrology", subcategory: "Lab" },
  { code: "81003", description: "Urinalysis, automated, without microscopy", category: "Nephrology", subcategory: "Lab" },
  { code: "84520", description: "Urea nitrogen (BUN), blood", category: "Nephrology", subcategory: "Lab" },
  { code: "84295", description: "Sodium, serum", category: "Nephrology", subcategory: "Lab" },
  { code: "84132", description: "Potassium, serum", category: "Nephrology", subcategory: "Lab" },

  // Transplant
  { code: "50360", description: "Renal allotransplantation, implantation", category: "Nephrology", subcategory: "Transplant" },
  { code: "50365", description: "Renal allotransplantation from cadaver", category: "Nephrology", subcategory: "Transplant" },
];

export const NEPHROLOGY_ICD10: ICD10Code[] = [
  // CKD Stages
  { code: "N18.1", description: "Chronic kidney disease, stage 1", category: "Nephrology", subcategory: "CKD" },
  { code: "N18.2", description: "Chronic kidney disease, stage 2 (mild)", category: "Nephrology", subcategory: "CKD" },
  { code: "N18.3", description: "Chronic kidney disease, stage 3 (moderate)", category: "Nephrology", subcategory: "CKD" },
  { code: "N18.30", description: "Chronic kidney disease, stage 3 unspecified", category: "Nephrology", subcategory: "CKD" },
  { code: "N18.31", description: "Chronic kidney disease, stage 3a", category: "Nephrology", subcategory: "CKD" },
  { code: "N18.32", description: "Chronic kidney disease, stage 3b", category: "Nephrology", subcategory: "CKD" },
  { code: "N18.4", description: "Chronic kidney disease, stage 4 (severe)", category: "Nephrology", subcategory: "CKD" },
  { code: "N18.5", description: "Chronic kidney disease, stage 5", category: "Nephrology", subcategory: "CKD" },
  { code: "N18.6", description: "End stage renal disease", category: "Nephrology", subcategory: "CKD", commonProcedures: ["90935", "90963"] },
  { code: "N18.9", description: "Chronic kidney disease, unspecified", category: "Nephrology", subcategory: "CKD" },

  // Acute Kidney Injury
  { code: "N17.0", description: "Acute kidney failure with tubular necrosis", category: "Nephrology", subcategory: "AKI" },
  { code: "N17.1", description: "Acute kidney failure with acute cortical necrosis", category: "Nephrology", subcategory: "AKI" },
  { code: "N17.2", description: "Acute kidney failure with medullary necrosis", category: "Nephrology", subcategory: "AKI" },
  { code: "N17.8", description: "Other acute kidney failure", category: "Nephrology", subcategory: "AKI" },
  { code: "N17.9", description: "Acute kidney failure, unspecified", category: "Nephrology", subcategory: "AKI" },

  // Status Codes
  { code: "Z94.0", description: "Kidney transplant status", category: "Nephrology", subcategory: "Status" },
  { code: "Z99.2", description: "Dependence on renal dialysis", category: "Nephrology", subcategory: "Status" },
];

// =============================================================================
// NEUROLOGY CODES
// =============================================================================

export const NEUROLOGY_CPT: CPTCode[] = [
  // Sleep Studies
  { code: "95810", description: "Polysomnography, sleep staging, 4+ parameters", category: "Neurology", subcategory: "Sleep", commonDiagnoses: ["G47.33"] },
  { code: "95811", description: "Polysomnography with CPAP titration", category: "Neurology", subcategory: "Sleep" },
  { code: "95800", description: "Sleep study, unattended, minimum 3 channels", category: "Neurology", subcategory: "Sleep" },
  { code: "95801", description: "Sleep study, unattended, minimum 7 channels", category: "Neurology", subcategory: "Sleep" },
  { code: "95806", description: "Sleep study, unattended, with type III portable monitor", category: "Neurology", subcategory: "Sleep" },
  { code: "95807", description: "Sleep study, attended", category: "Neurology", subcategory: "Sleep" },

  // EMG/Nerve Conduction
  { code: "95860", description: "EMG, 1 extremity, limited", category: "Neurology", subcategory: "EMG" },
  { code: "95861", description: "EMG, 2 extremities, limited", category: "Neurology", subcategory: "EMG" },
  { code: "95863", description: "EMG, 3 extremities, limited", category: "Neurology", subcategory: "EMG" },
  { code: "95864", description: "EMG, 4 extremities, limited", category: "Neurology", subcategory: "EMG" },
  { code: "95865", description: "Needle EMG, larynx", category: "Neurology", subcategory: "EMG" },
  { code: "95866", description: "Needle EMG, hemidiaphragm", category: "Neurology", subcategory: "EMG" },
  { code: "95867", description: "Needle EMG, cranial nerve innervated muscles, unilateral", category: "Neurology", subcategory: "EMG" },
  { code: "95868", description: "Needle EMG, cranial nerve innervated muscles, bilateral", category: "Neurology", subcategory: "EMG" },
  { code: "95869", description: "Needle EMG, thoracic paraspinal muscles", category: "Neurology", subcategory: "EMG" },
  { code: "95870", description: "Needle EMG, non-extremity muscle", category: "Neurology", subcategory: "EMG" },
  { code: "95872", description: "Needle EMG using single fiber electrode", category: "Neurology", subcategory: "EMG" },
  { code: "95907", description: "Nerve conduction studies, 1-2 studies", category: "Neurology", subcategory: "NCS" },
  { code: "95908", description: "Nerve conduction studies, 3-4 studies", category: "Neurology", subcategory: "NCS" },
  { code: "95909", description: "Nerve conduction studies, 5-6 studies", category: "Neurology", subcategory: "NCS" },
  { code: "95910", description: "Nerve conduction studies, 7-8 studies", category: "Neurology", subcategory: "NCS" },
  { code: "95911", description: "Nerve conduction studies, 9-10 studies", category: "Neurology", subcategory: "NCS" },
  { code: "95912", description: "Nerve conduction studies, 11-12 studies", category: "Neurology", subcategory: "NCS" },
  { code: "95913", description: "Nerve conduction studies, 13+ studies", category: "Neurology", subcategory: "NCS" },

  // Cognitive Assessment
  { code: "96116", description: "Neurobehavioral status exam by physician, first hour", category: "Neurology", subcategory: "Cognitive" },
  { code: "96121", description: "Neurobehavioral status exam by physician, each additional hour", category: "Neurology", subcategory: "Cognitive" },
  { code: "96132", description: "Neuropsychological testing by psychologist, first hour", category: "Neurology", subcategory: "Cognitive" },
  { code: "96133", description: "Neuropsychological testing by psychologist, each additional hour", category: "Neurology", subcategory: "Cognitive" },
  { code: "96136", description: "Psychological testing by technician, first 30 min", category: "Neurology", subcategory: "Cognitive" },
  { code: "96137", description: "Psychological testing by technician, each additional 30 min", category: "Neurology", subcategory: "Cognitive" },
  { code: "96138", description: "Psychological testing by technician, first 30 min, computer", category: "Neurology", subcategory: "Cognitive" },
  { code: "96139", description: "Psychological testing by technician, each additional 30 min, computer", category: "Neurology", subcategory: "Cognitive" },

  // Brain Imaging
  { code: "70551", description: "MRI brain without contrast", category: "Neurology", subcategory: "Imaging" },
  { code: "70552", description: "MRI brain with contrast", category: "Neurology", subcategory: "Imaging" },
  { code: "70553", description: "MRI brain without and with contrast", category: "Neurology", subcategory: "Imaging" },
  { code: "70450", description: "CT head without contrast", category: "Neurology", subcategory: "Imaging" },
  { code: "70460", description: "CT head with contrast", category: "Neurology", subcategory: "Imaging" },
  { code: "70470", description: "CT head without and with contrast", category: "Neurology", subcategory: "Imaging" },

  // EEG
  { code: "95816", description: "EEG, awake and drowsy", category: "Neurology", subcategory: "EEG" },
  { code: "95817", description: "EEG, awake and asleep", category: "Neurology", subcategory: "EEG" },
  { code: "95819", description: "EEG, awake and asleep or coma", category: "Neurology", subcategory: "EEG" },
  { code: "95822", description: "EEG, coma or sleep only", category: "Neurology", subcategory: "EEG" },

  // Botox
  { code: "64615", description: "Chemodenervation of muscle(s), migraine", category: "Neurology", subcategory: "Injection" },
  { code: "64612", description: "Chemodenervation of muscle(s), facial nerve", category: "Neurology", subcategory: "Injection" },
  { code: "64616", description: "Chemodenervation of muscle(s), neck", category: "Neurology", subcategory: "Injection" },
  { code: "64642", description: "Chemodenervation of extremity muscle(s), 1-4 muscles", category: "Neurology", subcategory: "Injection" },
  { code: "64643", description: "Chemodenervation of extremity muscle(s), each additional 1-4 muscles", category: "Neurology", subcategory: "Injection" },
  { code: "64644", description: "Chemodenervation of trunk muscle(s), 1-5 muscles", category: "Neurology", subcategory: "Injection" },
  { code: "64645", description: "Chemodenervation of trunk muscle(s), each additional 1-5 muscles", category: "Neurology", subcategory: "Injection" },
  { code: "64646", description: "Chemodenervation of trunk muscle(s), 6 or more muscles", category: "Neurology", subcategory: "Injection" },
  { code: "64647", description: "Chemodenervation of trunk muscle(s), each additional 6+ muscles", category: "Neurology", subcategory: "Injection" },
];

export const NEUROLOGY_ICD10: ICD10Code[] = [
  // Alzheimer's Disease
  { code: "G30.0", description: "Alzheimer's disease with early onset", category: "Neurology", subcategory: "Dementia" },
  { code: "G30.1", description: "Alzheimer's disease with late onset", category: "Neurology", subcategory: "Dementia" },
  { code: "G30.8", description: "Other Alzheimer's disease", category: "Neurology", subcategory: "Dementia" },
  { code: "G30.9", description: "Alzheimer's disease, unspecified", category: "Neurology", subcategory: "Dementia", commonProcedures: ["96116", "70551"] },

  // Other Dementias
  { code: "F01.50", description: "Vascular dementia without behavioral disturbance", category: "Neurology", subcategory: "Dementia" },
  { code: "F01.51", description: "Vascular dementia with behavioral disturbance", category: "Neurology", subcategory: "Dementia" },
  { code: "F02.80", description: "Dementia in other diseases without behavioral disturbance", category: "Neurology", subcategory: "Dementia" },
  { code: "F02.81", description: "Dementia in other diseases with behavioral disturbance", category: "Neurology", subcategory: "Dementia" },
  { code: "F03.90", description: "Unspecified dementia without behavioral disturbance", category: "Neurology", subcategory: "Dementia" },
  { code: "F03.91", description: "Unspecified dementia with behavioral disturbance", category: "Neurology", subcategory: "Dementia" },

  // Parkinson's Disease
  { code: "G20", description: "Parkinson's disease", category: "Neurology", subcategory: "Movement Disorder", commonProcedures: ["99214", "70551"] },
  { code: "G21.0", description: "Malignant neuroleptic syndrome", category: "Neurology", subcategory: "Movement Disorder" },
  { code: "G21.11", description: "Neuroleptic induced parkinsonism", category: "Neurology", subcategory: "Movement Disorder" },
  { code: "G21.19", description: "Other drug induced secondary parkinsonism", category: "Neurology", subcategory: "Movement Disorder" },
  { code: "G21.2", description: "Secondary parkinsonism due to other external agents", category: "Neurology", subcategory: "Movement Disorder" },
  { code: "G21.3", description: "Postencephalitic parkinsonism", category: "Neurology", subcategory: "Movement Disorder" },
  { code: "G21.4", description: "Vascular parkinsonism", category: "Neurology", subcategory: "Movement Disorder" },
  { code: "G21.8", description: "Other secondary parkinsonism", category: "Neurology", subcategory: "Movement Disorder" },
  { code: "G21.9", description: "Secondary parkinsonism, unspecified", category: "Neurology", subcategory: "Movement Disorder" },

  // Pain Syndromes
  { code: "G89.0", description: "Central pain syndrome", category: "Neurology", subcategory: "Pain" },
  { code: "G89.11", description: "Acute pain due to trauma", category: "Neurology", subcategory: "Pain" },
  { code: "G89.12", description: "Acute post-thoracotomy pain", category: "Neurology", subcategory: "Pain" },
  { code: "G89.18", description: "Other acute postprocedural pain", category: "Neurology", subcategory: "Pain" },
  { code: "G89.21", description: "Chronic pain due to trauma", category: "Neurology", subcategory: "Pain" },
  { code: "G89.22", description: "Chronic post-thoracotomy pain", category: "Neurology", subcategory: "Pain" },
  { code: "G89.28", description: "Other chronic postprocedural pain", category: "Neurology", subcategory: "Pain" },
  { code: "G89.29", description: "Other chronic pain", category: "Neurology", subcategory: "Pain" },
  { code: "G89.3", description: "Neoplasm related pain (acute or chronic)", category: "Neurology", subcategory: "Pain" },
  { code: "G89.4", description: "Chronic pain syndrome", category: "Neurology", subcategory: "Pain" },

  // Neuropathy
  { code: "G62.0", description: "Drug-induced polyneuropathy", category: "Neurology", subcategory: "Neuropathy" },
  { code: "G62.1", description: "Alcoholic polyneuropathy", category: "Neurology", subcategory: "Neuropathy" },
  { code: "G62.2", description: "Polyneuropathy due to other toxic agents", category: "Neurology", subcategory: "Neuropathy" },
  { code: "G62.81", description: "Critical illness polyneuropathy", category: "Neurology", subcategory: "Neuropathy" },
  { code: "G62.82", description: "Radiation-induced polyneuropathy", category: "Neurology", subcategory: "Neuropathy" },
  { code: "G62.89", description: "Other specified polyneuropathies", category: "Neurology", subcategory: "Neuropathy" },
  { code: "G62.9", description: "Polyneuropathy, unspecified", category: "Neurology", subcategory: "Neuropathy", commonProcedures: ["95907", "95860"] },

  // Sleep Disorders
  { code: "G47.00", description: "Insomnia, unspecified", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.01", description: "Insomnia due to medical condition", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.09", description: "Other insomnia", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.30", description: "Sleep apnea, unspecified", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.31", description: "Primary central sleep apnea", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.33", description: "Obstructive sleep apnea", category: "Neurology", subcategory: "Sleep", commonProcedures: ["95810", "E0601"] },
  { code: "G47.34", description: "Idiopathic sleep related nonobstructive alveolar hypoventilation", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.35", description: "Congenital central alveolar hypoventilation syndrome", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.36", description: "Sleep related hypoventilation in conditions classified elsewhere", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.37", description: "Central sleep apnea in conditions classified elsewhere", category: "Neurology", subcategory: "Sleep" },
  { code: "G47.39", description: "Other sleep apnea", category: "Neurology", subcategory: "Sleep" },

  // Other
  { code: "R41.0", description: "Disorientation, unspecified", category: "Neurology", subcategory: "Cognitive Symptoms" },
  { code: "R41.3", description: "Other amnesia", category: "Neurology", subcategory: "Cognitive Symptoms" },
  { code: "R41.82", description: "Altered mental status, unspecified", category: "Neurology", subcategory: "Cognitive Symptoms" },
  { code: "R51.9", description: "Headache, unspecified", category: "Neurology", subcategory: "Symptoms" },
  { code: "G43.909", description: "Migraine, unspecified, not intractable, without status migrainosus", category: "Neurology", subcategory: "Symptoms" },
];

// =============================================================================
// OPHTHALMOLOGY CODES
// =============================================================================

export const OPHTHALMOLOGY_CPT: CPTCode[] = [
  // Cataract Surgery
  { code: "66982", description: "Cataract surgery, complex", category: "Ophthalmology", subcategory: "Surgery" },
  { code: "66984", description: "Cataract surgery with IOL insertion", category: "Ophthalmology", subcategory: "Surgery", commonDiagnoses: ["H25.9"] },

  // Intravitreal Injections
  { code: "67028", description: "Intravitreal injection of a pharmacologic agent", category: "Ophthalmology", subcategory: "Injection", commonDiagnoses: ["H35.32", "E11.319"] },

  // Eye Exams
  { code: "92002", description: "Ophthalmological exam, intermediate, new patient", category: "Ophthalmology", subcategory: "Exam" },
  { code: "92004", description: "Ophthalmological exam, comprehensive, new patient", category: "Ophthalmology", subcategory: "Exam" },
  { code: "92012", description: "Ophthalmological exam, intermediate, established patient", category: "Ophthalmology", subcategory: "Exam" },
  { code: "92014", description: "Ophthalmological exam, comprehensive, established patient", category: "Ophthalmology", subcategory: "Exam" },

  // Visual Field
  { code: "92081", description: "Visual field examination, limited", category: "Ophthalmology", subcategory: "Diagnostic" },
  { code: "92082", description: "Visual field examination, intermediate", category: "Ophthalmology", subcategory: "Diagnostic" },
  { code: "92083", description: "Visual field examination, extended", category: "Ophthalmology", subcategory: "Diagnostic", commonDiagnoses: ["H40.10"] },

  // OCT
  { code: "92132", description: "OCT of the optic nerve", category: "Ophthalmology", subcategory: "Diagnostic" },
  { code: "92133", description: "OCT of the optic nerve, bilateral", category: "Ophthalmology", subcategory: "Diagnostic" },
  { code: "92134", description: "OCT of the retina", category: "Ophthalmology", subcategory: "Diagnostic", commonDiagnoses: ["H35.32", "H35.31"] },

  // Glaucoma
  { code: "65855", description: "Laser trabeculoplasty (ALT/SLT)", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "66170", description: "Trabeculectomy", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "66172", description: "Trabeculectomy with scarring removal", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "66180", description: "Aqueous shunt to extraocular reservoir", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "66183", description: "Aqueous shunt insertion without graft", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "66711", description: "Ciliary body destruction, cyclophotocoagulation", category: "Ophthalmology", subcategory: "Glaucoma" },

  // Retina
  { code: "67040", description: "Laser photocoagulation, panretinal", category: "Ophthalmology", subcategory: "Retina" },
  { code: "67041", description: "Laser photocoagulation, one or more sessions", category: "Ophthalmology", subcategory: "Retina" },
  { code: "67042", description: "Laser photocoagulation, macular", category: "Ophthalmology", subcategory: "Retina" },
  { code: "67043", description: "Vitrectomy, mechanical, pars plana approach", category: "Ophthalmology", subcategory: "Retina" },
  { code: "67108", description: "Repair of retinal detachment, scleral buckle", category: "Ophthalmology", subcategory: "Retina" },
  { code: "67113", description: "Repair of complex retinal detachment", category: "Ophthalmology", subcategory: "Retina" },
];

export const OPHTHALMOLOGY_ICD10: ICD10Code[] = [
  // Cataracts
  { code: "H25.10", description: "Age-related nuclear cataract, unspecified eye", category: "Ophthalmology", subcategory: "Cataract" },
  { code: "H25.11", description: "Age-related nuclear cataract, right eye", category: "Ophthalmology", subcategory: "Cataract", commonProcedures: ["66984"] },
  { code: "H25.12", description: "Age-related nuclear cataract, left eye", category: "Ophthalmology", subcategory: "Cataract" },
  { code: "H25.13", description: "Age-related nuclear cataract, bilateral", category: "Ophthalmology", subcategory: "Cataract" },
  { code: "H25.20", description: "Age-related cataract, morgagnian type, unspecified eye", category: "Ophthalmology", subcategory: "Cataract" },
  { code: "H25.811", description: "Combined forms of age-related cataract, right eye", category: "Ophthalmology", subcategory: "Cataract" },
  { code: "H25.812", description: "Combined forms of age-related cataract, left eye", category: "Ophthalmology", subcategory: "Cataract" },
  { code: "H25.813", description: "Combined forms of age-related cataract, bilateral", category: "Ophthalmology", subcategory: "Cataract" },
  { code: "H25.9", description: "Unspecified age-related cataract", category: "Ophthalmology", subcategory: "Cataract" },

  // Macular Degeneration
  { code: "H35.30", description: "Unspecified macular degeneration", category: "Ophthalmology", subcategory: "Retina" },
  { code: "H35.31", description: "Nonexudative age-related macular degeneration", category: "Ophthalmology", subcategory: "Retina", commonProcedures: ["92134"] },
  { code: "H35.3110", description: "Nonexudative AMD, right eye, stage unspecified", category: "Ophthalmology", subcategory: "Retina" },
  { code: "H35.3120", description: "Nonexudative AMD, left eye, stage unspecified", category: "Ophthalmology", subcategory: "Retina" },
  { code: "H35.3130", description: "Nonexudative AMD, bilateral, stage unspecified", category: "Ophthalmology", subcategory: "Retina" },
  { code: "H35.32", description: "Exudative age-related macular degeneration", category: "Ophthalmology", subcategory: "Retina", commonProcedures: ["67028", "92134"] },
  { code: "H35.3210", description: "Exudative AMD, right eye, stage unspecified", category: "Ophthalmology", subcategory: "Retina" },
  { code: "H35.3220", description: "Exudative AMD, left eye, stage unspecified", category: "Ophthalmology", subcategory: "Retina" },
  { code: "H35.3230", description: "Exudative AMD, bilateral, stage unspecified", category: "Ophthalmology", subcategory: "Retina" },

  // Glaucoma
  { code: "H40.10", description: "Unspecified open-angle glaucoma", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "H40.1110", description: "Primary open-angle glaucoma, right eye, stage unspecified", category: "Ophthalmology", subcategory: "Glaucoma", commonProcedures: ["92083", "92133"] },
  { code: "H40.1120", description: "Primary open-angle glaucoma, left eye, stage unspecified", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "H40.1130", description: "Primary open-angle glaucoma, bilateral, stage unspecified", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "H40.20", description: "Unspecified primary angle-closure glaucoma", category: "Ophthalmology", subcategory: "Glaucoma" },
  { code: "H40.9", description: "Unspecified glaucoma", category: "Ophthalmology", subcategory: "Glaucoma" },

  // Diabetic Retinopathy (also in Diabetes)
  { code: "E11.319", description: "Type 2 diabetes with unspecified diabetic retinopathy without macular edema", category: "Ophthalmology", subcategory: "Diabetic Retinopathy" },
  { code: "E11.329", description: "Type 2 diabetes with mild nonproliferative diabetic retinopathy without macular edema", category: "Ophthalmology", subcategory: "Diabetic Retinopathy" },
  { code: "E11.339", description: "Type 2 diabetes with moderate nonproliferative diabetic retinopathy without macular edema", category: "Ophthalmology", subcategory: "Diabetic Retinopathy" },
  { code: "E11.349", description: "Type 2 diabetes with severe nonproliferative diabetic retinopathy without macular edema", category: "Ophthalmology", subcategory: "Diabetic Retinopathy" },
  { code: "E11.359", description: "Type 2 diabetes with proliferative diabetic retinopathy without macular edema", category: "Ophthalmology", subcategory: "Diabetic Retinopathy" },

  // Vision Loss
  { code: "H54.0", description: "Blindness, both eyes", category: "Ophthalmology", subcategory: "Vision Loss" },
  { code: "H54.10", description: "Blindness, one eye, low vision other eye", category: "Ophthalmology", subcategory: "Vision Loss" },
  { code: "H54.2", description: "Low vision, both eyes", category: "Ophthalmology", subcategory: "Vision Loss" },
  { code: "H54.3", description: "Unqualified visual loss, both eyes", category: "Ophthalmology", subcategory: "Vision Loss" },
  { code: "H54.8", description: "Legal blindness, as defined in USA", category: "Ophthalmology", subcategory: "Vision Loss" },
];

// =============================================================================
// GASTROENTEROLOGY CODES
// =============================================================================

export const GI_CPT: CPTCode[] = [
  // Endoscopy
  { code: "43235", description: "Upper GI endoscopy, diagnostic", category: "GI", subcategory: "Endoscopy" },
  { code: "43239", description: "Upper GI endoscopy with biopsy", category: "GI", subcategory: "Endoscopy", commonDiagnoses: ["K21.0", "K25.9"] },
  { code: "43249", description: "Upper GI endoscopy with dilation", category: "GI", subcategory: "Endoscopy" },
  { code: "43250", description: "Upper GI endoscopy with tumor removal", category: "GI", subcategory: "Endoscopy" },
  { code: "43251", description: "Upper GI endoscopy with removal of foreign body", category: "GI", subcategory: "Endoscopy" },

  // Colonoscopy
  { code: "45378", description: "Colonoscopy, diagnostic", category: "GI", subcategory: "Colonoscopy" },
  { code: "45380", description: "Colonoscopy with biopsy", category: "GI", subcategory: "Colonoscopy", commonDiagnoses: ["Z12.11", "K57.30"] },
  { code: "45381", description: "Colonoscopy with submucosal injection", category: "GI", subcategory: "Colonoscopy" },
  { code: "45382", description: "Colonoscopy with control of bleeding", category: "GI", subcategory: "Colonoscopy" },
  { code: "45384", description: "Colonoscopy with removal of lesion by snare", category: "GI", subcategory: "Colonoscopy" },
  { code: "45385", description: "Colonoscopy with removal of lesion by snare", category: "GI", subcategory: "Colonoscopy" },

  // Imaging
  { code: "74176", description: "CT abdomen and pelvis without contrast", category: "GI", subcategory: "Imaging" },
  { code: "74177", description: "CT abdomen and pelvis with contrast", category: "GI", subcategory: "Imaging" },
  { code: "74178", description: "CT abdomen and pelvis without and with contrast", category: "GI", subcategory: "Imaging" },
  { code: "74150", description: "CT abdomen without contrast", category: "GI", subcategory: "Imaging" },
  { code: "74160", description: "CT abdomen with contrast", category: "GI", subcategory: "Imaging" },
  { code: "74170", description: "CT abdomen without and with contrast", category: "GI", subcategory: "Imaging" },

  // Esophageal Studies
  { code: "91034", description: "Esophageal function test", category: "GI", subcategory: "Esophageal" },
  { code: "91035", description: "Esophageal function test with provocation", category: "GI", subcategory: "Esophageal" },
  { code: "91037", description: "Gastric motility study", category: "GI", subcategory: "Esophageal" },
  { code: "91038", description: "Gastric motility study with intestinal monitoring", category: "GI", subcategory: "Esophageal" },

  // Screening
  { code: "G0105", description: "Colorectal cancer screening, colonoscopy, high risk", category: "GI", subcategory: "Screening", medicareNotes: "Every 24 months for high-risk" },
  { code: "G0121", description: "Colorectal cancer screening, colonoscopy, not high risk", category: "GI", subcategory: "Screening", medicareNotes: "Once every 10 years (45 months after flex sig)" },
];

export const GI_ICD10: ICD10Code[] = [
  // GERD
  { code: "K21.0", description: "GERD with esophagitis", category: "GI", subcategory: "GERD", commonProcedures: ["43239"] },
  { code: "K21.9", description: "GERD without esophagitis", category: "GI", subcategory: "GERD" },

  // Diverticular Disease
  { code: "K57.10", description: "Diverticulosis of large intestine without perforation or abscess without bleeding", category: "GI", subcategory: "Diverticular" },
  { code: "K57.11", description: "Diverticulosis of large intestine without perforation or abscess with bleeding", category: "GI", subcategory: "Diverticular" },
  { code: "K57.12", description: "Diverticulitis of large intestine without perforation or abscess without bleeding", category: "GI", subcategory: "Diverticular" },
  { code: "K57.13", description: "Diverticulitis of large intestine without perforation or abscess with bleeding", category: "GI", subcategory: "Diverticular" },
  { code: "K57.20", description: "Diverticulitis of large intestine with perforation and abscess without bleeding", category: "GI", subcategory: "Diverticular" },
  { code: "K57.21", description: "Diverticulitis of large intestine with perforation and abscess with bleeding", category: "GI", subcategory: "Diverticular" },
  { code: "K57.30", description: "Diverticulosis of large intestine without perforation or abscess, unspecified", category: "GI", subcategory: "Diverticular", commonProcedures: ["45380"] },
  { code: "K57.32", description: "Diverticulitis of large intestine without perforation or abscess, unspecified", category: "GI", subcategory: "Diverticular" },
  { code: "K57.90", description: "Diverticulosis of intestine, part unspecified, without perforation or abscess without bleeding", category: "GI", subcategory: "Diverticular" },
  { code: "K57.92", description: "Diverticulitis of intestine, part unspecified, without perforation or abscess without bleeding", category: "GI", subcategory: "Diverticular" },
  { code: "K57.93", description: "Diverticulitis of intestine, part unspecified, without perforation or abscess with bleeding", category: "GI", subcategory: "Diverticular" },

  // IBD
  { code: "K50.00", description: "Crohn's disease of small intestine without complications", category: "GI", subcategory: "IBD" },
  { code: "K50.10", description: "Crohn's disease of large intestine without complications", category: "GI", subcategory: "IBD" },
  { code: "K50.80", description: "Crohn's disease of both small and large intestine without complications", category: "GI", subcategory: "IBD" },
  { code: "K50.90", description: "Crohn's disease, unspecified, without complications", category: "GI", subcategory: "IBD" },
  { code: "K50.911", description: "Crohn's disease, unspecified, with rectal bleeding", category: "GI", subcategory: "IBD" },
  { code: "K50.912", description: "Crohn's disease, unspecified, with intestinal obstruction", category: "GI", subcategory: "IBD" },
  { code: "K50.913", description: "Crohn's disease, unspecified, with fistula", category: "GI", subcategory: "IBD" },
  { code: "K50.914", description: "Crohn's disease, unspecified, with abscess", category: "GI", subcategory: "IBD" },
  { code: "K50.918", description: "Crohn's disease, unspecified, with other complication", category: "GI", subcategory: "IBD" },
  { code: "K50.919", description: "Crohn's disease, unspecified, with unspecified complications", category: "GI", subcategory: "IBD" },
  { code: "K51.00", description: "Ulcerative pancolitis without complications", category: "GI", subcategory: "IBD" },
  { code: "K51.30", description: "Ulcerative proctitis without complications", category: "GI", subcategory: "IBD" },
  { code: "K51.50", description: "Left sided colitis without complications", category: "GI", subcategory: "IBD" },
  { code: "K51.80", description: "Other ulcerative colitis without complications", category: "GI", subcategory: "IBD" },
  { code: "K51.90", description: "Ulcerative colitis, unspecified, without complications", category: "GI", subcategory: "IBD" },
  { code: "K51.911", description: "Ulcerative colitis, unspecified with rectal bleeding", category: "GI", subcategory: "IBD" },
  { code: "K51.912", description: "Ulcerative colitis, unspecified with intestinal obstruction", category: "GI", subcategory: "IBD" },
  { code: "K51.913", description: "Ulcerative colitis, unspecified with fistula", category: "GI", subcategory: "IBD" },
  { code: "K51.914", description: "Ulcerative colitis, unspecified with abscess", category: "GI", subcategory: "IBD" },
  { code: "K51.918", description: "Ulcerative colitis, unspecified with other complication", category: "GI", subcategory: "IBD" },
  { code: "K51.919", description: "Ulcerative colitis, unspecified with unspecified complications", category: "GI", subcategory: "IBD" },

  // Liver Disease
  { code: "K76.0", description: "Fatty (change of) liver, not elsewhere classified", category: "GI", subcategory: "Liver" },
  { code: "K75.81", description: "Nonalcoholic steatohepatitis (NASH)", category: "GI", subcategory: "Liver" },
  { code: "K74.60", description: "Unspecified cirrhosis of liver", category: "GI", subcategory: "Liver" },
  { code: "K70.30", description: "Alcoholic cirrhosis of liver without ascites", category: "GI", subcategory: "Liver" },
  { code: "K70.31", description: "Alcoholic cirrhosis of liver with ascites", category: "GI", subcategory: "Liver" },

  // Screening
  { code: "Z12.11", description: "Encounter for screening for malignant neoplasm of colon", category: "GI", subcategory: "Screening", commonProcedures: ["G0121", "45378"] },
  { code: "Z12.12", description: "Encounter for screening for malignant neoplasm of rectum", category: "GI", subcategory: "Screening" },
];

// =============================================================================
// MENTAL HEALTH CODES
// =============================================================================

export const MENTAL_HEALTH_CPT: CPTCode[] = [
  // Psychotherapy
  { code: "90832", description: "Psychotherapy, 30 minutes with patient", category: "Mental Health", subcategory: "Therapy" },
  { code: "90833", description: "Psychotherapy, 30 minutes with E/M service", category: "Mental Health", subcategory: "Therapy" },
  { code: "90834", description: "Psychotherapy, 45 minutes with patient", category: "Mental Health", subcategory: "Therapy", commonDiagnoses: ["F32.9", "F41.9"] },
  { code: "90836", description: "Psychotherapy, 45 minutes with E/M service", category: "Mental Health", subcategory: "Therapy" },
  { code: "90837", description: "Psychotherapy, 60 minutes with patient", category: "Mental Health", subcategory: "Therapy" },
  { code: "90838", description: "Psychotherapy, 60 minutes with E/M service", category: "Mental Health", subcategory: "Therapy" },

  // Family/Group Therapy
  { code: "90846", description: "Family psychotherapy without patient present", category: "Mental Health", subcategory: "Therapy" },
  { code: "90847", description: "Family psychotherapy with patient present", category: "Mental Health", subcategory: "Therapy" },
  { code: "90849", description: "Multiple-family group psychotherapy", category: "Mental Health", subcategory: "Therapy" },
  { code: "90853", description: "Group psychotherapy", category: "Mental Health", subcategory: "Therapy" },

  // Psychiatric Evaluation
  { code: "90791", description: "Psychiatric diagnostic evaluation", category: "Mental Health", subcategory: "Evaluation" },
  { code: "90792", description: "Psychiatric diagnostic evaluation with medical services", category: "Mental Health", subcategory: "Evaluation" },

  // Medication Management
  { code: "90863", description: "Pharmacologic management with psychotherapy", category: "Mental Health", subcategory: "Medication" },

  // Crisis
  { code: "90839", description: "Psychotherapy for crisis, first 60 minutes", category: "Mental Health", subcategory: "Crisis" },
  { code: "90840", description: "Psychotherapy for crisis, each additional 30 minutes", category: "Mental Health", subcategory: "Crisis" },
];

export const MENTAL_HEALTH_ICD10: ICD10Code[] = [
  // Major Depressive Disorder - Single Episode
  { code: "F32.0", description: "Major depressive disorder, single episode, mild", category: "Mental Health", subcategory: "Depression" },
  { code: "F32.1", description: "Major depressive disorder, single episode, moderate", category: "Mental Health", subcategory: "Depression" },
  { code: "F32.2", description: "Major depressive disorder, single episode, severe without psychotic features", category: "Mental Health", subcategory: "Depression" },
  { code: "F32.3", description: "Major depressive disorder, single episode, severe with psychotic features", category: "Mental Health", subcategory: "Depression" },
  { code: "F32.4", description: "Major depressive disorder, single episode, in partial remission", category: "Mental Health", subcategory: "Depression" },
  { code: "F32.5", description: "Major depressive disorder, single episode, in full remission", category: "Mental Health", subcategory: "Depression" },
  { code: "F32.89", description: "Other specified depressive episodes", category: "Mental Health", subcategory: "Depression" },
  { code: "F32.9", description: "Major depressive disorder, single episode, unspecified", category: "Mental Health", subcategory: "Depression", commonProcedures: ["90834", "90837"] },

  // Major Depressive Disorder - Recurrent
  { code: "F33.0", description: "Major depressive disorder, recurrent, mild", category: "Mental Health", subcategory: "Depression" },
  { code: "F33.1", description: "Major depressive disorder, recurrent, moderate", category: "Mental Health", subcategory: "Depression" },
  { code: "F33.2", description: "Major depressive disorder, recurrent severe without psychotic features", category: "Mental Health", subcategory: "Depression" },
  { code: "F33.3", description: "Major depressive disorder, recurrent, severe with psychotic symptoms", category: "Mental Health", subcategory: "Depression" },
  { code: "F33.40", description: "Major depressive disorder, recurrent, in remission, unspecified", category: "Mental Health", subcategory: "Depression" },
  { code: "F33.41", description: "Major depressive disorder, recurrent, in partial remission", category: "Mental Health", subcategory: "Depression" },
  { code: "F33.42", description: "Major depressive disorder, recurrent, in full remission", category: "Mental Health", subcategory: "Depression" },
  { code: "F33.8", description: "Other recurrent depressive disorders", category: "Mental Health", subcategory: "Depression" },
  { code: "F33.9", description: "Major depressive disorder, recurrent, unspecified", category: "Mental Health", subcategory: "Depression" },

  // Anxiety Disorders
  { code: "F41.0", description: "Panic disorder without agoraphobia", category: "Mental Health", subcategory: "Anxiety" },
  { code: "F41.1", description: "Generalized anxiety disorder", category: "Mental Health", subcategory: "Anxiety", commonProcedures: ["90834", "90837"] },
  { code: "F41.8", description: "Other specified anxiety disorders", category: "Mental Health", subcategory: "Anxiety" },
  { code: "F41.9", description: "Anxiety disorder, unspecified", category: "Mental Health", subcategory: "Anxiety" },
  { code: "F40.10", description: "Social phobia, unspecified", category: "Mental Health", subcategory: "Anxiety" },
  { code: "F40.11", description: "Social phobia, generalized", category: "Mental Health", subcategory: "Anxiety" },

  // Bipolar Disorder
  { code: "F31.0", description: "Bipolar disorder, current episode hypomanic", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.10", description: "Bipolar disorder, current episode manic without psychotic features, unspecified", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.11", description: "Bipolar disorder, current episode manic without psychotic features, mild", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.12", description: "Bipolar disorder, current episode manic without psychotic features, moderate", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.13", description: "Bipolar disorder, current episode manic without psychotic features, severe", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.2", description: "Bipolar disorder, current episode manic severe with psychotic features", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.30", description: "Bipolar disorder, current episode depressed, mild or moderate severity, unspecified", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.31", description: "Bipolar disorder, current episode depressed, mild", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.32", description: "Bipolar disorder, current episode depressed, moderate", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.4", description: "Bipolar disorder, current episode depressed, severe, without psychotic features", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.5", description: "Bipolar disorder, current episode depressed, severe, with psychotic features", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.60", description: "Bipolar disorder, current episode mixed, unspecified", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.61", description: "Bipolar disorder, current episode mixed, mild", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.62", description: "Bipolar disorder, current episode mixed, moderate", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.63", description: "Bipolar disorder, current episode mixed, severe, without psychotic features", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.64", description: "Bipolar disorder, current episode mixed, severe, with psychotic features", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.70", description: "Bipolar disorder, currently in remission, most recent episode unspecified", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.71", description: "Bipolar disorder, in partial remission, most recent episode hypomanic", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.72", description: "Bipolar disorder, in full remission, most recent episode hypomanic", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.73", description: "Bipolar disorder, in partial remission, most recent episode manic", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.74", description: "Bipolar disorder, in full remission, most recent episode manic", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.75", description: "Bipolar disorder, in partial remission, most recent episode depressed", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.76", description: "Bipolar disorder, in full remission, most recent episode depressed", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.77", description: "Bipolar disorder, in partial remission, most recent episode mixed", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.78", description: "Bipolar disorder, in full remission, most recent episode mixed", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.81", description: "Bipolar II disorder", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.89", description: "Other bipolar disorder", category: "Mental Health", subcategory: "Bipolar" },
  { code: "F31.9", description: "Bipolar disorder, unspecified", category: "Mental Health", subcategory: "Bipolar" },
];

// =============================================================================
// PREVENTIVE CARE CODES
// =============================================================================

export const PREVENTIVE_CPT: CPTCode[] = [
  // Annual Wellness Visits
  { code: "G0438", description: "Annual wellness visit, initial", category: "Preventive", subcategory: "AWV", medicareNotes: "Once per lifetime, after 12 months of Part B" },
  { code: "G0439", description: "Annual wellness visit, subsequent", category: "Preventive", subcategory: "AWV", medicareNotes: "Once every 12 months after initial AWV" },

  // Screenings
  { code: "G0442", description: "Annual alcohol misuse screening, 15 minutes", category: "Preventive", subcategory: "Screening" },
  { code: "G0443", description: "Brief face-to-face behavioral counseling for alcohol misuse, 15 minutes", category: "Preventive", subcategory: "Screening" },
  { code: "G0444", description: "Annual depression screening, 15 minutes", category: "Preventive", subcategory: "Screening" },
  { code: "G0446", description: "Annual face-to-face intensive behavioral therapy for cardiovascular disease, 15 minutes", category: "Preventive", subcategory: "Counseling" },
  { code: "G0447", description: "Face-to-face behavioral counseling for obesity, 15 minutes", category: "Preventive", subcategory: "Counseling" },

  // Vaccines
  { code: "90732", description: "Pneumococcal polysaccharide vaccine (PPSV23)", category: "Preventive", subcategory: "Vaccine", medicareNotes: "One-time, additional if high risk" },
  { code: "90670", description: "Pneumococcal conjugate vaccine (PCV13)", category: "Preventive", subcategory: "Vaccine" },
  { code: "90715", description: "Tdap vaccine", category: "Preventive", subcategory: "Vaccine" },
  { code: "90714", description: "Td vaccine", category: "Preventive", subcategory: "Vaccine" },
  { code: "90662", description: "Influenza vaccine, high-dose", category: "Preventive", subcategory: "Vaccine" },
  { code: "90686", description: "Influenza vaccine, quadrivalent", category: "Preventive", subcategory: "Vaccine" },
  { code: "90688", description: "Influenza vaccine, quadrivalent, split virus", category: "Preventive", subcategory: "Vaccine" },
  { code: "90750", description: "Zoster vaccine, recombinant (Shingrix), IM", category: "Preventive", subcategory: "Vaccine", medicareNotes: "Part D coverage, 2 doses 2-6 months apart" },

  // Preventive Visits
  { code: "99381", description: "Preventive visit, new patient, infant", category: "Preventive", subcategory: "Visit" },
  { code: "99382", description: "Preventive visit, new patient, age 1-4", category: "Preventive", subcategory: "Visit" },
  { code: "99383", description: "Preventive visit, new patient, age 5-11", category: "Preventive", subcategory: "Visit" },
  { code: "99384", description: "Preventive visit, new patient, age 12-17", category: "Preventive", subcategory: "Visit" },
  { code: "99385", description: "Preventive visit, new patient, age 18-39", category: "Preventive", subcategory: "Visit" },
  { code: "99386", description: "Preventive visit, new patient, age 40-64", category: "Preventive", subcategory: "Visit" },
  { code: "99387", description: "Preventive visit, new patient, age 65+", category: "Preventive", subcategory: "Visit" },
  { code: "99391", description: "Preventive visit, established patient, infant", category: "Preventive", subcategory: "Visit" },
  { code: "99392", description: "Preventive visit, established patient, age 1-4", category: "Preventive", subcategory: "Visit" },
  { code: "99393", description: "Preventive visit, established patient, age 5-11", category: "Preventive", subcategory: "Visit" },
  { code: "99394", description: "Preventive visit, established patient, age 12-17", category: "Preventive", subcategory: "Visit" },
  { code: "99395", description: "Preventive visit, established patient, age 18-39", category: "Preventive", subcategory: "Visit" },
  { code: "99396", description: "Preventive visit, established patient, age 40-64", category: "Preventive", subcategory: "Visit" },
  { code: "99397", description: "Preventive visit, established patient, age 65+", category: "Preventive", subcategory: "Visit" },
];

// =============================================================================
// DME (DURABLE MEDICAL EQUIPMENT) CODES
// =============================================================================

export const DME_HCPCS: CPTCode[] = [
  // CPAP/BiPAP
  { code: "E0601", description: "Continuous positive airway pressure (CPAP) device", category: "DME", subcategory: "Respiratory", commonDiagnoses: ["G47.33"] },
  { code: "E0470", description: "Respiratory assist device, bi-level pressure capability, without backup rate", category: "DME", subcategory: "Respiratory" },
  { code: "E0471", description: "Respiratory assist device, bi-level pressure capability, with backup rate", category: "DME", subcategory: "Respiratory" },
  { code: "A7030", description: "CPAP full face mask", category: "DME", subcategory: "Respiratory" },
  { code: "A7031", description: "CPAP face mask interface, replacement cushion", category: "DME", subcategory: "Respiratory" },
  { code: "A7032", description: "CPAP nasal cushion/pillow", category: "DME", subcategory: "Respiratory" },
  { code: "A7034", description: "CPAP nasal interface", category: "DME", subcategory: "Respiratory" },
  { code: "A7035", description: "CPAP headgear", category: "DME", subcategory: "Respiratory" },
  { code: "A7036", description: "CPAP chinstrap", category: "DME", subcategory: "Respiratory" },
  { code: "A7037", description: "CPAP tubing", category: "DME", subcategory: "Respiratory" },
  { code: "A7038", description: "CPAP filter, disposable", category: "DME", subcategory: "Respiratory" },
  { code: "A7039", description: "CPAP filter, non-disposable", category: "DME", subcategory: "Respiratory" },
  { code: "A7046", description: "CPAP water chamber for humidifier", category: "DME", subcategory: "Respiratory" },

  // Hospital Beds
  { code: "E0260", description: "Hospital bed, semi-electric, with mattress", category: "DME", subcategory: "Bed" },
  { code: "E0261", description: "Hospital bed, semi-electric, with side rails and mattress", category: "DME", subcategory: "Bed" },
  { code: "E0265", description: "Hospital bed, full electric, with mattress", category: "DME", subcategory: "Bed" },
  { code: "E0266", description: "Hospital bed, full electric, with side rails and mattress", category: "DME", subcategory: "Bed" },
  { code: "E0271", description: "Mattress, hospital bed, innerspring", category: "DME", subcategory: "Bed" },
  { code: "E0272", description: "Mattress, hospital bed, foam rubber", category: "DME", subcategory: "Bed" },

  // Mobility Aids - Crutches
  { code: "E0110", description: "Crutches, forearm, wood, adjustable, pair", category: "DME", subcategory: "Mobility" },
  { code: "E0111", description: "Crutches, forearm, aluminum, adjustable, pair", category: "DME", subcategory: "Mobility" },
  { code: "E0112", description: "Crutches, underarm, wood, adjustable, pair", category: "DME", subcategory: "Mobility" },
  { code: "E0113", description: "Crutches, underarm, wood, adjustable, pair, with tips and handgrips", category: "DME", subcategory: "Mobility" },
  { code: "E0114", description: "Crutches, underarm, aluminum, adjustable, pair", category: "DME", subcategory: "Mobility" },
  { code: "E0116", description: "Crutch, underarm, aluminum, adjustable, each", category: "DME", subcategory: "Mobility" },
  { code: "E0117", description: "Crutch, underarm, patient articulating spring assist, each", category: "DME", subcategory: "Mobility" },
  { code: "E0118", description: "Crutch substitute, lower leg platform, with or without wheels, each", category: "DME", subcategory: "Mobility" },

  // Mobility Aids - Walkers
  { code: "E0130", description: "Walker, rigid, adjustable or fixed height", category: "DME", subcategory: "Mobility" },
  { code: "E0135", description: "Walker, folding, adjustable or fixed height", category: "DME", subcategory: "Mobility" },
  { code: "E0140", description: "Walker, with trunk support, adjustable or fixed height, any type", category: "DME", subcategory: "Mobility" },
  { code: "E0141", description: "Walker, rigid, wheeled, adjustable or fixed height", category: "DME", subcategory: "Mobility" },
  { code: "E0143", description: "Walker, folding, wheeled, adjustable or fixed height", category: "DME", subcategory: "Mobility" },
  { code: "E0144", description: "Walker, enclosed, four-sided framed, rigid or folding, wheeled", category: "DME", subcategory: "Mobility" },
  { code: "E0147", description: "Walker, heavy duty, multiple braking system, variable wheel resistance", category: "DME", subcategory: "Mobility" },
  { code: "E0148", description: "Walker, heavy duty, without wheels, rigid or folding, any type", category: "DME", subcategory: "Mobility" },
  { code: "E0149", description: "Walker, heavy duty, wheeled, rigid or folding, any type", category: "DME", subcategory: "Mobility" },
  { code: "E0154", description: "Platform attachment, walker, each", category: "DME", subcategory: "Mobility" },
  { code: "E0155", description: "Wheel attachment, rigid pick-up walker, per pair", category: "DME", subcategory: "Mobility" },
  { code: "E0156", description: "Seat attachment, walker", category: "DME", subcategory: "Mobility" },
  { code: "E0157", description: "Crutch attachment, walker, each", category: "DME", subcategory: "Mobility" },
  { code: "E0158", description: "Leg extensions for walker, per set of four", category: "DME", subcategory: "Mobility" },
  { code: "E0159", description: "Brake attachment for wheeled walker, replacement, each", category: "DME", subcategory: "Mobility" },

  // Mobility Aids - Canes
  { code: "E0100", description: "Cane, adjustable or fixed, with tip", category: "DME", subcategory: "Mobility" },
  { code: "E0105", description: "Cane, quad or three-pronged, with tips", category: "DME", subcategory: "Mobility" },

  // Oxygen
  { code: "E1390", description: "Oxygen concentrator, single delivery port, capable of delivering 85% or greater oxygen concentration", category: "DME", subcategory: "Oxygen", commonDiagnoses: ["J96.11", "J44.1"] },
  { code: "E1391", description: "Oxygen concentrator, dual delivery port, capable of delivering 85% or greater oxygen concentration", category: "DME", subcategory: "Oxygen" },
  { code: "E0431", description: "Portable gaseous oxygen system, rental", category: "DME", subcategory: "Oxygen" },
  { code: "E0434", description: "Portable liquid oxygen system, rental", category: "DME", subcategory: "Oxygen" },
  { code: "E0439", description: "Stationary liquid oxygen system, rental", category: "DME", subcategory: "Oxygen" },
  { code: "E0441", description: "Oxygen contents, gaseous, 1 month supply", category: "DME", subcategory: "Oxygen" },
  { code: "E0442", description: "Oxygen contents, liquid, 1 month supply", category: "DME", subcategory: "Oxygen" },
  { code: "E0443", description: "Portable oxygen contents, gaseous, 1 month supply", category: "DME", subcategory: "Oxygen" },
  { code: "E0444", description: "Portable oxygen contents, liquid, 1 month supply", category: "DME", subcategory: "Oxygen" },

  // Wheelchairs
  { code: "K0001", description: "Standard wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0002", description: "Standard hemi (low seat) wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0003", description: "Lightweight wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0004", description: "High strength lightweight wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0005", description: "Ultra lightweight wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0006", description: "Heavy duty wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0007", description: "Extra heavy duty wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0008", description: "Custom manual wheelchair/base", category: "DME", subcategory: "Wheelchair" },
  { code: "K0009", description: "Other manual wheelchair/base", category: "DME", subcategory: "Wheelchair" },
  { code: "K0010", description: "Standard weight frame motorized/power wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0011", description: "Standard weight frame motorized/power wheelchair with programmable control parameters", category: "DME", subcategory: "Wheelchair" },
  { code: "K0012", description: "Lightweight portable motorized/power wheelchair", category: "DME", subcategory: "Wheelchair" },
  { code: "K0014", description: "Other motorized/power wheelchair base", category: "DME", subcategory: "Wheelchair" },

  // Diabetes Supplies
  { code: "A4253", description: "Blood glucose test or reagent strips for home blood glucose monitor, per 50 strips", category: "DME", subcategory: "Diabetes" },
  { code: "A4256", description: "Normal, low, and high calibrator solution/chips", category: "DME", subcategory: "Diabetes" },
  { code: "A4258", description: "Spring-powered device for lancet, each", category: "DME", subcategory: "Diabetes" },
  { code: "A4259", description: "Lancets, per box of 100", category: "DME", subcategory: "Diabetes" },
  { code: "E0607", description: "Home blood glucose monitor", category: "DME", subcategory: "Diabetes" },
  { code: "E2100", description: "Blood glucose monitor with integrated voice synthesizer", category: "DME", subcategory: "Diabetes" },
  { code: "E2101", description: "Blood glucose monitor with integrated lancing/blood sample", category: "DME", subcategory: "Diabetes" },
];

export const DME_ICD10: ICD10Code[] = [
  // Sleep Apnea (for CPAP)
  { code: "G47.33", description: "Obstructive sleep apnea", category: "DME", subcategory: "Respiratory", commonProcedures: ["E0601", "95810"] },

  // Respiratory Failure (for oxygen)
  { code: "J96.00", description: "Acute respiratory failure, unspecified", category: "DME", subcategory: "Respiratory" },
  { code: "J96.01", description: "Acute respiratory failure with hypoxia", category: "DME", subcategory: "Respiratory" },
  { code: "J96.10", description: "Chronic respiratory failure, unspecified", category: "DME", subcategory: "Respiratory", commonProcedures: ["E1390"] },
  { code: "J96.11", description: "Chronic respiratory failure with hypoxia", category: "DME", subcategory: "Respiratory" },
  { code: "J96.90", description: "Respiratory failure, unspecified", category: "DME", subcategory: "Respiratory" },
  { code: "J96.91", description: "Respiratory failure, unspecified with hypoxia", category: "DME", subcategory: "Respiratory" },

  // Mobility limitations
  { code: "M62.81", description: "Muscle weakness (generalized)", category: "DME", subcategory: "Mobility", commonProcedures: ["E0130", "K0001"] },
  { code: "R26.0", description: "Ataxic gait", category: "DME", subcategory: "Mobility" },
  { code: "R26.1", description: "Paralytic gait", category: "DME", subcategory: "Mobility" },
  { code: "R26.2", description: "Difficulty in walking, not elsewhere classified", category: "DME", subcategory: "Mobility" },
  { code: "R26.81", description: "Unsteadiness on feet", category: "DME", subcategory: "Mobility" },
  { code: "R26.89", description: "Other abnormalities of gait and mobility", category: "DME", subcategory: "Mobility" },
  { code: "R26.9", description: "Unspecified abnormalities of gait and mobility", category: "DME", subcategory: "Mobility" },

  // Need for assistance
  { code: "Z74.01", description: "Bed confinement status", category: "DME", subcategory: "Assistance" },
  { code: "Z74.09", description: "Other reduced mobility", category: "DME", subcategory: "Assistance" },
  { code: "Z74.1", description: "Need for assistance with personal care", category: "DME", subcategory: "Assistance" },
  { code: "Z74.2", description: "Need for assistance at home and no other household member able to render care", category: "DME", subcategory: "Assistance" },
  { code: "Z74.3", description: "Need for continuous supervision", category: "DME", subcategory: "Assistance" },
  { code: "Z74.8", description: "Other problems related to care provider dependency", category: "DME", subcategory: "Assistance" },
  { code: "Z74.9", description: "Problem related to care provider dependency, unspecified", category: "DME", subcategory: "Assistance" },
];

// Export all extended codes
export const EXTENDED_CPT_CODES: CPTCode[] = [
  ...ONCOLOGY_CPT,
  ...NEPHROLOGY_CPT,
  ...NEUROLOGY_CPT,
  ...OPHTHALMOLOGY_CPT,
  ...GI_CPT,
  ...MENTAL_HEALTH_CPT,
  ...PREVENTIVE_CPT,
  ...DME_HCPCS,
];

export const EXTENDED_ICD10_CODES: ICD10Code[] = [
  ...ONCOLOGY_ICD10,
  ...NEPHROLOGY_ICD10,
  ...NEUROLOGY_ICD10,
  ...OPHTHALMOLOGY_ICD10,
  ...GI_ICD10,
  ...MENTAL_HEALTH_ICD10,
  ...DME_ICD10,
];
