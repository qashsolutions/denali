"use client";

interface Insight {
  summary: string;
  recommendations: string[];
  risk_alerts: Array<{ severity: string; message: string }>;
  screening_reminders: Array<{ message: string }>;
  generated_at: string;
}

interface InsightsCardProps {
  insight: Insight | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export function InsightsCard({ insight, isLoading, onRefresh }: InsightsCardProps) {
  if (!insight && !isLoading) {
    return (
      <section>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Enable AI analysis in settings for personalized insights
          </p>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section>
        <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 animate-pulse space-y-3">
          <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3" />
          <div className="h-3 bg-[var(--bg-tertiary)] rounded w-full" />
          <div className="h-3 bg-[var(--bg-tertiary)] rounded w-2/3" />
        </div>
      </section>
    );
  }

  if (!insight) return null;

  return (
    <section>
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-violet-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456Z" />
          </svg>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            AI Insights
          </h2>
        </div>

        <p className="text-sm text-[var(--text-primary)]">{insight.summary}</p>

        {insight.recommendations.length > 0 && (
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)] mb-1">Recommendations</p>
            <ul className="space-y-1">
              {insight.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                  <span className="text-violet-500 mt-0.5 shrink-0">&bull;</span>
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--border)]">
          <span>
            AI-generated &middot; Updated{" "}
            {new Date(insight.generated_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
          <button
            onClick={onRefresh}
            className="text-[var(--accent-primary)] hover:underline"
          >
            Refresh
          </button>
        </div>
      </div>
    </section>
  );
}
