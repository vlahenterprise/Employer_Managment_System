import "server-only";

type PdfRenderOptions = {
  html: string;
  filename: string;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
};

export async function renderPdfResponse({ html, filename, viewport }: PdfRenderOptions) {
  const puppeteer = (await import("puppeteer")).default;
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width: viewport?.width ?? 1200,
      height: viewport?.height ?? 800,
      deviceScaleFactor: viewport?.deviceScaleFactor ?? 2
    });
    await page.emulateMediaType("screen");
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForNetworkIdle({ idleTime: 400, timeout: 4000 });
    } catch {}

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
    });

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } finally {
    await browser.close();
  }
}
