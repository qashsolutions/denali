"use client";

import { getGreeting } from "@/lib/utils";
import { FeatureCard } from "@/components/layout/FeatureCard";
import {
  HeartPulseIcon,
  ChatBubbleIcon,
  DiabetesIcon,
  ClaimsIcon,
} from "@/components/icons";

const FEATURES = [
  {
    href: "/app/health",
    icon: <HeartPulseIcon className="w-6 h-6" />,
    title: "My Health",
    description: "Connect your clinic, see your records in plain English",
    accentColor: "#ef4444",
    badge: "Coming Soon",
  },
  {
    href: "/app/chat",
    icon: <ChatBubbleIcon className="w-6 h-6" />,
    title: "Ask Denali",
    description: "Medicare coverage, symptoms, and health questions",
    accentColor: "#3b82f6",
  },
  {
    href: "/app/diabetes",
    icon: <DiabetesIcon className="w-6 h-6" />,
    title: "Diabetes Care",
    description: "Personalized coaching from your own lab results",
    accentColor: "#8b5cf6",
    badge: "Coming Soon",
  },
  {
    href: "/app/claims",
    icon: <ClaimsIcon className="w-6 h-6" />,
    title: "Claims & Appeals",
    description: "Coverage guidance and appeal letters that work",
    accentColor: "#f59e0b",
  },
];

export default function AppHomePage() {
  const greeting = getGreeting();

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">
        {greeting}
      </h1>
      <p className="text-[var(--text-secondary)] mb-8">
        What would you like to do today?
      </p>

      {/* Feature Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {FEATURES.map((feature) => (
          <FeatureCard
            key={feature.href}
            href={feature.href}
            icon={feature.icon}
            title={feature.title}
            description={feature.description}
            accentColor={feature.accentColor}
            badge={feature.badge}
          />
        ))}
      </div>
    </div>
  );
}
