/**
 * Symptom-tracking catalog — the plain, trackable symptoms a user can LOG a
 * severity for over time (the unlicensed replacement for the removed scored
 * instruments; 2026-07 licensing decision, audit/LICENSING_BRIEF.md).
 *
 * SCOPE / BOUNDARY (read before editing):
 *   - This is an Apple-Health-style SYMPTOM LOG, NOT a validated instrument.
 *     Each symptom is a GENERIC, plain-language complaint name (medical common
 *     terms — not copyrightable) tracked INDIVIDUALLY with a Denali-authored
 *     0–3 severity (None / Mild / Moderate / Severe). We deliberately do NOT:
 *       • reproduce any proprietary instrument's item set, wording, or scale
 *         (IPSS's 0–5 frequency scale, MRS's 0–4 scale, ESS's dozing scale, …);
 *       • sum symptoms into a domain "score";
 *       • attach any interpretation band or severity verdict.
 *     A logged severity is the user's OWN self-report, displayed as-is with a
 *     band-less trend (mirrors the raw-marker rule, D28).
 *   - COHORT gating is by `sex_at_birth` ONLY (mirrors markersFor / instrumentsFor):
 *       • sleep + urinary → universal (urinary unifies the former male-LUTS and
 *         female-incontinence gap into one tracker);
 *       • menopause → female; hormonal → male.
 *   - PROVISIONAL: every entry is `provisional: true` pending a clinical
 *     reviewer's sign-off on the symptom SET + wording. Names are plain and
 *     non-diagnostic; the ‡ governance still applies to the display layer.
 *
 * Storage: each logged symptom commits as ONE observation — category
 * "symptom", code_system "internal", code = `denali.symptom.<domain>.<key>`,
 * value_num = severity 0–3 (for the trend), value_text = the severity label.
 * Identical model to the marker/upload path (append-only, ON CONFLICT DO NOTHING).
 */

import type { SexAtBirth } from "@/contracts";

/** The four symptom-backed domains (a subset of DomainId — kept local to avoid
 *  a circular import with the timeline domain registry). */
export type SymptomDomainId = "sleep" | "urinary" | "menopause" | "hormonal";

/** Denali-authored generic severity scale (NOT any instrument's scale). */
export interface SeverityOption {
  value: 0 | 1 | 2 | 3;
  label: string;
}

export const SEVERITY_OPTIONS: ReadonlyArray<SeverityOption> = [
  { value: 0, label: "None" },
  { value: 1, label: "Mild" },
  { value: 2, label: "Moderate" },
  { value: 3, label: "Severe" },
];

export const SEVERITY_MIN = 0;
export const SEVERITY_MAX = 3;

/** Plain-language label for a stored severity value (0–3), or null if invalid. */
export function severityLabel(value: number): string | null {
  return SEVERITY_OPTIONS.find((o) => o.value === value)?.label ?? null;
}

export interface SymptomDef {
  /** Stable slug within the domain (used in the code + testIDs). */
  key: string;
  /** Plain-language name shown in the picker + as the observation display. */
  display: string;
  domain: SymptomDomainId;
  /**
   * Sex-at-birth gate. Absent → universal (offered to everyone). Present →
   * offered ONLY to the listed sexes. Gating is on sex_at_birth, never
   * gender_identity (clinical-key rule).
   */
  cohort?: { sex: ReadonlyArray<SexAtBirth> };
  /** True until a clinical reviewer verifies the symptom SET + wording. */
  provisional: boolean;
}

/**
 * The symptom set. GENERIC names + a 0–3 severity — deliberately NOT any
 * proprietary instrument. Operator/clinical to verify the SET + wording before
 * un-provisioning.
 */
export const SYMPTOM_CATALOG: ReadonlyArray<SymptomDef> = [
  // ── Sleep (universal — replaces the removed Epworth domain's capability) ──
  { key: "trouble_falling_asleep", display: "Trouble falling asleep", domain: "sleep", provisional: true },
  { key: "waking_at_night", display: "Waking during the night", domain: "sleep", provisional: true },
  { key: "daytime_sleepiness", display: "Daytime sleepiness", domain: "sleep", provisional: true },
  { key: "unrefreshing_sleep", display: "Waking up tired", domain: "sleep", provisional: true },

  // ── Urinary (universal — unifies male LUTS + female incontinence) ────────
  { key: "urgency", display: "Sudden urge to urinate", domain: "urinary", provisional: true },
  { key: "frequency", display: "Urinating often", domain: "urinary", provisional: true },
  { key: "nocturia", display: "Waking at night to urinate", domain: "urinary", provisional: true },
  { key: "leaking", display: "Leaking urine", domain: "urinary", provisional: true },
  { key: "weak_stream", display: "Weak urine stream", domain: "urinary", provisional: true },

  // ── Menopause (female) ──────────────────────────────────────────────────
  { key: "hot_flashes", display: "Hot flashes", domain: "menopause", cohort: { sex: ["female"] }, provisional: true },
  { key: "night_sweats", display: "Night sweats", domain: "menopause", cohort: { sex: ["female"] }, provisional: true },
  { key: "vaginal_dryness", display: "Vaginal dryness", domain: "menopause", cohort: { sex: ["female"] }, provisional: true },
  { key: "mood_changes", display: "Mood changes", domain: "menopause", cohort: { sex: ["female"] }, provisional: true },
  { key: "menopause_sleep", display: "Sleep problems", domain: "menopause", cohort: { sex: ["female"] }, provisional: true },

  // ── Hormonal (male) ─────────────────────────────────────────────────────
  { key: "low_energy", display: "Low energy", domain: "hormonal", cohort: { sex: ["male"] }, provisional: true },
  { key: "low_libido", display: "Low sex drive", domain: "hormonal", cohort: { sex: ["male"] }, provisional: true },
  { key: "reduced_strength", display: "Reduced strength", domain: "hormonal", cohort: { sex: ["male"] }, provisional: true },
  { key: "low_mood", display: "Low mood", domain: "hormonal", cohort: { sex: ["male"] }, provisional: true },
];

/** Stable observation code for a symptom: `denali.symptom.<domain>.<key>`. */
export function symptomCode(symptom: SymptomDef): string {
  return `denali.symptom.${symptom.domain}.${symptom.key}`;
}

/** Look up a symptom definition by its full observation code. */
export function findSymptomByCode(code: string): SymptomDef | undefined {
  return SYMPTOM_CATALOG.find((s) => symptomCode(s) === code);
}

/**
 * Symptoms offered to a given sex_at_birth cohort. Universal symptoms (no
 * `cohort`) are always included; sex-specific ones only when the sex matches.
 * For null/unknown/intersex, sex-specific symptoms are excluded (same
 * strictness as `markersFor` / `instrumentsFor`).
 */
export function symptomsFor(
  sexAtBirth: SexAtBirth | null | undefined,
): ReadonlyArray<SymptomDef> {
  return SYMPTOM_CATALOG.filter((s) => {
    if (s.cohort?.sex == null) return true;
    return sexAtBirth != null && s.cohort.sex.includes(sexAtBirth);
  });
}

/**
 * The symptom DOMAINS relevant to a cohort (unique, source order). Used by the
 * timeline registry to surface symptom domain cards for the cohort.
 */
export function symptomDomainsFor(
  sexAtBirth: SexAtBirth | null | undefined,
): ReadonlyArray<SymptomDomainId> {
  const seen = new Set<SymptomDomainId>();
  const out: SymptomDomainId[] = [];
  for (const s of symptomsFor(sexAtBirth)) {
    if (!seen.has(s.domain)) {
      seen.add(s.domain);
      out.push(s.domain);
    }
  }
  return out;
}

/** code → domain map for every catalogued symptom (routing on the timeline). */
export const SYMPTOM_CODE_TO_DOMAIN: Readonly<Record<string, SymptomDomainId>> =
  Object.fromEntries(SYMPTOM_CATALOG.map((s) => [symptomCode(s), s.domain]));

/** The four symptom-backed domain ids (runtime set, for `isSymptomDomain`). */
export const SYMPTOM_DOMAIN_IDS: ReadonlySet<string> = new Set<SymptomDomainId>([
  "sleep",
  "urinary",
  "menopause",
  "hormonal",
]);

/** Is `domainId` a symptom-tracked domain (vs. an instrument / umbrella one)? */
export function isSymptomDomain(domainId: string): boolean {
  return SYMPTOM_DOMAIN_IDS.has(domainId);
}
