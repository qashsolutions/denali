interface Props {
  className?: string;
}

export function CoverageCheckIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Coverage check workflow illustration"
      className={className}
    >
      {/* Policy document */}
      <rect
        x="90"
        y="40"
        width="100"
        height="130"
        rx="6"
        fill="var(--check-teal)"
        opacity="0.1"
        stroke="var(--check-teal)"
        strokeWidth="1.5"
      />

      {/* Document content lines */}
      <rect x="106" y="60" width="68" height="4" rx="2" fill="var(--check-teal)" opacity="0.35" />
      <rect x="106" y="74" width="50" height="4" rx="2" fill="var(--check-teal)" opacity="0.25" />
      <rect x="106" y="88" width="62" height="4" rx="2" fill="var(--check-teal)" opacity="0.25" />
      <rect x="106" y="102" width="40" height="4" rx="2" fill="var(--check-teal)" opacity="0.25" />
      <rect x="106" y="116" width="55" height="4" rx="2" fill="var(--check-teal)" opacity="0.25" />

      {/* Magnifying glass */}
      <g className="animate-float">
        <circle
          cx="62"
          cy="80"
          r="22"
          stroke="var(--check-teal)"
          strokeWidth="2.5"
          fill="var(--check-teal)"
          fillOpacity="0.08"
        />
        <line
          x1="78"
          y1="96"
          x2="92"
          y2="110"
          stroke="var(--check-teal)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Search lines inside magnifier */}
        <rect x="50" y="73" width="24" height="3" rx="1.5" fill="var(--check-teal)" opacity="0.4" />
        <rect x="50" y="81" width="16" height="3" rx="1.5" fill="var(--check-teal)" opacity="0.3" />
      </g>

      {/* Shield badge */}
      <g className="animate-pulse-gentle">
        <path
          d="M220 55 L220 85 C220 100 205 110 205 110 C205 110 190 100 190 85 L190 55 L205 48 L220 55Z"
          fill="var(--check-teal)"
          opacity="0.15"
          stroke="var(--check-teal)"
          strokeWidth="1.5"
        />
        <path
          d="M199 78 L203 82 L212 72"
          stroke="var(--check-teal)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* Decorative dots */}
      <circle cx="230" cy="140" r="3" fill="var(--check-teal)" opacity="0.2" />
      <circle cx="242" cy="148" r="2" fill="var(--check-teal)" opacity="0.15" />
      <circle cx="224" cy="155" r="2.5" fill="var(--check-teal)" opacity="0.15" />
    </svg>
  );
}
