"use client";

import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageContainer, Container } from "@/components/layout/Container";
import { useTheme } from "@/components/ThemeProvider";
import { useSettings } from "@/hooks/useSettings";

export default function SettingsPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const {
    settings,
    setTextScale,
    setHighContrast,
    setReduceMotion,
    resetSettings,
  } = useSettings();

  const handleBack = () => {
    router.push("/");
  };

  const textScaleOptions = [
    { value: 0.8, label: "Small" },
    { value: 0.9, label: "Medium" },
    { value: 1, label: "Default" },
    { value: 1.1, label: "Large" },
    { value: 1.2, label: "X-Large" },
    { value: 1.3, label: "XX-Large" },
  ];

  return (
    <PageContainer>
      <Header
        showBack
        onBack={handleBack}
        showThemeToggle
        onThemeToggle={toggleTheme}
        isDark={isDark}
      />

      <main className="flex-1 overflow-y-auto">
        <Container className="py-6">
          <h1 className="text-2xl font-semibold text-[var(--text-primary)] mb-6">
            Settings
          </h1>

          {/* Accessibility Section */}
          <section className="mb-8">
            <h2 className="text-label text-[var(--text-muted)] mb-4">
              ACCESSIBILITY
            </h2>

            <div className="space-y-4">
              {/* Text Size */}
              <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
                <label
                  htmlFor="text-size"
                  className="block text-[var(--text-primary)] font-medium mb-3"
                >
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
                <p className="text-sm text-[var(--text-muted)] mt-2">
                  Preview: The quick brown fox jumps over the lazy dog.
                </p>
              </div>

              {/* High Contrast */}
              <ToggleSetting
                label="High Contrast"
                description="Increase contrast for better visibility"
                checked={settings.highContrast}
                onChange={setHighContrast}
              />

              {/* Reduce Motion */}
              <ToggleSetting
                label="Reduce Motion"
                description="Minimize animations and transitions"
                checked={settings.reduceMotion}
                onChange={setReduceMotion}
              />
            </div>
          </section>

          {/* Appearance Section */}
          <section className="mb-8">
            <h2 className="text-label text-[var(--text-muted)] mb-4">
              APPEARANCE
            </h2>

            <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)]">
              <label className="block text-[var(--text-primary)] font-medium mb-3">
                Theme
              </label>
              <div className="flex gap-2">
                <ThemeButton
                  label="Auto"
                  icon="💻"
                  active={!isDark && typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === isDark}
                  onClick={toggleTheme}
                />
                <ThemeButton
                  label="Light"
                  icon="☀️"
                  active={!isDark}
                  onClick={() => !isDark || toggleTheme()}
                />
                <ThemeButton
                  label="Dark"
                  icon="🌙"
                  active={isDark}
                  onClick={() => isDark || toggleTheme()}
                />
              </div>
            </div>
          </section>

          {/* Reset Section */}
          <section>
            <button
              onClick={resetSettings}
              className="w-full py-3 px-4 rounded-xl border border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)]/10 transition-colors font-medium"
            >
              Reset to Defaults
            </button>
          </section>
        </Container>
      </main>
    </PageContainer>
  );
}

function ToggleSetting({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-xl p-4 border border-[var(--border)] flex items-center justify-between gap-4">
      <div>
        <p className="text-[var(--text-primary)] font-medium">{label}</p>
        <p className="text-sm text-[var(--text-muted)]">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full transition-colors ${
          checked ? "bg-[var(--accent-primary)]" : "bg-[var(--bg-tertiary)]"
        }`}
      >
        <span
          className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

function ThemeButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 px-4 rounded-lg flex flex-col items-center gap-1 transition-colors ${
        active
          ? "bg-[var(--accent-primary)] text-white"
          : "bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]/80"
      }`}
      aria-pressed={active}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}
