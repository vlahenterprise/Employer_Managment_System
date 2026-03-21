"use server";

import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { listBackupFiles, writeBackupZipToDisk } from "@/server/backup";
import { APP_TIMEZONE } from "@/server/app-settings";
import { ORG_STRUCTURE_CACHE_TAG, ORG_USERS_CACHE_TAG, SETTINGS_CACHE_TAG } from "@/server/cache-tags";
import { importLegacyDataset } from "@/server/legacy-import";
import fs from "node:fs/promises";

const roleSchema = z.enum(["ADMIN", "HR", "MANAGER", "USER"]);
const statusSchema = z.enum(["ACTIVE", "INACTIVE"]);

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function redirectError(path: string, message: string): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

function redirectSuccess(path: string, message: string): never {
  redirect(`${path}?success=${encodeURIComponent(message)}`);
}

function revalidateSettingsData() {
  revalidateTag(SETTINGS_CACHE_TAG);
}

function revalidateOrgUsersData() {
  revalidateTag(ORG_USERS_CACHE_TAG);
}

function revalidateOrgStructureData() {
  revalidateTag(ORG_STRUCTURE_CACHE_TAG);
}

const settingKeySchema = z
  .string()
  .trim()
  .min(1, "Key je obavezan")
  .max(120, "Key je predugačak");

const settingValueSchema = z.string().transform((v) => String(v ?? ""));

const activityTypeNameSchema = z.string().trim().min(1, "Naziv je obavezan").max(160, "Naziv je predugačak");

const legacyDatasetSchema = z.enum([
  "REPORTS",
  "TASKS",
  "TASK_EVENTS",
  "REQUESTS",
  "REQUEST_EVENTS",
  "PERF_QUESTIONS",
  "PERF_EVALUATIONS",
  "PERF_GOALS",
  "PERF_SELF",
  "PERF_MANAGER",
  "PERF_PERSONAL",
  "PERF_SUMMARY",
  "PERF_LOG"
]);

export async function createTeamAction(formData: FormData) {
  await requireAdminUser();

  const nameRaw = String(formData.get("name") ?? "");
  const name = nameRaw.trim();
  if (name.length < 2) redirectError("/admin/teams", "Naziv tima je obavezan.");

  try {
    await prisma.team.create({ data: { name } });
  } catch {
    redirectError("/admin/teams", "Tim sa tim nazivom već postoji.");
  }

  revalidatePath("/admin/teams");
  revalidateOrgUsersData();
  redirectSuccess("/admin/teams", "Tim je kreiran.");
}

export async function deleteTeamAction(formData: FormData) {
  await requireAdminUser();

  const teamId = String(formData.get("teamId") ?? "").trim();
  if (!teamId) redirectError("/admin/teams", "Nedostaje teamId.");

  try {
    await prisma.$transaction([
      prisma.user.updateMany({
        where: { teamId },
        data: { teamId: null }
      }),
      prisma.team.delete({ where: { id: teamId } })
    ]);
  } catch {
    redirectError("/admin/teams", "Ne mogu da obrišem tim.");
  }

  revalidatePath("/admin/teams");
  revalidatePath("/admin/users");
  revalidatePath("/admin/activity-types");
  revalidateOrgUsersData();
  redirectSuccess("/admin/teams", "Tim je obrisan.");
}

export async function createUserAction(formData: FormData) {
  await requireAdminUser();

  const emailRaw = String(formData.get("email") ?? "");
  const nameRaw = String(formData.get("name") ?? "");
  const positionRaw = String(formData.get("position") ?? "");
  const roleRaw = String(formData.get("role") ?? "USER");
  const statusRaw = String(formData.get("status") ?? "ACTIVE");
  const carryOverAnnualLeaveRaw = String(formData.get("carryOverAnnualLeave") ?? "0");
  const teamIdRaw = String(formData.get("teamId") ?? "");
  const managerIdRaw = String(formData.get("managerId") ?? "");
  const passwordRaw = String(formData.get("password") ?? "");
  const hrAddon = formData.get("hrAddon") != null;

  const parsedRole = roleSchema.safeParse(roleRaw);
  if (!parsedRole.success) redirectError("/admin/users", "Neispravna uloga (role).");
  const parsedStatus = statusSchema.safeParse(statusRaw);
  if (!parsedStatus.success) redirectError("/admin/users", "Neispravan status.");

  const email = normalizeEmail(emailRaw);
  const name = nameRaw.trim();
  const position = positionRaw.trim() || null;
  const teamId = teamIdRaw.trim() || null;
  const managerId = managerIdRaw.trim() || null;
  const password = passwordRaw.trim() || null;

  const baseSchema = z.object({
    email: z.string().email(),
    name: z.string().min(2),
    carryOverAnnualLeave: z.coerce.number().int().min(0)
  });
  const ok = baseSchema.safeParse({
    email,
    name,
    carryOverAnnualLeave: carryOverAnnualLeaveRaw
  });
  if (!ok.success) redirectError("/admin/users", "Proveri email i ime.");

  const passwordHash = password ? await bcrypt.hash(password, 12) : null;

  try {
    await prisma.user.create({
      data: {
        email,
        name,
        position,
        role: parsedRole.data,
        hrAddon,
        status: parsedStatus.data,
        carryOverAnnualLeave: ok.data.carryOverAnnualLeave,
        teamId,
        managerId,
        passwordHash
      }
    });
  } catch {
    redirectError("/admin/users", "Korisnik sa tim email-om već postoji ili su podaci neispravni.");
  }

  revalidatePath("/admin/users");
  revalidateOrgUsersData();
  revalidateOrgStructureData();
  redirectSuccess("/admin/users", "Korisnik je kreiran.");
}

export async function deleteUserAction(formData: FormData) {
  const currentUser = await requireAdminUser();

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) redirectError("/admin/users", "Nedostaje userId.");
  if (userId === currentUser.id) redirectError("/admin/users", "Ne možeš da obrišeš svog korisnika.");

  try {
    await prisma.user.updateMany({
      where: { managerId: userId },
      data: { managerId: null }
    });
    await prisma.user.delete({ where: { id: userId } });
  } catch {
    redirectError(
      "/admin/users",
      "Ne mogu da obrišem korisnika. Ako ima povezane podatke, preporuka je da ga staviš na INACTIVE."
    );
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/teams");
  revalidateOrgUsersData();
  revalidateOrgStructureData();
  redirectSuccess("/admin/users", "Korisnik je obrisan.");
}

export async function updateUserAction(formData: FormData) {
  await requireAdminUser();

  const userId = String(formData.get("userId") ?? "").trim();
  if (!userId) redirectError("/admin/users", "Nedostaje userId.");

  const nameRaw = String(formData.get("name") ?? "");
  const positionRaw = String(formData.get("position") ?? "");
  const roleRaw = String(formData.get("role") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const carryOverAnnualLeaveRaw = String(formData.get("carryOverAnnualLeave") ?? "0");
  const teamIdRaw = String(formData.get("teamId") ?? "");
  const managerIdRaw = String(formData.get("managerId") ?? "");
  const hrAddon = formData.get("hrAddon") != null;

  const parsedRole = roleSchema.safeParse(roleRaw);
  if (!parsedRole.success) redirectError("/admin/users", "Neispravna uloga (role).");
  const parsedStatus = statusSchema.safeParse(statusRaw);
  if (!parsedStatus.success) redirectError("/admin/users", "Neispravan status.");

  const name = nameRaw.trim();
  if (name.length < 2) redirectError("/admin/users", "Ime mora imati bar 2 karaktera.");
  const position = positionRaw.trim() || null;
  const teamId = teamIdRaw.trim() || null;
  const managerId = managerIdRaw.trim() || null;
  const carryOverAnnualLeaveParsed = z.coerce.number().int().min(0).safeParse(carryOverAnnualLeaveRaw);
  if (!carryOverAnnualLeaveParsed.success) {
    redirectError("/admin/users", "CarryOverAnnualLeave mora biti broj (0 ili više).");
  }

  if (managerId && managerId === userId) {
    redirectError("/admin/users", "Korisnik ne može biti sam sebi manager.");
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        position,
        role: parsedRole.data,
        hrAddon,
        status: parsedStatus.data,
        carryOverAnnualLeave: carryOverAnnualLeaveParsed.data,
        teamId,
        managerId
      }
    });
  } catch {
    redirectError("/admin/users", "Ne mogu da sačuvam izmene (proveri podatke).");
  }

  revalidatePath("/admin/users");
  revalidateOrgUsersData();
  revalidateOrgStructureData();
  redirectSuccess("/admin/users", "Izmene sačuvane.");
}

export async function setUserPasswordAction(formData: FormData) {
  await requireAdminUser();

  const userId = String(formData.get("userId") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!userId) redirectError("/admin/users", "Nedostaje userId.");
  if (password.length < 6) redirectError("/admin/users", "Lozinka mora imati bar 6 karaktera.");

  const passwordHash = await bcrypt.hash(password, 12);

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });
  } catch {
    redirectError("/admin/users", "Ne mogu da postavim lozinku.");
  }

  revalidatePath("/admin/users");
  redirectSuccess("/admin/users", "Lozinka je postavljena.");
}

export async function upsertSettingAction(formData: FormData) {
  await requireAdminUser();

  const keyRaw = String(formData.get("key") ?? "");
  const valueRaw = String(formData.get("value") ?? "");

  const keyParsed = settingKeySchema.safeParse(keyRaw);
  if (!keyParsed.success) redirectError("/admin/settings", keyParsed.error.issues[0]?.message ?? "Neispravan key.");

  const valueParsed = settingValueSchema.safeParse(valueRaw);
  if (!valueParsed.success) redirectError("/admin/settings", "Neispravan value.");

  const key = keyParsed.data;
  const value = valueParsed.data;

  try {
    await prisma.setting.upsert({
      where: { key },
      create: { key, value },
      update: { value }
    });
  } catch {
    redirectError("/admin/settings", "Ne mogu da sačuvam setting.");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidateSettingsData();
  redirectSuccess("/admin/settings", "Setting je sačuvan.");
}

export async function deleteSettingAction(formData: FormData) {
  await requireAdminUser();

  const keyRaw = String(formData.get("key") ?? "");
  const keyParsed = settingKeySchema.safeParse(keyRaw);
  if (!keyParsed.success) redirectError("/admin/settings", "Neispravan key.");

  try {
    await prisma.setting.delete({ where: { key: keyParsed.data } });
  } catch {
    redirectError("/admin/settings", "Ne mogu da obrišem setting (možda ne postoji).");
  }

  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidateSettingsData();
  redirectSuccess("/admin/settings", "Setting je obrisan.");
}

export async function createActivityTypeAction(formData: FormData) {
  await requireAdminUser();

  const teamId = String(formData.get("teamId") ?? "").trim();
  const nameRaw = String(formData.get("name") ?? "");

  if (!teamId) redirectError("/admin/activity-types", "Team je obavezan.");

  const nameParsed = activityTypeNameSchema.safeParse(nameRaw);
  if (!nameParsed.success) {
    redirectError("/admin/activity-types", nameParsed.error.issues[0]?.message ?? "Neispravan naziv.");
  }

  const name = nameParsed.data;

  try {
    await prisma.activityType.create({
      data: {
        teamId,
        name,
        isActive: true
      }
    });
  } catch {
    redirectError("/admin/activity-types", "Activity type već postoji ili su podaci neispravni.");
  }

  revalidatePath("/admin/activity-types");
  redirectSuccess("/admin/activity-types", "Activity type je kreiran.");
}

export async function deleteActivityTypeAction(formData: FormData) {
  await requireAdminUser();

  const activityTypeId = String(formData.get("activityTypeId") ?? "").trim();
  if (!activityTypeId) redirectError("/admin/activity-types", "Nedostaje activityTypeId.");

  try {
    await prisma.activityType.delete({ where: { id: activityTypeId } });
  } catch {
    redirectError("/admin/activity-types", "Ne mogu da obrišem activity type.");
  }

  revalidatePath("/admin/activity-types");
  redirectSuccess("/admin/activity-types", "Activity type je obrisan.");
}

export async function setActivityTypeActiveAction(formData: FormData) {
  await requireAdminUser();

  const activityTypeId = String(formData.get("activityTypeId") ?? "").trim();
  const isActiveRaw = String(formData.get("isActive") ?? "").trim();
  const isActive = ["1", "true", "yes", "y", "on"].includes(isActiveRaw.toLowerCase());

  if (!activityTypeId) redirectError("/admin/activity-types", "Nedostaje activityTypeId.");

  try {
    await prisma.activityType.update({
      where: { id: activityTypeId },
      data: { isActive }
    });
  } catch {
    redirectError("/admin/activity-types", "Ne mogu da ažuriram activity type.");
  }

  revalidatePath("/admin/activity-types");
  redirectSuccess("/admin/activity-types", "Sačuvano.");
}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizeTeamName(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function parseIntOrZero(value: string) {
  const n = Number.parseInt(value.trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

function mapRole(value: string) {
  const v = value.trim().toLowerCase();
  if (v === "admin") return "ADMIN";
  if (v === "manager") return "MANAGER";
  if (v === "hr") return "HR";
  if (v === "user") return "USER";
  return "USER";
}

export async function importSettingsSheetAction(formData: FormData) {
  await requireAdminUser();

  const tsv = String(formData.get("tsv") ?? "");
  const overwritePasswords = Boolean(formData.get("overwritePasswords"));

  if (tsv.trim().length < 10) redirectError("/admin/import", "TSV je prazan ili prekratak.");

  const lines = tsv
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0);

  if (lines.length < 2) redirectError("/admin/import", "Nema dovoljno redova za import.");

  const header = lines[0].split("\t").map((h) => h.trim());
  const rows = lines.slice(1).map((line) => line.split("\t"));

  const headerNormToIndex = new Map<string, number>();
  header.forEach((col, idx) => headerNormToIndex.set(normalizeHeader(col), idx));

  function idxOf(...names: string[]) {
    for (const name of names) {
      const idx = headerNormToIndex.get(normalizeHeader(name));
      if (idx !== undefined) return idx;
    }
    return null;
  }

  const employersIdx = idxOf("Employers", "Employer", "FullName", "Name");
  const teamIdx = idxOf("Team");
  const positionIdx = idxOf("Position");
  const emailIdx = idxOf("Email");
  const passwordIdx = idxOf("Password");
  const roleIdx = idxOf("Role");
  const carryOverIdx = idxOf("CarryOverAnnualLeave");
  const managerEmailIdx = idxOf("ManagerEmail");
  const settingsNameIdx = idxOf("Seetings Name", "Settings Name", "Setting Name", "Key");
  const settingsValueIdx = idxOf("Seetings Value", "Settings Value", "Setting Value", "Value");

  const canImportUsers = emailIdx !== null && teamIdx !== null && employersIdx !== null && roleIdx !== null;
  const canImportSettings = settingsNameIdx !== null && settingsValueIdx !== null;

  const activityTeamColumns = header
    .map((col, idx) => ({ col, idx, norm: normalizeHeader(col) }))
    .filter((h) => {
      if (h.norm === "team") return false;
      if (/^team\\d+$/.test(h.norm)) return false;
      return h.norm.endsWith("team");
    });

  if (!canImportUsers && !canImportSettings && activityTeamColumns.length === 0) {
    redirectError(
      "/admin/import",
      "Ne mogu da prepoznam kolone. Potrebno je bar: Email/Team/Employers/Role ili Seetings Name/Value."
    );
  }

  const userRows = [];
  const allTeamNames = new Set<string>();

  if (canImportUsers) {
    for (const row of rows) {
      const email = (row[emailIdx!] ?? "").trim();
      if (email) {
        const teamName = normalizeTeamName(row[teamIdx!] ?? "");
        if (teamName) allTeamNames.add(teamName);

        userRows.push(row);
      }
    }
  }

  for (const col of activityTeamColumns) {
    const teamName = normalizeTeamName(col.col);
    if (teamName) allTeamNames.add(teamName);
  }

  const teamNames = [...allTeamNames].filter(Boolean);
  const existingTeams = await prisma.team.findMany({
    where: { name: { in: teamNames } },
    select: { id: true, name: true }
  });
  const teamIdByName = new Map(existingTeams.map((t) => [t.name, t.id]));

  let teamsCreated = 0;
  for (const name of teamNames) {
    if (teamIdByName.has(name)) continue;
    try {
      const team = await prisma.team.create({ data: { name }, select: { id: true, name: true } });
      teamIdByName.set(team.name, team.id);
      teamsCreated += 1;
    } catch {
      // ignore race/duplicates
    }
  }

  const usersToImport: Array<{
    email: string;
    name: string;
    position: string | null;
    role: "ADMIN" | "HR" | "MANAGER" | "USER";
    carryOverAnnualLeave: number;
    teamId: string | null;
    managerEmail: string | null;
    password: string | null;
  }> = [];

  const emailSchema = z.string().email();

  if (canImportUsers) {
    for (const row of userRows) {
      const emailRaw = (row[emailIdx!] ?? "").trim();
      const emailParsed = emailSchema.safeParse(normalizeEmail(emailRaw));
      if (!emailParsed.success) continue;

      const nameRaw = (row[employersIdx!] ?? "").trim();
      const positionRaw = positionIdx === null ? "" : String(row[positionIdx] ?? "").trim();
      const roleRaw = String(row[roleIdx!] ?? "").trim();
      const carryOverRaw = carryOverIdx === null ? "0" : String(row[carryOverIdx] ?? "0");
      const teamName = normalizeTeamName(row[teamIdx!] ?? "");
      const managerEmailRaw = managerEmailIdx === null ? "" : String(row[managerEmailIdx] ?? "").trim();
      const passwordRaw = passwordIdx === null ? "" : String(row[passwordIdx] ?? "").trim();

      const teamId = teamName ? (teamIdByName.get(teamName) ?? null) : null;

      usersToImport.push({
        email: emailParsed.data,
        name: nameRaw || emailParsed.data.split("@")[0],
        position: positionRaw || null,
        role: mapRole(roleRaw),
        carryOverAnnualLeave: parseIntOrZero(carryOverRaw),
        teamId,
        managerEmail: managerEmailRaw ? normalizeEmail(managerEmailRaw) : null,
        password: passwordRaw || null
      });
    }
  }

  const existingUsers = await prisma.user.findMany({
    where: { email: { in: usersToImport.map((u) => u.email) } },
    select: { email: true, passwordHash: true }
  });
  const existingUserByEmail = new Map(existingUsers.map((u) => [u.email, u]));

  let usersUpserted = 0;

  for (const user of usersToImport) {
    const existing = existingUserByEmail.get(user.email);
    const shouldSetPassword = Boolean(user.password) && (!existing?.passwordHash || overwritePasswords);
    const passwordHash = shouldSetPassword && user.password ? await bcrypt.hash(user.password, 12) : undefined;

    try {
      await prisma.user.upsert({
        where: { email: user.email },
        create: {
          email: user.email,
          name: user.name,
          position: user.position,
          role: user.role,
          status: "ACTIVE",
          carryOverAnnualLeave: user.carryOverAnnualLeave,
          teamId: user.teamId,
          passwordHash: user.password ? await bcrypt.hash(user.password, 12) : null
        },
        update: {
          name: user.name,
          position: user.position,
          role: user.role,
          status: "ACTIVE",
          carryOverAnnualLeave: user.carryOverAnnualLeave,
          teamId: user.teamId,
          ...(passwordHash ? { passwordHash } : {})
        }
      });
      usersUpserted += 1;
    } catch {
      // keep going, but report at the end if needed
    }
  }

  const allEmailsForManagerLookup = new Set<string>();
  usersToImport.forEach((u) => {
    allEmailsForManagerLookup.add(u.email);
    if (u.managerEmail) allEmailsForManagerLookup.add(u.managerEmail);
  });

  const managerLookup = await prisma.user.findMany({
    where: { email: { in: [...allEmailsForManagerLookup] } },
    select: { id: true, email: true }
  });
  const userIdByEmail = new Map(managerLookup.map((u) => [u.email, u.id]));

  let managersLinked = 0;
  for (const user of usersToImport) {
    if (!user.managerEmail) continue;
    const userId = userIdByEmail.get(user.email);
    const managerId = userIdByEmail.get(user.managerEmail);
    if (!userId || !managerId) continue;
    if (userId === managerId) continue;

    try {
      await prisma.user.update({
        where: { id: userId },
        data: { managerId }
      });
      managersLinked += 1;
    } catch {
      // ignore
    }
  }

  let settingsUpserted = 0;
  if (canImportSettings) {
    for (const row of rows) {
      const key = String(row[settingsNameIdx!] ?? "").trim();
      if (!key) continue;
      const value = String(row[settingsValueIdx!] ?? "").trim();

      try {
        await prisma.setting.upsert({
          where: { key },
          create: { key, value },
          update: { value }
        });
        settingsUpserted += 1;
      } catch {
        // ignore
      }
    }
  }

  let activityTypesUpserted = 0;
  if (activityTeamColumns.length > 0) {
    for (const row of rows) {
      for (const col of activityTeamColumns) {
        const teamName = normalizeTeamName(col.col);
        const teamId = teamIdByName.get(teamName);
        if (!teamId) continue;
        const name = String(row[col.idx] ?? "").trim();
        if (!name) continue;

        try {
          await prisma.activityType.upsert({
            where: { teamId_name: { teamId, name } },
            create: { teamId, name, isActive: true },
            update: { isActive: true }
          });
          activityTypesUpserted += 1;
        } catch {
          // ignore
        }
      }
    }
  }

  revalidatePath("/admin/users");
  revalidatePath("/admin/teams");
  revalidatePath("/admin/activity-types");
  revalidatePath("/admin/settings");
  revalidatePath("/");
  revalidateOrgUsersData();
  revalidateOrgStructureData();
  revalidateSettingsData();

  redirectSuccess(
    "/admin/import",
    `Import OK. Teams created: ${teamsCreated}, users upserted: ${usersUpserted}, managers linked: ${managersLinked}, settings upserted: ${settingsUpserted}, activity types upserted: ${activityTypesUpserted}.`
  );
}

export async function importLegacyTsvAction(formData: FormData) {
  await requireAdminUser();

  const datasetRaw = String(formData.get("dataset") ?? "").trim().toUpperCase();
  const tsv = String(formData.get("tsv") ?? "");
  const overwriteExisting = Boolean(formData.get("overwriteExisting"));

  const datasetParsed = legacyDatasetSchema.safeParse(datasetRaw);
  if (!datasetParsed.success) redirectError("/admin/import", "Nepoznat dataset za legacy import.");
  if (tsv.trim().length < 10) redirectError("/admin/import", "TSV je prazan ili prekratak.");

  const res = await importLegacyDataset({
    dataset: datasetParsed.data,
    tsv,
    overwriteExisting
  });

  revalidatePath("/reports");
  revalidatePath("/reports/manager");
  revalidatePath("/tasks");
  revalidatePath("/absence");
  revalidatePath("/performance");
  revalidatePath("/admin/import");

  const msg = [
    `Legacy import ${res.dataset}: created ${res.created}, updated ${res.updated}, skipped ${res.skipped}, errors ${res.errors}.`,
    ...(res.notes.length ? [`Notes: ${res.notes.join(" | ")}`] : [])
  ].join(" ");

  if (res.errors > 0 && res.created + res.updated === 0) {
    redirectError("/admin/import", msg);
  }
  redirectSuccess("/admin/import", msg);
}

function parseTimeHHMM(value: string) {
  const v = value.trim();
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function todayIsoInTz(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

export async function upsertBackupSettingsAction(formData: FormData) {
  await requireAdminUser();

  const enabledRaw = String(formData.get("enabled") ?? "0").trim();
  const timeRaw = String(formData.get("time") ?? "").trim();
  const keepDaysRaw = String(formData.get("keepDays") ?? "30").trim();
  const folderRaw = String(formData.get("folder") ?? "backups").trim();

  const enabled = ["1", "true", "yes", "y", "on"].includes(enabledRaw.toLowerCase()) ? "1" : "0";
  const time = parseTimeHHMM(timeRaw);
  if (!time) redirectError("/admin/backup", "Neispravno vreme (HH:MM).");

  const keepDays = Number.parseInt(keepDaysRaw, 10);
  if (!Number.isFinite(keepDays) || keepDays < 1 || keepDays > 3650) {
    redirectError("/admin/backup", "Keep days mora biti broj (1–3650).");
  }

  const folder = folderRaw || "backups";

  try {
    await prisma.$transaction([
      prisma.setting.upsert({ where: { key: "BackupEnabled" }, create: { key: "BackupEnabled", value: enabled }, update: { value: enabled } }),
      prisma.setting.upsert({ where: { key: "BackupTime" }, create: { key: "BackupTime", value: time }, update: { value: time } }),
      prisma.setting.upsert({ where: { key: "BackupKeepDays" }, create: { key: "BackupKeepDays", value: String(keepDays) }, update: { value: String(keepDays) } }),
      prisma.setting.upsert({ where: { key: "BackupFolder" }, create: { key: "BackupFolder", value: folder }, update: { value: folder } })
    ]);
  } catch {
    redirectError("/admin/backup", "Ne mogu da sačuvam backup settings.");
  }

  revalidatePath("/admin/backup");
  revalidateSettingsData();
  redirectSuccess("/admin/backup", "Backup settings su sačuvani.");
}

export async function runBackupNowAction() {
  await requireAdminUser();

  const [folderRow, keepDaysRow] = await Promise.all([
    prisma.setting.findUnique({ where: { key: "BackupFolder" }, select: { value: true } }),
    prisma.setting.findUnique({ where: { key: "BackupKeepDays" }, select: { value: true } })
  ]);
  const folder = folderRow?.value?.trim() || "backups";
  const keepDays = Number.parseInt(String(keepDaysRow?.value || "30").trim(), 10);

  try {
    const res = await writeBackupZipToDisk({ folder });
    const nowIso = todayIsoInTz(APP_TIMEZONE);
    const nowAt = new Date().toISOString();
    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "BackupLastRunIso" },
        create: { key: "BackupLastRunIso", value: nowIso },
        update: { value: nowIso }
      }),
      prisma.setting.upsert({
        where: { key: "BackupLastRunAt" },
        create: { key: "BackupLastRunAt", value: nowAt },
        update: { value: nowAt }
      })
    ]);

    // Best-effort cleanup: delete backups older than keepDays.
    if (Number.isFinite(keepDays) && keepDays > 0) {
      try {
        const files = await listBackupFiles(folder);
        const cutoffMs = Date.now() - keepDays * 24 * 60 * 60 * 1000;
        const old = files.filter((f) => f.mtimeMs < cutoffMs);
        await Promise.all(old.map((f) => fs.unlink(f.fullPath).catch(() => null)));
      } catch {
        // ignore cleanup errors
      }
    }
    revalidatePath("/admin/backup");
    revalidateSettingsData();
    redirectSuccess("/admin/backup", `Backup sačuvan: ${res.filename}`);
  } catch {
    redirectError("/admin/backup", "Backup nije uspeo.");
  }
}

const perfQNoSchema = z.coerce.number().int().min(1, "Q_No mora biti >= 1").max(9999, "Q_No je prevelik");
const perfAreaSchema = z.string().trim().min(1, "Area je obavezna").max(120, "Area je predugačka");
const perfDescriptionSchema = z.string().trim().min(1, "Description je obavezan").max(2000, "Description je predugačak");
const perfScaleSchema = z.string().trim().min(1, "Scale je obavezan").max(200, "Scale je predugačak");

export async function createPerformanceQuestionAction(formData: FormData) {
  await requireAdminUser();

  const qNoRaw = String(formData.get("qNo") ?? "");
  const areaRaw = String(formData.get("area") ?? "");
  const descriptionRaw = String(formData.get("description") ?? "");
  const scaleRaw = String(formData.get("scale") ?? "");
  const isActiveRaw = String(formData.get("isActive") ?? "1");

  const qNo = perfQNoSchema.safeParse(qNoRaw);
  if (!qNo.success) redirectError("/admin/performance-questions", qNo.error.issues[0]?.message || "Neispravan Q_No.");
  const area = perfAreaSchema.safeParse(areaRaw);
  if (!area.success) redirectError("/admin/performance-questions", area.error.issues[0]?.message || "Neispravan Area.");
  const description = perfDescriptionSchema.safeParse(descriptionRaw);
  if (!description.success) redirectError("/admin/performance-questions", description.error.issues[0]?.message || "Neispravan Description.");
  const scale = perfScaleSchema.safeParse(scaleRaw);
  if (!scale.success) redirectError("/admin/performance-questions", scale.error.issues[0]?.message || "Neispravan Scale.");

  const isActive = ["1", "true", "yes", "y", "on"].includes(isActiveRaw.trim().toLowerCase());

  try {
    await prisma.performanceQuestion.create({
      data: {
        qNo: qNo.data,
        area: area.data,
        description: description.data,
        scale: scale.data,
        isActive
      }
    });
  } catch {
    redirectError("/admin/performance-questions", "Ne mogu da kreiram pitanje (možda već postoji isti Q_No).");
  }

  revalidatePath("/admin/performance-questions");
  redirectSuccess("/admin/performance-questions", "Pitanje je kreirano.");
}

export async function updatePerformanceQuestionAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectError("/admin/performance-questions", "Nedostaje id.");

  const qNoRaw = String(formData.get("qNo") ?? "");
  const areaRaw = String(formData.get("area") ?? "");
  const descriptionRaw = String(formData.get("description") ?? "");
  const scaleRaw = String(formData.get("scale") ?? "");

  const qNo = perfQNoSchema.safeParse(qNoRaw);
  if (!qNo.success) redirectError("/admin/performance-questions", qNo.error.issues[0]?.message || "Neispravan Q_No.");
  const area = perfAreaSchema.safeParse(areaRaw);
  if (!area.success) redirectError("/admin/performance-questions", area.error.issues[0]?.message || "Neispravan Area.");
  const description = perfDescriptionSchema.safeParse(descriptionRaw);
  if (!description.success) redirectError("/admin/performance-questions", description.error.issues[0]?.message || "Neispravan Description.");
  const scale = perfScaleSchema.safeParse(scaleRaw);
  if (!scale.success) redirectError("/admin/performance-questions", scale.error.issues[0]?.message || "Neispravan Scale.");

  try {
    await prisma.performanceQuestion.update({
      where: { id },
      data: {
        qNo: qNo.data,
        area: area.data,
        description: description.data,
        scale: scale.data
      }
    });
  } catch {
    redirectError("/admin/performance-questions", "Ne mogu da ažuriram pitanje (Q_No mora biti jedinstven).");
  }

  revalidatePath("/admin/performance-questions");
  redirectSuccess("/admin/performance-questions", "Sačuvano.");
}

export async function setPerformanceQuestionActiveAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  const isActiveRaw = String(formData.get("isActive") ?? "").trim();
  if (!id) redirectError("/admin/performance-questions", "Nedostaje id.");
  const isActive = ["1", "true", "yes", "y", "on"].includes(isActiveRaw.toLowerCase());

  try {
    await prisma.performanceQuestion.update({
      where: { id },
      data: { isActive }
    });
  } catch {
    redirectError("/admin/performance-questions", "Ne mogu da ažuriram status.");
  }

  revalidatePath("/admin/performance-questions");
  redirectSuccess("/admin/performance-questions", "Sačuvano.");
}

export async function deletePerformanceQuestionAction(formData: FormData) {
  await requireAdminUser();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirectError("/admin/performance-questions", "Nedostaje id.");

  try {
    await prisma.performanceQuestion.delete({ where: { id } });
  } catch {
    redirectError("/admin/performance-questions", "Ne mogu da obrišem pitanje (možda je već korišćeno u evaluacijama).");
  }

  revalidatePath("/admin/performance-questions");
  redirectSuccess("/admin/performance-questions", "Obrisano.");
}
