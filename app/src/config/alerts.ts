/**
 * Email Alert Configuration
 *
 * Plan-gated alerts: Unlimited gets all 4 types, Plus gets 2 time-sensitive,
 * Trial/Starter get none (visible but locked in Settings).
 */

export type AlertType = 'appeal_deadline' | 'med_refill' | 'new_denial' | 'data_refresh';

export const ALERT_TYPES: AlertType[] = ['appeal_deadline', 'med_refill', 'new_denial', 'data_refresh'];

export const ALERT_CONFIG = {
  PLAN_ALERTS: {
    unlimited: ['appeal_deadline', 'med_refill', 'new_denial', 'data_refresh'] as AlertType[],
    plus: ['appeal_deadline', 'new_denial'] as AlertType[],
    starter: [] as AlertType[],
    trial: [] as AlertType[],
  },
  APPEAL_DEADLINE_REMINDERS: [30, 14, 7] as number[],
  MED_REFILL_GAP_DAYS: 7 as number,
  DATA_REFRESH_STALE_DAYS: 30 as number,
  MAX_ALERTS_PER_USER_PER_DAY: 3 as number,
} as const;

export const ALERT_LABELS: Record<AlertType, { name: string; description: string }> = {
  appeal_deadline: {
    name: "Appeal deadline reminders",
    description: "Get notified when an appeal deadline is approaching",
  },
  new_denial: {
    name: "New claim denials",
    description: "Get notified when new denied claims appear in your data",
  },
  med_refill: {
    name: "Medication refill gaps",
    description: "Get notified when a medication may need refilling",
  },
  data_refresh: {
    name: "Medicare data refresh",
    description: "Reminder to refresh your Medicare data periodically",
  },
};

export function getEligibleAlertTypes(plan: string | null, isAdmin: boolean): AlertType[] {
  if (isAdmin) return ALERT_CONFIG.PLAN_ALERTS.unlimited;
  return ALERT_CONFIG.PLAN_ALERTS[plan as keyof typeof ALERT_CONFIG.PLAN_ALERTS] ?? [];
}
