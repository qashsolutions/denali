interface Props {
  className?: string;
}

export function HealthRecordsIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Health records illustration"
      className={className}
    >
      {/* Heart rate card */}
      <rect
        x="70"
        y="35"
        width="140"
        height="90"
        rx="8"
        fill="var(--health-red)"
        opacity="0.1"
        stroke="var(--health-red)"
        strokeWidth="1.5"
      />

      {/* Heart rate line */}
      <polyline
        points="85,85 100,85 110,65 118,95 126,55 134,85 145,85 155,85 165,70 175,85 195,85"
        stroke="var(--health-red)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className=""
      />

      {/* Heart icon */}
      <path
        d="M135 50 C135 45 130 42 126 42 C120 42 118 47 118 50 C118 47 116 42 110 42 C106 42 101 45 101 50 C101 60 118 68 118 68 C118 68 135 60 135 50Z"
        fill="var(--health-red)"
        opacity="0.3"
      />

      {/* Medication pill */}
      <g className="">
        <rect x="45" y="140" width="50" height="22" rx="11" fill="var(--health-red)" opacity="0.15" stroke="var(--health-red)" strokeWidth="1.5" />
        <line x1="70" y1="140" x2="70" y2="162" stroke="var(--health-red)" strokeWidth="1" opacity="0.3" />
      </g>

      {/* Lab result badge */}
      <g className="">
        <rect x="185" y="135" width="55" height="35" rx="6" fill="var(--health-red)" opacity="0.1" stroke="var(--health-red)" strokeWidth="1.5" />
        <rect x="195" y="145" width="30" height="3" rx="1.5" fill="var(--health-red)" opacity="0.3" />
        <rect x="195" y="153" width="20" height="3" rx="1.5" fill="var(--health-red)" opacity="0.2" />
      </g>

      {/* Decorative dots */}
      <circle cx="50" cy="50" r="3" fill="var(--health-red)" opacity="0.2" />
      <circle cx="240" cy="60" r="2.5" fill="var(--health-red)" opacity="0.15" />
      <circle cx="230" cy="110" r="2" fill="var(--health-red)" opacity="0.15" />
    </svg>
  );
}
