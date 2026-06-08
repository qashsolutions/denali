/**
 * Input primitives barrel — Wave-2 redesign.
 *
 * SliderInput / LikertInput / AutocompleteInput / StructuredFamilyHistoryInput
 * are the reusable one-question-per-screen building blocks consumed by
 * the new per-step onboarding screens.
 */
export { SliderInput } from "./SliderInput";
export type { SliderInputProps } from "./SliderInput";

export { LikertInput } from "./LikertInput";
export type { LikertInputProps, LikertOption } from "./LikertInput";

export { AutocompleteInput } from "./AutocompleteInput";
export type { AutocompleteInputProps } from "./AutocompleteInput";

export { StructuredFamilyHistoryInput } from "./StructuredFamilyHistoryInput";
export type { StructuredFamilyHistoryInputProps } from "./StructuredFamilyHistoryInput";

export {
  buildFamilyHistoryRecord,
  buildOtherSelection,
  canSaveFamilyHistory,
  clamp,
  FAMILY_RELATION_LABELS,
  familyHistoryMetadataJson,
  filterAutocomplete,
  isValidLikertValue,
  normalizeForMatch,
  parseFamilyHistoryMetadata,
  sliderStepCount,
  snapToStep,
  valueAtStepIndex,
} from "./helpers";
export type {
  AutocompleteEntry,
  AutocompleteSelection,
  FamilyHistoryDraft,
  FamilyHistoryMetadataParsed,
  FamilyHistoryRecord,
  FamilyRelation,
} from "./helpers";
