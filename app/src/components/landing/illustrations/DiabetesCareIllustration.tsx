interface Props {
  className?: string;
}

export function DiabetesCareIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 280 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Diabetes care illustration"
      className={className}
    >
      {/* A1C trend chart */}
      <rect
        x="55"
        y="30"
        width="170"
        height="110"
        rx="8"
        fill="var(--diabetes-violet)"
        opacity="0.08"
        stroke="var(--diabetes-violet)"
        strokeWidth="1.5"
      />

      {/* Chart grid lines */}
      <line x1="75" y1="55" x2="205" y2="55" stroke="var(--diabetes-violet)" strokeWidth="0.5" opacity="0.15" />
      <line x1="75" y1="75" x2="205" y2="75" stroke="var(--diabetes-violet)" strokeWidth="0.5" opacity="0.15" />
      <line x1="75" y1="95" x2="205" y2="95" stroke="var(--diabetes-violet)" strokeWidth="0.5" opacity="0.15" />
      <line x1="75" y1="115" x2="205" y2="115" stroke="var(--diabetes-violet)" strokeWidth="0.5" opacity="0.15" />

      {/* Trend line — going down (good!) */}
      <polyline
        points="80,60 105,65 130,58 155,70 180,80 200,90"
        stroke="var(--diabetes-violet)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        className="animate-float"
      />

      {/* Data points */}
      <circle cx="80" cy="60" r="4" fill="var(--diabetes-violet)" opacity="0.3" />
      <circle cx="105" cy="65" r="4" fill="var(--diabetes-violet)" opacity="0.3" />
      <circle cx="130" cy="58" r="4" fill="var(--diabetes-violet)" opacity="0.3" />
      <circle cx="155" cy="70" r="4" fill="var(--diabetes-violet)" opacity="0.3" />
      <circle cx="180" cy="80" r="4" fill="var(--diabetes-violet)" opacity="0.3" />
      <circle cx="200" cy="90" r="5" fill="var(--diabetes-violet)" opacity="0.5" />

      {/* Down arrow — trending well */}
      <g className="animate-pulse-gentle">
        <circle cx="230" cy="52" r="15" fill="var(--diabetes-violet)" opacity="0.12" />
        <path
          d="M225 48 L230 56 L235 48"
          stroke="var(--diabetes-violet)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </g>

      {/* Blood drop icon */}
      <g className="animate-float">
        <path
          d="M55 160 C55 160 45 170 45 176 C45 182 49 186 55 186 C61 186 65 182 65 176 C65 170 55 160 55 160Z"
          fill="var(--diabetes-violet)"
          opacity="0.2"
          stroke="var(--diabetes-violet)"
          strokeWidth="1.5"
        />
      </g>

      {/* Medication reminder badge */}
      <rect x="165" y="150" width="60" height="28" rx="6" fill="var(--diabetes-violet)" opacity="0.1" stroke="var(--diabetes-violet)" strokeWidth="1.5" />
      <rect x="175" y="160" width="25" height="3" rx="1.5" fill="var(--diabetes-violet)" opacity="0.3" />

      {/* Decorative dots */}
      <circle cx="35" cy="70" r="2.5" fill="var(--diabetes-violet)" opacity="0.15" />
      <circle cx="250" cy="130" r="3" fill="var(--diabetes-violet)" opacity="0.2" />
    </svg>
  );
}
