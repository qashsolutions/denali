import type { Metadata, Viewport } from "next";
import { BRAND } from "@/config";
import "./globals.css";

export const metadata: Metadata = {
  title: `${BRAND.NAME} - Medicare Coverage Guidance`,
  description:
    "Get plain-English guidance on Medicare coverage requirements. Understand what your doctor needs to document for approval.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: BRAND.NAME,
  },
  openGraph: {
    title: BRAND.NAME,
    description: "Medicare coverage guidance in plain English",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
