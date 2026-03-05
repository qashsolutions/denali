interface Props {
  className?: string;
}

export function WeightManagementIllustration({ className }: Props) {
  return (
    <svg
      viewBox="0 0 300 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Weight management coverage cards showing medications and counseling"
      className={className}
    >
      {/* Card 1: Medication — Wegovy */}
      <rect x="40" y="18" width="220" height="48" rx="10" fill="var(--bg-primary)" stroke="var(--border)" strokeWidth="1" />
      {/* Pill icon circle */}
      <circle cx="68" cy="42" r="16" fill="var(--accent-primary)" opacity="0.12" />
      <rect x="58" y="38" width="20" height="8" rx="4" fill="var(--accent-primary)" opacity="0.6" />
      <line x1="68" y1="38" x2="68" y2="46" stroke="var(--bg-primary)" strokeWidth="0.8" />
      {/* Text */}
      <text x="94" y="38" fontSize="11" fontWeight="600" fill="var(--text-primary)">Wegovy (semaglutide)</text>
      <text x="94" y="52" fontSize="9" fill="var(--text-muted)">GLP-1 · Medicare Part D</text>
      {/* Status badge */}
      <rect x="216" y="32" width="36" height="18" rx="9" fill="var(--check-teal)" opacity="0.15" />
      <text x="234" y="44" fontSize="8" fontWeight="600" fill="var(--check-teal)" textAnchor="middle">Active</text>

      {/* Card 2: Counseling — IBT */}
      <rect x="40" y="76" width="220" height="48" rx="10" fill="var(--bg-primary)" stroke="var(--border)" strokeWidth="1" />
      {/* Chat icon circle */}
      <circle cx="68" cy="100" r="16" fill="var(--accent-primary)" opacity="0.12" />
      <rect x="56" y="93" width="16" height="11" rx="3" fill="var(--accent-primary)" opacity="0.5" />
      <path d="M60 104 L63 108 L66 104" fill="var(--accent-primary)" opacity="0.5" />
      {/* Text */}
      <text x="94" y="96" fontSize="11" fontWeight="600" fill="var(--text-primary)">Obesity Counseling</text>
      <text x="94" y="110" fontSize="9" fill="var(--text-muted)">IBT · G0447 · Covered</text>
      {/* Check badge */}
      <rect x="216" y="90" width="36" height="18" rx="9" fill="var(--check-teal)" opacity="0.15" />
      <text x="234" y="102" fontSize="8" fontWeight="600" fill="var(--check-teal)" textAnchor="middle">Cover</text>

      {/* Card 3: Bariatric */}
      <rect x="40" y="134" width="220" height="48" rx="10" fill="var(--bg-primary)" stroke="var(--border)" strokeWidth="1" />
      {/* Clipboard icon circle */}
      <circle cx="68" cy="158" r="16" fill="var(--accent-primary)" opacity="0.12" />
      <rect x="60" y="150" width="16" height="16" rx="2" fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" opacity="0.5" />
      <rect x="64" y="147" width="8" height="4" rx="1" fill="var(--accent-primary)" opacity="0.5" />
      <line x1="64" y1="156" x2="72" y2="156" stroke="var(--accent-primary)" strokeWidth="1" opacity="0.35" />
      <line x1="64" y1="160" x2="70" y2="160" stroke="var(--accent-primary)" strokeWidth="1" opacity="0.35" />
      {/* Text */}
      <text x="94" y="154" fontSize="11" fontWeight="600" fill="var(--text-primary)">Bariatric Surgery</text>
      <text x="94" y="168" fontSize="9" fill="var(--text-muted)">BMI 35+ · Prior auth required</text>
      {/* Status badge */}
      <rect x="210" y="148" width="42" height="18" rx="9" fill="var(--accent-primary)" opacity="0.12" />
      <text x="231" y="160" fontSize="8" fontWeight="600" fill="var(--accent-primary)" textAnchor="middle">Review</text>
    </svg>
  );
}
