#!/usr/bin/env npx tsx
/**
 * Legal Document Consistency Checker
 *
 * Verifies that FAQ, Terms, Privacy, and HIPAA pages are internally consistent —
 * no contradictions on pricing, breach notification, data retention, consent, etc.
 *
 * Run: npx tsx scripts/check-legal-docs.ts
 * CI:  npx tsx scripts/check-legal-docs.ts && echo "OK" || exit 1
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = resolve(__dirname, "../app/src/app");

function read(page: string): string {
  return readFileSync(resolve(BASE, page, "page.tsx"), "utf-8");
}

const docs = {
  faq: read("faq"),
  terms: read("terms"),
  privacy: read("privacy"),
  hipaa: read("hipaa"),
} as const;

type DocKey = keyof typeof docs;

// ─── helpers ───────────────────────────────────────────────────────────────

function has(doc: DocKey, pattern: string | RegExp): boolean {
  return typeof pattern === "string"
    ? docs[doc].includes(pattern)
    : pattern.test(docs[doc]);
}

function allHave(docKeys: DocKey[], pattern: string | RegExp): DocKey[] {
  return docKeys.filter((d) => !has(d, pattern));
}

function noneHave(docKeys: DocKey[], pattern: string | RegExp): DocKey[] {
  return docKeys.filter((d) => has(d, pattern));
}

// ─── check definitions ─────────────────────────────────────────────────────

type Result = { pass: boolean; detail?: string };
type Check = { name: string; run: () => Result };

const checks: Check[] = [
  // ── Breach notification ──────────────────────────────────────────────────
  {
    name: "60-day breach notification window in FAQ, Privacy, HIPAA",
    run: () => {
      const missing = allHave(["faq", "privacy", "hipaa"], "60 days");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "500+ breach notifies FTC in FAQ, Privacy, HIPAA",
    run: () => {
      const missing = allHave(["faq", "privacy", "hipaa"], "FTC");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "500+ breach notifies HHS in FAQ, Privacy, HIPAA",
    run: () => {
      const missing = allHave(["faq", "privacy", "hipaa"], "HHS");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── Audit logs ───────────────────────────────────────────────────────────
  {
    name: "6-year audit log retention in FAQ, Privacy, HIPAA",
    run: () => {
      const missing = allHave(["faq", "privacy", "hipaa"], /6.year/i);
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "Audit log carve-out on account deletion in FAQ, Privacy, HIPAA",
    run: () => {
      // Each doc must mention both audit logs AND 6-year retention (case-insensitive)
      const missing = (["faq", "privacy", "hipaa"] as DocKey[]).filter(
        (d) => !has(d, /audit log/i) || !has(d, /6.year/i)
      );
      return { pass: missing.length === 0, detail: missing.length ? `Carve-out missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "Terms §11 does not claim 'all your data' deleted without audit log exception",
    run: () => {
      const hasUncaveated =
        docs.terms.includes("all your data will be permanently deleted") &&
        !has("terms", /audit log/i);
      return {
        pass: !hasUncaveated,
        detail: hasUncaveated
          ? "Terms §11 says 'all your data will be permanently deleted' but no audit log carve-out found"
          : undefined,
      };
    },
  },
  {
    name: "Terms §13 Medicare data deletion includes audit log exception",
    run: () => {
      const hasMedicareDeleted = docs.terms.includes("all Medicare data is permanently deleted");
      const hasCarveout = has("terms", /audit log/i);
      const fail = hasMedicareDeleted && !hasCarveout;
      return {
        pass: !fail,
        detail: fail
          ? "Terms §13 says 'all Medicare data is permanently deleted immediately' but no audit log carve-out found"
          : undefined,
      };
    },
  },

  // ── Cache TTL ────────────────────────────────────────────────────────────
  {
    name: "24-hour health data cache TTL in FAQ, Privacy, HIPAA",
    run: () => {
      const missing = allHave(["faq", "privacy", "hipaa"], /24.hour/i);
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── Encryption ───────────────────────────────────────────────────────────
  {
    name: "AES-256-GCM at-rest encryption in FAQ, Privacy, HIPAA",
    run: () => {
      const missing = allHave(["faq", "privacy", "hipaa"], "AES-256-GCM");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "TLS 1.2+ in-transit encryption in FAQ, Privacy, HIPAA",
    run: () => {
      const missing = allHave(["faq", "privacy", "hipaa"], "TLS 1.2");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── Pricing ──────────────────────────────────────────────────────────────
  {
    name: "$10 per-appeal price in FAQ and Terms",
    run: () => {
      const missing = allHave(["faq", "terms"], "$10");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "$20/month price in FAQ and Terms",
    run: () => {
      const missing = allHave(["faq", "terms"], "$20");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "5 messages/day with per-appeal plan in FAQ and Terms",
    run: () => {
      const missing = allHave(["faq", "terms"], "5 messages");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "3 appeal credits/month for Monthly plan in FAQ and Terms",
    run: () => {
      const missing = allHave(["faq", "terms"], "3 appeal");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── Trial ────────────────────────────────────────────────────────────────
  {
    name: "14-day free trial in FAQ and Terms",
    run: () => {
      const missing = allHave(["faq", "terms"], "14-day");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "3 messages/day trial limit in FAQ and Terms",
    run: () => {
      const missing = allHave(["faq", "terms"], "3 messages");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "Trial gives '1 appeal credit' (not 'letter') in FAQ and Terms",
    run: () => {
      const missing = allHave(["faq", "terms"], "1 appeal credit");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },
  {
    name: "Post-trial chat lock stated in FAQ and Terms",
    run: () => {
      const missing = allHave(["faq", "terms"], "chat access is locked");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── Data processors ──────────────────────────────────────────────────────
  {
    name: "AWS and Stripe named as data processors in FAQ and Privacy",
    run: () => {
      const processors = ["AWS", "Stripe"];
      const issues: string[] = [];
      for (const p of processors) {
        const missing = allHave(["faq", "privacy"], p);
        if (missing.length) issues.push(`${p} missing in: ${missing.join(", ")}`);
      }
      return { pass: issues.length === 0, detail: issues.join("; ") || undefined };
    },
  },

  // ── BAA status ───────────────────────────────────────────────────────────
  {
    name: "AWS BAA execution date stated in Privacy and HIPAA",
    run: () => {
      // BAA with AWS was executed February 25, 2026 — must be stated in both docs
      const missing = (["privacy", "hipaa"] as DocKey[]).filter(
        (d) => !has(d, /executed.{0,40}February 25, 2026|February 25, 2026.{0,40}executed/i)
      );
      return {
        pass: missing.length === 0,
        detail: missing.length
          ? `AWS BAA execution date missing in: ${missing.join(", ")}`
          : undefined,
      };
    },
  },

  // ── No model training ────────────────────────────────────────────────────
  {
    name: "No AI model training on user data stated in Privacy and HIPAA",
    run: () => {
      const missing = allHave(["privacy", "hipaa"], /not train|do not train|does not train/i);
      return { pass: missing.length === 0, detail: missing.length ? `No-training statement missing in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── Policy change notice ─────────────────────────────────────────────────
  {
    name: "30-day policy change notification in Terms, Privacy, HIPAA",
    run: () => {
      const missing = allHave(["terms", "privacy", "hipaa"], "30 days");
      return { pass: missing.length === 0, detail: missing.length ? `Missing in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── CMS non-endorsement ──────────────────────────────────────────────────
  {
    name: "CMS non-endorsement disclaimer in Terms",
    run: () => {
      const has = docs.terms.includes("not endorsed or certified by");
      return { pass: has, detail: has ? undefined : "CMS non-endorsement disclaimer missing from Terms" };
    },
  },

  // ── Negative checks (things that must NOT appear) ────────────────────────
  {
    name: "FAQ does not claim 'never store your full name'",
    run: () => {
      const bad = docs.faq.includes("never store your full name");
      return { pass: !bad, detail: bad ? "Incorrect claim still present in FAQ" : undefined };
    },
  },
  {
    name: "HIPAA does not claim 'active session' for cache TTL",
    run: () => {
      const bad = docs.hipaa.includes("active session");
      return { pass: !bad, detail: bad ? "Inaccurate 'active session' TTL wording still in HIPAA" : undefined };
    },
  },

  // ── AWS Bedrock no-retention ─────────────────────────────────────────────
  {
    name: "AWS Bedrock no-retention/no-training stated in Privacy and HIPAA",
    run: () => {
      // AWS Bedrock does not retain prompts by default — must be stated in both docs
      const missing = (["privacy", "hipaa"] as DocKey[]).filter(
        (d) => !has(d, /Bedrock[\s\S]{0,100}not (store|log|retain)|not (store|log|retain)[\s\S]{0,100}Bedrock/i)
      );
      return { pass: missing.length === 0, detail: missing.length ? `AWS Bedrock no-retention statement missing in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── Medicare OAuth scope ─────────────────────────────────────────────────
  {
    name: "Medicare data scoped to Patient, Coverage, EOB in Terms and Privacy",
    run: () => {
      const missing = (["terms", "privacy"] as DocKey[]).filter(
        (d) =>
          !has(d, "Patient") ||
          !has(d, "Coverage") ||
          !has(d, /Explanation of Benefit|EOB/i)
      );
      return { pass: missing.length === 0, detail: missing.length ? `Scope statement incomplete in: ${missing.join(", ")}` : undefined };
    },
  },

  // ── Revocation deletes cached data ───────────────────────────────────────
  {
    name: "Disconnecting Medicare deletes cached health data in Privacy and HIPAA",
    run: () => {
      const missing = (["privacy", "hipaa"] as DocKey[]).filter(
        (d) => !has(d, /disconnect|revok/i) || !has(d, /delet|remov/i)
      );
      return { pass: missing.length === 0, detail: missing.length ? `Revocation-deletion link missing in: ${missing.join(", ")}` : undefined };
    },
  },
];

// ─── runner ────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures: string[] = [];

console.log("\n📋  Legal Documents Consistency Check");
console.log("Docs: FAQ · Terms · Privacy · HIPAA");
console.log("=".repeat(60));

for (const check of checks) {
  const result = check.run();
  if (result.pass) {
    console.log(`  ✅  ${check.name}`);
    passed++;
  } else {
    console.log(`  ❌  ${check.name}`);
    if (result.detail) console.log(`       → ${result.detail}`);
    failed++;
    failures.push(check.name);
  }
}

console.log("=".repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.log("Failed checks:");
  failures.forEach((f) => console.log(`  ✗  ${f}`));
  console.log("");
  process.exit(1);
} else {
  console.log("✅  All checks passed — documents are consistent.\n");
  process.exit(0);
}
