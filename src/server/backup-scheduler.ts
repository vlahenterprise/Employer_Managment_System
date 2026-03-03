import "server-only";

import { prisma } from "./db";
import { APP_TIMEZONE } from "./app-settings";
import { listBackupFiles, writeBackupZipToDisk } from "./backup";
import fs from "node:fs/promises";

type SchedulerState = {
  started: boolean;
  running: boolean;
  timer: NodeJS.Timeout | null;
};

const GLOBAL_KEY = "__ems_backup_scheduler_state__";

function getState(): SchedulerState {
  const g = globalThis as any;
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { started: false, running: false, timer: null } satisfies SchedulerState;
  }
  return g[GLOBAL_KEY] as SchedulerState;
}

function nowInTz(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date());
  const map: Record<string, string> = {};
  for (const p of parts) {
    if (p.type === "literal") continue;
    map[p.type] = p.value;
  }
  return { dateIso: `${map.year}-${map.month}-${map.day}`, timeHHMM: `${map.hour}:${map.minute}` };
}

function parseTimeHHMM(value: string) {
  const v = String(value || "").trim();
  const m = v.match(/^(\d{2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number.parseInt(m[1], 10);
  const mm = Number.parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function truthy(value: string | null | undefined) {
  const v = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(v);
}

async function pruneOldBackups(folder: string, keepDays: number) {
  const days = Number.isFinite(keepDays) ? Math.max(1, Math.floor(keepDays)) : 30;
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
  const files = await listBackupFiles(folder);
  const toDelete = files.filter((f) => f.mtimeMs < cutoffMs);
  for (const f of toDelete) {
    try {
      await fs.unlink(f.fullPath);
    } catch {
      // ignore
    }
  }
  return { deleted: toDelete.length };
}

async function runBackupIfDue() {
  const state = getState();
  if (state.running) return;
  state.running = true;

  try {
    const keys = ["BackupEnabled", "BackupTime", "BackupKeepDays", "BackupFolder", "BackupLastRunIso"] as const;
    const rows = await prisma.setting.findMany({
      where: { key: { in: [...keys] } },
      select: { key: true, value: true }
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    if (!truthy(map.BackupEnabled)) return;

    const backupTime = parseTimeHHMM(map.BackupTime) || "02:00";
    const keepDays = Number.parseInt(String(map.BackupKeepDays || "30").trim(), 10);
    const folder = String(map.BackupFolder || "backups").trim() || "backups";
    const lastRunIso = String(map.BackupLastRunIso || "").trim();

    const now = nowInTz(APP_TIMEZONE);
    if (now.timeHHMM < backupTime) return;
    if (lastRunIso === now.dateIso) return;

    const res = await writeBackupZipToDisk({ folder });
    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "BackupLastRunIso" },
        create: { key: "BackupLastRunIso", value: now.dateIso },
        update: { value: now.dateIso }
      }),
      prisma.setting.upsert({
        where: { key: "BackupLastRunAt" },
        create: { key: "BackupLastRunAt", value: new Date().toISOString() },
        update: { value: new Date().toISOString() }
      })
    ]);

    await pruneOldBackups(folder, Number.isFinite(keepDays) ? keepDays : 30);

    // eslint-disable-next-line no-console
    console.log(`[backup-scheduler] Backup created: ${res.filename}`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[backup-scheduler] Error:", error);
  } finally {
    state.running = false;
  }
}

export function ensureBackupSchedulerStarted() {
  const state = getState();
  if (state.started) return;

  // Avoid starting in build-time evaluation
  const lifecycle = String(process.env.npm_lifecycle_event || "").trim().toLowerCase();
  if (lifecycle === "build") return;
  if (process.argv.some((a) => String(a || "").toLowerCase() === "build")) return;

  state.started = true;

  // Run once shortly after start, then every minute.
  void runBackupIfDue();
  state.timer = setInterval(() => {
    void runBackupIfDue();
  }, 60 * 1000);
}

export function startBackupScheduler() {
  ensureBackupSchedulerStarted();
}
