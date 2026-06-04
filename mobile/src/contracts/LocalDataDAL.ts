/**
 * LocalDataDAL — frozen Phase 1 contract for on-device data access.
 *
 * Implementation: mobile-local-data-modeler agent owns src/db/dal/*.
 * Consumers: mobile-onboarding-builder, mobile-upload-parse-builder,
 * mobile-app-shell (for the timeline view), and any future surface
 * that reads/writes the local SQLCipher store.
 *
 * Invariant: append-only time-series. UNIQUE(user_id, code, effective_at)
 * with ON CONFLICT DO NOTHING. Corrections insert a NEW row with
 * supersedes_id pointing at the OLD row; the old row is unchanged.
 * No method on this interface UPDATEs an observation value column.
 *
 * USCDI enum types below MUST stay in lockstep with the web's
 * app/src/types/user-demographics.ts module.
 */

// ─── USCDI value sets — mirror app/src/types/user-demographics.ts ─────────

export type SexAtBirth = "male" | "female" | "intersex" | "unknown";

export type GenderIdentity =
  | "male"
  | "female"
  | "non-binary"
  | "transgender-male"
  | "transgender-female"
  | "other"
  | "prefer-not-to-say";

// ─── Observation taxonomy ─────────────────────────────────────────────────

export type ObservationCategory =
  | "anthropometric"
  | "vital"
  | "biomarker"
  | "symptom"
  | "questionnaire"
  | "screening"
  | "lifestyle"
  | "family_history"
  | "condition";

export type CodeSystem = "LOINC" | "SNOMED" | "ICD10" | "internal";

export type ObservationSource =
  | "fhir"
  | "log"
  | "self_reported"
  | "uploaded_report"
  | "derived";

// ─── Condition taxonomy — mirror server-side user_conditions ──────────────

export type ConditionCategory =
  | "prediabetes"
  | "type1"
  | "type2"
  | "obesity"
  | "hypertension"
  | "dyslipidemia"
  | "ckd"
  | "cvd"
  | "depression";

export type ConditionSource = "claims" | "self_reported" | "ehr" | "uploaded_report";

// ─── Reports + plan + chat ────────────────────────────────────────────────

export type ReportType = "lab" | "ehr" | "visit";
export type ReportParseStatus = "pending" | "parsing" | "confirmed" | "partial" | "rejected";

export type Plan = "trial" | "starter" | "plus" | "unlimited";

export type ChatRole = "user" | "assistant" | "system";

// ─── Row shapes ───────────────────────────────────────────────────────────

export interface ProfileRow {
  id: string;                         // Cognito sub (uuid)
  email: string;
  plan: Plan;
  birth_year: number | null;
  is_on_medicare: boolean | null;
  sex_at_birth: SexAtBirth | null;
  gender_identity: GenderIdentity | null;
  created_at: string;                 // ISO8601
  updated_at: string;                 // ISO8601
}

export interface ObservationRow {
  id: string;
  user_id: string;
  category: ObservationCategory;
  code_system: CodeSystem;
  code: string;
  display: string;
  value_num: number | null;
  value_text: string | null;
  unit: string | null;
  source: ObservationSource;
  effective_at: string;               // ISO8601 — when the observation is about
  recorded_at: string;                // ISO8601 — when this row was inserted
  report_id: string | null;
  supersedes_id: string | null;       // null = original, non-null = correction
  metadata_json: string | null;
}

export interface ConditionRow {
  id: string;
  user_id: string;
  condition_code: string;
  condition_category: ConditionCategory;
  source: ConditionSource;
  started_at: string;                 // ISO8601
  ended_at: string | null;
  confidence: number | null;          // 0..1
}

export interface ReportRow {
  id: string;
  user_id: string;
  type: ReportType;
  file_blob_ref: string;              // path to encrypted on-device blob
  original_filename: string;
  uploaded_at: string;
  parsed_at: string | null;
  parse_status: ReportParseStatus;
  summary_text: string | null;
}

export interface AnalysisRow {
  id: string;
  user_id: string;
  requested_at: string;
  input_observation_ids_json: string;
  model_used: string;
  result_text: string;
  result_structured_json: string | null;
}

export interface ChatMessageRow {
  id: string;
  role: ChatRole;
  content: string;
  created_at: string;
  session_id: string | null;
}

// ─── Filter shapes ────────────────────────────────────────────────────────

export interface ObservationsFilter {
  category?: ObservationCategory;
  code_system?: CodeSystem;
  code?: string;
  /** ISO8601 inclusive lower bound on effective_at. */
  since?: string;
  /** ISO8601 exclusive upper bound on effective_at. */
  until?: string;
  /** When true (default), only latest non-superseded rows are returned. */
  latest_only?: boolean;
  limit?: number;
}

export interface ConditionsFilter {
  category?: ConditionCategory;
  source?: ConditionSource;
  /** When true (default), only currently-active conditions (ended_at IS NULL). */
  active_only?: boolean;
}

// ─── Insert input shapes (omit auto-generated fields) ─────────────────────

export type ProfileUpsertInput = Partial<Omit<ProfileRow, "id" | "created_at" | "updated_at">> & {
  id: string;
  email: string;
};

export type ObservationInsertInput = Omit<ObservationRow, "id" | "recorded_at"> & {
  /** Optional explicit id; DAL generates a UUID otherwise. */
  id?: string;
  /** Optional explicit recorded_at; DAL uses now() otherwise. */
  recorded_at?: string;
};

export type ConditionInsertInput = Omit<ConditionRow, "id"> & {
  id?: string;
};

export type ReportInsertInput = Omit<
  ReportRow,
  "id" | "uploaded_at" | "parsed_at" | "parse_status" | "summary_text"
> & {
  id?: string;
  uploaded_at?: string;
  parse_status?: ReportParseStatus;
  summary_text?: string | null;
};

export type AnalysisInsertInput = Omit<AnalysisRow, "id" | "requested_at"> & {
  id?: string;
  requested_at?: string;
};

export type ChatMessageInsertInput = Omit<ChatMessageRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

// ─── The frozen contract ──────────────────────────────────────────────────

/**
 * Append-only on-device data access. Implemented by mobile-local-data-modeler.
 *
 * Append-only contract:
 *   - insertObservation honors UNIQUE(user_id, code, effective_at). A duplicate
 *     insert resolves to a no-op (returns inserted=false).
 *   - Corrections: callers supply supersedes_id in the input; the DAL writes a
 *     new row, the OLD row remains unchanged. No method UPDATEs value columns.
 *
 * Reads default to latest non-superseded rows by walking the supersedes chain.
 */
export interface LocalDataDAL {
  // Observations
  insertObservation(input: ObservationInsertInput): Promise<{ inserted: boolean; id: string }>;
  getObservation(id: string): Promise<ObservationRow | null>;
  listObservations(filter?: ObservationsFilter): Promise<ObservationRow[]>;
  /** Convenience: latest non-superseded observation for a given (user, code). */
  getLatestObservation(userId: string, code: string): Promise<ObservationRow | null>;

  // Conditions
  insertCondition(input: ConditionInsertInput): Promise<{ inserted: boolean; id: string }>;
  listConditions(userId: string, filter?: ConditionsFilter): Promise<ConditionRow[]>;

  // Reports
  insertReport(input: ReportInsertInput): Promise<{ id: string }>;
  getReport(id: string): Promise<ReportRow | null>;
  listReports(userId: string): Promise<ReportRow[]>;
  updateReportParseStatus(
    id: string,
    status: ReportParseStatus,
    summary?: string,
  ): Promise<void>;

  // Profile
  getProfile(): Promise<ProfileRow | null>;
  upsertProfile(input: ProfileUpsertInput): Promise<ProfileRow>;

  // Analyses (transient inference results stored on-device for audit/recall)
  insertAnalysis(input: AnalysisInsertInput): Promise<{ id: string }>;
  listAnalyses(userId: string, limit?: number): Promise<AnalysisRow[]>;

  // Chat (local-only — no-persist on server)
  insertChatMessage(input: ChatMessageInsertInput): Promise<{ id: string }>;
  listChatMessages(sessionId: string | null, limit?: number): Promise<ChatMessageRow[]>;
}
