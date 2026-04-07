import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1, "DIRECT_URL is required for Prisma migrations").optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
  NEXTAUTH_URL: z.string().url().optional(),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  AUTH_ALLOWED_EMAIL_DOMAINS: z.string().optional(),
  AUTH_AUTO_PROVISION: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  CV_MAX_UPLOAD_BYTES: z.string().optional(),
  PDF_ROUTE_LIMIT_PER_MINUTE: z.string().optional(),
  BACKUP_ROUTE_LIMIT_PER_MINUTE: z.string().optional(),
  PDF_RENDER_TIMEOUT_MS: z.string().optional(),
  CHROMIUM_EXECUTABLE_PATH: z.string().optional(),
  CHROMIUM_PACK_URL: z.string().optional(),
  ENABLE_HR_MODULE: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  GOOGLE_WORKSPACE_CLIENT_ID: z.string().optional(),
  GOOGLE_WORKSPACE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_WORKSPACE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_WORKSPACE_BOT_EMAIL: z.string().optional(),
  GOOGLE_WORKSPACE_CALENDAR_ID: z.string().optional(),
  GOOGLE_WORKSPACE_EMAIL_ENABLED: z.string().optional(),
  GOOGLE_WORKSPACE_CALENDAR_ENABLED: z.string().optional(),
  GOOGLE_WORKSPACE_TASK_CALENDAR_ENABLED: z.string().optional(),
  LOGIN_RATE_LIMIT_PER_10_MIN: z.string().optional(),
  FIELD_ENCRYPTION_KEY: z.string().optional()
});

export const env = envSchema.parse(process.env);

function parseBool(value: string | undefined, defaultValue: boolean) {
  if (value === undefined) return defaultValue;
  return ["1", "true", "yes", "y", "on"].includes(value.toLowerCase());
}

function parseCsv(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parsePositiveInt(value: string | undefined, defaultValue: number) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function parseNonNegativeInt(value: string | undefined, defaultValue: number) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return defaultValue;
  return parsed;
}

if (env.NODE_ENV === "production" && !(env.CRON_SECRET?.trim())) {
  throw new Error("CRON_SECRET must be set in production");
}

export const config = {
  database: {
    url: env.DATABASE_URL,
    directUrl: env.DIRECT_URL || env.DATABASE_URL
  },
  auth: {
    secret: env.NEXTAUTH_SECRET,
    url: env.NEXTAUTH_URL,
    googleClientId: env.GOOGLE_CLIENT_ID,
    googleClientSecret: env.GOOGLE_CLIENT_SECRET,
    allowedEmailDomains: parseCsv(env.AUTH_ALLOWED_EMAIL_DOMAINS).map((d) => d.toLowerCase()),
    autoProvision: parseBool(env.AUTH_AUTO_PROVISION, false),
    loginRateLimitPer10Min: parsePositiveInt(env.LOGIN_RATE_LIMIT_PER_10_MIN, 10)
  },
  backup: {
    cronSecret: env.CRON_SECRET?.trim() || "",
    routeLimitPerMinute: parseNonNegativeInt(env.BACKUP_ROUTE_LIMIT_PER_MINUTE, 4)
  },
  rateLimit: {
    upstashRedisUrl: env.UPSTASH_REDIS_REST_URL?.trim() || "",
    upstashRedisToken: env.UPSTASH_REDIS_REST_TOKEN?.trim() || ""
  },
  files: {
    maxCvUploadBytes: parsePositiveInt(env.CV_MAX_UPLOAD_BYTES, 5 * 1024 * 1024)
  },
  pdf: {
    routeLimitPerMinute: parseNonNegativeInt(env.PDF_ROUTE_LIMIT_PER_MINUTE, 10),
    renderTimeoutMs: parsePositiveInt(env.PDF_RENDER_TIMEOUT_MS, 12000),
    chromiumExecutablePath: env.CHROMIUM_EXECUTABLE_PATH?.trim() || "",
    chromiumPackUrl: env.CHROMIUM_PACK_URL?.trim() || ""
  },
  features: {
    hrModuleEnabled: parseBool(env.ENABLE_HR_MODULE, false)
  },
  encryption: {
    fieldEncryptionKey: env.FIELD_ENCRYPTION_KEY?.trim() || ""
  },
  googleWorkspace: {
    clientId: env.GOOGLE_WORKSPACE_CLIENT_ID?.trim() || "",
    clientSecret: env.GOOGLE_WORKSPACE_CLIENT_SECRET?.trim() || "",
    refreshToken: env.GOOGLE_WORKSPACE_REFRESH_TOKEN?.trim() || "",
    botEmail: env.GOOGLE_WORKSPACE_BOT_EMAIL?.trim() || "",
    calendarId: env.GOOGLE_WORKSPACE_CALENDAR_ID?.trim() || "",
    emailEnabled: parseBool(env.GOOGLE_WORKSPACE_EMAIL_ENABLED, true),
    calendarEnabled: parseBool(env.GOOGLE_WORKSPACE_CALENDAR_ENABLED, true),
    taskCalendarEnabled: parseBool(env.GOOGLE_WORKSPACE_TASK_CALENDAR_ENABLED, true)
  }
};
