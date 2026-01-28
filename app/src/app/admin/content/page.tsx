"use client";

import dynamic from "next/dynamic";

// Dynamically import the admin content with SSR disabled
// This prevents the Supabase client from being created during build
const AdminContent = dynamic(() => import("./AdminContent"), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[var(--bg-primary)] flex items-center justify-center">
      <div className="text-[var(--text-secondary)]">Loading...</div>
    </div>
  ),
});

export default function AdminContentPage() {
  return <AdminContent />;
}
