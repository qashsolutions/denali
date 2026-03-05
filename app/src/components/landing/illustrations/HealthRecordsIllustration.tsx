interface Props {
  className?: string;
}

export function HealthRecordsIllustration({ className }: Props) {
  return (
    <svg
      viewBox="12 20 285 155"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Claims and appeals illustration showing denied claim becoming approved appeal"
      className={className}
    >
      {/* Left card: Denied claim */}
      <rect x="20" y="30" width="120" height="140" rx="10" fill="var(--bg-primary)" stroke="var(--border)" strokeWidth="1" />

      {/* Denied header bar */}
      <rect x="20" y="30" width="120" height="32" rx="10" fill="var(--health-red)" opacity="0.1" />
      <rect x="20" y="52" width="120" height="10" fill="var(--health-red)" opacity="0.1" />
      <circle cx="38" cy="46" r="8" fill="var(--health-red)" opacity="0.2" />
      <text x="34" y="49" fontSize="10" fontWeight="700" fill="var(--health-red)">!</text>
      <text x="52" y="49" fontSize="10" fontWeight="600" fill="var(--health-red)">Denied</text>

      {/* Claim details lines */}
      <text x="32" y="78" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">CLAIM</text>
      <rect x="32" y="83" width="96" height="3" rx="1.5" fill="var(--text-muted)" opacity="0.2" />
      <rect x="32" y="91" width="72" height="3" rx="1.5" fill="var(--text-muted)" opacity="0.15" />

      <text x="32" y="110" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">REASON</text>
      <rect x="32" y="115" width="84" height="3" rx="1.5" fill="var(--health-red)" opacity="0.25" />
      <rect x="32" y="123" width="60" height="3" rx="1.5" fill="var(--health-red)" opacity="0.15" />

      {/* Amount */}
      <text x="32" y="148" fontSize="9" fill="var(--text-muted)">You owe</text>
      <text x="32" y="161" fontSize="14" fontWeight="700" fill="var(--health-red)">$1,240</text>

      {/* Arrow in the middle */}
      <g>
        <circle cx="155" cy="100" r="14" fill="var(--accent-primary)" opacity="0.12" />
        <path
          d="M149 100 L161 100 M157 95 L162 100 L157 105"
          stroke="var(--accent-primary)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Right card: Appeal letter */}
      <rect x="175" y="30" width="120" height="140" rx="10" fill="var(--bg-primary)" stroke="var(--border)" strokeWidth="1" />

      {/* Approved header bar */}
      <rect x="175" y="30" width="120" height="32" rx="10" fill="var(--check-teal)" opacity="0.1" />
      <rect x="175" y="52" width="120" height="10" fill="var(--check-teal)" opacity="0.1" />
      <circle cx="193" cy="46" r="8" fill="var(--check-teal)" opacity="0.2" />
      <path d="M189 46 L192 49 L198 43" stroke="var(--check-teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <text x="207" y="49" fontSize="10" fontWeight="600" fill="var(--check-teal)">Appeal</text>

      {/* Appeal letter lines */}
      <text x="187" y="78" fontSize="8" fill="var(--text-muted)" fontFamily="var(--font-mono)">APPEAL LETTER</text>
      <rect x="187" y="83" width="96" height="3" rx="1.5" fill="var(--text-primary)" opacity="0.15" />
      <rect x="187" y="91" width="80" height="3" rx="1.5" fill="var(--text-primary)" opacity="0.1" />
      <rect x="187" y="99" width="88" height="3" rx="1.5" fill="var(--text-primary)" opacity="0.1" />

      {/* Policy citation badge */}
      <rect x="187" y="112" width="56" height="16" rx="4" fill="var(--accent-primary)" opacity="0.1" />
      <text x="193" y="123" fontSize="7" fontWeight="600" fill="var(--accent-primary)" fontFamily="var(--font-mono)">LCD L35936</text>

      <rect x="248" y="112" width="36" height="16" rx="4" fill="var(--accent-primary)" opacity="0.1" />
      <text x="253" y="123" fontSize="7" fontWeight="600" fill="var(--accent-primary)" fontFamily="var(--font-mono)">ICD-10</text>

      {/* PubMed citation */}
      <rect x="187" y="134" width="96" height="3" rx="1.5" fill="var(--text-primary)" opacity="0.1" />
      <rect x="187" y="142" width="72" height="3" rx="1.5" fill="var(--text-primary)" opacity="0.08" />

      {/* Savings */}
      <text x="187" y="161" fontSize="9" fill="var(--text-muted)">Saved</text>
      <text x="216" y="161" fontSize="12" fontWeight="700" fill="var(--check-teal)">$1,240</text>
    </svg>
  );
}
