interface Props {
  className?: string;
}

export function PriorAuthIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Prior authorization workflow illustration"
      className={className}
    >
      {/* Document body */}
      <rect
        x="80"
        y="30"
        width="120"
        height="150"
        rx="8"
        fill="var(--auth-blue)"
        opacity="0.12"
        stroke="var(--auth-blue)"
        strokeWidth="1.5"
      />

      {/* Form lines */}
      <rect x="100" y="55" width="60" height="4" rx="2" fill="var(--auth-blue)" opacity="0.4" />
      <rect x="100" y="70" width="80" height="4" rx="2" fill="var(--auth-blue)" opacity="0.3" />
      <rect x="100" y="85" width="50" height="4" rx="2" fill="var(--auth-blue)" opacity="0.3" />

      {/* Checkbox fields */}
      <rect x="100" y="105" width="10" height="10" rx="2" stroke="var(--auth-blue)" strokeWidth="1.5" opacity="0.5" />
      <rect x="116" y="107" width="45" height="4" rx="2" fill="var(--auth-blue)" opacity="0.3" />
      <rect x="100" y="125" width="10" height="10" rx="2" stroke="var(--auth-blue)" strokeWidth="1.5" opacity="0.5" />
      <rect x="116" y="127" width="55" height="4" rx="2" fill="var(--auth-blue)" opacity="0.3" />

      {/* Circular progress indicator */}
      <circle
        cx="220"
        cy="70"
        r="24"
        stroke="var(--auth-blue)"
        strokeWidth="3"
        opacity="0.15"
        fill="none"
      />
      <circle
        cx="220"
        cy="70"
        r="24"
        stroke="var(--auth-blue)"
        strokeWidth="3"
        fill="none"
        strokeDasharray="110 40"
        strokeLinecap="round"
        className="animate-draw-in"
        style={{ strokeDashoffset: 0 }}
      />

      {/* Upload arrow */}
      <g className="animate-float">
        <path
          d="M56 130 L56 100 L46 110 M56 100 L66 110"
          stroke="var(--auth-blue-light)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <rect x="46" y="132" width="20" height="3" rx="1.5" fill="var(--auth-blue-light)" opacity="0.5" />
      </g>

      {/* Checkmark badge */}
      <circle cx="220" cy="150" r="16" fill="var(--auth-blue)" opacity="0.2" />
      <path
        d="M212 150 L218 156 L229 144"
        stroke="var(--auth-blue)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="animate-pulse-gentle"
      />
    </svg>
  );
}
