"use client";

import { useState, useMemo } from "react";
import type { SnapshotPoint } from "@/hooks/useDiabetesSnapshots";

interface A1CTrendChartProps {
  dataPoints: SnapshotPoint[];
}

function dotColor(value: number): string {
  if (value < 5.7) return "#22c55e";  // green
  if (value < 6.5) return "#f59e0b";  // amber
  return "#ef4444";                    // red
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

export function A1CTrendChart({ dataPoints }: A1CTrendChartProps) {
  const [showList, setShowList] = useState(false);

  const sorted = useMemo(
    () => [...dataPoints].sort((a, b) => a.date.localeCompare(b.date)),
    [dataPoints]
  );

  if (sorted.length === 0) {
    return (
      <p className="text-xs text-[var(--text-muted)]">No A1C history yet</p>
    );
  }

  if (showList) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">A1C History</span>
          <button onClick={() => setShowList(false)} className="text-xs text-[var(--accent-primary)] hover:underline">
            Show chart
          </button>
        </div>
        {[...sorted].reverse().map((pt, i, arr) => {
          const prev = arr[i + 1];
          const delta = prev ? pt.value - prev.value : 0;
          const arrow = delta > 0.01 ? "\u2191" : delta < -0.01 ? "\u2193" : "\u2192";
          const arrowColor = delta > 0.01 ? "text-red-500" : delta < -0.01 ? "text-green-500" : "text-[var(--text-muted)]";
          return (
            <div key={pt.date} className="flex items-center gap-2 text-sm">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dotColor(pt.value) }} />
              <span className="text-[var(--text-primary)] font-medium">{pt.value}%</span>
              {prev && (
                <span className={`text-xs ${arrowColor}`}>
                  {arrow} {Math.abs(delta).toFixed(1)}
                </span>
              )}
              <span className="text-xs text-[var(--text-muted)] ml-auto">{formatShortDate(pt.date)}</span>
            </div>
          );
        })}
      </div>
    );
  }

  if (sorted.length === 1) {
    const pt = sorted[0];
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">A1C Trend</span>
          <button onClick={() => setShowList(true)} className="text-xs text-[var(--accent-primary)] hover:underline">
            Show list
          </button>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: dotColor(pt.value) }} />
          <span className="text-lg font-bold text-[var(--text-primary)]">{pt.value}%</span>
          <span className="text-xs text-[var(--text-muted)]">{formatShortDate(pt.date)}</span>
        </div>
        <p className="text-xs text-[var(--text-muted)]">More data points will show a trend</p>
      </div>
    );
  }

  // SVG sparkline
  const W = 280;
  const H = 80;
  const PAD_X = 8;
  const PAD_Y = 12;

  const values = sorted.map((p) => p.value);
  const minV = Math.min(...values, 4);
  const maxV = Math.max(...values, 10);
  const rangeV = maxV - minV || 1;

  const toX = (i: number) => PAD_X + (i / (sorted.length - 1)) * (W - 2 * PAD_X);
  const toY = (v: number) => PAD_Y + (1 - (v - minV) / rangeV) * (H - 2 * PAD_Y);

  const polyline = sorted.map((p, i) => `${toX(i)},${toY(p.value)}`).join(" ");

  // Threshold lines
  const y57 = toY(5.7);
  const y65 = toY(6.5);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">A1C Trend</span>
        <button onClick={() => setShowList(true)} className="text-xs text-[var(--accent-primary)] hover:underline">
          Show list
        </button>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 80 }}>
        {/* Threshold lines */}
        {y57 >= PAD_Y && y57 <= H - PAD_Y && (
          <line x1={PAD_X} y1={y57} x2={W - PAD_X} y2={y57} stroke="#f59e0b" strokeWidth={0.5} strokeDasharray="4,3" opacity={0.4} />
        )}
        {y65 >= PAD_Y && y65 <= H - PAD_Y && (
          <line x1={PAD_X} y1={y65} x2={W - PAD_X} y2={y65} stroke="#ef4444" strokeWidth={0.5} strokeDasharray="4,3" opacity={0.4} />
        )}

        {/* Trend line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="var(--accent-primary)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {sorted.map((p, i) => (
          <g key={p.date}>
            <circle cx={toX(i)} cy={toY(p.value)} r={4} fill={dotColor(p.value)} />
            <title>{`${p.value}% — ${formatShortDate(p.date)}`}</title>
          </g>
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
        <span>{formatShortDate(sorted[0].date)}</span>
        <span>{formatShortDate(sorted[sorted.length - 1].date)}</span>
      </div>
    </div>
  );
}
