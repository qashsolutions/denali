/**
 * Professional SVG Icon Library
 * 24x24 stroke-based icons, configurable via className
 */

import { cn } from "@/lib/utils";

interface IconProps {
  className?: string;
  strokeWidth?: number;
}

/**
 * Mountain Logo - Denali Brand (shield + mountain)
 * 64x64 PNG inlined as base64 data URI — zero network requests.
 */
const LOGO_DATA_URI =
  "data:image/png;base64,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";

export function MountainIcon({ className }: IconProps) {
  return (
    <img
      src={LOGO_DATA_URI}
      alt="Denali"
      className={cn("w-10 h-10", className)}
      draggable={false}
    />
  );
}

/**
 * Shield with Check - Prevent Denials
 */
export function ShieldCheckIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/**
 * Document with Text - Plain English Guidance
 */
export function DocumentTextIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

/**
 * Scale - Appeal Support / Balance
 */
export function ScaleIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M12 3v18" />
      <path d="M5 7l7-4 7 4" />
      <path d="M5 7l-2 8a4 4 0 004 4h0a4 4 0 004-4l-2-8" />
      <path d="M19 7l-2 8a4 4 0 004 4h0a4 4 0 004-4l-2-8" />
    </svg>
  );
}

/**
 * Chat Bubble - Tell Us / Conversation
 */
export function ChatBubbleIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  );
}

/**
 * Magnifying Glass - Search / Check Rules
 */
export function MagnifyingGlassIcon({
  className,
  strokeWidth = 1.5,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/**
 * Clipboard with Check - Get Checklist
 */
export function ClipboardCheckIcon({
  className,
  strokeWidth = 1.5,
}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  );
}

/**
 * Check - Pricing checkmarks
 */
export function CheckIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-5 h-5", className)}
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

/**
 * Star - Testimonial ratings
 */
export function StarIcon({
  className,
  filled = false,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-5 h-5", className)}
    >
      <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
    </svg>
  );
}

/**
 * Arrow Right - CTA buttons
 */
export function ArrowRightIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-5 h-5", className)}
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12,5 19,12 12,19" />
    </svg>
  );
}

/**
 * Sun - Light mode
 */
export function SunIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-5 h-5", className)}
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

/**
 * Moon - Dark mode
 */
export function MoonIcon({ className, strokeWidth = 2 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-5 h-5", className)}
    >
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

/**
 * Heart Pulse - My Health / Health Records
 */
export function HeartPulseIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M19.5 12.572l-7.5 7.428-7.5-7.428A5 5 0 1112 6.006a5 5 0 017.5 6.572" />
      <path d="M5 12h2l2 4 4-8 2 4h2" />
    </svg>
  );
}

/**
 * Diabetes / Glucose Chart - Diabetes Care
 * Line chart with trend line and current reading dot
 */
export function DiabetesIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M3 20h18" />
      <polyline points="4,16 8,11 11,14 15,7 19,12" />
      <circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * Weight Scale - Obesity / Weight Management Care
 * Precision balance scale with circular dial and base platform
 */
export function WeightScaleIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      {/* Scale platform base */}
      <path d="M5 21h14a1 1 0 001-1v-1a1 1 0 00-1-1H5a1 1 0 00-1 1v1a1 1 0 001 1z" />
      {/* Scale body */}
      <rect x="6" y="10" width="12" height="8" rx="2" />
      {/* Circular gauge face */}
      <circle cx="12" cy="14" r="3" />
      {/* Gauge needle */}
      <path d="M12 14l1.5-2" />
      {/* Gauge tick marks */}
      <path d="M10 12.2l.3.3" />
      <path d="M13.7 12.2l-.3.3" />
      {/* Top handle */}
      <path d="M9.5 10V8a2.5 2.5 0 015 0v2" />
    </svg>
  );
}

/**
 * Claims / File Stack - Claims & Appeals
 */
export function ClaimsIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M15 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <path d="M10 9l-2 2 2 2" />
    </svg>
  );
}

/**
 * Sparkle - AI indicator
 */
export function SparkleIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M12 3l1.912 5.813a2 2 0 001.272 1.278L21 12l-5.816 1.91a2 2 0 00-1.272 1.278L12 21l-1.912-5.813a2 2 0 00-1.272-1.278L3 12l5.816-1.91a2 2 0 001.272-1.278L12 3z" />
    </svg>
  );
}

/**
 * Gear - Settings
 */
export function GearIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Home - Home hub
 */
export function HomeIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <polyline points="9,22 9,12 15,12 15,22" />
    </svg>
  );
}

export function QuestionMarkIcon({ className, strokeWidth = 1.5 }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}

/**
 * Get icon component by name
 */
export function getIconByName(
  name: string
): React.ComponentType<IconProps> | null {
  const icons: Record<string, React.ComponentType<IconProps>> = {
    shield: ShieldCheckIcon,
    document: DocumentTextIcon,
    appeal: ScaleIcon,
    chat: ChatBubbleIcon,
    search: MagnifyingGlassIcon,
    checklist: ClipboardCheckIcon,
    check: CheckIcon,
    star: StarIcon,
    arrow: ArrowRightIcon,
    sun: SunIcon,
    moon: MoonIcon,
    mountain: MountainIcon,
    heart: HeartPulseIcon,
    diabetes: DiabetesIcon,
    weight: WeightScaleIcon,
    claims: ClaimsIcon,
    sparkle: SparkleIcon,
    home: HomeIcon,
    gear: GearIcon,
  };

  return icons[name] || null;
}
