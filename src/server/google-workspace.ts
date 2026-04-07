import "server-only";

import { config } from "./config";
import { prisma } from "./db";
import { APP_TIMEZONE } from "./app-settings";
import { formatInTimeZone } from "./time";
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
  const response = await googleFetch(GOOGLE_TOKEN_URL, {
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

async function sendGoogleMail(params: { to: string; subject: string; text: string }) {
  if (!config.googleWorkspace.emailEnabled || !isGoogleWorkspaceConfigured()) return { ok: false as const, skipped: true as const };
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false as const, skipped: false as const, error: "NO_ACCESS_TOKEN" };

  const raw = [
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
}) {
  if (!params.to.trim()) return;
  if (!config.googleWorkspace.emailEnabled || !isGoogleWorkspaceConfigured()) return;

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

  const result = await sendGoogleMail({ to: params.to, subject: params.subject, text: params.text });
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

async function upsertCalendarEvent(params: { entityType: string; entityId: string; event: Record<string, unknown> }) {
  if (!isGoogleWorkspaceCalendarConfigured()) return { ok: false as const, skipped: true as const };
  const accessToken = await getAccessToken();
  if (!accessToken) return { ok: false as const, skipped: false as const, error: "NO_ACCESS_TOKEN" };

  const calendarId = config.googleWorkspace.calendarId;
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
  if (!isGoogleWorkspaceCalendarConfigured()) return;
  const calendarId = config.googleWorkspace.calendarId;
  const existing = await prisma.externalCalendarEvent.findUnique({
    where: { entityType_entityId_calendarId: { entityType: params.entityType, entityId: params.entityId, calendarId } },
    select: { googleEventId: true }
  });
  if (!existing?.googleEventId || existing.googleEventId === "pending") return;

  const accessToken = await getAccessToken();
  if (!accessToken) return;

  const response = await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing.googleEventId)}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` } }
  );

  await prisma.externalCalendarEvent.update({
    where: { entityType_entityId_calendarId: { entityType: params.entityType, entityId: params.entityId, calendarId } },
    data: {
      status: response.ok || response.status === 410 || response.status === 404 ? "DELETED" : "FAILED",
      errorMessage: response.ok || response.status === 410 || response.status === 404 ? null : `CALENDAR_DELETE_FAILED:${response.status}`,
      lastSyncedAt: new Date()
    }
  });
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
      transparency: "transparent",
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 24 * 60 }] }
    };

    const result = await upsertCalendarEvent({ entityType: "ABSENCE", entityId: absence.id, event });
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

    const statusLabel = absence.status === "APPROVED" ? "odobren" : absence.status === "REJECTED" ? "odbijen" : "otkazan";
    const subject = `EMS · Zahtev za odsustvo je ${statusLabel}`;
    const text = [
      `Zdravo ${absence.employee.name},`,
      "",
      `Tvoj zahtev za odsustvo je ${statusLabel}.`,
      `Tip: ${absenceTypeLabel(absence.type)}`,
      `Period: ${formatInTimeZone(absence.dateFrom, APP_TIMEZONE, "yyyy-MM-dd")} → ${formatInTimeZone(absence.dateTo, APP_TIMEZONE, "yyyy-MM-dd")}`,
      `Dana: ${absence.days}`,
      absence.approver ? `Obradio/la: ${absence.approver.name}` : "",
      "",
      `${baseUrl()}/absence`
    ]
      .filter(Boolean)
      .join("\n");

    await deliverEmailOnce({
      entityType: "ABSENCE",
      entityId: absence.id,
      dedupeKey: `absence:${absence.id}:decision:${absence.status}`,
      to: absence.employee.email,
      subject,
      text
    });
  } catch (error) {
    logError("google_workspace.absence.email_failed", error, { absenceId });
  }
}

export async function syncTaskDueCalendarEvent(taskId: string) {
  try {
    if (!config.googleWorkspace.taskCalendarEnabled) return;
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
      start: { date: dueIso },
      end: { date: addDaysIso(dueIso, 1) },
      attendees: [{ email: task.assignee.email }, { email: task.delegator.email }],
      reminders: { useDefault: false, overrides: [{ method: "email", minutes: 24 * 60 }, { method: "popup", minutes: 60 }] }
    };

    await upsertCalendarEvent({ entityType: "TASK_DUE", entityId: task.id, event });
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
    const subject = `EMS · Novi task: ${task.title}`;
    const text = [
      `Zdravo ${task.assignee.name},`,
      "",
      `${task.delegator.name} ti je dodelio/la novi task.`,
      `Naziv: ${task.title}`,
      `Prioritet: ${task.priority}`,
      task.dueDate ? `Rok: ${formatInTimeZone(task.dueDate, APP_TIMEZONE, "yyyy-MM-dd")}` : "",
      task.description ? `Opis: ${task.description}` : "",
      "",
      `${baseUrl()}/tasks`
    ]
      .filter(Boolean)
      .join("\n");

    await deliverEmailOnce({
      entityType: "TASK",
      entityId: task.id,
      dedupeKey: `task:${task.id}:created:${task.assignee.email}`,
      to: task.assignee.email,
      subject,
      text
    });
  } catch (error) {
    logError("google_workspace.task.email_failed", error, { taskId });
  }
}

export async function runGoogleWorkspaceDueReminders() {
  if (!config.googleWorkspace.emailEnabled || !isGoogleWorkspaceConfigured()) {
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
    await deliverEmailOnce({
      entityType: "TASK",
      entityId: task.id,
      dedupeKey: `task:${task.id}:due:${dueIso}:${task.assignee.email}`,
      to: task.assignee.email,
      subject,
      text
    });
    sent += 1;
  }

  return { ok: true as const, checked: tasks.length, processed: sent };
}
