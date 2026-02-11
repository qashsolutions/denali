import type { Metadata, Viewport } from "next";
import { Playfair_Display } from "next/font/google";
import { BRAND } from "@/config";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppHeader } from "@/components/layout/AppHeader";
import { OfflineBanner } from "@/components/ui/OfflineBanner";
import { InactivityWarning } from "@/components/ui/InactivityWarning";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-serif",
});

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

// Service worker registration with update detection + offline queue sync
const swScript = `
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function() {
      navigator.serviceWorker.register('/sw.js').then(function(reg) {
        // Check for updates periodically (every 60 min)
        setInterval(function() { reg.update(); }, 60 * 60 * 1000);
        // Auto-activate waiting worker
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', function() {
          var newWorker = reg.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', function() {
              if (newWorker.state === 'activated') {
                // New SW activated — could show update toast, but keep it simple
              }
            });
          }
        });
      });
    });
    // On reconnect: tell SW to process offline queue
    window.addEventListener('online', function() {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SYNC_QUEUE' });
      }
    });
  }
`;

// Inline script to prevent flash of incorrect theme
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('theme');
      if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
        document.documentElement.style.colorScheme = 'light';
      } else if (theme === 'dark') {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
          document.documentElement.setAttribute('data-theme', 'dark');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.setAttribute('data-theme', 'light');
          document.documentElement.style.colorScheme = 'light';
        }
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={playfair.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: swScript }} />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.ico" sizes="32x32" />
        <link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png" />
        <link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AppHeader />
          <OfflineBanner />
          <InactivityWarning />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
