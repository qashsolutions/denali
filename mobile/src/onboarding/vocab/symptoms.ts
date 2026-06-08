/**
 * Curated symptom vocabulary for chief-complaint capture.
 *
 * Internal coding (no LOINC / SNOMED panel; plain stable codes prefixed
 * with `denali.symptom.`). Codes are stable identifiers so longitudinal
 * analysis can group repeat reports of the same symptom even if the
 * user enters slightly different wording.
 *
 * The list is intentionally broad — covers the common chief complaints
 * a 45+ user is most likely to enter (fatigue, joint pain, shortness of
 * breath, headache, sleep issues, mood changes, etc.). "Other"
 * fallthrough is handled by the AutocompleteInput's `allowOther` flag.
 *
 * Pure data module — no side effects.
 */
import type { CodeSystem } from "@/contracts";

export interface SymptomVocabEntry {
  /** Stable internal code: `denali.symptom.<slug>`. */
  code: string;
  code_system: CodeSystem;
  /** Plain-language display label. */
  display: string;
  /** Alternate phrasings the autocomplete should match. */
  aliases?: ReadonlyArray<string>;
}

export const SYMPTOMS: ReadonlyArray<SymptomVocabEntry> = [
  {
    code: "denali.symptom.fatigue",
    code_system: "internal",
    display: "Fatigue / low energy",
    aliases: ["tired", "tiredness", "exhausted", "low energy", "fatigue"],
  },
  {
    code: "denali.symptom.chest_pain",
    code_system: "internal",
    display: "Chest pain or pressure",
    aliases: ["chest pain", "chest pressure", "chest tightness", "angina"],
  },
  {
    code: "denali.symptom.shortness_of_breath",
    code_system: "internal",
    display: "Shortness of breath",
    aliases: ["shortness of breath", "sob", "dyspnea", "breathlessness", "winded"],
  },
  {
    code: "denali.symptom.palpitations",
    code_system: "internal",
    display: "Heart palpitations",
    aliases: ["palpitations", "racing heart", "skipped beats", "fluttering heart"],
  },
  {
    code: "denali.symptom.dizziness",
    code_system: "internal",
    display: "Dizziness or lightheadedness",
    aliases: ["dizzy", "dizziness", "lightheaded", "vertigo"],
  },
  {
    code: "denali.symptom.headache",
    code_system: "internal",
    display: "Headache",
    aliases: ["headache", "head pain", "migraine", "tension headache"],
  },
  {
    code: "denali.symptom.abdominal_pain",
    code_system: "internal",
    display: "Stomach or abdominal pain",
    aliases: ["stomach pain", "belly pain", "abdominal pain", "stomach ache"],
  },
  {
    code: "denali.symptom.nausea",
    code_system: "internal",
    display: "Nausea or vomiting",
    aliases: ["nausea", "nauseous", "queasy", "vomiting", "throwing up"],
  },
  {
    code: "denali.symptom.constipation",
    code_system: "internal",
    display: "Constipation",
    aliases: ["constipation", "constipated", "infrequent stools"],
  },
  {
    code: "denali.symptom.diarrhea",
    code_system: "internal",
    display: "Diarrhea",
    aliases: ["diarrhea", "loose stools", "frequent stools"],
  },
  {
    code: "denali.symptom.joint_pain",
    code_system: "internal",
    display: "Joint pain",
    aliases: ["joint pain", "achy joints", "arthritis pain", "stiff joints"],
  },
  {
    code: "denali.symptom.back_pain",
    code_system: "internal",
    display: "Back pain",
    aliases: ["back pain", "lower back pain", "lumbago", "backache"],
  },
  {
    code: "denali.symptom.neck_pain",
    code_system: "internal",
    display: "Neck pain or stiffness",
    aliases: ["neck pain", "stiff neck", "neck ache"],
  },
  {
    code: "denali.symptom.muscle_weakness",
    code_system: "internal",
    display: "Muscle weakness",
    aliases: ["weakness", "muscle weakness", "weak muscles"],
  },
  {
    code: "denali.symptom.numbness_tingling",
    code_system: "internal",
    display: "Numbness or tingling",
    aliases: ["numbness", "tingling", "pins and needles", "neuropathy"],
  },
  {
    code: "denali.symptom.urinary_frequency",
    code_system: "internal",
    display: "Urinating more often than usual",
    aliases: ["frequent urination", "urinary frequency", "peeing a lot"],
  },
  {
    code: "denali.symptom.urinary_urgency",
    code_system: "internal",
    display: "Sudden urge to urinate",
    aliases: ["urgency", "urinary urgency", "sudden need to pee"],
  },
  {
    code: "denali.symptom.nocturia",
    code_system: "internal",
    display: "Waking up at night to urinate",
    aliases: ["nocturia", "night peeing", "waking to urinate"],
  },
  {
    code: "denali.symptom.sleep_disturbance",
    code_system: "internal",
    display: "Trouble sleeping",
    aliases: ["insomnia", "trouble sleeping", "can't sleep", "sleep disturbance"],
  },
  {
    code: "denali.symptom.daytime_sleepiness",
    code_system: "internal",
    display: "Daytime sleepiness",
    aliases: ["sleepy", "daytime sleepiness", "drowsy", "tired during day"],
  },
  {
    code: "denali.symptom.mood_change",
    code_system: "internal",
    display: "Changes in mood",
    aliases: ["mood swings", "mood changes", "irritable", "sad"],
  },
  {
    code: "denali.symptom.memory_issues",
    code_system: "internal",
    display: "Memory or focus problems",
    aliases: ["memory loss", "forgetful", "brain fog", "trouble concentrating"],
  },
  {
    code: "denali.symptom.weight_loss",
    code_system: "internal",
    display: "Unintentional weight loss",
    aliases: ["weight loss", "losing weight", "unintentional weight loss"],
  },
  {
    code: "denali.symptom.weight_gain",
    code_system: "internal",
    display: "Unintentional weight gain",
    aliases: ["weight gain", "gaining weight", "unintentional weight gain"],
  },
  {
    code: "denali.symptom.fever",
    code_system: "internal",
    display: "Fever or chills",
    aliases: ["fever", "chills", "high temperature", "feverish"],
  },
  {
    code: "denali.symptom.rash",
    code_system: "internal",
    display: "Skin rash or changes",
    aliases: ["rash", "skin rash", "hives", "itchy skin"],
  },
  {
    code: "denali.symptom.swelling",
    code_system: "internal",
    display: "Swelling in legs or feet",
    aliases: ["swelling", "edema", "swollen legs", "swollen feet"],
  },
  {
    code: "denali.symptom.vision_change",
    code_system: "internal",
    display: "Vision changes",
    aliases: ["vision change", "blurry vision", "eye problems"],
  },
  {
    code: "denali.symptom.hearing_change",
    code_system: "internal",
    display: "Hearing changes",
    aliases: ["hearing loss", "hearing change", "ringing in ears", "tinnitus"],
  },
  {
    code: "denali.symptom.cough",
    code_system: "internal",
    display: "Persistent cough",
    aliases: ["cough", "chronic cough", "coughing"],
  },
] as const;
