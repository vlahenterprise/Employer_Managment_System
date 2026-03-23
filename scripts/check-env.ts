process.loadEnvFile?.(".env");

async function main() {
  const { config } = await import("../src/server/config");

  const summary = {
    database: {
      hasRuntimeUrl: Boolean(config.database.url),
      hasDirectUrl: Boolean(config.database.directUrl)
    },
    auth: {
      hasNextAuthSecret: Boolean(config.auth.secret),
      hasNextAuthUrl: Boolean(config.auth.url),
      hasGoogleOauth: Boolean(config.auth.googleClientId && config.auth.googleClientSecret),
      allowedEmailDomains: config.auth.allowedEmailDomains.length
    },
    backup: {
      hasCronSecret: Boolean(config.backup.cronSecret),
      routeLimitPerMinute: config.backup.routeLimitPerMinute
    },
    files: {
      maxCvUploadBytes: config.files.maxCvUploadBytes
    },
    pdf: {
      routeLimitPerMinute: config.pdf.routeLimitPerMinute,
      renderTimeoutMs: config.pdf.renderTimeoutMs,
      hasCustomChromiumExecutablePath: Boolean(config.pdf.chromiumExecutablePath),
      hasCustomChromiumPackUrl: Boolean(config.pdf.chromiumPackUrl)
    }
  };

  console.log(JSON.stringify({ ok: true, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
