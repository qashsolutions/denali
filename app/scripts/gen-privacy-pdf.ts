import { chromium } from "playwright";
import path from "path";

const URL = "https://denali.health/privacy";
const OUT = path.resolve("/Users/cvr/Documents/Project/Denali/privacy_apr21.pdf");

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ colorScheme: "light" });
  const tab = await context.newPage();

  console.log(`Loading ${URL} ...`);
  await tab.goto(URL, { waitUntil: "networkidle" });
  await tab.waitForSelector("h1");

  await tab.addStyleTag({
    content: `
      body { background: white !important; color: #1a1a1a !important; -webkit-print-color-adjust: exact; }
      * {
        --text-primary: #1a1a1a !important;
        --text-secondary: #4a4a4a !important;
        --text-muted: #6a6a6a !important;
        --bg-primary: white !important;
        --bg-secondary: #f5f5f5 !important;
        --border: #e0e0e0 !important;
        --accent-primary: #2563eb !important;
      }
      header, nav[aria-label="Main"], footer,
      [class*="BottomTabs"], [class*="AppHeader"] { display: none !important; }
      .max-w-3xl { max-width: 100% !important; padding: 0 !important; }
      [id] > h2 { page-break-after: avoid; }
      ul, ol { page-break-inside: avoid; }
      .border-t:last-child { display: none !important; }
    `,
  });

  await tab.pdf({
    path: OUT,
    format: "Letter",
    margin: { top: "0.75in", right: "0.75in", bottom: "0.75in", left: "0.75in" },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: `<div style="font-size:9px;color:#666;width:100%;text-align:center;padding:0 0.75in;">DenaliHealth — Privacy Policy — Confidential</div>`,
    footerTemplate: `<div style="font-size:9px;color:#666;width:100%;display:flex;justify-content:space-between;padding:0 0.75in;"><span>© 2026 DenaliHealth (Qash Solutions Inc)</span><span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span></div>`,
  });

  await browser.close();
  console.log(`Wrote ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
