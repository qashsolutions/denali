/**
 * LocalDataDAL factory — owned by mobile-local-data-modeler (Wave 1).
 *
 * Wires the per-table modules into a single object that satisfies the
 * `LocalDataDAL` contract from `@/contracts`. The factory takes any
 * `SqliteAdapter`, so production code calls it with the SQLCipher-backed
 * expo-sqlite adapter from `src/db/open.ts`, while unit tests pass an
 * in-memory adapter built on `better-sqlite3`.
 *
 * NEW DAL FUNCTIONS:
 *   1. Add the implementation in the appropriate `dal/<table>.ts` file.
 *   2. Add the contract method to `mobile/src/contracts/LocalDataDAL.ts`
 *      ONLY via additive-only change (see mobile/CLAUDE.md § Hooks).
 *   3. Bind the new method in the factory below.
 *   4. Add tests under `src/db/__tests__/`.
 *
 * NEVER expose `update*` or `delete*` for observation values — invariant 4
 * (append-only) is non-negotiable. Corrections go through `supersedes_id`.
 */

import type { LocalDataDAL } from "@/contracts/LocalDataDAL";
import type { SqliteAdapter } from "../types";

import { insertAnalysis, listAnalyses } from "./analyses";
import { insertChatMessage, listChatMessages } from "./chatMessages";
import { insertCondition, listConditions } from "./conditions";
import {
  getLatestObservation,
  getObservation,
  insertObservation,
  listObservations,
} from "./observations";
import { getProfile, upsertProfile } from "./profile";
import {
  deleteReport,
  getReport,
  insertReport,
  listReports,
  renameReport,
  updateReportParseStatus,
} from "./reports";

export function createLocalDataDAL(db: SqliteAdapter): LocalDataDAL {
  return {
    // Observations
    insertObservation: (input) => insertObservation(db, input),
    getObservation: (id) => getObservation(db, id),
    listObservations: (filter) => listObservations(db, filter),
    getLatestObservation: (userId, code) =>
      getLatestObservation(db, userId, code),

    // Conditions
    insertCondition: (input) => insertCondition(db, input),
    listConditions: (userId, filter) => listConditions(db, userId, filter),

    // Reports
    insertReport: (input) => insertReport(db, input),
    getReport: (id) => getReport(db, id),
    listReports: (userId) => listReports(db, userId),
    updateReportParseStatus: (id, status, summary) =>
      updateReportParseStatus(db, id, status, summary),
    renameReport: (id, name) => renameReport(db, id, name),
    deleteReport: (id) => deleteReport(db, id),

    // Profile
    getProfile: () => getProfile(db),
    upsertProfile: (input) => upsertProfile(db, input),

    // Analyses
    insertAnalysis: (input) => insertAnalysis(db, input),
    listAnalyses: (userId, limit) => listAnalyses(db, userId, limit),

    // Chat messages
    insertChatMessage: (input) => insertChatMessage(db, input),
    listChatMessages: (sessionId, limit) =>
      listChatMessages(db, sessionId, limit),
  };
}
