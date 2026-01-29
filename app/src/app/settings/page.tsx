"use client";

import { useRouter } from "next/navigation";
import { PageContainer, Container } from "@/components/layout/Container";
import { useTheme } from "@/components/ThemeProvider";
import { useSettings } from "@/hooks/useSettings";
import { MountainIcon } from "@/components/icons";
import Link from "next/link";

export default function SettingsPage() {
  const router = useRouter();
  const { isDark, toggleTheme, setTheme } = useTheme();
  const { settings, setTextScale, resetSettings } = useSettings();

  const handleBack = () => {
    router.push("/chat");
  };

  const textScaleOptions = [
    { value: 0.9, label: "Small" },
    { value: 1, label: "Default" },
    { value: 1.1, label: "Large" },
    { value: 1.2, label: "X-Large" },
  ];

  return (
    <PageContainer>
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ChevronLeftIcon className="w-5 h-5" />
              <span>Back</span>
            </button>

            <Link href="/" className="flex items-center gap-2">
              <MountainIcon className="w-8 h-6" />
            </Link>

            <div className="w-16" /> {/* Spacer for centering */}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <Container className="py-6">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
            Settings
          </h1>

          {/* Appearance Section */}
          <section className="mb-8">
            <h2 className="text-label text-[var(--text-muted)] mb-4">
              APPEARANCE
            </h2>

            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
              <label className="block text-[var(--text-primary)] font-medium mb-3">
                Theme
              </label>
              <div className="flex gap-3">
                <ThemeButton
                  label="Light"
                  icon={<SunIcon className="w-6 h-6" />}
                  active={!isDark}
                  onClick={() => setTheme("light")}
                />
                <ThemeButton
                  label="Dark"
                  icon={<MoonIcon className="w-6 h-6" />}
                  active={isDark}
                  onClick={() => setTheme("dark")}
                />
              </div>
            </div>
          </section>

          {/* Text Size Section */}
          <section className="mb-8">
            <h2 className="text-label text-[var(--text-muted)] mb-4">
              ACCESSIBILITY
            </h2>

            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
              <label className="block text-[var(--text-primary)] font-medium mb-3">
                Text Size
              </label>
              <div className="flex gap-2 flex-wrap">
                {textScaleOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setTextScale(option.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      settings.textScale === option.value
                        ? "bg-[var(--accent-primary)] text-white"
                        : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80"
                    }`}
                    aria-pressed={settings.textScale === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p
                className="text-[var(--text-muted)] mt-3"
                style={{ fontSize: `${settings.textScale}rem` }}
              >
                Preview: The quick brown fox jumps over the lazy dog.
              </p>
            </div>
          </section>

          {/* Reset Section */}
          <section>
            <button
              onClick={() => {
                resetSettings();
                setTheme("dark"); // Reset to default dark theme
              }}
              className="w-full py-3 px-4 rounded-xl border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors font-medium"
            >
              Reset to Defaults
            </button>
          </section>
        </Container>
      </main>
    </PageContainer>
  );
}

function ThemeButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-4 px-4 rounded-xl flex flex-col items-center gap-2 transition-colors border-2 ${
        active
          ? "bg-[var(--accent-primary)]/10 border-[var(--accent-primary)] text-[var(--accent-primary)]"
          : "bg-[var(--bg-tertiary)] border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80"
      }`}
      aria-pressed={active}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}
