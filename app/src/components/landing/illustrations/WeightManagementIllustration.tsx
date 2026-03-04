interface Props {
  className?: string;
}

export function WeightManagementIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Weight management illustration"
      className={className}
    >
      {/* Scale base */}
      <rect
        x="80"
        y="130"
        width="120"
        height="40"
        rx="8"
        fill="var(--appeal-coral)"
        opacity="0.1"
        stroke="var(--appeal-coral)"
        strokeWidth="1.5"
      />

      {/* Scale display */}
      <rect
        x="110"
        y="140"
        width="60"
        height="20"
        rx="4"
        fill="var(--appeal-coral)"
        opacity="0.08"
        stroke="var(--appeal-coral)"
        strokeWidth="1"
      />
      <rect x="120" y="147" width="40" height="3" rx="1.5" fill="var(--appeal-coral)" opacity="0.35" />
      <rect x="128" y="153" width="24" height="2" rx="1" fill="var(--appeal-coral)" opacity="0.2" />

      {/* Gauge / dial above scale */}
      <circle
        cx="140"
        cy="90"
        r="40"
        fill="var(--appeal-coral)"
        opacity="0.08"
        stroke="var(--appeal-coral)"
        strokeWidth="1.5"
      />

      {/* Gauge tick marks */}
      <line x1="140" y1="54" x2="140" y2="60" stroke="var(--appeal-coral)" strokeWidth="1.5" opacity="0.3" />
      <line x1="165" y1="60" x2="162" y2="66" stroke="var(--appeal-coral)" strokeWidth="1" opacity="0.2" />
      <line x1="115" y1="60" x2="118" y2="66" stroke="var(--appeal-coral)" strokeWidth="1" opacity="0.2" />
      <line x1="176" y1="78" x2="171" y2="82" stroke="var(--appeal-coral)" strokeWidth="1" opacity="0.2" />
      <line x1="104" y1="78" x2="109" y2="82" stroke="var(--appeal-coral)" strokeWidth="1" opacity="0.2" />

      {/* Needle */}
      <line
        x1="140"
        y1="90"
        x2="155"
        y2="65"
        stroke="var(--appeal-coral)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="140" cy="90" r="4" fill="var(--appeal-coral)" opacity="0.3" />

      {/* Trend arrow (improving) */}
      <g>
        <path
          d="M45 100 L55 85 L65 90 L75 70"
          stroke="var(--appeal-coral)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.4"
        />
        <path
          d="M70 65 L77 70 L72 75"
          stroke="var(--appeal-coral)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.4"
        />
      </g>

      {/* Medication capsule */}
      <g>
        <rect x="205" y="80" width="40" height="18" rx="9" fill="var(--appeal-coral)" opacity="0.12" stroke="var(--appeal-coral)" strokeWidth="1.5" />
        <line x1="225" y1="80" x2="225" y2="98" stroke="var(--appeal-coral)" strokeWidth="1" opacity="0.25" />
      </g>

      {/* Decorative dots */}
      <circle cx="45" cy="140" r="2.5" fill="var(--appeal-coral)" opacity="0.15" />
      <circle cx="235" cy="130" r="3" fill="var(--appeal-coral)" opacity="0.2" />
      <circle cx="245" cy="60" r="2" fill="var(--appeal-coral)" opacity="0.15" />
    </svg>
  );
}
