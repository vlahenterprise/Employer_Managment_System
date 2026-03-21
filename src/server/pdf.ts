import "server-only";

import { logError, logInfo } from "./log";

type PdfRenderOptions = {
  html: string;
  filename: string;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
};

const chromiumPackageVersion = "138.0.2";
const chromiumArch = process.arch === "arm64" ? "arm64" : "x64";
const chromiumPackUrl = `https://github.com/Sparticuz/chromium/releases/download/v${chromiumPackageVersion}/chromium-v${chromiumPackageVersion}-pack.${chromiumArch}.tar`;

async function launchBrowser(viewport: Required<NonNullable<PdfRenderOptions["viewport"]>>) {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    const chromium = (await import("@sparticuz/chromium")).default;
    const puppeteerCore = (await import("puppeteer-core")).default;

    logInfo("pdf.render.chromium_pack", {
      source: chromiumPackUrl,
      arch: chromiumArch
    });

    return puppeteerCore.launch({
      args: [...chromium.args, "--hide-scrollbars", "--font-render-hinting=none"],
      defaultViewport: viewport,
      executablePath: await chromium.executablePath(chromiumPackUrl),
      headless: true
    });
  }

  const puppeteer = (await import("puppeteer")).default;
  return puppeteer.launch({
    headless: true,
    defaultViewport: viewport,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
}

export async function renderPdfResponse({ html, filename, viewport }: PdfRenderOptions) {
  const resolvedViewport = {
    width: viewport?.width ?? 1200,
    height: viewport?.height ?? 800,
    deviceScaleFactor: viewport?.deviceScaleFactor ?? 2
  };

  logInfo("pdf.render.started", {
    filename,
    width: resolvedViewport.width,
    height: resolvedViewport.height
  });

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser(resolvedViewport);
    const page = await browser.newPage();
    await page.setViewport(resolvedViewport);
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

    logInfo("pdf.render.completed", {
      filename,
      sizeBytes: pdf.length
    });

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    logError("pdf.render.failed", error, { filename });
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}
