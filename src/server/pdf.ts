import "server-only";

import { config } from "./config";
import { logError, logInfo } from "./log";

type PdfRenderOptions = {
  html: string;
  filename: string;
  requestId?: string;
  viewport?: { width: number; height: number; deviceScaleFactor?: number };
};

const chromiumPackageVersion = "138.0.2";
const chromiumArch = process.arch === "arm64" ? "arm64" : "x64";
const defaultChromiumPackUrl = `https://github.com/Sparticuz/chromium/releases/download/v${chromiumPackageVersion}/chromium-v${chromiumPackageVersion}-pack.${chromiumArch}.tar`;
const chromiumPackUrl = config.pdf.chromiumPackUrl || defaultChromiumPackUrl;
const globalForPdf = globalThis as typeof globalThis & {
  __chromiumExecutablePathPromise?: Promise<string>;
  __chromiumExecutablePathSource?: string;
};

async function getChromium() {
  const chromium = await import("@sparticuz/chromium");
  return chromium.default;
}

async function getPuppeteerCore() {
  const puppeteerCore = await import("puppeteer-core");
  return puppeteerCore.default;
}

async function getPuppeteer() {
  const puppeteer = await import("puppeteer");
  return puppeteer.default;
}

async function getChromiumExecutablePath(chromium: Awaited<ReturnType<typeof getChromium>>) {
  if (config.pdf.chromiumExecutablePath) {
    return config.pdf.chromiumExecutablePath;
  }

  if (
    !globalForPdf.__chromiumExecutablePathPromise ||
    globalForPdf.__chromiumExecutablePathSource !== chromiumPackUrl
  ) {
    globalForPdf.__chromiumExecutablePathPromise = chromium.executablePath(chromiumPackUrl);
    globalForPdf.__chromiumExecutablePathSource = chromiumPackUrl;
  }

  return globalForPdf.__chromiumExecutablePathPromise;
}

async function launchBrowser(viewport: Required<NonNullable<PdfRenderOptions["viewport"]>>) {
  if (process.env.VERCEL || process.env.NODE_ENV === "production") {
    const chromium = await getChromium();
    const puppeteerCore = await getPuppeteerCore();

    logInfo("pdf.render.chromium_pack", {
      source: chromiumPackUrl,
      arch: chromiumArch
    });

    return puppeteerCore.launch({
      args: [...chromium.args, "--hide-scrollbars", "--font-render-hinting=none"],
      defaultViewport: viewport,
      executablePath: await getChromiumExecutablePath(chromium),
      headless: true
    });
  }

  const puppeteer = await getPuppeteer();
  return puppeteer.launch({
    headless: true,
    defaultViewport: viewport,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
}

export async function renderPdfResponse({ html, filename, requestId, viewport }: PdfRenderOptions) {
  const resolvedViewport = {
    width: viewport?.width ?? 1200,
    height: viewport?.height ?? 800,
    deviceScaleFactor: viewport?.deviceScaleFactor ?? 2
  };

  logInfo("pdf.render.started", {
    filename,
    requestId,
    width: resolvedViewport.width,
    height: resolvedViewport.height
  });

  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;

  try {
    browser = await launchBrowser(resolvedViewport);
    const page = await browser.newPage();
    page.setDefaultTimeout(config.pdf.renderTimeoutMs);
    page.setDefaultNavigationTimeout(config.pdf.renderTimeoutMs);
    await page.setViewport(resolvedViewport);
    await page.emulateMediaType("screen");
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: config.pdf.renderTimeoutMs
    });

    try {
      await page.waitForNetworkIdle({
        idleTime: 400,
        timeout: Math.min(config.pdf.renderTimeoutMs, 4000)
      });
    } catch {}

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "10mm", bottom: "10mm", left: "10mm", right: "10mm" }
    });

    logInfo("pdf.render.completed", {
      filename,
      requestId,
      sizeBytes: pdf.length
    });

    return new Response(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
        ...(requestId ? { "x-request-id": requestId } : {})
      }
    });
  } catch (error) {
    logError("pdf.render.failed", error, { filename, requestId });
    throw error;
  } finally {
    if (browser) {
      await browser.close().catch(() => null);
    }
  }
}
