"use client";

export interface CounselorStats {
  openCases: number;
  filedThisMonth: number;
  outcomesReported: number;
  approvedCount: number;
  deniedCount: number;
  partialCount: number;
  avgResolutionDays: number | null;
}

interface OutcomeStatsProps {
  stats: CounselorStats;
}

export default function OutcomeStats({ stats }: OutcomeStatsProps) {
  const totalOutcomes = stats.approvedCount + stats.deniedCount + stats.partialCount;
  const successRate = totalOutcomes > 0
    ? Math.round((stats.approvedCount / totalOutcomes) * 100)
    : null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <StatCard
        label="Open Cases"
        value={stats.openCases}
        color="blue"
      />
      <StatCard
        label="Filed This Month"
        value={stats.filedThisMonth}
        color="violet"
      />
      <StatCard
        label="Success Rate"
        value={successRate !== null ? `${successRate}%` : "--"}
        subtitle={totalOutcomes > 0 ? `${totalOutcomes} outcomes` : undefined}
        color="green"
      />
      <StatCard
        label="Avg Resolution"
        value={stats.avgResolutionDays !== null ? `${stats.avgResolutionDays}d` : "--"}
        color="amber"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  subtitle,
  color,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
  color: "blue" | "violet" | "green" | "amber";
}) {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    violet: "bg-violet-50 border-violet-200 text-violet-700",
    green: "bg-green-50 border-green-200 text-green-700",
    amber: "bg-amber-50 border-amber-200 text-amber-700",
  };

  return (
    <div className={`rounded-xl border p-4 ${colorClasses[color]}`}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
      {subtitle && <p className="text-xs mt-1 opacity-70">{subtitle}</p>}
    </div>
  );
}
