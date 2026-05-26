/**
 * Generate PDF versions of Terms and Privacy pages for CMS submission.
 * Usage: npx playwright test scripts/generate-legal-pdfs.ts
 * Or:    npx tsx scripts/generate-legal-pdfs.ts
 */

import { chromium } from "playwright";
import { execSync, spawn, type ChildProcess } from "child_process";
import { existsSync } from "fs";
import path from "path";

const PAGES = [
  { path: "/terms", filename: "DenaliHealth-Terms-of-Service.pdf", title: "Terms of Service" },
  { path: "/privacy", filename: "DenaliHealth-Privacy-Policy.pdf", title: "Privacy Policy" },
];

const PORT = 3099; // Use non-standard port to avoid conflicts
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.resolve(__dirname, "../../"); // Project root

async function waitForServer(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // Server not ready yet
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Server did not start within ${timeoutMs / 1000}s`);
}

async function main() {
  let server: ChildProcess | null = null;

  try {
    // Start Next.js dev server on a separate port
    console.log(`Starting dev server on port ${PORT}...`);
    server = spawn("npx", ["next", "dev", "-p", String(PORT)], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "pipe",
      env: { ...process.env, PORT: String(PORT) },
    });

    server.stderr?.on("data", (data: Buffer) => {
      const msg = data.toString();
      if (msg.includes("Error") || msg.includes("error")) {
        console.error("[server]", msg.trim());
      }
    });

    await waitForServer(BASE_URL);
    console.log("Dev server ready.\n");

    // Launch browser
    const browser = await chromium.launch();
    const context = await browser.newContext({
      // Use light theme for PDF readability
      colorScheme: "light",
    });

    for (const page of PAGES) {
      const tab = await context.newPage();
      const url = `${BASE_URL}${page.path}`;
      console.log(`Generating ${page.title}...`);

      await tab.goto(url, { waitUntil: "networkidle" });

      // Wait for content to render
      await tab.waitForSelector("h1");

      // Inject print-friendly styles
      await tab.addStyleTag({
        content: `
          /* PDF print overrides */
          body {
            background: white !important;
            color: #1a1a1a !important;
            -webkit-print-color-adjust: exact;
          }
          /* Force light theme colors for PDF */
          * {
            --text-primary: #1a1a1a !important;
            --text-secondary: #4a4a4a !important;
            --text-muted: #6a6a6a !important;
            --bg-primary: white !important;
            --bg-secondary: #f5f5f5 !important;
            --border: #e0e0e0 !important;
            --accent-primary: #2563eb !important;
          }
          /* Hide nav/footer chrome */
          header, nav[aria-label="Main"], footer,
          [class*="BottomTabs"], [class*="AppHeader"] {
            display: none !important;
          }
          /* Clean up container */
          .max-w-3xl {
            max-width: 100% !important;
            padding: 0 !important;
          }
          /* Avoid page breaks inside sections */
          [id] > h2 {
            page-break-after: avoid;
          }
          ul, ol {
            page-break-inside: avoid;
          }
          /* Footer links section — hide for PDF */
          .border-t:last-child {
            display: none !important;
          }
        `,
      });

      const outputPath = path.join(OUTPUT_DIR, page.filename);

      await tab.pdf({
        path: outputPath,
        format: "Letter",
        margin: { top: "0.75in", right: "0.75in", bottom: "0.75in", left: "0.75in" },
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size:9px; color:#666; width:100%; text-align:center; padding:0 0.75in;">
            DenaliHealth — ${page.title} — Confidential
          </div>
        `,
        footerTemplate: `
          <div style="font-size:9px; color:#666; width:100%; display:flex; justify-content:space-between; padding:0 0.75in;">
            <span>© 2026 DenaliHealth (Qash Solutions Inc)</span>
            <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
          </div>
        `,
      });

      console.log(`  → ${outputPath}`);
      await tab.close();
    }

    await browser.close();
    console.log("\nDone! PDFs generated in project root.");
  } finally {
    if (server) {
      server.kill("SIGTERM");
      console.log("Dev server stopped.");
    }
  }
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
