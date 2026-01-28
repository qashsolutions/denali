"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  SiteSetting,
  LandingSection,
  PricingPlan,
  Testimonial,
} from "@/types/cms";

type Tab = "settings" | "sections" | "pricing" | "testimonials";

// Create client lazily
function getSupabase(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export default function AdminContent() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("settings");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Memoize supabase client
  const supabase = useMemo(() => getSupabase(), []);

  // Data states
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [sections, setSections] = useState<LandingSection[]>([]);
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  // Load all data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [settingsRes, sectionsRes, plansRes, testimonialsRes] =
        await Promise.all([
          supabase.from("site_settings").select("*").order("key"),
          supabase.from("landing_content").select("*").order("display_order"),
          supabase.from("pricing_plans").select("*").order("display_order"),
          supabase
            .from("testimonials")
            .select("*")
            .order("created_at", { ascending: false }),
        ]);

      if (settingsRes.data) setSettings(settingsRes.data);
      if (sectionsRes.data) setSections(sectionsRes.data);
      if (plansRes.data) setPlans(plansRes.data);
      if (testimonialsRes.data) setTestimonials(testimonialsRes.data);
    } catch (error) {
      console.error("Error loading data:", error);
      setMessage({ type: "error", text: "Failed to load data" });
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update setting
  const updateSetting = async (key: string, value: string) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("site_settings")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("key", key);

      if (error) throw error;

      setSettings((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value } : s))
      );
      setMessage({ type: "success", text: "Setting saved" });
    } catch (error) {
      console.error("Error updating setting:", error);
      setMessage({ type: "error", text: "Failed to save setting" });
    } finally {
      setIsSaving(false);
    }
  };

  // Update section
  const updateSection = async (
    id: string,
    data: Partial<LandingSection>
  ) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("landing_content")
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;

      setSections((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...data } : s))
      );
      setMessage({ type: "success", text: "Section saved" });
    } catch (error) {
      console.error("Error updating section:", error);
      setMessage({ type: "error", text: "Failed to save section" });
    } finally {
      setIsSaving(false);
    }
  };

  // Update pricing plan
  const updatePlan = async (id: string, data: Partial<PricingPlan>) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("pricing_plans")
        .update(data)
        .eq("id", id);

      if (error) throw error;

      setPlans((prev) =>
        prev.map((p) => (p.id === id ? { ...p, ...data } : p))
      );
      setMessage({ type: "success", text: "Plan saved" });
    } catch (error) {
      console.error("Error updating plan:", error);
      setMessage({ type: "error", text: "Failed to save plan" });
    } finally {
      setIsSaving(false);
    }
  };

  // Update testimonial
  const updateTestimonial = async (
    id: string,
    data: Partial<Testimonial>
  ) => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("testimonials")
        .update(data)
        .eq("id", id);

      if (error) throw error;

      setTestimonials((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...data } : t))
      );
      setMessage({ type: "success", text: "Testimonial saved" });
    } catch (error) {
      console.error("Error updating testimonial:", error);
      setMessage({ type: "error", text: "Failed to save testimonial" });
    } finally {
      setIsSaving(false);
    }
  };

  // Clear message after 3 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
        <div className="text-[var(--text-secondary)]">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">
                Content Manager
              </h1>
              <p className="text-sm text-[var(--text-muted)]">
                Edit landing page content
              </p>
            </div>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 rounded-lg bg-[var(--bg-tertiary)] text-[var(--text-primary)] text-sm font-medium hover:bg-[var(--border)] transition-colors"
            >
              View Site
            </button>
          </div>
        </div>
      </header>

      {/* Status Message */}
      {message && (
        <div
          className={`fixed top-4 right-4 px-4 py-2 rounded-lg text-white text-sm z-50 ${
            message.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Saving Indicator */}
      {isSaving && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-[var(--accent-primary)] text-white text-sm z-50">
          Saving...
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--border)]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex gap-4">
            {(
              ["settings", "sections", "pricing", "testimonials"] as Tab[]
            ).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab
                    ? "border-[var(--accent-primary)] text-[var(--accent-primary)]"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "settings" && (
          <SettingsTab settings={settings} onUpdate={updateSetting} />
        )}
        {activeTab === "sections" && (
          <SectionsTab sections={sections} onUpdate={updateSection} />
        )}
        {activeTab === "pricing" && (
          <PricingTab plans={plans} onUpdate={updatePlan} />
        )}
        {activeTab === "testimonials" && (
          <TestimonialsTab
            testimonials={testimonials}
            onUpdate={updateTestimonial}
          />
        )}
      </div>
    </div>
  );
}

// Settings Tab Component
function SettingsTab({
  settings,
  onUpdate,
}: {
  settings: SiteSetting[];
  onUpdate: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Site Settings
      </h2>
      <div className="grid gap-4">
        {settings.map((setting) => (
          <div
            key={setting.key}
            className="bg-[var(--bg-secondary)] rounded-lg p-4 border border-[var(--border)]"
          >
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
              {setting.key.replace(/_/g, " ").toUpperCase()}
            </label>
            <input
              type="text"
              defaultValue={setting.value}
              onBlur={(e) => {
                if (e.target.value !== setting.value) {
                  onUpdate(setting.key, e.target.value);
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// Sections Tab Component
function SectionsTab({
  sections,
  onUpdate,
}: {
  sections: LandingSection[];
  onUpdate: (id: string, data: Partial<LandingSection>) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Landing Sections
      </h2>
      <div className="space-y-6">
        {sections.map((section) => (
          <div
            key={section.id}
            className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border)]"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-[var(--text-primary)]">
                {section.section_key.replace(/_/g, " ").toUpperCase()}
              </h3>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={section.is_published ?? true}
                  onChange={(e) =>
                    onUpdate(section.id, { is_published: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-[var(--text-secondary)]">Published</span>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Title
                </label>
                <input
                  type="text"
                  defaultValue={section.title || ""}
                  onBlur={(e) => {
                    if (e.target.value !== section.title) {
                      onUpdate(section.id, { title: e.target.value || null });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  defaultValue={section.subtitle || ""}
                  onBlur={(e) => {
                    if (e.target.value !== section.subtitle) {
                      onUpdate(section.id, {
                        subtitle: e.target.value || null,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                  Content (JSON)
                </label>
                <textarea
                  defaultValue={JSON.stringify(section.content, null, 2)}
                  rows={6}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (
                        JSON.stringify(parsed) !==
                        JSON.stringify(section.content)
                      ) {
                        onUpdate(section.id, { content: parsed });
                      }
                    } catch {
                      // Invalid JSON, don't save
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Pricing Tab Component
function PricingTab({
  plans,
  onUpdate,
}: {
  plans: PricingPlan[];
  onUpdate: (id: string, data: Partial<PricingPlan>) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Pricing Plans
      </h2>
      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border)]"
          >
            <div className="flex items-center justify-between mb-4">
              <input
                type="text"
                defaultValue={plan.name}
                onBlur={(e) => {
                  if (e.target.value !== plan.name) {
                    onUpdate(plan.id, { name: e.target.value });
                  }
                }}
                className="text-lg font-semibold bg-transparent text-[var(--text-primary)] border-b border-transparent focus:border-[var(--accent-primary)] focus:outline-none"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={plan.is_popular ?? false}
                  onChange={(e) =>
                    onUpdate(plan.id, { is_popular: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-[var(--text-muted)]">Popular</span>
              </label>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Price (cents)
                </label>
                <input
                  type="number"
                  defaultValue={plan.price_cents}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value);
                    if (value !== plan.price_cents) {
                      onUpdate(plan.id, { price_cents: value });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Billing Period
                </label>
                <select
                  defaultValue={plan.billing_period || ""}
                  onChange={(e) =>
                    onUpdate(plan.id, {
                      billing_period: (e.target.value || null) as
                        | "one_time"
                        | "monthly"
                        | null,
                    })
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  <option value="">None (Free)</option>
                  <option value="one_time">One Time</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Features (JSON array)
                </label>
                <textarea
                  defaultValue={JSON.stringify(plan.features, null, 2)}
                  rows={4}
                  onBlur={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value);
                      if (Array.isArray(parsed)) {
                        onUpdate(plan.id, { features: parsed });
                      }
                    } catch {
                      // Invalid JSON
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] font-mono text-sm focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={plan.is_active ?? true}
                  onChange={(e) =>
                    onUpdate(plan.id, { is_active: e.target.checked })
                  }
                  className="rounded"
                />
                <span className="text-[var(--text-secondary)]">Active</span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Testimonials Tab Component
function TestimonialsTab({
  testimonials,
  onUpdate,
}: {
  testimonials: Testimonial[];
  onUpdate: (id: string, data: Partial<Testimonial>) => void;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-[var(--text-primary)]">
        Testimonials
      </h2>
      <div className="space-y-4">
        {testimonials.map((testimonial) => (
          <div
            key={testimonial.id}
            className="bg-[var(--bg-secondary)] rounded-lg p-6 border border-[var(--border)]"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Author Name
                </label>
                <input
                  type="text"
                  defaultValue={testimonial.author_name}
                  onBlur={(e) => {
                    if (e.target.value !== testimonial.author_name) {
                      onUpdate(testimonial.id, {
                        author_name: e.target.value,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>

              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Author Title
                </label>
                <input
                  type="text"
                  defaultValue={testimonial.author_title || ""}
                  onBlur={(e) => {
                    if (e.target.value !== testimonial.author_title) {
                      onUpdate(testimonial.id, {
                        author_title: e.target.value || null,
                      });
                    }
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-sm text-[var(--text-secondary)] mb-1">
                Content
              </label>
              <textarea
                defaultValue={testimonial.content}
                rows={3}
                onBlur={(e) => {
                  if (e.target.value !== testimonial.content) {
                    onUpdate(testimonial.id, { content: e.target.value });
                  }
                }}
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div>
                <label className="block text-sm text-[var(--text-secondary)] mb-1">
                  Rating
                </label>
                <select
                  defaultValue={testimonial.rating ?? 5}
                  onChange={(e) =>
                    onUpdate(testimonial.id, {
                      rating: parseInt(e.target.value),
                    })
                  }
                  className="px-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)]"
                >
                  {[1, 2, 3, 4, 5].map((r) => (
                    <option key={r} value={r}>
                      {r} Star{r !== 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={testimonial.is_featured ?? false}
                  onChange={(e) =>
                    onUpdate(testimonial.id, {
                      is_featured: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-[var(--text-secondary)]">Featured</span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={testimonial.is_published ?? true}
                  onChange={(e) =>
                    onUpdate(testimonial.id, {
                      is_published: e.target.checked,
                    })
                  }
                  className="rounded"
                />
                <span className="text-[var(--text-secondary)]">Published</span>
              </label>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
