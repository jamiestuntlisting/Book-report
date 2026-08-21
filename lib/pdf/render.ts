// Renders a URL to a print-ready PDF using Cloudflare Browser Rendering
// (@cloudflare/puppeteer over the BROWSER binding). The free plan includes
// 10 minutes of browser time per day — a book render takes seconds.
import puppeteer, { type BrowserWorker } from "@cloudflare/puppeteer";
import { getBindings } from "@/lib/cf";

export async function renderUrlToPdf(url: string): Promise<Uint8Array> {
  const { BROWSER } = getBindings();
  if (!BROWSER) {
    throw new Error(
      "Browser Rendering binding missing — PDF export needs the BROWSER binding in wrangler.jsonc.",
    );
  }

  const browser = await puppeteer.launch(BROWSER as unknown as BrowserWorker);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    return pdf;
  } finally {
    await browser.close();
  }
}
