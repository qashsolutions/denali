/**
 * useInstrumentSessions — trend-chart data hook (Step-3 Part B).
 *
 * Thin live-state shell over the pure helpers in ./sessions.ts: builds
 * the range query via buildTrendQuery (since per range, "all" omits it,
 * TREND_QUERY_LIMIT backstop — never PAGE_SIZE), scopes rows to the
 * signed-in user, and scores sessions ascending. All decision logic is
 * in the pure module per the stale-closure rule.
 */

import { useFocusEffect } from "@react-navigation/native";
import React from "react";

import { useApiClient } from "@/auth";
import type { ObservationRow } from "@/contracts";
import { useDal } from "@/db/DalProvider";

import {
  buildTrendQuery,
  computeScoredSessions,
  type ScoredSession,
  type TrendRange,
} from "./sessions";

export interface UseInstrumentSessionsResult {
  sessions: ScoredSession[];
  loading: boolean;
}

export function useInstrumentSessions(
  instrumentId: string,
  range: TrendRange,
): UseInstrumentSessionsResult {
  const dal = useDal();
  const api = useApiClient();
  const [rows, setRows] = React.useState<ObservationRow[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Focus-scoped (Step 4): re-queries when the screen regains focus —
  // returning from a repeat check-in must redraw the chart immediately.
  useFocusEffect(
    React.useCallback(() => {
      if (!dal) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const user = api.getCurrentUser();
          const list = await dal.listObservations(
            buildTrendQuery(range, new Date()),
          );
          if (cancelled) return;
          setRows(user ? list.filter((o) => o.user_id === user.userId) : list);
        } catch (err) {
          console.warn("[useInstrumentSessions] load failed", err);
          if (!cancelled) setRows([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [api, dal, range]),
  );

  const sessions = React.useMemo(
    () => computeScoredSessions(rows, instrumentId),
    [rows, instrumentId],
  );

  return { sessions, loading };
}
