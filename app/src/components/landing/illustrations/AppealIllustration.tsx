interface Props {
  className?: string;
}

export function AppealIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Appeal process illustration"
      className={className}
    >
      {/* Denied document (left) */}
      <rect
        x="30"
        y="50"
        width="80"
        height="105"
        rx="6"
        fill="var(--appeal-coral)"
        opacity="0.1"
        stroke="var(--appeal-coral)"
        strokeWidth="1.5"
      />
      <rect x="44" y="70" width="52" height="3" rx="1.5" fill="var(--appeal-coral)" opacity="0.3" />
      <rect x="44" y="80" width="40" height="3" rx="1.5" fill="var(--appeal-coral)" opacity="0.25" />
      <rect x="44" y="90" width="48" height="3" rx="1.5" fill="var(--appeal-coral)" opacity="0.25" />

      {/* X mark on denied doc */}
      <g>
        <circle cx="70" cy="130" r="12" fill="var(--appeal-coral)" opacity="0.15" />
        <path
          d="M64 124 L76 136 M76 124 L64 136"
          stroke="var(--appeal-coral)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>

      {/* Arrow from denied to approved */}
      <g className="animate-float">
        <path
          d="M120 105 L155 105"
          stroke="var(--appeal-coral-light)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="4 3"
        />
        <path
          d="M150 99 L158 105 L150 111"
          stroke="var(--appeal-coral-light)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* Approved document (right) */}
      <rect
        x="165"
        y="50"
        width="80"
        height="105"
        rx="6"
        fill="var(--appeal-coral)"
        opacity="0.1"
        stroke="var(--appeal-coral)"
        strokeWidth="1.5"
      />
      <rect x="179" y="70" width="52" height="3" rx="1.5" fill="var(--appeal-coral)" opacity="0.3" />
      <rect x="179" y="80" width="40" height="3" rx="1.5" fill="var(--appeal-coral)" opacity="0.25" />
      <rect x="179" y="90" width="48" height="3" rx="1.5" fill="var(--appeal-coral)" opacity="0.25" />

      {/* Checkmark on approved doc */}
      <g className="animate-pulse-gentle">
        <circle cx="205" cy="130" r="12" fill="var(--appeal-coral)" opacity="0.2" />
        <path
          d="M198 130 L203 135 L213 124"
          stroke="var(--appeal-coral)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* Appeal levels steps (bottom) */}
      <g>
        {[0, 1, 2, 3, 4].map((i) => (
          <g key={i}>
            <rect
              x={60 + i * 38}
              y={172 - i * 4}
              width="28"
              height="8"
              rx="2"
              fill="var(--appeal-coral)"
              opacity={0.12 + i * 0.06}
            />
          </g>
        ))}
      </g>
    </svg>
  );
}
