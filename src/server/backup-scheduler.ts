import "server-only";

import { prisma } from "./db";
import { APP_TIMEZONE } from "./app-settings";
import { pruneStoredBackups, writeBackupZipToDisk } from "./backup";
import { logError, logInfo } from "./log";
import { nowInTz, parseTimeHHMM, shouldRunScheduledBackup, truthy } from "./backup-scheduler-utils";

export { nowInTz, parseTimeHHMM, shouldRunScheduledBackup, truthy } from "./backup-scheduler-utils";

export async function runBackupIfDue() {
  try {
    const keys = ["BackupEnabled", "BackupTime", "BackupKeepDays", "BackupFolder", "BackupLastRunIso"] as const;
    const rows = await prisma.setting.findMany({
      where: { key: { in: [...keys] } },
      select: { key: true, value: true }
    });
    const map: Record<string, string> = {};
    for (const row of rows) map[row.key] = row.value;

    const now = nowInTz(APP_TIMEZONE);
    const enabled = truthy(map.BackupEnabled);
    const backupTime = parseTimeHHMM(map.BackupTime) || "02:00";
    const folder = String(map.BackupFolder || "backups").trim() || "backups";
    const keepDays = Number.parseInt(String(map.BackupKeepDays || "30").trim(), 10);

    if (!shouldRunScheduledBackup({ enabled, backupTime, lastRunIso: map.BackupLastRunIso, now })) {
      return { ok: true as const, ran: false as const, reason: "NOT_DUE" };
    }

    const runKey = `cron:${now.dateIso}`;
    const result = await writeBackupZipToDisk({ folder, source: "CRON", runKey });
    const nowAt = new Date().toISOString();
    await prisma.$transaction([
      prisma.setting.upsert({
        where: { key: "BackupLastRunIso" },
        create: { key: "BackupLastRunIso", value: now.dateIso },
        update: { value: now.dateIso }
      }),
      prisma.setting.upsert({
        where: { key: "BackupLastRunAt" },
        create: { key: "BackupLastRunAt", value: nowAt },
        update: { value: nowAt }
      })
    ]);

    await pruneStoredBackups({
      folder,
      keepDays: Number.isFinite(keepDays) ? keepDays : 30
    });

    logInfo(result.duplicate ? "backup.cron.duplicate" : "backup.cron.completed", {
      folder,
      filename: result.filename,
      sizeBytes: result.sizeBytes,
      runKey
    });

    return {
      ok: true as const,
      ran: true as const,
      filename: result.filename,
      sizeBytes: result.sizeBytes,
      duplicate: result.duplicate
    };
  } catch (error) {
    logError("backup.cron.failed", error);
    return { ok: false as const, ran: false as const, error: "BACKUP_FAILED" };
  }
}

export function ensureBackupSchedulerStarted() {
  return;
}

export function startBackupScheduler() {
  return;
}
