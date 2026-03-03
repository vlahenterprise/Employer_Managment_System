import { startBackupScheduler } from "@/server/backup-scheduler";

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  startBackupScheduler();
}

