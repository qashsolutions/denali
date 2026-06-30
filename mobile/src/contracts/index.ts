/**
 * Phase 1 mobile contracts — frozen seam between foundation agents
 * (theme-bridge, local-data-modeler, auth-wirer) and consumer agents
 * (onboarding-builder, upload-parse-builder, app-shell).
 *
 * IMPORTANT: do not redefine LocalDataDAL, Theme, or ApiClient locally
 * in any consumer module. Always import the interface from here.
 *
 * Implementations:
 *   - LocalDataDAL → src/db/dal/* (mobile-local-data-modeler)
 *   - Theme        → src/theme/tokens.ts (mobile-theme-bridge)
 *   - ApiClient    → src/auth/httpClient.ts (mobile-auth-wirer)
 *
 * See docs/design/phase-1-45plus.md § Build sequencing & ownership for
 * the wave model these contracts enable.
 */

export type * from "./LocalDataDAL";
export type * from "./Theme";
export type * from "./ApiClient";
