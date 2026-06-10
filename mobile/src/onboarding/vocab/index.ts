/**
 * Coded vocabulary barrel — autocomplete-ready entries for the
 * onboarding redesign.
 *
 * Each vocabulary file exports a const array of `{ code, code_system,
 * display, aliases? }`. The `AutocompleteInput` primitive consumes the
 * array directly and resolves the user's selection to the entry's
 * `{ code, code_system, display }`.
 *
 * Phase 1 ships two vocabularies — conditions (ICD-10) and symptoms
 * (internal codes). Medications are intentionally deferred (see the
 * Wave-2 redesign report for the contract-gap rationale).
 */
export type { ConditionVocabEntry } from "./conditions45plus";
export {
  CONDITIONS_45_PLUS,
  CONDITIONS_45_PLUS_PROVENANCE,
} from "./conditions45plus";

export type { SymptomVocabEntry } from "./symptoms";
export { SYMPTOMS, SYMPTOMS_PROVENANCE } from "./symptoms";
