import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdminUser } from "@/server/current-user";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { listBackupFiles } from "@/server/backup";
import { APP_TIMEZONE } from "@/server/app-settings";
import { runBackupNowAction, upsertBackupSettingsAction } from "../actions";
import { IconArrowLeft, IconBolt, IconDownload } from "@/components/icons";

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

export default async function AdminBackupPage({
  searchParams
}: {
  searchParams: { success?: string; error?: string };
}) {
  await requireAdminUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  const keys = ["BackupEnabled", "BackupTime", "BackupKeepDays", "BackupFolder", "BackupLastRunIso", "BackupLastRunAt"] as const;
  const rows = await prisma.setting.findMany({
    where: { key: { in: [...keys] } },
    select: { key: true, value: true }
  });
  const map: Record<string, string> = {};
  for (const row of rows) map[row.key] = row.value;

  const enabled = map.BackupEnabled === "1" || map.BackupEnabled?.toLowerCase() === "true";
  const backupTime = map.BackupTime?.trim() || "02:00";
  const keepDays = Number.parseInt(map.BackupKeepDays?.trim() || "30", 10);
  const folder = map.BackupFolder?.trim() || "backups";
  const lastRunIso = map.BackupLastRunIso?.trim() || "";
  const lastRunAt = map.BackupLastRunAt?.trim() || "";
  const lastRunAtLabel = (() => {
    if (!lastRunAt) return "";
    const d = new Date(lastRunAt);
    if (Number.isNaN(d.getTime())) return lastRunAt;
    return d.toLocaleString(lang === "sr" ? "sr-RS" : "en-GB");
  })();

  const now = nowInTz(APP_TIMEZONE);
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const tomorrowIso = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(tomorrow);
  const nextRunIso = now.timeHHMM < backupTime ? now.dateIso : tomorrowIso;

  const files = await listBackupFiles(folder);

  return (
    <main className="page">
      <div className="card stack">
        <div className="header">
          <div>
            <h1>{t.admin.title}</h1>
            <p className="muted">{t.admin.backup.subtitle}</p>
          </div>
          <div className="inline">
            <Link className="button button-secondary" href="/dashboard">
              <IconArrowLeft size={18} /> {t.common.backToDashboard}
            </Link>
          </div>
        </div>

        <div className="tabs">
          <Link className="tab" href="/admin/users">
            {t.admin.tabs.users}
          </Link>
          <Link className="tab" href="/admin/teams">
            {t.admin.tabs.teams}
          </Link>
          <Link className="tab" href="/admin/org-structure">
            {t.admin.tabs.org}
          </Link>
          <Link className="tab" href="/admin/activity-types">
            {t.admin.tabs.activityTypes}
          </Link>
          <Link className="tab" href="/admin/settings">
            {t.admin.tabs.settings}
          </Link>
          <Link className="tab" href="/admin/performance-questions">
            {t.admin.tabs.performanceQuestions}
          </Link>
          <Link className="tab" href="/admin/import">
            {t.admin.tabs.import}
          </Link>
          <Link className="tab tab-active" href="/admin/backup">
            {t.admin.tabs.backup}
          </Link>
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="panel stack">
          <h2 className="h2">{t.admin.backup.schedule}</h2>
          <form className="grid3" action={upsertBackupSettingsAction}>
            <label className="field">
              <span className="label">{t.admin.backup.enabled}</span>
              <select className="input" name="enabled" defaultValue={enabled ? "1" : "0"}>
                <option value="1">{t.common.yes}</option>
                <option value="0">{t.common.no}</option>
              </select>
            </label>

            <label className="field">
              <span className="label">{t.admin.backup.time}</span>
              <input className="input" name="time" type="time" defaultValue={backupTime} required />
            </label>

            <label className="field">
              <span className="label">{t.admin.backup.keepDays}</span>
              <input className="input" name="keepDays" type="number" min={1} defaultValue={Number.isFinite(keepDays) ? keepDays : 30} />
            </label>

            <label className="field" style={{ gridColumn: "1 / -1" }}>
              <span className="label">{t.admin.backup.folder}</span>
              <input className="input" name="folder" type="text" defaultValue={folder} />
            </label>

            <div className="field field-actions">
              <span className="label"> </span>
              <button className="button" type="submit">
                {t.admin.backup.saveSchedule}
              </button>
            </div>
          </form>
          <div className="muted small">{t.admin.backup.note(APP_TIMEZONE)}</div>
          <div className="muted small">
            {t.admin.backup.lastRun}: {lastRunIso ? `${lastRunIso}${lastRunAtLabel ? ` (${lastRunAtLabel})` : ""}` : t.admin.backup.never}
          </div>
          <div className="muted small">
            {t.admin.backup.nextRun}: {enabled ? `${nextRunIso} ${backupTime}` : t.common.no}
          </div>
        </section>

        <section className="panel stack">
          <h2 className="h2">{t.admin.tabs.backup}</h2>
          <div className="inline">
            <a className="button" href="/api/admin/backup/download">
              <IconDownload size={18} /> {t.admin.backup.downloadNow}
            </a>
            <form action={runBackupNowAction}>
              <button className="button button-secondary" type="submit">
                <IconBolt size={18} /> {t.admin.backup.runNow}
              </button>
            </form>
          </div>
        </section>

        <section className="stack">
          <h2 className="h2">{t.admin.backup.files}</h2>
          <div className="list">
            {files.slice(0, 20).map((f) => (
              <div key={f.name} className="item item-compact">
                <div>
                  <div className="item-title">{f.name}</div>
                  <div className="muted small">
                    {(f.sizeBytes / 1024).toFixed(1)} KB · {new Date(f.mtimeMs).toLocaleString(lang === "sr" ? "sr-RS" : "en-GB")}
                  </div>
                </div>
                <a className="button button-secondary" href={`/api/admin/backup/file?name=${encodeURIComponent(f.name)}`}>
                  <IconDownload size={18} /> {t.admin.backup.downloadNow}
                </a>
              </div>
            ))}
            {files.length === 0 ? <div className="muted">{t.admin.backup.emptyFiles}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
