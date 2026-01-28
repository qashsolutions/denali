/**
 * Medicare CPT/ICD-10 Mapping System for Seniors (65+)
 *
 * Comprehensive mappings for common conditions affecting Medicare beneficiaries.
 * Used as primary source when AMA API is unavailable.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CPTCode {
  code: string;
  description: string;
  category: string;
  subcategory?: string;
  commonDiagnoses?: string[]; // ICD-10 codes commonly paired
  medicareNotes?: string;
}

export interface ICD10Code {
  code: string;
  description: string;
  category: string;
  subcategory?: string;
  commonProcedures?: string[]; // CPT codes commonly needed
}

export interface ConditionMapping {
  condition: string;
  keywords: string[];
  icd10Codes: string[];
  cptCodes: string[];
  category: string;
}

// =============================================================================
// EVALUATION & MANAGEMENT (E/M) CODES
// =============================================================================

export const EM_CODES: CPTCode[] = [
  // Office/Outpatient Visits - New Patient
  { code: "99201", description: "Office visit, new patient, straightforward", category: "E/M", subcategory: "Office Visit - New" },
  { code: "99202", description: "Office visit, new patient, straightforward MDM", category: "E/M", subcategory: "Office Visit - New" },
  { code: "99203", description: "Office visit, new patient, low complexity", category: "E/M", subcategory: "Office Visit - New" },
  { code: "99204", description: "Office visit, new patient, moderate complexity", category: "E/M", subcategory: "Office Visit - New" },
  { code: "99205", description: "Office visit, new patient, high complexity", category: "E/M", subcategory: "Office Visit - New" },

  // Office/Outpatient Visits - Established Patient
  { code: "99211", description: "Office visit, established patient, minimal", category: "E/M", subcategory: "Office Visit - Established" },
  { code: "99212", description: "Office visit, established patient, straightforward", category: "E/M", subcategory: "Office Visit - Established" },
  { code: "99213", description: "Office visit, established patient, low complexity", category: "E/M", subcategory: "Office Visit - Established" },
  { code: "99214", description: "Office visit, established patient, moderate complexity", category: "E/M", subcategory: "Office Visit - Established" },
  { code: "99215", description: "Office visit, established patient, high complexity", category: "E/M", subcategory: "Office Visit - Established" },

  // Home Visits
  { code: "99341", description: "Home visit, new patient, straightforward", category: "E/M", subcategory: "Home Visit" },
  { code: "99342", description: "Home visit, new patient, low complexity", category: "E/M", subcategory: "Home Visit" },
  { code: "99343", description: "Home visit, new patient, moderate complexity", category: "E/M", subcategory: "Home Visit" },
  { code: "99344", description: "Home visit, new patient, high complexity", category: "E/M", subcategory: "Home Visit" },
  { code: "99345", description: "Home visit, new patient, high complexity (unstable)", category: "E/M", subcategory: "Home Visit" },
  { code: "99347", description: "Home visit, established patient, straightforward", category: "E/M", subcategory: "Home Visit" },
  { code: "99348", description: "Home visit, established patient, low complexity", category: "E/M", subcategory: "Home Visit" },
  { code: "99349", description: "Home visit, established patient, moderate complexity", category: "E/M", subcategory: "Home Visit" },
  { code: "99350", description: "Home visit, established patient, high complexity", category: "E/M", subcategory: "Home Visit" },

  // Emergency Department
  { code: "99281", description: "ED visit, self-limited or minor problem", category: "E/M", subcategory: "Emergency" },
  { code: "99282", description: "ED visit, low to moderate severity", category: "E/M", subcategory: "Emergency" },
  { code: "99283", description: "ED visit, moderate severity", category: "E/M", subcategory: "Emergency" },
  { code: "99284", description: "ED visit, high severity", category: "E/M", subcategory: "Emergency" },
  { code: "99285", description: "ED visit, high severity with immediate threat", category: "E/M", subcategory: "Emergency" },

  // Hospital Care - Initial
  { code: "99221", description: "Initial hospital care, low complexity", category: "E/M", subcategory: "Hospital - Initial" },
  { code: "99222", description: "Initial hospital care, moderate complexity", category: "E/M", subcategory: "Hospital - Initial" },
  { code: "99223", description: "Initial hospital care, high complexity", category: "E/M", subcategory: "Hospital - Initial" },

  // Hospital Care - Subsequent
  { code: "99231", description: "Subsequent hospital care, stable/recovering", category: "E/M", subcategory: "Hospital - Subsequent" },
  { code: "99232", description: "Subsequent hospital care, responding inadequately", category: "E/M", subcategory: "Hospital - Subsequent" },
  { code: "99233", description: "Subsequent hospital care, unstable/significant complication", category: "E/M", subcategory: "Hospital - Subsequent" },

  // Hospital Discharge
  { code: "99238", description: "Hospital discharge day, 30 minutes or less", category: "E/M", subcategory: "Hospital - Discharge" },
  { code: "99239", description: "Hospital discharge day, more than 30 minutes", category: "E/M", subcategory: "Hospital - Discharge" },

  // Nursing Facility
  { code: "99304", description: "Nursing facility admission, low complexity", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99305", description: "Nursing facility admission, moderate complexity", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99306", description: "Nursing facility admission, high complexity", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99307", description: "Nursing facility subsequent care, straightforward", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99308", description: "Nursing facility subsequent care, low complexity", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99309", description: "Nursing facility subsequent care, moderate complexity", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99310", description: "Nursing facility subsequent care, high complexity", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99315", description: "Nursing facility discharge, 30 minutes or less", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99316", description: "Nursing facility discharge, more than 30 minutes", category: "E/M", subcategory: "Nursing Facility" },
  { code: "99318", description: "Nursing facility annual assessment", category: "E/M", subcategory: "Nursing Facility" },

  // Care Management
  { code: "99490", description: "Chronic care management, first 20 minutes", category: "E/M", subcategory: "Care Management", medicareNotes: "Requires 2+ chronic conditions expected to last 12+ months" },
  { code: "99491", description: "Chronic care management by physician, first 30 minutes", category: "E/M", subcategory: "Care Management" },
  { code: "99495", description: "Transitional care management, moderate complexity", category: "E/M", subcategory: "Care Management", medicareNotes: "Face-to-face within 14 days of discharge" },
  { code: "99496", description: "Transitional care management, high complexity", category: "E/M", subcategory: "Care Management", medicareNotes: "Face-to-face within 7 days of discharge" },

  // Annual Wellness Visits
  { code: "G0438", description: "Annual wellness visit, initial", category: "E/M", subcategory: "Preventive", medicareNotes: "Once per lifetime, after 12 months of Part B" },
  { code: "G0439", description: "Annual wellness visit, subsequent", category: "E/M", subcategory: "Preventive", medicareNotes: "Once every 12 months after initial AWV" },
];

// =============================================================================
// CARDIOLOGY CODES
// =============================================================================

export const CARDIOLOGY_CPT: CPTCode[] = [
  // ECG/EKG
  { code: "93000", description: "Electrocardiogram (ECG) complete", category: "Cardiology", subcategory: "ECG", commonDiagnoses: ["I10", "I25.10", "I48.91", "R00.0"] },
  { code: "93005", description: "ECG tracing only", category: "Cardiology", subcategory: "ECG" },
  { code: "93010", description: "ECG interpretation and report only", category: "Cardiology", subcategory: "ECG" },

  // Echocardiography
  { code: "93303", description: "Transthoracic echo, congenital", category: "Cardiology", subcategory: "Echo" },
  { code: "93306", description: "Transthoracic echo with Doppler, complete", category: "Cardiology", subcategory: "Echo", commonDiagnoses: ["I50.9", "I25.10", "I42.9"] },
  { code: "93307", description: "Transthoracic echo, 2D, without Doppler", category: "Cardiology", subcategory: "Echo" },
  { code: "93308", description: "Transthoracic echo, follow-up or limited", category: "Cardiology", subcategory: "Echo" },
  { code: "93312", description: "Transesophageal echo (TEE)", category: "Cardiology", subcategory: "Echo" },
  { code: "93320", description: "Doppler echo, complete", category: "Cardiology", subcategory: "Echo" },
  { code: "93325", description: "Doppler echo, color flow velocity mapping", category: "Cardiology", subcategory: "Echo" },
  { code: "93350", description: "Stress echocardiography", category: "Cardiology", subcategory: "Echo", commonDiagnoses: ["I25.10", "R07.9", "I20.9"] },
  { code: "93351", description: "Stress echo with ECG monitoring", category: "Cardiology", subcategory: "Echo" },
  { code: "93352", description: "Contrast agent for stress echo", category: "Cardiology", subcategory: "Echo" },

  // Cardiac Catheterization
  { code: "93454", description: "Coronary angiography without left heart cath", category: "Cardiology", subcategory: "Cath Lab" },
  { code: "93456", description: "Coronary angiography with right heart cath", category: "Cardiology", subcategory: "Cath Lab" },
  { code: "93458", description: "Left heart cath with coronary angiography", category: "Cardiology", subcategory: "Cath Lab", commonDiagnoses: ["I25.10", "I21.9", "I20.0"] },
  { code: "93459", description: "Left heart cath with coronary and graft angiography", category: "Cardiology", subcategory: "Cath Lab" },
  { code: "93460", description: "Right and left heart cath with coronary angiography", category: "Cardiology", subcategory: "Cath Lab" },
  { code: "93461", description: "Right and left heart cath with coronary and graft angiography", category: "Cardiology", subcategory: "Cath Lab" },

  // Stress Tests
  { code: "93015", description: "Cardiovascular stress test, complete", category: "Cardiology", subcategory: "Stress Test", commonDiagnoses: ["I25.10", "R07.9", "R00.0"] },
  { code: "93016", description: "Cardiovascular stress test, supervision only", category: "Cardiology", subcategory: "Stress Test" },
  { code: "93017", description: "Cardiovascular stress test, tracing only", category: "Cardiology", subcategory: "Stress Test" },
  { code: "93018", description: "Cardiovascular stress test, interpretation only", category: "Cardiology", subcategory: "Stress Test" },

  // Holter Monitoring
  { code: "93224", description: "Holter monitor, recording, scanning, report", category: "Cardiology", subcategory: "Holter", commonDiagnoses: ["R00.0", "R00.1", "I48.91", "I49.9"] },
  { code: "93225", description: "Holter monitor, recording only", category: "Cardiology", subcategory: "Holter" },
  { code: "93226", description: "Holter monitor, scanning with report", category: "Cardiology", subcategory: "Holter" },
  { code: "93227", description: "Holter monitor, review and interpretation", category: "Cardiology", subcategory: "Holter" },

  // Pacemaker/ICD
  { code: "93279", description: "Pacemaker interrogation, single lead", category: "Cardiology", subcategory: "Device Check" },
  { code: "93280", description: "Pacemaker interrogation, dual lead", category: "Cardiology", subcategory: "Device Check" },
  { code: "93281", description: "Pacemaker interrogation, multiple leads", category: "Cardiology", subcategory: "Device Check" },
  { code: "93282", description: "ICD interrogation, single lead", category: "Cardiology", subcategory: "Device Check" },
  { code: "93283", description: "ICD interrogation, dual lead", category: "Cardiology", subcategory: "Device Check" },
  { code: "93284", description: "ICD interrogation, multiple leads", category: "Cardiology", subcategory: "Device Check" },
  { code: "93288", description: "Pacemaker interrogation in person", category: "Cardiology", subcategory: "Device Check" },
  { code: "93289", description: "ICD interrogation in person", category: "Cardiology", subcategory: "Device Check" },
  { code: "93290", description: "Loop recorder interrogation", category: "Cardiology", subcategory: "Device Check" },
  { code: "93291", description: "Loop recorder interrogation, remote", category: "Cardiology", subcategory: "Device Check" },
  { code: "93294", description: "Pacemaker remote monitoring, report", category: "Cardiology", subcategory: "Device Check" },
  { code: "93295", description: "ICD remote monitoring, report", category: "Cardiology", subcategory: "Device Check" },
  { code: "93296", description: "Remote monitoring technical support", category: "Cardiology", subcategory: "Device Check" },
  { code: "93297", description: "Loop recorder remote monitoring", category: "Cardiology", subcategory: "Device Check" },
  { code: "93298", description: "Loop recorder remote monitoring, physician review", category: "Cardiology", subcategory: "Device Check" },
  { code: "93299", description: "Implantable cardiovascular monitor remote", category: "Cardiology", subcategory: "Device Check" },

  // Pacemaker Surgery
  { code: "33206", description: "Insertion of pacemaker, atrial", category: "Cardiology", subcategory: "Pacemaker Surgery" },
  { code: "33207", description: "Insertion of pacemaker, ventricular", category: "Cardiology", subcategory: "Pacemaker Surgery" },
  { code: "33208", description: "Insertion of pacemaker, dual chamber", category: "Cardiology", subcategory: "Pacemaker Surgery", commonDiagnoses: ["I44.2", "I49.5", "I45.9"] },
  { code: "33212", description: "Pacemaker pulse generator insertion only", category: "Cardiology", subcategory: "Pacemaker Surgery" },
  { code: "33213", description: "Pacemaker dual chamber pulse generator insertion", category: "Cardiology", subcategory: "Pacemaker Surgery" },
  { code: "33214", description: "Upgrade single to dual chamber pacemaker", category: "Cardiology", subcategory: "Pacemaker Surgery" },
  { code: "33227", description: "Pacemaker generator replacement, single lead", category: "Cardiology", subcategory: "Pacemaker Surgery" },
  { code: "33228", description: "Pacemaker generator replacement, dual lead", category: "Cardiology", subcategory: "Pacemaker Surgery" },
  { code: "33229", description: "Pacemaker generator replacement, multiple leads", category: "Cardiology", subcategory: "Pacemaker Surgery" },
  { code: "33230", description: "ICD pulse generator insertion, dual lead", category: "Cardiology", subcategory: "ICD Surgery" },
  { code: "33231", description: "ICD pulse generator insertion, multiple leads", category: "Cardiology", subcategory: "ICD Surgery" },
  { code: "33240", description: "ICD insertion, single lead", category: "Cardiology", subcategory: "ICD Surgery" },
  { code: "33249", description: "ICD insertion with defibrillation testing", category: "Cardiology", subcategory: "ICD Surgery" },
];

export const CARDIOLOGY_ICD10: ICD10Code[] = [
  // Hypertension
  { code: "I10", description: "Essential (primary) hypertension", category: "Cardiology", subcategory: "Hypertension", commonProcedures: ["93000", "99213", "99214"] },
  { code: "I11.0", description: "Hypertensive heart disease with heart failure", category: "Cardiology", subcategory: "Hypertension" },
  { code: "I11.9", description: "Hypertensive heart disease without heart failure", category: "Cardiology", subcategory: "Hypertension" },
  { code: "I12.0", description: "Hypertensive CKD with stage 5 or ESRD", category: "Cardiology", subcategory: "Hypertension" },
  { code: "I12.9", description: "Hypertensive CKD with stage 1-4 or unspecified", category: "Cardiology", subcategory: "Hypertension" },
  { code: "I13.0", description: "Hypertensive heart and CKD with heart failure", category: "Cardiology", subcategory: "Hypertension" },
  { code: "I13.10", description: "Hypertensive heart and CKD without heart failure, stage 1-4", category: "Cardiology", subcategory: "Hypertension" },

  // Coronary Artery Disease
  { code: "I25.10", description: "Atherosclerotic heart disease of native coronary artery", category: "Cardiology", subcategory: "CAD", commonProcedures: ["93458", "93015", "93306"] },
  { code: "I25.110", description: "Atherosclerotic heart disease with unstable angina", category: "Cardiology", subcategory: "CAD" },
  { code: "I25.111", description: "Atherosclerotic heart disease with angina with spasm", category: "Cardiology", subcategory: "CAD" },
  { code: "I25.118", description: "Atherosclerotic heart disease with other angina", category: "Cardiology", subcategory: "CAD" },
  { code: "I25.119", description: "Atherosclerotic heart disease with unspecified angina", category: "Cardiology", subcategory: "CAD" },
  { code: "I25.5", description: "Ischemic cardiomyopathy", category: "Cardiology", subcategory: "CAD" },
  { code: "I25.700", description: "Atherosclerosis of bypass graft, unspecified", category: "Cardiology", subcategory: "CAD" },
  { code: "I25.810", description: "Atherosclerosis of bypass graft with angina", category: "Cardiology", subcategory: "CAD" },

  // Atrial Fibrillation/Flutter
  { code: "I48.0", description: "Paroxysmal atrial fibrillation", category: "Cardiology", subcategory: "Arrhythmia", commonProcedures: ["93000", "93224", "93306"] },
  { code: "I48.1", description: "Persistent atrial fibrillation", category: "Cardiology", subcategory: "Arrhythmia" },
  { code: "I48.2", description: "Chronic atrial fibrillation", category: "Cardiology", subcategory: "Arrhythmia" },
  { code: "I48.20", description: "Chronic atrial fibrillation, unspecified", category: "Cardiology", subcategory: "Arrhythmia" },
  { code: "I48.21", description: "Permanent atrial fibrillation", category: "Cardiology", subcategory: "Arrhythmia" },
  { code: "I48.3", description: "Typical atrial flutter", category: "Cardiology", subcategory: "Arrhythmia" },
  { code: "I48.4", description: "Atypical atrial flutter", category: "Cardiology", subcategory: "Arrhythmia" },
  { code: "I48.91", description: "Unspecified atrial fibrillation", category: "Cardiology", subcategory: "Arrhythmia" },
  { code: "I48.92", description: "Unspecified atrial flutter", category: "Cardiology", subcategory: "Arrhythmia" },

  // Heart Failure
  { code: "I50.1", description: "Left ventricular failure, unspecified", category: "Cardiology", subcategory: "Heart Failure", commonProcedures: ["93306", "93000", "71046"] },
  { code: "I50.20", description: "Unspecified systolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.21", description: "Acute systolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.22", description: "Chronic systolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.23", description: "Acute on chronic systolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.30", description: "Unspecified diastolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.31", description: "Acute diastolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.32", description: "Chronic diastolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.33", description: "Acute on chronic diastolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.40", description: "Unspecified combined systolic and diastolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.41", description: "Acute combined systolic and diastolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.42", description: "Chronic combined systolic and diastolic heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.43", description: "Acute on chronic combined heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.810", description: "Right heart failure, unspecified", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.811", description: "Acute right heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.812", description: "Chronic right heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.813", description: "Acute on chronic right heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.814", description: "Right heart failure due to left heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.82", description: "Biventricular heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.83", description: "High output heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.84", description: "End stage heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.89", description: "Other heart failure", category: "Cardiology", subcategory: "Heart Failure" },
  { code: "I50.9", description: "Heart failure, unspecified", category: "Cardiology", subcategory: "Heart Failure" },

  // Myocardial Infarction
  { code: "I21.01", description: "STEMI involving left main coronary artery", category: "Cardiology", subcategory: "MI" },
  { code: "I21.02", description: "STEMI involving left anterior descending artery", category: "Cardiology", subcategory: "MI" },
  { code: "I21.09", description: "STEMI involving other coronary artery of anterior wall", category: "Cardiology", subcategory: "MI" },
  { code: "I21.11", description: "STEMI involving right coronary artery", category: "Cardiology", subcategory: "MI" },
  { code: "I21.19", description: "STEMI involving other coronary artery of inferior wall", category: "Cardiology", subcategory: "MI" },
  { code: "I21.21", description: "STEMI involving left circumflex artery", category: "Cardiology", subcategory: "MI" },
  { code: "I21.29", description: "STEMI involving other sites", category: "Cardiology", subcategory: "MI" },
  { code: "I21.3", description: "STEMI of unspecified site", category: "Cardiology", subcategory: "MI" },
  { code: "I21.4", description: "Non-ST elevation myocardial infarction (NSTEMI)", category: "Cardiology", subcategory: "MI" },
  { code: "I21.9", description: "Acute myocardial infarction, unspecified", category: "Cardiology", subcategory: "MI" },
  { code: "I21.A1", description: "Myocardial infarction type 2", category: "Cardiology", subcategory: "MI" },
  { code: "I21.A9", description: "Other myocardial infarction type", category: "Cardiology", subcategory: "MI" },

  // Stroke
  { code: "I63.00", description: "Cerebral infarction due to thrombosis of unspecified precerebral artery", category: "Cardiology", subcategory: "Stroke" },
  { code: "I63.10", description: "Cerebral infarction due to embolism of unspecified precerebral artery", category: "Cardiology", subcategory: "Stroke" },
  { code: "I63.30", description: "Cerebral infarction due to thrombosis of unspecified cerebral artery", category: "Cardiology", subcategory: "Stroke" },
  { code: "I63.40", description: "Cerebral infarction due to embolism of unspecified cerebral artery", category: "Cardiology", subcategory: "Stroke" },
  { code: "I63.50", description: "Cerebral infarction due to unspecified occlusion of unspecified cerebral artery", category: "Cardiology", subcategory: "Stroke" },
  { code: "I63.9", description: "Cerebral infarction, unspecified", category: "Cardiology", subcategory: "Stroke" },

  // Atherosclerosis
  { code: "I70.0", description: "Atherosclerosis of aorta", category: "Cardiology", subcategory: "Atherosclerosis" },
  { code: "I70.1", description: "Atherosclerosis of renal artery", category: "Cardiology", subcategory: "Atherosclerosis" },
  { code: "I70.201", description: "Atherosclerosis of native arteries of extremities, unspecified, right leg", category: "Cardiology", subcategory: "Atherosclerosis" },
  { code: "I70.202", description: "Atherosclerosis of native arteries of extremities, unspecified, left leg", category: "Cardiology", subcategory: "Atherosclerosis" },
  { code: "I70.203", description: "Atherosclerosis of native arteries of extremities, unspecified, bilateral legs", category: "Cardiology", subcategory: "Atherosclerosis" },
  { code: "I70.90", description: "Unspecified atherosclerosis", category: "Cardiology", subcategory: "Atherosclerosis" },
  { code: "I70.91", description: "Generalized atherosclerosis", category: "Cardiology", subcategory: "Atherosclerosis" },
  { code: "I70.92", description: "Chronic total occlusion of artery of the extremities", category: "Cardiology", subcategory: "Atherosclerosis" },
];

// =============================================================================
// DIABETES CODES
// =============================================================================

export const DIABETES_CPT: CPTCode[] = [
  // Lab Tests
  { code: "83036", description: "Hemoglobin A1C", category: "Diabetes", subcategory: "Lab", commonDiagnoses: ["E11.9", "E11.65"] },
  { code: "82947", description: "Glucose, quantitative, blood", category: "Diabetes", subcategory: "Lab" },
  { code: "82950", description: "Glucose, post glucose dose", category: "Diabetes", subcategory: "Lab" },
  { code: "82951", description: "Glucose tolerance test, 3 specimens", category: "Diabetes", subcategory: "Lab" },
  { code: "82952", description: "Glucose tolerance test, each additional specimen", category: "Diabetes", subcategory: "Lab" },
  { code: "36415", description: "Venipuncture for blood draw", category: "Diabetes", subcategory: "Lab" },

  // Self-Management Training
  { code: "G0108", description: "Diabetes self-management training, individual", category: "Diabetes", subcategory: "Education", medicareNotes: "10 hours lifetime benefit, must be ordered by treating physician" },
  { code: "G0109", description: "Diabetes self-management training, group", category: "Diabetes", subcategory: "Education", medicareNotes: "2-20 patients, must be DSMES accredited program" },

  // Eye Exams for Diabetic Retinopathy
  { code: "92002", description: "Ophthalmological exam, intermediate, new patient", category: "Diabetes", subcategory: "Eye Exam" },
  { code: "92004", description: "Ophthalmological exam, comprehensive, new patient", category: "Diabetes", subcategory: "Eye Exam" },
  { code: "92012", description: "Ophthalmological exam, intermediate, established patient", category: "Diabetes", subcategory: "Eye Exam" },
  { code: "92014", description: "Ophthalmological exam, comprehensive, established patient", category: "Diabetes", subcategory: "Eye Exam", commonDiagnoses: ["E11.319", "E11.329", "E11.339"] },
  { code: "92134", description: "OCT scan, retina", category: "Diabetes", subcategory: "Eye Exam" },
  { code: "92250", description: "Fundus photography", category: "Diabetes", subcategory: "Eye Exam" },

  // Foot Care
  { code: "11055", description: "Paring of benign hyperkeratotic lesion, 1", category: "Diabetes", subcategory: "Foot Care" },
  { code: "11056", description: "Paring of benign hyperkeratotic lesion, 2-4", category: "Diabetes", subcategory: "Foot Care" },
  { code: "11057", description: "Paring of benign hyperkeratotic lesion, more than 4", category: "Diabetes", subcategory: "Foot Care" },
  { code: "11719", description: "Trimming of nondystrophic nails", category: "Diabetes", subcategory: "Foot Care" },
  { code: "11720", description: "Debridement of nails, 1-5", category: "Diabetes", subcategory: "Foot Care", commonDiagnoses: ["E11.621", "L60.0"] },
  { code: "11721", description: "Debridement of nails, 6 or more", category: "Diabetes", subcategory: "Foot Care" },
  { code: "G0245", description: "Initial foot exam for diabetic patient", category: "Diabetes", subcategory: "Foot Care", medicareNotes: "For patients at risk" },
  { code: "G0246", description: "Follow-up foot care for diabetic patient", category: "Diabetes", subcategory: "Foot Care" },
  { code: "G0247", description: "Foot care for diabetic with peripheral neuropathy and LOPS", category: "Diabetes", subcategory: "Foot Care" },
];

export const DIABETES_ICD10: ICD10Code[] = [
  // Type 2 Diabetes - Base codes
  { code: "E11.9", description: "Type 2 diabetes mellitus without complications", category: "Diabetes", subcategory: "Type 2", commonProcedures: ["83036", "99213", "99214"] },
  { code: "E11.65", description: "Type 2 diabetes with hyperglycemia", category: "Diabetes", subcategory: "Type 2" },
  { code: "E11.69", description: "Type 2 diabetes with other specified complication", category: "Diabetes", subcategory: "Type 2" },
  { code: "E11.8", description: "Type 2 diabetes with unspecified complications", category: "Diabetes", subcategory: "Type 2" },

  // Type 2 Diabetes with Kidney Complications
  { code: "E11.21", description: "Type 2 diabetes with diabetic nephropathy", category: "Diabetes", subcategory: "Kidney" },
  { code: "E11.22", description: "Type 2 diabetes with diabetic CKD", category: "Diabetes", subcategory: "Kidney" },
  { code: "E11.29", description: "Type 2 diabetes with other diabetic kidney complication", category: "Diabetes", subcategory: "Kidney" },

  // Type 2 Diabetes with Retinopathy
  { code: "E11.311", description: "Type 2 diabetes with unspecified diabetic retinopathy with macular edema", category: "Diabetes", subcategory: "Retinopathy", commonProcedures: ["92014", "92134", "67028"] },
  { code: "E11.319", description: "Type 2 diabetes with unspecified diabetic retinopathy without macular edema", category: "Diabetes", subcategory: "Retinopathy" },
  { code: "E11.321", description: "Type 2 diabetes with mild nonproliferative diabetic retinopathy with macular edema", category: "Diabetes", subcategory: "Retinopathy" },
  { code: "E11.329", description: "Type 2 diabetes with mild nonproliferative diabetic retinopathy without macular edema", category: "Diabetes", subcategory: "Retinopathy" },
  { code: "E11.331", description: "Type 2 diabetes with moderate nonproliferative diabetic retinopathy with macular edema", category: "Diabetes", subcategory: "Retinopathy" },
  { code: "E11.339", description: "Type 2 diabetes with moderate nonproliferative diabetic retinopathy without macular edema", category: "Diabetes", subcategory: "Retinopathy" },
  { code: "E11.341", description: "Type 2 diabetes with severe nonproliferative diabetic retinopathy with macular edema", category: "Diabetes", subcategory: "Retinopathy" },
  { code: "E11.349", description: "Type 2 diabetes with severe nonproliferative diabetic retinopathy without macular edema", category: "Diabetes", subcategory: "Retinopathy" },
  { code: "E11.351", description: "Type 2 diabetes with proliferative diabetic retinopathy with macular edema", category: "Diabetes", subcategory: "Retinopathy" },
  { code: "E11.359", description: "Type 2 diabetes with proliferative diabetic retinopathy without macular edema", category: "Diabetes", subcategory: "Retinopathy" },

  // Type 2 Diabetes with Neurological Complications
  { code: "E11.40", description: "Type 2 diabetes with diabetic neuropathy, unspecified", category: "Diabetes", subcategory: "Neuropathy", commonProcedures: ["95860", "G0247"] },
  { code: "E11.41", description: "Type 2 diabetes with diabetic mononeuropathy", category: "Diabetes", subcategory: "Neuropathy" },
  { code: "E11.42", description: "Type 2 diabetes with diabetic polyneuropathy", category: "Diabetes", subcategory: "Neuropathy" },
  { code: "E11.43", description: "Type 2 diabetes with diabetic autonomic neuropathy", category: "Diabetes", subcategory: "Neuropathy" },
  { code: "E11.44", description: "Type 2 diabetes with diabetic amyotrophy", category: "Diabetes", subcategory: "Neuropathy" },
  { code: "E11.49", description: "Type 2 diabetes with other diabetic neurological complication", category: "Diabetes", subcategory: "Neuropathy" },

  // Type 2 Diabetes with Circulatory Complications
  { code: "E11.51", description: "Type 2 diabetes with diabetic peripheral angiopathy without gangrene", category: "Diabetes", subcategory: "Circulatory" },
  { code: "E11.52", description: "Type 2 diabetes with diabetic peripheral angiopathy with gangrene", category: "Diabetes", subcategory: "Circulatory" },
  { code: "E11.59", description: "Type 2 diabetes with other circulatory complications", category: "Diabetes", subcategory: "Circulatory" },

  // Type 2 Diabetes with Skin Complications
  { code: "E11.610", description: "Type 2 diabetes with diabetic neuropathic arthropathy", category: "Diabetes", subcategory: "Skin" },
  { code: "E11.618", description: "Type 2 diabetes with other diabetic arthropathy", category: "Diabetes", subcategory: "Skin" },
  { code: "E11.620", description: "Type 2 diabetes with diabetic dermatitis", category: "Diabetes", subcategory: "Skin" },
  { code: "E11.621", description: "Type 2 diabetes with foot ulcer", category: "Diabetes", subcategory: "Skin", commonProcedures: ["11720", "97597", "G0247"] },
  { code: "E11.622", description: "Type 2 diabetes with other skin ulcer", category: "Diabetes", subcategory: "Skin" },
  { code: "E11.628", description: "Type 2 diabetes with other skin complications", category: "Diabetes", subcategory: "Skin" },
];

// =============================================================================
// ORTHOPEDICS/MUSCULOSKELETAL CODES
// =============================================================================

export const ORTHOPEDIC_CPT: CPTCode[] = [
  // Joint Replacements
  { code: "27447", description: "Total knee arthroplasty", category: "Orthopedics", subcategory: "Joint Replacement", commonDiagnoses: ["M17.11", "M17.12", "M17.0"] },
  { code: "27446", description: "Unicompartmental knee arthroplasty", category: "Orthopedics", subcategory: "Joint Replacement" },
  { code: "27130", description: "Total hip arthroplasty", category: "Orthopedics", subcategory: "Joint Replacement", commonDiagnoses: ["M16.11", "M16.12", "M16.0"] },
  { code: "27132", description: "Hip arthroplasty with acetabular and femoral components", category: "Orthopedics", subcategory: "Joint Replacement" },
  { code: "27134", description: "Hip revision arthroplasty, femoral component only", category: "Orthopedics", subcategory: "Joint Replacement" },
  { code: "27137", description: "Hip revision arthroplasty, acetabular component only", category: "Orthopedics", subcategory: "Joint Replacement" },
  { code: "27138", description: "Hip revision arthroplasty, both components", category: "Orthopedics", subcategory: "Joint Replacement" },
  { code: "23472", description: "Total shoulder arthroplasty", category: "Orthopedics", subcategory: "Joint Replacement" },

  // Joint Injections
  { code: "20610", description: "Arthrocentesis/injection, major joint", category: "Orthopedics", subcategory: "Injection", commonDiagnoses: ["M17.11", "M25.561", "M25.562"] },
  { code: "20611", description: "Arthrocentesis/injection, major joint with ultrasound", category: "Orthopedics", subcategory: "Injection" },
  { code: "20600", description: "Arthrocentesis/injection, small joint", category: "Orthopedics", subcategory: "Injection" },
  { code: "20604", description: "Arthrocentesis/injection, small joint with ultrasound", category: "Orthopedics", subcategory: "Injection" },
  { code: "20605", description: "Arthrocentesis/injection, intermediate joint", category: "Orthopedics", subcategory: "Injection" },
  { code: "20606", description: "Arthrocentesis/injection, intermediate joint with ultrasound", category: "Orthopedics", subcategory: "Injection" },

  // Physical Therapy
  { code: "97110", description: "Therapeutic exercises, 15 minutes", category: "Orthopedics", subcategory: "Physical Therapy", commonDiagnoses: ["M54.5", "M17.11", "S72.001A"] },
  { code: "97112", description: "Neuromuscular reeducation, 15 minutes", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97113", description: "Aquatic therapy, 15 minutes", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97116", description: "Gait training, 15 minutes", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97140", description: "Manual therapy techniques, 15 minutes", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97161", description: "PT evaluation, low complexity", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97162", description: "PT evaluation, moderate complexity", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97163", description: "PT evaluation, high complexity", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97164", description: "PT re-evaluation", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97530", description: "Therapeutic activities, 15 minutes", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97535", description: "Self-care/home management training, 15 minutes", category: "Orthopedics", subcategory: "Physical Therapy" },
  { code: "97542", description: "Wheelchair management training, 15 minutes", category: "Orthopedics", subcategory: "Physical Therapy" },

  // MRI Imaging
  { code: "72148", description: "MRI lumbar spine without contrast", category: "Orthopedics", subcategory: "Imaging", commonDiagnoses: ["M54.5", "M54.41", "M54.42"] },
  { code: "72149", description: "MRI lumbar spine with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "72156", description: "MRI lumbar spine without and with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "72157", description: "MRI lumbar spine without and with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "72158", description: "MRI lumbar spine without and with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "72141", description: "MRI cervical spine without contrast", category: "Orthopedics", subcategory: "Imaging", commonDiagnoses: ["M54.2", "M50.20"] },
  { code: "72142", description: "MRI cervical spine with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "72146", description: "MRI thoracic spine without contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "72147", description: "MRI thoracic spine with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "73721", description: "MRI lower extremity joint without contrast", category: "Orthopedics", subcategory: "Imaging", commonDiagnoses: ["M17.11", "M25.561", "S83.511A"] },
  { code: "73722", description: "MRI lower extremity joint with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "73723", description: "MRI lower extremity joint without and with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "73221", description: "MRI upper extremity joint without contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "73222", description: "MRI upper extremity joint with contrast", category: "Orthopedics", subcategory: "Imaging" },
  { code: "73223", description: "MRI upper extremity joint without and with contrast", category: "Orthopedics", subcategory: "Imaging" },

  // Bone Density
  { code: "77080", description: "DEXA bone density, axial skeleton", category: "Orthopedics", subcategory: "Bone Density", commonDiagnoses: ["M81.0", "Z87.310"], medicareNotes: "Covered every 24 months for qualifying beneficiaries" },
  { code: "77081", description: "DEXA bone density, appendicular skeleton", category: "Orthopedics", subcategory: "Bone Density" },
  { code: "77085", description: "DEXA bone density, axial with vertebral fracture assessment", category: "Orthopedics", subcategory: "Bone Density" },
  { code: "77086", description: "Vertebral fracture assessment", category: "Orthopedics", subcategory: "Bone Density" },
];

export const ORTHOPEDIC_ICD10: ICD10Code[] = [
  // Knee Osteoarthritis
  { code: "M17.0", description: "Bilateral primary osteoarthritis of knee", category: "Orthopedics", subcategory: "Knee", commonProcedures: ["27447", "20610", "73721"] },
  { code: "M17.10", description: "Unilateral primary osteoarthritis, unspecified knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.11", description: "Unilateral primary osteoarthritis, right knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.12", description: "Unilateral primary osteoarthritis, left knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.2", description: "Bilateral post-traumatic osteoarthritis of knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.30", description: "Unilateral post-traumatic osteoarthritis, unspecified knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.31", description: "Unilateral post-traumatic osteoarthritis, right knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.32", description: "Unilateral post-traumatic osteoarthritis, left knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.4", description: "Other bilateral secondary osteoarthritis of knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.5", description: "Other unilateral secondary osteoarthritis of knee", category: "Orthopedics", subcategory: "Knee" },
  { code: "M17.9", description: "Osteoarthritis of knee, unspecified", category: "Orthopedics", subcategory: "Knee" },

  // Hip Osteoarthritis
  { code: "M16.0", description: "Bilateral primary osteoarthritis of hip", category: "Orthopedics", subcategory: "Hip", commonProcedures: ["27130", "20610", "73721"] },
  { code: "M16.10", description: "Unilateral primary osteoarthritis, unspecified hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.11", description: "Unilateral primary osteoarthritis, right hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.12", description: "Unilateral primary osteoarthritis, left hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.2", description: "Bilateral osteoarthritis resulting from hip dysplasia", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.30", description: "Unilateral osteoarthritis from hip dysplasia, unspecified hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.31", description: "Unilateral osteoarthritis from hip dysplasia, right hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.32", description: "Unilateral osteoarthritis from hip dysplasia, left hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.4", description: "Bilateral post-traumatic osteoarthritis of hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.50", description: "Unilateral post-traumatic osteoarthritis, unspecified hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.51", description: "Unilateral post-traumatic osteoarthritis, right hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.52", description: "Unilateral post-traumatic osteoarthritis, left hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.6", description: "Other bilateral secondary osteoarthritis of hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.7", description: "Other unilateral secondary osteoarthritis of hip", category: "Orthopedics", subcategory: "Hip" },
  { code: "M16.9", description: "Osteoarthritis of hip, unspecified", category: "Orthopedics", subcategory: "Hip" },

  // Back Pain
  { code: "M54.5", description: "Low back pain", category: "Orthopedics", subcategory: "Spine", commonProcedures: ["72148", "97110", "20552"] },
  { code: "M54.50", description: "Low back pain, unspecified", category: "Orthopedics", subcategory: "Spine" },
  { code: "M54.51", description: "Vertebrogenic low back pain", category: "Orthopedics", subcategory: "Spine" },
  { code: "M54.59", description: "Other low back pain", category: "Orthopedics", subcategory: "Spine" },
  { code: "M54.2", description: "Cervicalgia", category: "Orthopedics", subcategory: "Spine", commonProcedures: ["72141", "97110"] },
  { code: "M54.40", description: "Lumbago with sciatica, unspecified side", category: "Orthopedics", subcategory: "Spine" },
  { code: "M54.41", description: "Lumbago with sciatica, right side", category: "Orthopedics", subcategory: "Spine" },
  { code: "M54.42", description: "Lumbago with sciatica, left side", category: "Orthopedics", subcategory: "Spine" },
  { code: "M54.6", description: "Pain in thoracic spine", category: "Orthopedics", subcategory: "Spine" },

  // Osteoporosis
  { code: "M81.0", description: "Age-related osteoporosis without current pathological fracture", category: "Orthopedics", subcategory: "Osteoporosis", commonProcedures: ["77080"] },
  { code: "M80.00XA", description: "Age-related osteoporosis with pathological fracture, unspecified site, initial", category: "Orthopedics", subcategory: "Osteoporosis" },
  { code: "M80.08XA", description: "Age-related osteoporosis with pathological fracture, vertebrae, initial", category: "Orthopedics", subcategory: "Osteoporosis" },

  // Hip Fractures
  { code: "S72.001A", description: "Fracture of unspecified part of neck of right femur, initial", category: "Orthopedics", subcategory: "Fracture", commonProcedures: ["27130", "27236"] },
  { code: "S72.002A", description: "Fracture of unspecified part of neck of left femur, initial", category: "Orthopedics", subcategory: "Fracture" },
  { code: "S72.009A", description: "Fracture of unspecified part of neck of unspecified femur, initial", category: "Orthopedics", subcategory: "Fracture" },
  { code: "S72.011A", description: "Unspecified intracapsular fracture of right femur, initial", category: "Orthopedics", subcategory: "Fracture" },
  { code: "S72.012A", description: "Unspecified intracapsular fracture of left femur, initial", category: "Orthopedics", subcategory: "Fracture" },
  { code: "S72.019A", description: "Unspecified intracapsular fracture of unspecified femur, initial", category: "Orthopedics", subcategory: "Fracture" },

  // Knee Pain
  { code: "M25.561", description: "Pain in right knee", category: "Orthopedics", subcategory: "Knee Pain", commonProcedures: ["73721", "20610"] },
  { code: "M25.562", description: "Pain in left knee", category: "Orthopedics", subcategory: "Knee Pain" },
  { code: "M25.569", description: "Pain in unspecified knee", category: "Orthopedics", subcategory: "Knee Pain" },

  // Other
  { code: "M79.3", description: "Panniculitis, unspecified", category: "Orthopedics", subcategory: "Other" },
  { code: "M62.81", description: "Muscle weakness (generalized)", category: "Orthopedics", subcategory: "Other" },
];

// =============================================================================
// PULMONARY/RESPIRATORY CODES
// =============================================================================

export const PULMONARY_CPT: CPTCode[] = [
  // Spirometry/PFT
  { code: "94010", description: "Spirometry, including graphic record", category: "Pulmonary", subcategory: "PFT", commonDiagnoses: ["J44.9", "J45.909"] },
  { code: "94060", description: "Bronchodilation responsiveness, spirometry", category: "Pulmonary", subcategory: "PFT" },
  { code: "94726", description: "Pulmonary function test, plethysmography", category: "Pulmonary", subcategory: "PFT" },
  { code: "94727", description: "Pulmonary function test, gas distribution", category: "Pulmonary", subcategory: "PFT" },
  { code: "94728", description: "Pulmonary function test, airway resistance", category: "Pulmonary", subcategory: "PFT" },
  { code: "94729", description: "Pulmonary function test, diffusing capacity", category: "Pulmonary", subcategory: "PFT" },

  // Chest Imaging
  { code: "71046", description: "Chest X-ray, 2 views", category: "Pulmonary", subcategory: "Imaging", commonDiagnoses: ["J18.9", "J44.9", "R05.9"] },
  { code: "71047", description: "Chest X-ray, 3 views", category: "Pulmonary", subcategory: "Imaging" },
  { code: "71048", description: "Chest X-ray, 4 or more views", category: "Pulmonary", subcategory: "Imaging" },
  { code: "71250", description: "CT chest without contrast", category: "Pulmonary", subcategory: "Imaging" },
  { code: "71260", description: "CT chest with contrast", category: "Pulmonary", subcategory: "Imaging" },
  { code: "71270", description: "CT chest without and with contrast", category: "Pulmonary", subcategory: "Imaging" },
  { code: "71271", description: "Low dose CT for lung cancer screening", category: "Pulmonary", subcategory: "Imaging", medicareNotes: "Annual screening for high-risk individuals ages 50-77" },
  { code: "71275", description: "CT angiography, chest", category: "Pulmonary", subcategory: "Imaging" },

  // Treatments
  { code: "94640", description: "Pressurized or non-pressurized inhalation treatment", category: "Pulmonary", subcategory: "Treatment" },
  { code: "94644", description: "Continuous inhalation treatment, first hour", category: "Pulmonary", subcategory: "Treatment" },
  { code: "94645", description: "Continuous inhalation treatment, each additional hour", category: "Pulmonary", subcategory: "Treatment" },
  { code: "94002", description: "Ventilation assist and management, initial day", category: "Pulmonary", subcategory: "Treatment" },
  { code: "94003", description: "Ventilation assist and management, subsequent days", category: "Pulmonary", subcategory: "Treatment" },
  { code: "94004", description: "Ventilation assist in nursing facility", category: "Pulmonary", subcategory: "Treatment" },
  { code: "94005", description: "Home ventilator management", category: "Pulmonary", subcategory: "Treatment" },

  // Bronchoscopy
  { code: "31622", description: "Bronchoscopy, diagnostic", category: "Pulmonary", subcategory: "Bronchoscopy" },
  { code: "31623", description: "Bronchoscopy with brushing", category: "Pulmonary", subcategory: "Bronchoscopy" },
  { code: "31624", description: "Bronchoscopy with bronchial alveolar lavage", category: "Pulmonary", subcategory: "Bronchoscopy" },
  { code: "31625", description: "Bronchoscopy with biopsy", category: "Pulmonary", subcategory: "Bronchoscopy" },
  { code: "31626", description: "Bronchoscopy with transbronchial needle aspiration", category: "Pulmonary", subcategory: "Bronchoscopy" },
  { code: "31628", description: "Bronchoscopy with transbronchial lung biopsy", category: "Pulmonary", subcategory: "Bronchoscopy" },
  { code: "31629", description: "Bronchoscopy with transbronchial needle aspiration, each", category: "Pulmonary", subcategory: "Bronchoscopy" },
];

export const PULMONARY_ICD10: ICD10Code[] = [
  // COPD
  { code: "J44.0", description: "COPD with acute lower respiratory infection", category: "Pulmonary", subcategory: "COPD", commonProcedures: ["94010", "71046"] },
  { code: "J44.1", description: "COPD with acute exacerbation", category: "Pulmonary", subcategory: "COPD" },
  { code: "J44.9", description: "COPD, unspecified", category: "Pulmonary", subcategory: "COPD" },

  // Asthma
  { code: "J45.20", description: "Mild intermittent asthma, uncomplicated", category: "Pulmonary", subcategory: "Asthma", commonProcedures: ["94010", "94060"] },
  { code: "J45.21", description: "Mild intermittent asthma with acute exacerbation", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.22", description: "Mild intermittent asthma with status asthmaticus", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.30", description: "Mild persistent asthma, uncomplicated", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.31", description: "Mild persistent asthma with acute exacerbation", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.32", description: "Mild persistent asthma with status asthmaticus", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.40", description: "Moderate persistent asthma, uncomplicated", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.41", description: "Moderate persistent asthma with acute exacerbation", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.42", description: "Moderate persistent asthma with status asthmaticus", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.50", description: "Severe persistent asthma, uncomplicated", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.51", description: "Severe persistent asthma with acute exacerbation", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.52", description: "Severe persistent asthma with status asthmaticus", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.901", description: "Unspecified asthma with acute exacerbation", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.902", description: "Unspecified asthma with status asthmaticus", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.909", description: "Unspecified asthma, uncomplicated", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.990", description: "Exercise induced bronchospasm", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.991", description: "Cough variant asthma", category: "Pulmonary", subcategory: "Asthma" },
  { code: "J45.998", description: "Other asthma", category: "Pulmonary", subcategory: "Asthma" },

  // Pneumonia
  { code: "J18.9", description: "Pneumonia, unspecified organism", category: "Pulmonary", subcategory: "Pneumonia", commonProcedures: ["71046", "99223"] },
  { code: "J18.0", description: "Bronchopneumonia, unspecified organism", category: "Pulmonary", subcategory: "Pneumonia" },
  { code: "J18.1", description: "Lobar pneumonia, unspecified organism", category: "Pulmonary", subcategory: "Pneumonia" },
  { code: "J15.9", description: "Unspecified bacterial pneumonia", category: "Pulmonary", subcategory: "Pneumonia" },
  { code: "J12.9", description: "Viral pneumonia, unspecified", category: "Pulmonary", subcategory: "Pneumonia" },

  // Respiratory Failure
  { code: "J96.00", description: "Acute respiratory failure, unspecified whether with hypoxia or hypercapnia", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.01", description: "Acute respiratory failure with hypoxia", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.02", description: "Acute respiratory failure with hypercapnia", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.10", description: "Chronic respiratory failure, unspecified", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.11", description: "Chronic respiratory failure with hypoxia", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.12", description: "Chronic respiratory failure with hypercapnia", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.20", description: "Acute and chronic respiratory failure, unspecified", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.21", description: "Acute and chronic respiratory failure with hypoxia", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.22", description: "Acute and chronic respiratory failure with hypercapnia", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.90", description: "Respiratory failure, unspecified, unspecified", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.91", description: "Respiratory failure, unspecified with hypoxia", category: "Pulmonary", subcategory: "Respiratory Failure" },
  { code: "J96.92", description: "Respiratory failure, unspecified with hypercapnia", category: "Pulmonary", subcategory: "Respiratory Failure" },

  // Other
  { code: "J84.10", description: "Pulmonary fibrosis, unspecified", category: "Pulmonary", subcategory: "Other" },
  { code: "J84.112", description: "Idiopathic pulmonary fibrosis", category: "Pulmonary", subcategory: "Other" },
  { code: "R06.02", description: "Shortness of breath", category: "Pulmonary", subcategory: "Symptoms", commonProcedures: ["94010", "71046", "93000"] },
  { code: "R06.00", description: "Dyspnea, unspecified", category: "Pulmonary", subcategory: "Symptoms" },
  { code: "R05.9", description: "Cough, unspecified", category: "Pulmonary", subcategory: "Symptoms" },
];

// =============================================================================
// Continue in next part...
// =============================================================================

// Export all code arrays for easy access
export const ALL_CPT_CODES: CPTCode[] = [
  ...EM_CODES,
  ...CARDIOLOGY_CPT,
  ...DIABETES_CPT,
  ...ORTHOPEDIC_CPT,
  ...PULMONARY_CPT,
];

export const ALL_ICD10_CODES: ICD10Code[] = [
  ...CARDIOLOGY_ICD10,
  ...DIABETES_ICD10,
  ...ORTHOPEDIC_ICD10,
  ...PULMONARY_ICD10,
];
