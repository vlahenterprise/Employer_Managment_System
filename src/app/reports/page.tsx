import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getActivityTypesForTeam } from "@/server/reports";
import { getAppSettings } from "@/server/app-settings";
import { prisma } from "@/server/db";
import ReportEntry from "./ReportEntry";
import ReportHistory from "./ReportHistory";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { IconArrowLeft, IconUsers, IconDownload } from "@/components/icons";
import { isManagerRole } from "@/server/rbac";
import { APP_TIMEZONE } from "@/server/app-settings";
import { formatInTimeZone } from "@/server/time";

function getWeekAndMonthBounds() {
  const now = new Date();
  const todayIso = formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd");
  const today = new Date(todayIso);

  // ISO week: Monday=1 ... Sunday=7
  const dayOfWeek = today.getDay() || 7;
  const weekStartDate = new Date(today);
  weekStartDate.setDate(today.getDate() - dayOfWeek + 1);
  const weekEndDate = new Date(today);
  weekEndDate.setDate(today.getDate() + (7 - dayOfWeek));

  const pad = (n: number) => String(n).padStart(2, "0");
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const weekStart = fmtDate(weekStartDate);
  const weekEnd = fmtDate(weekEndDate);
  const monthStart = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-01`;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const monthEnd = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(lastDay)}`;

  return { weekStart, weekEnd, monthStart, monthEnd };
}

async function getReportsKpi(userId: string) {
  const { weekStart, weekEnd, monthStart, monthEnd } = getWeekAndMonthBounds();

  const [weekReports, monthCount] = await Promise.all([
    prisma.dailyReport.findMany({
      where: { userId, dateIso: { gte: weekStart, lte: weekEnd } },
      select: { totalMinutes: true }
    }),
    prisma.dailyReport.count({
      where: { userId, dateIso: { gte: monthStart, lte: monthEnd } }
    })
  ]);

  const weekTotalMinutes = weekReports.reduce((sum, r) => sum + r.totalMinutes, 0);
  const weekDays = weekReports.length;
  const avgDailyMinutes = weekDays > 0 ? Math.round(weekTotalMinutes / weekDays) : 0;

  return { weekTotalMinutes, avgDailyMinutes, monthCount };
}

export default async function ReportsPage() {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const t = getI18n(lang);
  const settings = await getAppSettings();

  const [activityTypes, kpi] = await Promise.all([
    getActivityTypesForTeam(user.teamId),
    getReportsKpi(user.id)
  ]);

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div>
                <h1 className="brand-title">{t.reports.entryTitle}</h1>
                <p className="muted">{t.reports.rules(settings.MinDayActivtyDuration, settings.MaxDayActivtyDuration, settings.MaxActivitiesPerDay)}</p>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
                {isManagerRole(user.role) ? (
                  <Link className="button button-secondary" href="/reports/manager">
                    <IconUsers size={18} /> {t.reports.managerTitle}
                  </Link>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="grid3 reports-kpi-grid">
          <div className="item item-compact kpi-card">
            <div>
              <div className="kpi-value">
                {Math.floor(kpi.weekTotalMinutes / 60)}h {String(kpi.weekTotalMinutes % 60).padStart(2, "0")}m
              </div>
              <div className="kpi-label">
                {lang === "sr" ? "Ukupno ove sedmice" : "Total this week"}
              </div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div>
              <div className="kpi-value">
                {Math.floor(kpi.avgDailyMinutes / 60)}h {String(kpi.avgDailyMinutes % 60).padStart(2, "0")}m
              </div>
              <div className="kpi-label">
                {lang === "sr" ? "Prosek dnevno (sedmica)" : "Daily avg (week)"}
              </div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div>
              <div className="kpi-value">{kpi.monthCount}</div>
              <div className="kpi-label">
                {lang === "sr" ? "Izveštaja ovog meseca" : "Reports this month"}
              </div>
            </div>
          </div>
        </div>

        <div className="inline" style={{ justifyContent: "flex-end" }}>
          <a className="button button-secondary" href="/api/reports/export-csv">
            <IconDownload size={16} /> {lang === "sr" ? "Izvezi CSV" : "Export CSV"}
          </a>
        </div>

        <ReportEntry
          lang={lang}
          activityTypes={activityTypes}
          rules={{
            minH: settings.MinDayActivtyDuration,
            maxH: settings.MaxDayActivtyDuration,
            maxAct: settings.MaxActivitiesPerDay
          }}
        />

        <ReportHistory lang={lang} />

      </div>
    </main>
  );
}
