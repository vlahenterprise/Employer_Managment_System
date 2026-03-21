export type BackupClock = {
  dateIso: string;
  timeHHMM: string;
};

export function nowInTz(timeZone: string, now = new Date()): BackupClock {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type === "literal") continue;
    map[part.type] = part.value;
  }
  return { dateIso: `${map.year}-${map.month}-${map.day}`, timeHHMM: `${map.hour}:${map.minute}` };
}

export function parseTimeHHMM(value: string) {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hh = Number.parseInt(match[1], 10);
  const mm = Number.parseInt(match[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function truthy(value: string | null | undefined) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return ["1", "true", "yes", "y", "on"].includes(normalized);
}

export function shouldRunScheduledBackup(params: {
  enabled: boolean;
  backupTime: string | null | undefined;
  lastRunIso: string | null | undefined;
  now: BackupClock;
}) {
  if (!params.enabled) return false;
  const backupTime = parseTimeHHMM(params.backupTime || "") || "02:00";
  if (params.now.timeHHMM < backupTime) return false;
  if (String(params.lastRunIso || "").trim() === params.now.dateIso) return false;
  return true;
}
