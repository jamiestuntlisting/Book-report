// Renders a URL to a print-ready PDF buffer using headless Chromium.
// - On Vercel/serverless: puppeteer-core + @sparticuz/chromium.
// - Locally: the full `puppeteer` package (dev dependency) with its bundled Chromium.

export async function renderUrlToPdf(url: string): Promise<Buffer> {
  const isServerless = Boolean(process.env.VERCEL) || process.env.NODE_ENV === "production";

  let browser;
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteer = await import("puppeteer-core");
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  } else {
    // Dev: use the full puppeteer with its own Chromium download.
    const puppeteer = await import("puppeteer");
    browser = await puppeteer.launch({ headless: true });
  }

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0", timeout: 60_000 });
    const pdf = await page.pdf({
      printBackground: true,
      preferCSSPageSize: true,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
