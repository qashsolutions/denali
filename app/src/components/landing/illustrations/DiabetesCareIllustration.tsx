interface Props {
  className?: string;
}

export function DiabetesCareIllustration({ className }: Props) {
  return (
    <svg
      viewBox="25 15 245 170"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="A1C trend chart showing improvement over time"
      className={className}
    >
      {/* Chart background */}
      <rect x="30" y="20" width="240" height="160" rx="10" fill="var(--bg-primary)" stroke="var(--border)" strokeWidth="1" />

      {/* Range labels */}
      <text x="42" y="52" fontSize="8" fontFamily="var(--font-mono)" fill="var(--text-muted)" letterSpacing="0.05em">ABOVE RANGE</text>
      <text x="42" y="105" fontSize="8" fontFamily="var(--font-mono)" fill="var(--text-muted)" letterSpacing="0.05em">IN RANGE</text>
      <text x="42" y="158" fontSize="8" fontFamily="var(--font-mono)" fill="var(--text-muted)" letterSpacing="0.05em">BELOW RANGE</text>

      {/* Range divider lines */}
      <line x1="40" y1="58" x2="258" y2="58" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />
      <line x1="40" y1="110" x2="258" y2="110" stroke="var(--border)" strokeWidth="1" strokeDasharray="3 3" />

      {/* Left axis line */}
      <line x1="40" y1="40" x2="40" y2="165" stroke="var(--border)" strokeWidth="1.5" />
      <line x1="40" y1="40" x2="37" y2="46" stroke="var(--border)" strokeWidth="1.5" />
      <line x1="40" y1="40" x2="43" y2="46" stroke="var(--border)" strokeWidth="1.5" />

      {/* Trend line — A1C going from 8.1 → 7.2 → 6.8 → 6.5 (improving) */}
      <polyline
        points="80,50 135,68 195,88 240,100"
        stroke="var(--accent-primary)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Gradient fill under the line */}
      <path
        d="M80,50 L135,68 L195,88 L240,100 L240,165 L80,165 Z"
        fill="var(--accent-primary)"
        opacity="0.06"
      />

      {/* Data points with values */}
      {/* Point 1: 8.1 (above range) */}
      <circle cx="80" cy="50" r="6" fill="var(--accent-primary)" opacity="0.2" />
      <circle cx="80" cy="50" r="3.5" fill="var(--accent-primary)" />
      <text x="80" y="42" fontSize="10" fontWeight="600" fill="var(--accent-primary)" textAnchor="middle">8.1</text>

      {/* Point 2: 7.2 */}
      <circle cx="135" cy="68" r="6" fill="var(--accent-primary)" opacity="0.2" />
      <circle cx="135" cy="68" r="3.5" fill="var(--accent-primary)" />
      <text x="135" y="60" fontSize="10" fontWeight="600" fill="var(--accent-primary)" textAnchor="middle">7.2</text>

      {/* Point 3: 6.8 (entering in-range) */}
      <circle cx="195" cy="88" r="6" fill="var(--accent-primary)" opacity="0.2" />
      <circle cx="195" cy="88" r="3.5" fill="var(--accent-primary)" />
      <text x="195" y="80" fontSize="10" fontWeight="600" fill="var(--accent-primary)" textAnchor="middle">6.8</text>

      {/* Point 4: 6.5 (in range — green-ish accent) */}
      <circle cx="240" cy="100" r="7" fill="var(--check-teal)" opacity="0.2" />
      <circle cx="240" cy="100" r="4" fill="var(--check-teal)" />
      <text x="240" y="92" fontSize="10" fontWeight="700" fill="var(--check-teal)" textAnchor="middle">6.5</text>

      {/* Month labels */}
      <text x="80" y="178" fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-mono)">Jan</text>
      <text x="135" y="178" fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-mono)">Mar</text>
      <text x="195" y="178" fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-mono)">Jun</text>
      <text x="240" y="178" fontSize="9" fill="var(--text-muted)" textAnchor="middle" fontFamily="var(--font-mono)">Now</text>
    </svg>
  );
}
