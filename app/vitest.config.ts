import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "json-summary"],
      // Measure server-side files that have unit tests.
      // Client code (hooks, components, pages) is covered by Playwright E2E.
      include: [
        "src/middleware.ts",
        "src/lib/**/*.ts",
        "src/config/**/*.ts",
        "src/app/api/**/*.ts",
        "src/skills/**/*.ts",
      ],
      exclude: [
        "src/**/*.test.ts",
        "src/**/__tests__/**",
        "src/lib/fhir/__tests__/**",
        "src/types/**",
      ],
      thresholds: {
        // Global floor — ratchet up as more tests are added.
        // Per-file thresholds below are the real enforcement for critical files.
        statements: 33,
        branches: 32,
        lines: 33,
        functions: 29,
        // Metrics — structured logging + CloudWatch
        "src/lib/metrics/logger.ts": {
          statements: 100,
          branches: 100,
          lines: 100,
        },
        "src/lib/metrics/cloudwatch.ts": {
          statements: 85,
          branches: 75,
          lines: 85,
        },
        // Rate limiter — token bucket, circuit breaker, retry
        "src/lib/rate-limiter.ts": {
          statements: 80,
          branches: 60,
          lines: 80,
        },
        // Claude API client — extraction pipeline, tool loop, session state
        "src/lib/claude.ts": {
          statements: 65,
          branches: 50,
          lines: 65,
        },
        // Auth-critical files — high bar, these guard every request
        "src/middleware.ts": {
          statements: 100,
          branches: 90,
          lines: 100,
        },
        "src/app/api/auth/refresh/route.ts": {
          statements: 100,
          branches: 100,
          lines: 100,
        },
        "src/lib/auth-server.ts": {
          statements: 95,
          branches: 95,
          lines: 100,
        },
        // Chat route — core endpoint, orchestrates everything
        "src/app/api/chat/route.ts": {
          statements: 85,
          branches: 75,
          lines: 85,
        },
        // Health check — ALB depends on this
        "src/app/api/health/route.ts": {
          statements: 100,
          branches: 100,
          lines: 100,
        },
        // Payment — high financial risk
        "src/lib/stripe-fulfillment.ts": {
          statements: 95,
          branches: 90,
          lines: 95,
        },
        // Learning system — entity extraction, mapping upserts, prompt injection
        "src/lib/learning.ts": {
          statements: 95,
          branches: 80,
          lines: 95,
        },
        // Clinical data extraction — patient safety
        "src/lib/fhir/eob-clinical.ts": {
          statements: 60,
          branches: 50,
          lines: 70,
        },
        // Token encryption — Blue Button OAuth at rest
        "src/lib/fhir/crypto.ts": {
          statements: 100,
          branches: 100,
          lines: 100,
        },
        // Consent gate — prevents health data leaking into AI without permission
        "src/lib/fhir/context.ts": {
          statements: 80,
          branches: 60,
          lines: 80,
        },
        // PII boundary — only age+gender extracted from FHIR Patient
        "src/lib/fhir/transforms.ts": {
          statements: 45,
          branches: 40,
          lines: 50,
        },
        // Account deletion — GDPR/CCPA cascade
        "src/app/api/account/delete/route.ts": {
          statements: 100,
          branches: 70,
          lines: 100,
        },
      },
    },
  },
});
