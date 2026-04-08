import "server-only";

import { z } from "zod";
import type { OrgPositionTier, UserRole } from "@prisma/client";
import { APP_TIMEZONE } from "./app-settings";
import { prisma } from "./db";
import { formatInTimeZone, fromZonedTime } from "./time";
import { hasCompanyCalendarAddon } from "./rbac";
import { booleanish, idSchema, isoDateSchema, optionalTextSchema, requiredTextSchema } from "./validation";
import { sanitizeText } from "./action-utils";

export type CompanyCalendarActor = {
  id: string;
  role: UserRole;
  companyCalendarAddon?: boolean | null;
};

export type CompanyCalendarItem = {
  eventId: string;
  title: string;
  description: string;
  location: string;
  status: "ACTIVE" | "CANCELLED";
  fromIso: string;
  toIso: string;
  startLabel: string;
  endLabel: string;
  allDay: boolean;
  color: string;
  createdBy: { id: string; name: string; email: string } | null;
  participants: Array<{ id: string; name: string; email: string; teamName: string; position: string }>;
  positions: Array<{ id: string; title: string; tier: OrgPositionTier; teamName: string }>;
};

export type CompanyCalendarPickerData = {
  users: Array<{ id: string; name: string; email: string; teamName: string; position: string }>;
  positions: Array<{ id: string; title: string; tier: OrgPositionTier; teamName: string }>;
  teams: Array<{ id: string; name: string; userIds: string[] }>;
};

const eventPayloadSchema = z.object({
  eventId: idSchema.optional(),
  title: requiredTextSchema(180, "TITLE_REQUIRED"),
  description: optionalTextSchema(2000),
  location: optionalTextSchema(240),
  fromIso: isoDateSchema,
  toIso: isoDateSchema,
  startTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "INVALID_TIME").optional().default("09:00"),
  endTime: z.string().trim().regex(/^\d{2}:\d{2}$/, "INVALID_TIME").optional().default("10:00"),
  allDay: z.boolean().default(true),
  color: z.string().trim().max(30).default("orange"),
  userIds: z.array(idSchema).default([]),
  positionIds: z.array(idSchema).default([])
});

function uniqueIds(values: string[]) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeIds(values: FormDataEntryValue[]) {
  return uniqueIds(values.map((value) => String(value)));
}

function toEventDates(input: { fromIso: string; toIso: string; startTime: string; endTime: string; allDay: boolean }) {
  let fromIso = input.fromIso;
  let toIso = input.toIso;
  if (fromIso > toIso) {
    const nextFrom = toIso;
    toIso = fromIso;
    fromIso = nextFrom;
  }

  if (input.allDay) {
    return {
      fromIso,
      toIso,
      startsAt: fromZonedTime(`${fromIso}T00:00:00`, APP_TIMEZONE),
      endsAt: fromZonedTime(`${toIso}T23:59:59.999`, APP_TIMEZONE)
    };
  }

  const startsAt = fromZonedTime(`${fromIso}T${input.startTime}:00`, APP_TIMEZONE);
  const endsAt = fromZonedTime(`${toIso}T${input.endTime}:00`, APP_TIMEZONE);
  if (endsAt.getTime() < startsAt.getTime()) {
    return { fromIso, toIso, startsAt, endsAt: startsAt, invalidRange: true as const };
  }
  return { fromIso, toIso, startsAt, endsAt };
}

export function canManageCompanyCalendar(actor: Pick<CompanyCalendarActor, "role" | "companyCalendarAddon">) {
  return hasCompanyCalendarAddon({ role: actor.role, companyCalendarAddon: Boolean(actor.companyCalendarAddon) });
}

export function parseCompanyCalendarForm(formData: FormData) {
  return eventPayloadSchema.safeParse({
    eventId: String(formData.get("eventId") ?? "").trim() || undefined,
    title: sanitizeText(String(formData.get("title") ?? ""), 180),
    description: sanitizeText(String(formData.get("description") ?? ""), 2000),
    location: sanitizeText(String(formData.get("location") ?? ""), 240),
    fromIso: String(formData.get("fromIso") ?? ""),
    toIso: String(formData.get("toIso") ?? ""),
    startTime: String(formData.get("startTime") ?? "09:00"),
    endTime: String(formData.get("endTime") ?? "10:00"),
    allDay: booleanish(formData.get("allDay")),
    color: String(formData.get("color") ?? "orange").trim() || "orange",
    userIds: normalizeIds(formData.getAll("userIds")),
    positionIds: normalizeIds(formData.getAll("positionIds"))
  });
}

async function filterExistingIds(params: { userIds: string[]; positionIds: string[] }) {
  const [users, positions] = await Promise.all([
    params.userIds.length
      ? prisma.user.findMany({ where: { id: { in: params.userIds }, status: "ACTIVE" }, select: { id: true } })
      : Promise.resolve([]),
    params.positionIds.length
      ? prisma.orgPosition.findMany({ where: { id: { in: params.positionIds }, isActive: true }, select: { id: true } })
      : Promise.resolve([])
  ]);
  return {
    userIds: users.map((user) => user.id),
    positionIds: positions.map((position) => position.id)
  };
}

export async function getCompanyCalendar(params: { range: { fromIso: string; toIso: string } }) {
  const fromIsoParsed = isoDateSchema.safeParse(params.range.fromIso);
  const toIsoParsed = isoDateSchema.safeParse(params.range.toIso);
  if (!fromIsoParsed.success || !toIsoParsed.success) return { ok: false as const, error: "INVALID_DATE", items: [] as CompanyCalendarItem[] };

  let fromIso = fromIsoParsed.data;
  let toIso = toIsoParsed.data;
  if (fromIso > toIso) {
    const nextFrom = toIso;
    toIso = fromIso;
    fromIso = nextFrom;
  }

  const fromDt = fromZonedTime(`${fromIso}T00:00:00`, APP_TIMEZONE);
  const toDt = fromZonedTime(`${toIso}T23:59:59.999`, APP_TIMEZONE);

  const rows = await prisma.companyEvent.findMany({
    where: {
      status: "ACTIVE",
      startsAt: { lte: toDt },
      endsAt: { gte: fromDt }
    },
    orderBy: [{ startsAt: "asc" }, { title: "asc" }],
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      status: true,
      startsAt: true,
      endsAt: true,
      allDay: true,
      color: true,
      createdBy: { select: { id: true, name: true, email: true } },
      participants: {
        orderBy: { user: { name: "asc" } },
        select: {
          user: { select: { id: true, name: true, email: true, position: true, team: { select: { name: true } } } }
        }
      },
      positions: {
        orderBy: { position: { order: "asc" } },
        select: {
          position: { select: { id: true, title: true, tier: true, team: { select: { name: true } } } }
        }
      }
    }
  });

  const items = rows.map((row) => ({
    eventId: row.id,
    title: row.title,
    description: row.description ?? "",
    location: row.location ?? "",
    status: row.status,
    fromIso: formatInTimeZone(row.startsAt, APP_TIMEZONE, "yyyy-MM-dd"),
    toIso: formatInTimeZone(row.endsAt, APP_TIMEZONE, "yyyy-MM-dd"),
    startLabel: formatInTimeZone(row.startsAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm"),
    endLabel: formatInTimeZone(row.endsAt, APP_TIMEZONE, "yyyy-MM-dd HH:mm"),
    allDay: row.allDay,
    color: row.color ?? "orange",
    createdBy: row.createdBy,
    participants: row.participants.map(({ user }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      position: user.position ?? "",
      teamName: user.team?.name ?? ""
    })),
    positions: row.positions.map(({ position }) => ({
      id: position.id,
      title: position.title,
      tier: position.tier,
      teamName: position.team?.name ?? ""
    }))
  }));

  return { ok: true as const, items };
}

export async function getCompanyCalendarPickerData(): Promise<CompanyCalendarPickerData> {
  const [users, positions, teams] = await Promise.all([
    prisma.user.findMany({
      where: { status: "ACTIVE" },
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true, position: true, team: { select: { name: true } } }
    }),
    prisma.orgPosition.findMany({
      where: { isActive: true, kind: "POSITION" },
      orderBy: [{ tier: "asc" }, { order: "asc" }, { title: "asc" }],
      select: { id: true, title: true, tier: true, team: { select: { name: true } } }
    }),
    prisma.team.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, users: { where: { status: "ACTIVE" }, select: { id: true } } }
    })
  ]);

  return {
    users: users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      position: user.position ?? "",
      teamName: user.team?.name ?? ""
    })),
    positions: positions.map((position) => ({
      id: position.id,
      title: position.title,
      tier: position.tier,
      teamName: position.team?.name ?? ""
    })),
    teams: teams.map((team) => ({
      id: team.id,
      name: team.name,
      userIds: team.users.map((u) => u.id)
    }))
  };
}

export async function createCompanyEvent(params: {
  actor: CompanyCalendarActor;
  payload: z.infer<typeof eventPayloadSchema>;
}) {
  if (!canManageCompanyCalendar(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const dates = toEventDates(params.payload);
  if ("invalidRange" in dates) return { ok: false as const, error: "INVALID_RANGE" };
  const ids = await filterExistingIds({ userIds: params.payload.userIds, positionIds: params.payload.positionIds });

  const event = await prisma.companyEvent.create({
    data: {
      title: params.payload.title,
      description: params.payload.description,
      location: params.payload.location,
      startsAt: dates.startsAt,
      endsAt: dates.endsAt,
      allDay: params.payload.allDay,
      color: params.payload.color,
      createdById: params.actor.id,
      participants: ids.userIds.length ? { createMany: { data: ids.userIds.map((userId) => ({ userId })), skipDuplicates: true } } : undefined,
      positions: ids.positionIds.length ? { createMany: { data: ids.positionIds.map((positionId) => ({ positionId })), skipDuplicates: true } } : undefined
    },
    select: { id: true }
  });

  return { ok: true as const, eventId: event.id };
}

export async function updateCompanyEvent(params: {
  actor: CompanyCalendarActor;
  payload: z.infer<typeof eventPayloadSchema> & { eventId: string };
}) {
  if (!canManageCompanyCalendar(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const dates = toEventDates(params.payload);
  if ("invalidRange" in dates) return { ok: false as const, error: "INVALID_RANGE" };
  const ids = await filterExistingIds({ userIds: params.payload.userIds, positionIds: params.payload.positionIds });

  await prisma.$transaction(async (tx) => {
    await tx.companyEvent.update({
      where: { id: params.payload.eventId },
      data: {
        title: params.payload.title,
        description: params.payload.description,
        location: params.payload.location,
        startsAt: dates.startsAt,
        endsAt: dates.endsAt,
        allDay: params.payload.allDay,
        color: params.payload.color,
        status: "ACTIVE"
      }
    });
    await tx.companyEventParticipant.deleteMany({ where: { eventId: params.payload.eventId } });
    await tx.companyEventPosition.deleteMany({ where: { eventId: params.payload.eventId } });
    if (ids.userIds.length) {
      await tx.companyEventParticipant.createMany({
        data: ids.userIds.map((userId) => ({ eventId: params.payload.eventId, userId })),
        skipDuplicates: true
      });
    }
    if (ids.positionIds.length) {
      await tx.companyEventPosition.createMany({
        data: ids.positionIds.map((positionId) => ({ eventId: params.payload.eventId, positionId })),
        skipDuplicates: true
      });
    }
  });

  return { ok: true as const };
}

export async function deleteCompanyEvent(params: { actor: CompanyCalendarActor; eventId: string }) {
  if (!canManageCompanyCalendar(params.actor)) return { ok: false as const, error: "NO_ACCESS" };
  const eventIdParsed = idSchema.safeParse(params.eventId);
  if (!eventIdParsed.success) return { ok: false as const, error: "INVALID_EVENT" };

  await prisma.companyEvent.update({
    where: { id: eventIdParsed.data },
    data: { status: "CANCELLED" }
  });

  return { ok: true as const };
}
