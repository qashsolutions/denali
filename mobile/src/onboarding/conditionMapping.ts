/**
 * Map user-entered medical-history strings to the canonical
 * `ConditionCategory` enum where possible. Unmappable strings fall through
 * to free-text and are stored as observations (`category = "condition"`,
 * `code_system = "internal"`) instead of conditions rows.
 *
 * This keeps the conditions table strictly typed (the enum in
 * mobile/src/contracts/LocalDataDAL.ts has 9 fixed values) while still
 * capturing user input that doesn't map cleanly.
 *
 * Pure module — no side effects, easy to test under Node-only vitest.
 */
import type { ConditionCategory } from "@/contracts";

/**
 * Lowercase keyword → ConditionCategory. The list mirrors the keyword
 * matching the web uses for inferred conditions; we keep it conservative
 * to avoid false positives (e.g. "high blood pressure" → hypertension is
 * fine; "blood" alone is not enough).
 */
const KEYWORDS: ReadonlyArray<[ReadonlyArray<string>, ConditionCategory]> = [
  [["prediabetes", "pre-diabetes", "pre diabetes"], "prediabetes"],
  [["type 1 diabetes", "type1 diabetes", "t1d", "type 1"], "type1"],
  [
    ["type 2 diabetes", "type2 diabetes", "t2d", "type 2", "diabetes mellitus", "diabetes"],
    "type2",
  ],
  [["obesity", "obese", "overweight"], "obesity"],
  [
    [
      "hypertension",
      "high blood pressure",
      "htn",
      "elevated blood pressure",
    ],
    "hypertension",
  ],
  [
    [
      "dyslipidemia",
      "high cholesterol",
      "hyperlipidemia",
      "hypercholesterolemia",
      "high triglycerides",
    ],
    "dyslipidemia",
  ],
  [
    ["chronic kidney disease", "ckd", "kidney disease", "renal disease"],
    "ckd",
  ],
  [
    [
      "cardiovascular disease",
      "cvd",
      "coronary artery disease",
      "heart disease",
      "heart attack",
      "myocardial infarction",
      "stroke",
      "atrial fibrillation",
    ],
    "cvd",
  ],
  [
    [
      "depression",
      "major depressive disorder",
      "mdd",
      "depressive disorder",
    ],
    "depression",
  ],
];

/**
 * Returns the matching `ConditionCategory` for a user-typed string, or
 * null if no keyword matches. Matching is substring-aware and
 * case-insensitive.
 *
 * Multiple keywords can resolve to the same category. The longest
 * matching keyword wins so "type 2 diabetes" maps to `type2` rather than
 * being shadowed by the more generic "diabetes" alias.
 */
export function mapToConditionCategory(
  input: string,
): ConditionCategory | null {
  if (typeof input !== "string") return null;
  const lower = input.trim().toLowerCase();
  if (lower.length === 0) return null;

  let best: { length: number; category: ConditionCategory } | null = null;
  for (const [keywords, category] of KEYWORDS) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        if (best == null || kw.length > best.length) {
          best = { length: kw.length, category };
        }
      }
    }
  }
  return best?.category ?? null;
}
