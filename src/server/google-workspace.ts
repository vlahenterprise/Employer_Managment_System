import "server-only";

import { config } from "./config";
import { prisma } from "./db";
import { APP_TIMEZONE } from "./app-settings";
import { getAllSettingsMap } from "./settings";
import { formatInTimeZone, fromZonedTime } from "./time";
import { logError, logInfo, logWarn } from "./log";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";
const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const GOOGLE_REQUEST_TIMEOUT_MS = 7000;

export function isGoogleWorkspaceOAuthConfigured() {
  return Boolean(config.googleWorkspace.clientId && config.googleWorkspace.clientSecret);
}

export function isGoogleWorkspaceConfigured() {
  return Boolean(
    config.googleWorkspace.clientId &&
      config.googleWorkspace.clientSecret &&
      config.googleWorkspace.refreshToken &&
      config.googleWorkspace.botEmail
  );
}

export function isGoogleWorkspaceCalendarConfigured() {
  return Boolean(isGoogleWorkspaceConfigured() && config.googleWorkspace.calendarId && config.googleWorkspace.calendarEnabled);
}

export function buildGoogleWorkspaceAuthUrl(params: { redirectUri: string; state: string }) {
  if (!isGoogleWorkspaceOAuthConfigured()) return null;
  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", config.googleWorkspace.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", `${CALENDAR_SCOPE} ${GMAIL_SCOPE}`);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", params.state);
  return url.toString();
}

async function googleFetch(input: string, init?: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GOOGLE_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...(init ?? {}), signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// Retry sa exponential backoff za transijentne Google API greške
async function googleFetchWithRetry(
  input: string,
  init?: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await googleFetch(input, init);
      // Ne retry-uj 4xx greške (klijentske greške) - samo 429 i 5xx
      if (res.ok || (res.status >= 400 && res.status < 500 && res.status !== 429)) {
        return res;
      }
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxRetries - 1) {
      // Exponential backoff: 500ms, 1000ms, 2000ms
      const delayMs = 500 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export async function exchangeGoogleWorkspaceCode(params: { code: string; redirectUri: string }) {
  if (!isGoogleWorkspaceOAuthConfigured()) {
    return { ok: false as const, error: "GOOGLE_WORKSPACE_OAUTH_NOT_CONFIGURED" };
  }

  const response = await googleFetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: config.googleWorkspace.clientId,
      client_secret: config.googleWorkspace.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code"
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logWarn("google_workspace.oauth.exchange_failed", { status: response.status, body: body.slice(0, 300) });
    return { ok: false as const, error: "GOOGLE_WORKSPACE_OAUTH_EXCHANGE_FAILED" };
  }

  const data = (await response.json()) as { refresh_token?: string; scope?: string; expires_in?: number };
  return { ok: true as const, refreshToken: data.refresh_token || "", scope: data.scope || "", expiresIn: data.expires_in || 0 };
}

async function getAccessToken() {
  if (!isGoogleWorkspaceConfigured()) return null;
  const response = await googleFetchWithRetry(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.googleWorkspace.clientId,
      client_secret: config.googleWorkspace.clientSecret,
      refresh_token: config.googleWorkspace.refreshToken,
      grant_type: "refresh_token"
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    logWarn("google_workspace.token.refresh_failed", { status: response.status, body: body.slice(0, 300) });
    return null;
  }

  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  return data.access_token || null;
}

function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function baseUrl() {
  return config.auth.url || "https://employer.dashboard.vlahenterpriseapp.com";
}

function absenceTypeLabel(type: string) {
  if (type === "ANNUAL_LEAVE") return "Godišnji odmor";
  if (type === "HOME_OFFICE") return "Rad od kuće";
  if (type === "SLAVA") return "Slava";
  if (type === "SICK") return "Bolovanje";
  return "Odsustvo";
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function mimeSubject(subject: string) {
  return `=?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`;
}

function clampMessage(value: string, maxLength: number) {
  const trimmed = String(value || "").trim();
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1)}…` : trimmed;
}

type GoogleWorkspaceRuntimeSettings = {
  appTitle: string;
  appSubtitle: string;
  accentColor: string;
  backgroundColor: string;
  panelColor: string;
  textColor: string;
  mutedTextColor: string;
  okColor: string;
  dangerColor: string;
  taskFooter: string;
  absenceFooter: string;
  calendarId: string;
  emailEnabled: boolean;
  calendarEnabled: boolean;
  taskCalendarEnabled: boolean;
  taskCreatedEmailEnabled: boolean;
  taskDecisionEmailEnabled: boolean;
  absenceDecisionEmailEnabled: boolean;
  dueReminderEmailEnabled: boolean;
  taskReminderTime: string;
  taskReminderDurationMinutes: number;
  taskReminderBusy: boolean;
  absenceBlocksCalendar: boolean;
  taskColorId: string;
  absenceColorIds: Record<string, string>;
};

function parseBoolSetting(value: string | undefined, fallback: boolean) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return fallback;
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

function parseIntSetting(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(String(value ?? "").trim(), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseTimeSetting(value: string | undefined, fallback: string) {
  const trimmed = String(value ?? "").trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return fallback;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return fallback;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function parseColorIdSetting(value: string | undefined, fallback: string) {
  return String(parseIntSetting(value, Number(fallback), 1, 11));
}

function safeHexColor(value: string | undefined, fallback: string) {
  const trimmed = String(value ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : fallback;
}

async function getGoogleWorkspaceSettings(): Promise<GoogleWorkspaceRuntimeSettings> {
  const map = await getAllSettingsMap();

  return {
    appTitle: map.AppTitle?.trim() || "Employer Management System",
    appSubtitle: map.AppSubtitle?.trim() || "Internal operations platform",
    accentColor: safeHexColor(map.SecondaryColor, "#F05123"),
    backgroundColor: safeHexColor(map.Dark1, "#0B0B0B"),
    panelColor: safeHexColor(map.Dark2, "#161616"),
    textColor: safeHexColor(map.MainFontColor, "#E4EEF0"),
    mutedTextColor: safeHexColor(map.SecondaryFontColor, "#A0A7A8"),
    okColor: safeHexColor(map.OkColor, "#1E8E6A"),
    dangerColor: safeHexColor(map.DangerColor, "#C62828"),
    taskFooter: map.EmailFooterTask?.trim() || "Ovo je automatska EMS notifikacija za zadatke.",
    absenceFooter: map.EmailFooterLeave?.trim() || "Ovo je automatska EMS notifikacija za odsustva.",
    calendarId: map.GoogleWorkspaceCalendarId?.trim() || config.googleWorkspace.calendarId,
    emailEnabled: config.googleWorkspace.emailEnabled && parseBoolSetting(map.GoogleWorkspaceEmailEnabled, true),
    calendarEnabled: config.googleWorkspace.calendarEnabled && parseBoolSetting(map.GoogleWorkspaceCalendarEnabled, true),
    taskCalendarEnabled:
      config.googleWorkspace.taskCalendarEnabled && parseBoolSetting(map.GoogleWorkspaceTaskCalendarEnabled, true),
    taskCreatedEmailEnabled: parseBoolSetting(map.GoogleWorkspaceTaskCreatedEmailEnabled, true),
    taskDecisionEmailEnabled: parseBoolSetting(map.GoogleWorkspaceTaskDecisionEmailEnabled, true),
    absenceDecisionEmailEnabled: parseBoolSetting(map.GoogleWorkspaceAbsenceDecisionEmailEnabled, true),
    dueReminderEmailEnabled: parseBoolSetting(map.GoogleWorkspaceDueReminderEmailEnabled, true),
    taskReminderTime: parseTimeSetting(map.GoogleWorkspaceTaskReminderTime, "09:00"),
    taskReminderDurationMinutes: parseIntSetting(map.GoogleWorkspaceTaskReminderDurationMinutes, 15, 5, 240),
    taskReminderBusy: parseBoolSetting(map.GoogleWorkspaceTaskReminderBusy, false),
    absenceBlocksCalendar: parseBoolSetting(map.GoogleWorkspaceAbsenceBlocksCalendar, true),
    taskColorId: parseColorIdSetting(map.GoogleWorkspaceTaskColorId, "6"),
    absenceColorIds: {
      ANNUAL_LEAVE: parseColorIdSetting(map.GoogleWorkspaceAbsenceAnnualLeaveColorId, "2"),
      HOME_OFFICE: parseColorIdSetting(map.GoogleWorkspaceAbsenceHomeOfficeColorId, "9"),
      SLAVA: parseColorIdSetting(map.GoogleWorkspaceAbsenceSlavaColorId, "5"),
      SICK: parseColorIdSetting(map.GoogleWorkspaceAbsenceSickColorId, "11"),
      OTHER: parseColorIdSetting(map.GoogleWorkspaceAbsenceOtherColorId, "8")
    }
  };
}

function htmlEscape(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderEmailRows(rows: Array<{ label: string; value: string | number | null | undefined }>, borderColor: string) {
  return rows
    .filter((row) => String(row.value ?? "").trim().length > 0)
    .map(
      (row) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${borderColor};color:#a0a7a8;font-size:12px;text-transform:uppercase;letter-spacing:.08em;">${htmlEscape(row.label)}</td>
          <td style="padding:10px 0;border-bottom:1px solid ${borderColor};color:#e4eef0;font-size:14px;text-align:right;font-weight:700;">${htmlEscape(row.value)}</td>
        </tr>`
    )
    .join("");
}

function renderBrandedEmail(params: {
  settings: GoogleWorkspaceRuntimeSettings;
  tone: "task" | "reminder" | "absence-ok" | "absence-danger";
  eyebrow: string;
  title: string;
  intro: string;
  rows: Array<{ label: string; value: string | number | null | undefined }>;
  ctaLabel: string;
  ctaHref: string;
  footer: string;
}) {
  const accent =
    params.tone === "absence-ok"
      ? params.settings.okColor
      : params.tone === "absence-danger"
        ? params.settings.dangerColor
        : params.tone === "reminder"
          ? "#FFB703"
          : params.settings.accentColor;
  const borderColor = "rgba(228,238,240,.14)";
  const rows = renderEmailRows(params.rows, borderColor);

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:${params.settings.backgroundColor};font-family:Inter,Arial,sans-serif;color:${params.settings.textColor};">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${params.settings.backgroundColor};padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:${params.settings.panelColor};border:1px solid ${borderColor};border-radius:24px;overflow:hidden;box-shadow:0 24px 70px rgba(0,0,0,.35);">
            <tr>
              <td style="padding:28px 30px 20px;border-bottom:1px solid ${borderColor};background:linear-gradient(135deg,rgba(240,81,35,.20),rgba(255,255,255,.03));">
                <div style="font-size:11px;font-weight:800;letter-spacing:.16em;text-transform:uppercase;color:${accent};">${htmlEscape(params.eyebrow)}</div>
                <h1 style="margin:10px 0 6px;color:${params.settings.textColor};font-size:28px;line-height:1.15;">${htmlEscape(params.title)}</h1>
                <p style="margin:0;color:${params.settings.mutedTextColor};font-size:14px;line-height:1.65;">${htmlEscape(params.intro)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 30px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">${rows}</table>
                <div style="padding-top:24px;">
                  <a href="${htmlEscape(params.ctaHref)}" style="display:inline-block;background:${accent};color:#111111;text-decoration:none;font-weight:900;border-radius:999px;padding:13px 20px;font-size:14px;">${htmlEscape(params.ctaLabel)}</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 30px 26px;border-top:1px solid ${borderColor};color:${params.settings.mutedTextColor};font-size:12px;line-height:1.6;">
                <strong style="color:${params.settings.textColor};">${htmlEscape(params.settings.appTitle)}</strong><br/>
                ${htmlEscape(params.footer)}<br/>
                ${htmlEscape(params.settings.appSubtitle)}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function taskReminderWindow(dueIso: string, settings: GoogleWorkspaceRuntimeSettings) {
  const start = fromZonedTime(`${dueIso}T${settings.taskReminderTime}:00`, APP_TIMEZONE);
  const end = new Date(start.getTime() + settings.taskReminderDurationMinutes * 60 * 1000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

async function sendGoogleMail(params: { to: string; subject: string; text: string; html?: string }) {
  if (!config.googleWorkspace.emailEnabled || !isGoogleWorkspaceConfigured()) return { ok: false as const, skipped: true as const };
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false as const, skipped: false as const, error: "NO_ACCESS_TOKEN" };

  const boundary = `ems_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const raw = params.html
    ? [
        `From: EMS <${config.googleWorkspace.botEmail}>`,
        `To: ${params.to}`,
        `Subject: ${mimeSubject(params.subject)}`,
        "MIME-Version: 1.0",
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        "",
        `--${boundary}`,
        'Content-Type: text/plain; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        params.text,
        `--${boundary}`,
        'Content-Type: text/html; charset="UTF-8"',
        "Content-Transfer-Encoding: 8bit",
        "",
        params.html,
        `--${boundary}--`
      ].join("\r\n")
    : [
        `From: EMS <${config.googleWorkspace.botEmail}>`,
        `To: ${params.to}`,
        `Subject: ${mimeSubject(params.subject)}`,
        "MIME-Version: 1.0",
        'Content-Type: text/plain; charset="UTF-8"',
        "",
        params.text
      ].join("\r\n");

  const response = await googleFetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: encodeBase64Url(raw) })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return { ok: false as const, skipped: false as const, error: `GMAIL_SEND_FAILED:${response.status}:${body.slice(0, 200)}` };
  }

  const data = (await response.json()) as { id?: string };
  return { ok: true as const, messageId: data.id || "" };
}

async function deliverEmailOnce(params: {
  entityType: string;
  entityId: string;
  dedupeKey: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  settings?: GoogleWorkspaceRuntimeSettings;
}) {
  if (!params.to.trim()) return;
  const settings = params.settings ?? (await getGoogleWorkspaceSettings());
  if (!settings.emailEnabled || !isGoogleWorkspaceConfigured()) return;

  const existing = await prisma.notificationDelivery.findUnique({
    where: { dedupeKey: params.dedupeKey },
    select: { id: true, status: true }
  });
  if (existing?.status === "SENT") return;

  await prisma.notificationDelivery.upsert({
    where: { dedupeKey: params.dedupeKey },
    create: {
      channel: "EMAIL",
      entityType: params.entityType,
      entityId: params.entityId,
      recipientEmail: params.to,
      subject: params.subject,
      status: "PENDING",
      dedupeKey: params.dedupeKey
    },
    update: {
      recipientEmail: params.to,
      subject: params.subject,
      status: "PENDING",
      errorMessage: null,
      failedAt: null
    }
  });

  const result = await sendGoogleMail({ to: params.to, subject: params.subject, text: params.text, html: params.html });
  if (result.ok) {
    await prisma.notificationDelivery.update({
      where: { dedupeKey: params.dedupeKey },
      data: { status: "SENT", sentAt: new Date(), providerMessageId: result.messageId || null, errorMessage: null }
    });
    return;
  }

  if (result.skipped) return;

  await prisma.notificationDelivery.update({
    where: { dedupeKey: params.dedupeKey },
    data: { status: "FAILED", failedAt: new Date(), errorMessage: clampMessage(result.error || "EMAIL_FAILED", 900) }
  });
}

export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  resetUrl: string;
  tokenId: string;
  expiresMinutes: number;
}) {
  const settings = await getGoogleWorkspaceSettings();
  if (!settings.emailEnabled || !isGoogleWorkspaceConfigured()) return;

  const subject = "EMS · Reset lozinke";
  const text = [
    `Zdravo ${params.name},`,
    "",
    "Zatražen je reset lozinke za tvoj EMS nalog.",
    `Link važi ${params.expiresMinutes} minuta i može da se iskoristi samo jednom.`,
    "",
    params.resetUrl,
    "",
    "Ako ti nisi tražio/la reset lozinke, ignoriši ovaj email."
  ].join("\n");
  const html = renderBrandedEmail({
    settings,
    tone: "reminder",
    eyebrow: "Bezbednost naloga",
    title: "Reset lozinke",
    intro: `Zdravo ${params.name}, zatražen je reset lozinke za tvoj EMS nalog.`,
    rows: [
      { label: "Važi", value: `${params.expiresMinutes} minuta` },
      { label: "Sigurnost", value: "Link je jednokratan" }
    ],
    ctaLabel: "Promeni lozinku",
    ctaHref: params.resetUrl,
    footer: "Ako ti nisi tražio/la reset lozinke, ignoriši ovaj email."
  });

  await deliverEmailOnce({
    entityType: "PASSWORD_RESET",
    entityId: params.tokenId,
    dedupeKey: `password-reset:${params.tokenId}:${params.to}`,
    to: params.to,
    subject,
    text,
    html,
    settings
  });
}

function userManagerLabel(manager: { name: string; email: string } | null | undefined) {
  return manager ? `${manager.name} <${manager.email}>` : "Nije postavljen";
}

function userTeamLabel(team: { name: string } | null | undefined) {
  return team?.name || "Nije postavljen";
}

function userPositionLabel(position: string | null | undefined) {
  return position || "Nije postavljena";
}

async function loadUserAccountEmailData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      position: true,
      employmentDate: true,
      jobDescriptionUrl: true,
      workInstructionsUrl: true,
      team: { select: { name: true } },
      manager: { select: { name: true, email: true } }
    }
  });
}

export async function notifyUserCreated(params: { userId: string; initialPassword?: string | null }) {
  try {
    const user = await loadUserAccountEmailData(params.userId);
    if (!user) return;

    const settings = await getGoogleWorkspaceSettings();
    if (!settings.emailEnabled || !isGoogleWorkspaceConfigured()) return;

    const passwordLabel = params.initialPassword?.trim()
      ? params.initialPassword.trim()
      : "Lozinka nije postavljena. Na login strani klikni „Zaboravili ste lozinku?” da podežiš lozinku.";
    const loginUrl = `${baseUrl()}/login`;
    const subject = "EMS · Kreiran je tvoj korisnički nalog";
    const employmentDate = user.employmentDate ? formatInTimeZone(user.employmentDate, APP_TIMEZONE, "yyyy-MM-dd") : "";
    const text = [
      `Zdravo ${user.name},`,
      "",
      "Kreiran je tvoj korisnički nalog u EMS aplikaciji.",
      `Korisničko ime: ${user.email}`,
      `Lozinka: ${passwordLabel}`,
      `Rola: ${user.role}`,
      `Status: ${user.status}`,
      `Tim: ${userTeamLabel(user.team)}`,
      `Pozicija: ${userPositionLabel(user.position)}`,
      `Nadređeni: ${userManagerLabel(user.manager)}`,
      employmentDate ? `Datum zaposlenja: ${employmentDate}` : "",
      user.jobDescriptionUrl ? `Opis posla: ${user.jobDescriptionUrl}` : "",
      user.workInstructionsUrl ? `Radne instrukcije: ${user.workInstructionsUrl}` : "",
      "",
      "Preporuka: nakon prvog logina promeni lozinku u My Profile → Bezbednost naloga.",
      "",
      loginUrl
    ]
      .filter(Boolean)
      .join("\n");
    const html = renderBrandedEmail({
      settings,
      tone: "task",
      eyebrow: "Novi nalog",
      title: "Kreiran je tvoj EMS nalog",
      intro: `Zdravo ${user.name}, tvoj korisnički nalog je spreman za korišćenje.`,
      rows: [
        { label: "Korisničko ime", value: user.email },
        { label: "Lozinka", value: passwordLabel },
        { label: "Rola", value: user.role },
        { label: "Status", value: user.status },
        { label: "Tim", value: userTeamLabel(user.team) },
        { label: "Pozicija", value: userPositionLabel(user.position) },
        { label: "Nadređeni", value: userManagerLabel(user.manager) },
        { label: "Datum zaposlenja", value: employmentDate },
        { label: "Opis posla", value: user.jobDescriptionUrl || "" },
        { label: "Radne instrukcije", value: user.workInstructionsUrl || "" }
      ],
      ctaLabel: "Otvori EMS",
      ctaHref: loginUrl,
      footer: "Ovo je automatska EMS notifikacija za korisnički nalog."
    });

    await deliverEmailOnce({
      entityType: "USER",
      entityId: user.id,
      dedupeKey: `user:${user.id}:created:${user.email}`,
      to: user.email,
      subject,
      text,
      html,
      settings
    });
  } catch (error) {
    logError("google_workspace.user.created_email_failed", error, { userId: params.userId });
  }
}

export async function notifyUserPasswordSet(params: { userId: string; password: string }) {
  try {
    const user = await loadUserAccountEmailData(params.userId);
    if (!user) return;

    const settings = await getGoogleWorkspaceSettings();
    if (!settings.emailEnabled || !isGoogleWorkspaceConfigured()) return;

    const loginUrl = `${baseUrl()}/login`;
    const subject = "EMS · Lozinka je postavljena";
    const text = [
      `Zdravo ${user.name},`,
      "",
      "Administrator je postavio ili promenio lozinku za tvoj EMS nalog.",
      `Korisničko ime: ${user.email}`,
      `Lozinka: ${params.password}`,
      "",
      "Preporuka: nakon logina promeni lozinku u My Profile → Bezbednost naloga.",
      "",
      loginUrl
    ].join("\n");
    const html = renderBrandedEmail({
      settings,
      tone: "reminder",
      eyebrow: "Bezbednost naloga",
      title: "Lozinka je postavljena",
      intro: `Zdravo ${user.name}, administrator je postavio ili promenio lozinku za tvoj EMS nalog.`,
      rows: [
        { label: "Korisničko ime", value: user.email },
        { label: "Lozinka", value: params.password }
      ],
      ctaLabel: "Otvori EMS",
      ctaHref: loginUrl,
      footer: "Ovo je automatska EMS notifikacija za korisnički nalog."
    });

    await deliverEmailOnce({
      entityType: "USER",
      entityId: user.id,
      dedupeKey: `user:${user.id}:password-set:${Date.now()}:${user.email}`,
      to: user.email,
      subject,
      text,
      html,
      settings
    });
  } catch (error) {
    logError("google_workspace.user.password_email_failed", error, { userId: params.userId });
  }
}

export async function notifyUserOrganizationChanged(params: {
  userId: string;
  previous: {
    position?: string | null;
    teamName?: string | null;
    managerName?: string | null;
    managerEmail?: string | null;
  };
}) {
  try {
    const user = await loadUserAccountEmailData(params.userId);
    if (!user) return;

    const settings = await getGoogleWorkspaceSettings();
    if (!settings.emailEnabled || !isGoogleWorkspaceConfigured()) return;

    const newManager = userManagerLabel(user.manager);
    const previousManager = params.previous.managerName
      ? `${params.previous.managerName}${params.previous.managerEmail ? ` <${params.previous.managerEmail}>` : ""}`
      : "Nije postavljen";
    const profileUrl = `${baseUrl()}/profile`;
    const subject = "EMS · Ažurirana je tvoja organizaciona pozicija";
    const text = [
      `Zdravo ${user.name},`,
      "",
      "Ažurirana je tvoja organizaciona pozicija u EMS aplikaciji.",
      `Nova pozicija: ${userPositionLabel(user.position)}`,
      `Novi tim: ${userTeamLabel(user.team)}`,
      `Novi nadređeni: ${newManager}`,
      "",
      `Prethodna pozicija: ${userPositionLabel(params.previous.position)}`,
      `Prethodni tim: ${params.previous.teamName || "Nije postavljen"}`,
      `Prethodni nadređeni: ${previousManager}`,
      "",
      profileUrl
    ].join("\n");
    const html = renderBrandedEmail({
      settings,
      tone: "task",
      eyebrow: "Organizaciona promena",
      title: "Ažurirana je tvoja pozicija",
      intro: `Zdravo ${user.name}, tvoj tim, pozicija ili direktni nadređeni su ažurirani u EMS sistemu.`,
      rows: [
        { label: "Nova pozicija", value: userPositionLabel(user.position) },
        { label: "Novi tim", value: userTeamLabel(user.team) },
        { label: "Novi nadređeni", value: newManager },
        { label: "Prethodna pozicija", value: userPositionLabel(params.previous.position) },
        { label: "Prethodni tim", value: params.previous.teamName || "Nije postavljen" },
        { label: "Prethodni nadređeni", value: previousManager }
      ],
      ctaLabel: "Otvori profil",
      ctaHref: profileUrl,
      footer: "Ovo je automatska EMS notifikacija za organizacione promene."
    });

    await deliverEmailOnce({
      entityType: "USER",
      entityId: user.id,
      dedupeKey: `user:${user.id}:org-change:${Date.now()}:${user.email}`,
      to: user.email,
      subject,
      text,
      html,
      settings
    });
  } catch (error) {
    logError("google_workspace.user.org_change_email_failed", error, { userId: params.userId });
  }
}

async function upsertCalendarEvent(params: {
  entityType: string;
  entityId: string;
  event: Record<string, unknown>;
  settings?: GoogleWorkspaceRuntimeSettings;
}) {
  const settings = params.settings ?? (await getGoogleWorkspaceSettings());
  if (!settings.calendarEnabled || !settings.calendarId || !isGoogleWorkspaceConfigured()) {
    return { ok: false as const, skipped: true as const };
  }
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false as const, skipped: false as const, error: "NO_ACCESS_TOKEN" };

  const calendarId = settings.calendarId;
  const existing = await prisma.externalCalendarEvent.findUnique({
    where: { entityType_entityId_calendarId: { entityType: params.entityType, entityId: params.entityId, calendarId } },
    select: { googleEventId: true }
  });
  const encodedCalendarId = encodeURIComponent(calendarId);
  const existingGoogleEventId = existing?.googleEventId && existing.googleEventId !== "pending" ? existing.googleEventId : "";
  const method = existingGoogleEventId ? "PATCH" : "POST";
  const url = existingGoogleEventId
    ? `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events/${encodeURIComponent(existingGoogleEventId)}?sendUpdates=all`
    : `https://www.googleapis.com/calendar/v3/calendars/${encodedCalendarId}/events?sendUpdates=all`;

  const response = await googleFetch(url, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(params.event)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const error = `CALENDAR_UPSERT_FAILED:${response.status}:${body.slice(0, 200)}`;
    await prisma.externalCalendarEvent.upsert({
      where: { entityType_entityId_calendarId: { entityType: params.entityType, entityId: params.entityId, calendarId } },
      create: {
        entityType: params.entityType,
        entityId: params.entityId,
        calendarId,
        googleEventId: existingGoogleEventId || "pending",
        status: "FAILED",
        errorMessage: clampMessage(error, 900)
      },
      update: { status: "FAILED", errorMessage: clampMessage(error, 900), lastSyncedAt: new Date() }
    });
    return { ok: false as const, skipped: false as const, error };
  }

  const data = (await response.json()) as { id?: string };
  const googleEventId = data.id || existingGoogleEventId || "";
  if (!googleEventId) return { ok: false as const, skipped: false as const, error: "MISSING_GOOGLE_EVENT_ID" };

  await prisma.externalCalendarEvent.upsert({
    where: { entityType_entityId_calendarId: { entityType: params.entityType, entityId: params.entityId, calendarId } },
    create: {
      entityType: params.entityType,
      entityId: params.entityId,
      calendarId,
      googleEventId,
      status: "ACTIVE",
      errorMessage: null
    },
    update: { googleEventId, status: "ACTIVE", errorMessage: null, lastSyncedAt: new Date() }
  });

  return { ok: true as const, googleEventId };
}

async function deleteCalendarEvent(params: { entityType: string; entityId: string }) {
  const settings = await getGoogleWorkspaceSettings();
  if (!settings.calendarEnabled || !isGoogleWorkspaceConfigured()) return;
  const existingEvents = await prisma.externalCalendarEvent.findMany({
    where: { entityType: params.entityType, entityId: params.entityId, status: { not: "DELETED" } },
    select: { calendarId: true, googleEventId: true }
  });
  const deletableEvents = existingEvents.filter((event) => event.googleEventId && event.googleEventId !== "pending");
  if (!deletableEvents.length) return;

  const accessToken = await getAccessToken();
  if (!accessToken) return;

  for (const event of deletableEvents) {
    const response = await googleFetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(event.calendarId)}/events/${encodeURIComponent(event.googleEventId)}?sendUpdates=all`,
      { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
    );

    await prisma.externalCalendarEvent.update({
      where: { entityType_entityId_calendarId: { entityType: params.entityType, entityId: params.entityId, calendarId: event.calendarId } },
      data: {
        status: response.ok || response.status === 410 || response.status === 404 ? "DELETED" : "FAILED",
        errorMessage: response.ok || response.status === 410 || response.status === 404 ? null : `CALENDAR_DELETE_FAILED:${response.status}`,
        lastSyncedAt: new Date()
      }
    });
  }
}

export async function syncAbsenceWithGoogleWorkspace(absenceId: string) {
  try {
    const absence = await prisma.absence.findUnique({
      where: { id: absenceId },
      select: {
        id: true,
        type: true,
        status: true,
        dateFrom: true,
        dateTo: true,
        days: true,
        comment: true,
        employee: { select: { name: true, email: true, team: { select: { name: true } } } },
        approver: { select: { name: true, email: true } }
      }
    });
    if (!absence) return;
    const settings = await getGoogleWorkspaceSettings();

    if (absence.status !== "APPROVED") {
      await deleteCalendarEvent({ entityType: "ABSENCE", entityId: absence.id });
      return;
    }

    const startIso = formatInTimeZone(absence.dateFrom, APP_TIMEZONE, "yyyy-MM-dd");
    const endIso = addDaysIso(formatInTimeZone(absence.dateTo, APP_TIMEZONE, "yyyy-MM-dd"), 1);
    const label = absenceTypeLabel(absence.type);
    const event = {
      summary: `${absence.employee.name} · ${label}`,
      description: [
        `EMS odsustvo`,
        `Zaposleni: ${absence.employee.name} <${absence.employee.email}>`,
        `Tim: ${absence.employee.team?.name || "—"}`,
        `Tip: ${label}`,
        `Dana: ${absence.days}`,
        absence.approver ? `Odobrio/la: ${absence.approver.name} <${absence.approver.email}>` : "",
        absence.comment ? `Komentar: ${absence.comment}` : "",
        `${baseUrl()}/absence`
      ]
        .filter(Boolean)
        .join("\n"),
      start: { date: startIso },
      end: { date: endIso },
      transparency: settings.absenceBlocksCalendar ? "opaque" : "transparent",
      colorId: settings.absenceColorIds[absence.type] || settings.absenceColorIds.OTHER,
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 24 * 60 }] }
    };

    const result = await upsertCalendarEvent({ entityType: "ABSENCE", entityId: absence.id, event, settings });
    if (result.ok) logInfo("google_workspace.absence.synced", { absenceId: absence.id, googleEventId: result.googleEventId });
  } catch (error) {
    logError("google_workspace.absence.sync_failed", error, { absenceId });
  }
}

export async function notifyAbsenceDecision(absenceId: string) {
  try {
    const absence = await prisma.absence.findUnique({
      where: { id: absenceId },
      select: {
        id: true,
        status: true,
        type: true,
        dateFrom: true,
        dateTo: true,
        days: true,
        employee: { select: { name: true, email: true } },
        approver: { select: { name: true, email: true } }
      }
    });
    if (!absence || (absence.status !== "APPROVED" && absence.status !== "REJECTED" && absence.status !== "CANCELLED")) return;
    const settings = await getGoogleWorkspaceSettings();
    if (!settings.absenceDecisionEmailEnabled) return;

    const statusLabel = absence.status === "APPROVED" ? "odobren" : absence.status === "REJECTED" ? "odbijen" : "otkazan";
    const subject = `EMS · Zahtev za odsustvo je ${statusLabel}`;
    const period = `${formatInTimeZone(absence.dateFrom, APP_TIMEZONE, "yyyy-MM-dd")} → ${formatInTimeZone(absence.dateTo, APP_TIMEZONE, "yyyy-MM-dd")}`;
    const text = [
      `Zdravo ${absence.employee.name},`,
      "",
      `Tvoj zahtev za odsustvo je ${statusLabel}.`,
      `Tip: ${absenceTypeLabel(absence.type)}`,
      `Period: ${period}`,
      `Dana: ${absence.days}`,
      absence.approver ? `Obradio/la: ${absence.approver.name}` : "",
      "",
      `${baseUrl()}/absence`
    ]
      .filter(Boolean)
      .join("\n");
    const html = renderBrandedEmail({
      settings,
      tone: absence.status === "APPROVED" ? "absence-ok" : "absence-danger",
      eyebrow: "Odsustvo",
      title: `Zahtev za odsustvo je ${statusLabel}`,
      intro: `Zdravo ${absence.employee.name}, status tvog zahteva je ažuriran u EMS sistemu.`,
      rows: [
        { label: "Tip", value: absenceTypeLabel(absence.type) },
        { label: "Period", value: period },
        { label: "Dana", value: absence.days },
        { label: "Obradio/la", value: absence.approver?.name || "" }
      ],
      ctaLabel: "Otvori odsustva",
      ctaHref: `${baseUrl()}/absence`,
      footer: settings.absenceFooter
    });

    await deliverEmailOnce({
      entityType: "ABSENCE",
      entityId: absence.id,
      dedupeKey: `absence:${absence.id}:decision:${absence.status}`,
      to: absence.employee.email,
      subject,
      text,
      html,
      settings
    });
  } catch (error) {
    logError("google_workspace.absence.email_failed", error, { absenceId });
  }
}

export async function notifyTaskSubmittedForApproval(taskId: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        priority: true,
        dueDate: true,
        employeeComment: true,
        assignee: { select: { name: true, email: true } },
        delegator: { select: { name: true, email: true } }
      }
    });
    if (!task) return;
    const settings = await getGoogleWorkspaceSettings();
    if (!settings.emailEnabled || !isGoogleWorkspaceConfigured()) return;
    if (!settings.taskDecisionEmailEnabled) return;

    const dueIso = task.dueDate ? formatInTimeZone(task.dueDate, APP_TIMEZONE, "yyyy-MM-dd") : "—";
    const priorityLabel = ({ LOW: "Nisko", MED: "Srednje", HIGH: "Visoko", CRIT: "Kritično" } as Record<string, string>)[task.priority] || task.priority;
    const taskUrl = `${baseUrl()}/tasks`;
    const subject = `EMS · Zadatak čeka odobrenje: ${task.title}`;

    const text = [
      `Zdravo,`,
      "",
      `Zaposleni ${task.assignee.name} je podneo/la zadatak na odobrenje.`,
      `Zadatak: ${task.title}`,
      `Prioritet: ${priorityLabel}`,
      `Rok: ${dueIso}`,
      task.employeeComment ? `Komentar: ${task.employeeComment}` : "",
      "",
      `Molimo da pregledate i odobrite ili vratite zadatak u EMS aplikaciji.`,
      "",
      taskUrl
    ].filter(Boolean).join("\n");

    const html = renderBrandedEmail({
      settings,
      tone: "task",
      eyebrow: "Odobrenje zadatka",
      title: `Zadatak čeka odobrenje`,
      intro: `${task.assignee.name} je podneo/la zadatak na odobrenje u EMS sistemu.`,
      rows: [
        { label: "Zadatak", value: task.title },
        { label: "Prioritet", value: priorityLabel },
        { label: "Rok", value: dueIso },
        { label: "Komentar", value: task.employeeComment || "" }
      ],
      ctaLabel: "Otvori zadatke",
      ctaHref: taskUrl,
      footer: settings.taskFooter
    });

    await deliverEmailOnce({
      entityType: "TASK",
      entityId: task.id,
      dedupeKey: `task:${task.id}:submitted_for_approval`,
      to: task.delegator.email,
      subject,
      text,
      html,
      settings
    });
  } catch (error) {
    logError("google_workspace.task.submitted_for_approval_email_failed", error, { taskId });
  }
}

export async function notifyAbsenceSubmitted(absenceId: string) {
  try {
    const absence = await prisma.absence.findUnique({
      where: { id: absenceId },
      select: {
        id: true,
        type: true,
        dateFrom: true,
        dateTo: true,
        days: true,
        comment: true,
        employee: {
          select: {
            name: true,
            email: true,
            manager: { select: { name: true, email: true } }
          }
        }
      }
    });
    if (!absence || !absence.employee.manager?.email) return;
    const settings = await getGoogleWorkspaceSettings();
    if (!settings.emailEnabled || !isGoogleWorkspaceConfigured()) return;
    if (!settings.absenceDecisionEmailEnabled) return;

    const period = `${formatInTimeZone(absence.dateFrom, APP_TIMEZONE, "yyyy-MM-dd")} → ${formatInTimeZone(absence.dateTo, APP_TIMEZONE, "yyyy-MM-dd")}`;
    const typeLabel = absenceTypeLabel(absence.type);
    const absenceUrl = `${baseUrl()}/absence`;
    const subject = `EMS · Zahtev za odsustvo na odobrenju: ${absence.employee.name}`;

    const text = [
      `Zdravo ${absence.employee.manager.name},`,
      "",
      `${absence.employee.name} je podneo/la zahtev za odsustvo.`,
      `Tip: ${typeLabel}`,
      `Period: ${period}`,
      `Dana: ${absence.days}`,
      absence.comment ? `Komentar: ${absence.comment}` : "",
      "",
      `Molimo da pregledate i odlučite u EMS aplikaciji.`,
      "",
      absenceUrl
    ].filter(Boolean).join("\n");

    const html = renderBrandedEmail({
      settings,
      tone: "absence-ok",
      eyebrow: "Zahtev za odsustvo",
      title: `Zahtev za odsustvo na odobrenju`,
      intro: `${absence.employee.name} je podneo/la zahtev za odsustvo koji čeka vašu odluku.`,
      rows: [
        { label: "Zaposleni", value: absence.employee.name },
        { label: "Tip", value: typeLabel },
        { label: "Period", value: period },
        { label: "Dana", value: absence.days },
        { label: "Komentar", value: absence.comment || "" }
      ],
      ctaLabel: "Otvori odsustva",
      ctaHref: absenceUrl,
      footer: settings.absenceFooter
    });

    await deliverEmailOnce({
      entityType: "ABSENCE",
      entityId: absence.id,
      dedupeKey: `absence:${absence.id}:submitted`,
      to: absence.employee.manager.email,
      subject,
      text,
      html,
      settings
    });
  } catch (error) {
    logError("google_workspace.absence.submitted_email_failed", error, { absenceId });
  }
}

export async function notifyCompanyEventParticipants(eventId: string, isUpdate = false) {
  try {
    const event = await prisma.companyEvent.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        startsAt: true,
        endsAt: true,
        allDay: true,
        description: true,
        location: true,
        createdBy: { select: { name: true, email: true } },
        participants: {
          select: { user: { select: { name: true, email: true } } }
        }
      }
    });
    if (!event || event.participants.length === 0) return;

    const settings = await getGoogleWorkspaceSettings();
    if (!settings.emailEnabled || !isGoogleWorkspaceConfigured()) return;

    const startLabel = event.allDay
      ? formatInTimeZone(event.startsAt, APP_TIMEZONE, "yyyy-MM-dd")
      : formatInTimeZone(event.startsAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm");
    const endLabel = event.allDay
      ? formatInTimeZone(event.endsAt, APP_TIMEZONE, "yyyy-MM-dd")
      : formatInTimeZone(event.endsAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm");

    const subject = isUpdate
      ? `EMS · Kompanijski događaj izmenjen: ${event.title}`
      : `EMS · Poziv na kompanijski događaj: ${event.title}`;
    const calUrl = `${baseUrl()}/company-calendar`;

    for (const { user } of event.participants) {
      const text = [
        `Zdravo ${user.name},`,
        "",
        isUpdate
          ? `Kompanijski događaj "${event.title}" je izmenjen.`
          : `Pozvan/a si na kompanijski događaj: "${event.title}"`,
        `Početak: ${startLabel}`,
        `Kraj: ${endLabel}`,
        event.location ? `Lokacija: ${event.location}` : "",
        event.description ? `Opis: ${event.description}` : "",
        event.createdBy ? `Organizator: ${event.createdBy.name}` : "",
        "",
        calUrl
      ].filter(Boolean).join("\n");

      const html = renderBrandedEmail({
        settings,
        tone: "task",
        eyebrow: "Kompanijski kalendar",
        title: isUpdate ? `Događaj izmenjen: ${event.title}` : `Poziv: ${event.title}`,
        intro: isUpdate
          ? `Zdravo ${user.name}, detalji kompanijskog događaja su promenjeni.`
          : `Zdravo ${user.name}, pozvan/a si na kompanijski događaj.`,
        rows: [
          { label: "Događaj", value: event.title },
          { label: "Početak", value: startLabel },
          { label: "Kraj", value: endLabel },
          { label: "Lokacija", value: event.location || "" },
          { label: "Organizator", value: event.createdBy?.name || "" },
        ],
        ctaLabel: "Otvori kalendar",
        ctaHref: calUrl,
        footer: "Ovo je automatska EMS notifikacija za kompanijski kalendar."
      });

      await deliverEmailOnce({
        entityType: "COMPANY_EVENT" as any,
        entityId: event.id,
        dedupeKey: `company-event:${event.id}:participant:${user.email}:${isUpdate ? "update" : "create"}`,
        to: user.email,
        subject,
        text,
        html,
        settings
      });
    }
  } catch (error) {
    logError("google_workspace.company_event.notify_failed", error, { eventId });
  }
}

export async function syncTaskDueCalendarEvent(taskId: string) {
  try {
    const settings = await getGoogleWorkspaceSettings();
    if (!settings.taskCalendarEnabled) return;
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        dueDate: true,
        priority: true,
        assignee: { select: { name: true, email: true } },
        delegator: { select: { name: true, email: true } }
      }
    });
    if (!task || !task.dueDate) return;
    if (task.status === "APPROVED" || task.status === "CANCELLED") {
      await deleteCalendarEvent({ entityType: "TASK_DUE", entityId: task.id });
      return;
    }

    const dueIso = formatInTimeZone(task.dueDate, APP_TIMEZONE, "yyyy-MM-dd");
    const reminderWindow = taskReminderWindow(dueIso, settings);
    const event = {
      summary: `Task due · ${task.title}`,
      description: [
        "EMS task deadline",
        `Zadužen/a: ${task.assignee.name} <${task.assignee.email}>`,
        `Dodelio/la: ${task.delegator.name} <${task.delegator.email}>`,
        `Prioritet: ${task.priority}`,
        task.description ? `Opis: ${task.description}` : "",
        `${baseUrl()}/tasks`
      ]
        .filter(Boolean)
        .join("\n"),
      start: { dateTime: reminderWindow.startIso, timeZone: APP_TIMEZONE },
      end: { dateTime: reminderWindow.endIso, timeZone: APP_TIMEZONE },
      transparency: settings.taskReminderBusy ? "opaque" : "transparent",
      colorId: settings.taskColorId,
      attendees: [{ email: task.assignee.email }, { email: task.delegator.email }],
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 24 * 60 }, { method: "popup", minutes: 60 }] }
    };

    await upsertCalendarEvent({ entityType: "TASK_DUE", entityId: task.id, event, settings });
  } catch (error) {
    logError("google_workspace.task.calendar_failed", error, { taskId });
  }
}

export async function notifyTaskCreated(taskId: string) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        assignee: { select: { name: true, email: true } },
        delegator: { select: { name: true, email: true } }
      }
    });
    if (!task) return;
    const settings = await getGoogleWorkspaceSettings();
    if (!settings.taskCreatedEmailEnabled) return;
    const subject = `EMS · Novi task: ${task.title}`;
    const dueLabel = task.dueDate ? formatInTimeZone(task.dueDate, APP_TIMEZONE, "yyyy-MM-dd") : "";
    const text = [
      `Zdravo ${task.assignee.name},`,
      "",
      `${task.delegator.name} ti je dodelio/la novi task.`,
      `Naziv: ${task.title}`,
      `Prioritet: ${task.priority}`,
      dueLabel ? `Rok: ${dueLabel}` : "",
      task.description ? `Opis: ${task.description}` : "",
      "",
      `${baseUrl()}/tasks`
    ]
      .filter(Boolean)
      .join("\n");
    const html = renderBrandedEmail({
      settings,
      tone: "task",
      eyebrow: "Novi task",
      title: task.title,
      intro: `${task.delegator.name} ti je dodelio/la novi task u EMS sistemu.`,
      rows: [
        { label: "Zadužen/a", value: task.assignee.name },
        { label: "Dodelio/la", value: task.delegator.name },
        { label: "Prioritet", value: task.priority },
        { label: "Rok", value: dueLabel || "—" },
        { label: "Opis", value: task.description || "" }
      ],
      ctaLabel: "Otvori taskove",
      ctaHref: `${baseUrl()}/tasks`,
      footer: settings.taskFooter
    });

    await deliverEmailOnce({
      entityType: "TASK",
      entityId: task.id,
      dedupeKey: `task:${task.id}:created:${task.assignee.email}`,
      to: task.assignee.email,
      subject,
      text,
      html,
      settings
    });
  } catch (error) {
    logError("google_workspace.task.email_failed", error, { taskId });
  }
}

export async function notifyTaskDecision(params: {
  taskId: string;
  decision: "APPROVED" | "RETURNED" | "CANCELLED";
  actorName: string;
  actorEmail: string;
  comment?: string | null;
}) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: params.taskId },
      select: {
        id: true,
        title: true,
        dueDate: true,
        priority: true,
        assignee: { select: { name: true, email: true } }
      }
    });
    if (!task) return;

    const settings = await getGoogleWorkspaceSettings();
    if (!settings.taskDecisionEmailEnabled) return;

    const decisionLabel =
      params.decision === "APPROVED" ? "odobren" : params.decision === "RETURNED" ? "vraćen na doradu" : "otkazan";
    const decisionTitle =
      params.decision === "APPROVED" ? "Task je odobren" : params.decision === "RETURNED" ? "Task je vraćen" : "Task je otkazan";
    const dueLabel = task.dueDate ? formatInTimeZone(task.dueDate, APP_TIMEZONE, "yyyy-MM-dd") : "";
    const managerComment = String(params.comment || "").trim();
    const actorDisplay = params.actorEmail ? `${params.actorName} <${params.actorEmail}>` : params.actorName;
    const subject = `EMS · ${decisionTitle}: ${task.title}`;
    const text = [
      `Zdravo ${task.assignee.name},`,
      "",
      `${decisionTitle}.`,
      `Naziv: ${task.title}`,
      `Status: ${decisionLabel}`,
      `Prioritet: ${task.priority}`,
      dueLabel ? `Rok: ${dueLabel}` : "",
      `Obradio/la: ${actorDisplay}`,
      managerComment ? `Komentar menadžera: ${managerComment}` : "",
      "",
      `${baseUrl()}/tasks`
    ]
      .filter(Boolean)
      .join("\n");
    const html = renderBrandedEmail({
      settings,
      tone: params.decision === "APPROVED" ? "absence-ok" : "absence-danger",
      eyebrow: "Task odluka",
      title: `${decisionTitle}: ${task.title}`,
      intro: `Zdravo ${task.assignee.name}, status taska je ažuriran u EMS sistemu.`,
      rows: [
        { label: "Status", value: decisionLabel },
        { label: "Zadužen/a", value: task.assignee.name },
        { label: "Obradio/la", value: actorDisplay },
        { label: "Prioritet", value: task.priority },
        { label: "Rok", value: dueLabel || "—" },
        { label: "Komentar menadžera", value: managerComment }
      ],
      ctaLabel: "Otvori taskove",
      ctaHref: `${baseUrl()}/tasks`,
      footer: settings.taskFooter
    });

    await deliverEmailOnce({
      entityType: "TASK",
      entityId: task.id,
      dedupeKey: `task:${task.id}:decision:${params.decision}:${task.assignee.email}`,
      to: task.assignee.email,
      subject,
      text,
      html,
      settings
    });
  } catch (error) {
    logError("google_workspace.task.decision_email_failed", error, { taskId: params.taskId, decision: params.decision });
  }
}

export async function runGoogleWorkspaceDueReminders() {
  const settings = await getGoogleWorkspaceSettings();
  if (!settings.emailEnabled || !settings.dueReminderEmailEnabled || !isGoogleWorkspaceConfigured()) {
    return { ok: true as const, checked: 0, processed: 0, skipped: "NOT_CONFIGURED" as const };
  }

  const now = new Date();
  const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: now, lte: next24h },
      status: { in: ["OPEN", "IN_PROGRESS", "FOR_APPROVAL", "RETURNED"] }
    },
    orderBy: [{ dueDate: "asc" }],
    take: 200,
    select: {
      id: true,
      title: true,
      dueDate: true,
      priority: true,
      assignee: { select: { name: true, email: true } },
      delegator: { select: { name: true, email: true } }
    }
  });

  let sent = 0;
  for (const task of tasks) {
    if (!task.dueDate) continue;
    const dueIso = formatInTimeZone(task.dueDate, APP_TIMEZONE, "yyyy-MM-dd");
    const subject = `EMS podsetnik · Task rok: ${task.title}`;
    const text = [
      `Zdravo ${task.assignee.name},`,
      "",
      `Podsetnik: task ima rok ${dueIso}.`,
      `Naziv: ${task.title}`,
      `Prioritet: ${task.priority}`,
      `Dodelio/la: ${task.delegator.name}`,
      "",
      `${baseUrl()}/tasks`
    ].join("\n");
    const html = renderBrandedEmail({
      settings,
      tone: "reminder",
      eyebrow: "Podsetnik",
      title: `Task rok: ${task.title}`,
      intro: `Ovo je EMS podsetnik da task ima rok ${dueIso}.`,
      rows: [
        { label: "Zadužen/a", value: task.assignee.name },
        { label: "Dodelio/la", value: task.delegator.name },
        { label: "Prioritet", value: task.priority },
        { label: "Rok", value: dueIso }
      ],
      ctaLabel: "Otvori taskove",
      ctaHref: `${baseUrl()}/tasks`,
      footer: settings.taskFooter
    });
    await deliverEmailOnce({
      entityType: "TASK",
      entityId: task.id,
      dedupeKey: `task:${task.id}:due:${dueIso}:${task.assignee.email}`,
      to: task.assignee.email,
      subject,
      text,
      html,
      settings
    });
    sent += 1;
  }

  return { ok: true as const, checked: tasks.length, processed: sent };
}
