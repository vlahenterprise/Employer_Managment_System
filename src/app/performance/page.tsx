import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { buildChartPalette, getBrandingSettings, getThemeCssVars } from "@/server/settings";
import UserMenu from "../dashboard/UserMenu";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { createEvaluationAction } from "./actions";
import { getPerformanceDirectReports, getPerformanceManageableEmployees, getPerformanceMyEvaluations, getPerformanceTeamEvaluations } from "@/server/performance";
import PerformanceCharts from "./performance-charts";
import { APP_TIMEZONE, getAppSettings } from "@/server/app-settings";
import { formatInTimeZone } from "@/server/time";
import {
  IconAlertTriangle,
  IconArrowLeft,
  IconArrowRight,
  IconBolt,
  IconCheckCircle,
  IconClock,
  IconUsers
} from "@/components/icons";
import { isManagerRole } from "@/server/rbac";

function isoToDate(iso: string) {
  const m = String(iso || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  const mo = Number.parseInt(m[2], 10) - 1;
  const d = Number.parseInt(m[3], 10);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return new Date(Date.UTC(y, mo, d));
}

function isoFromUtcDate(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDaysIso(iso: string, days: number) {
  const d = isoToDate(iso);
  if (!d) return "";
  d.setUTCDate(d.getUTCDate() + days);
  return isoFromUtcDate(d);
}

function diffDaysIso(startIso: string, endIso: string) {
  const a = isoToDate(startIso);
  const b = isoToDate(endIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function quarterLabel(d: Date) {
  const y = d.getUTCFullYear();
  const q = Math.floor(d.getUTCMonth() / 3) + 1;
  return `${y}-Q${q}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function msgFromCode(t: ReturnType<typeof getI18n>, code: string | null, isSuccess: boolean) {
  const c = String(code || "");
  if (!c) return null;
  if (!isSuccess) {
    if (c === "OPEN_EVALUATION_EXISTS") return t.performance.msgOpenEvalExists;
    if (c === "PERIOD_EXISTS") return t.performance.msgPeriodExists;
    if (c === "NO_ACCESS") return t.performance.msgNoAccess;
    return t.performance.msgGenericError(c);
  }
  if (c.startsWith("CREATED:")) return t.performance.msgCreated(c.slice("CREATED:".length));
  if (c === "DELETED") return t.performance.msgDeleted;
  return c;
}

export default async function PerformancePage({
  searchParams
}: {
  searchParams: { success?: string; error?: string; teamFilter?: string };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const theme = await getThemeCssVars();
  const palette = buildChartPalette(theme as any);
  const lang = getRequestLang();
  const t = getI18n(lang);

  const canViewTeam = isManagerRole(user.role);
  const isManager = canViewTeam;
  const canCreate = isManagerRole(user.role);
  const teamFilter = String(searchParams.teamFilter || "OPEN").trim().toUpperCase();

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;
  const message = msgFromCode(t, success, true) || msgFromCode(t, error, false);
  const messageType = success ? "success" : error ? "error" : null;

  const [my, team, manageable, directReports] = await Promise.all([
    getPerformanceMyEvaluations({ id: user.id }),
    getPerformanceTeamEvaluations({ id: user.id, role: user.role }),
    canViewTeam ? getPerformanceManageableEmployees({ id: user.id, role: user.role }) : Promise.resolve({ ok: true as const, items: [] as any[] }),
    isManagerRole(user.role) ? getPerformanceDirectReports({ id: user.id }) : Promise.resolve({ ok: true as const, items: [] as any[] })
  ]);
  const settings = await getAppSettings();
  const todayIso = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const selfDeadlineDays = Math.max(1, Math.floor(Number(settings.PerformanceSelfReviewDeadlineDays || 10)));

  const myOpen = my.items.filter((e) => e.status === "OPEN" || e.status === "SELF_SUBMITTED").length;
  const myClosed = my.items.filter((e) => e.status === "CLOSED").length;
  const teamOpen = team.items.filter((e: any) => e.status === "OPEN" || e.status === "SELF_SUBMITTED").length;
  const teamClosed = team.items.filter((e: any) => e.status === "CLOSED").length;
  const teamNeedsReview = team.items.filter((e: any) => e.needsReview).length;
  const teamCritical = team.items.filter((e: any) => e.critical).length;

  const myHistory = [...my.items]
    .filter((e) => e.status === "CLOSED" && e.finalScore != null)
    .sort((a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime())
    .slice(-12)
    .map((e) => ({
      label: formatInTimeZone(e.periodEnd, APP_TIMEZONE, "yyyy-MM-dd"),
      value: Number(e.finalScore || 0)
    }));

  const teamStatus = canViewTeam
    ? [
        { label: t.performance.chartLabels.open, value: team.items.filter((e: any) => e.status === "OPEN").length },
        { label: t.performance.chartLabels.needsReview, value: team.items.filter((e: any) => e.status === "SELF_SUBMITTED").length },
        { label: t.performance.chartLabels.closed, value: team.items.filter((e: any) => e.status === "CLOSED").length },
        { label: t.performance.chartLabels.cancelled, value: team.items.filter((e: any) => e.status === "CANCELLED").length }
      ].filter((x) => x.value > 0)
    : [];

  const filteredTeam = (() => {
    const list = [...team.items] as any[];
    const filter = teamFilter;
    const keep = (e: any) => {
      const st = String(e.status || "").toUpperCase();
      if (filter === "ALL") return true;
      if (filter === "OPEN") return st === "OPEN" || st === "SELF_SUBMITTED";
      if (filter === "CLOSED") return st === "CLOSED";
      if (filter === "CANCELLED") return st === "CANCELLED";
      if (filter === "NEEDS_REVIEW") return Boolean(e.needsReview);
      if (filter === "CRITICAL") return Boolean(e.critical);
      return true;
    };
    return list
      .filter(keep)
      .sort((a, b) => {
        const ca = a.critical ? 1 : 0;
        const cb = b.critical ? 1 : 0;
        if (cb !== ca) return cb - ca;
        const ra = a.needsReview ? 1 : 0;
        const rb = b.needsReview ? 1 : 0;
        if (rb !== ra) return rb - ra;
        return new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime();
      });
  })();

  const teamAnalytics = canViewTeam
    ? (() => {
        type EmployeeRow = {
          name: string;
          email: string;
          team?: string | null;
          open: number;
          closed: number;
          waitingSelf: number;
          needsReview: number;
          total: number;
          lastClosed?: { periodLabel: string; score: number; endAt: Date };
        };
        const quarterMap = new Map<string, { label: string; endAt: Date; total: number; open: number; closed: number; sumFinal: number }>();
        const yearMap = new Map<string, { label: string; endAt: Date; total: number; open: number; closed: number; sumFinal: number }>();
        const employeeMap = new Map<string, EmployeeRow>();

        for (const u of manageable.items as any[]) {
          if (!u?.id || u.id === user.id) continue;
          const key = String(u.email || u.id).toLowerCase();
          employeeMap.set(key, {
            name: u.name || "—",
            email: u.email || "",
            team: u.team?.name || "",
            open: 0,
            closed: 0,
            waitingSelf: 0,
            needsReview: 0,
            total: 0
          });
        }

        for (const e of team.items as any[]) {
          const endAt = e.periodEnd ? new Date(e.periodEnd) : new Date();
          const quarter = quarterLabel(endAt);
          const year = String(endAt.getUTCFullYear());

          const q = quarterMap.get(quarter) || { label: quarter, endAt, total: 0, open: 0, closed: 0, sumFinal: 0 };
          q.total += 1;
          if (e.status === "CLOSED") {
            q.closed += 1;
            if (e.finalScore != null) q.sumFinal += Number(e.finalScore || 0);
          } else if (e.status === "OPEN" || e.status === "SELF_SUBMITTED") {
            q.open += 1;
          }
          if (endAt > q.endAt) q.endAt = endAt;
          quarterMap.set(quarter, q);

          const y = yearMap.get(year) || { label: year, endAt, total: 0, open: 0, closed: 0, sumFinal: 0 };
          y.total += 1;
          if (e.status === "CLOSED") {
            y.closed += 1;
            if (e.finalScore != null) y.sumFinal += Number(e.finalScore || 0);
          } else if (e.status === "OPEN" || e.status === "SELF_SUBMITTED") {
            y.open += 1;
          }
          if (endAt > y.endAt) y.endAt = endAt;
          yearMap.set(year, y);

          const key = String(e.employee?.email || e.employeeId || e.id).toLowerCase();
          const row: EmployeeRow = employeeMap.get(key) || {
            name: e.employee?.name || "—",
            email: e.employee?.email || "",
            team: e.employee?.team?.name || "",
            open: 0,
            closed: 0,
            waitingSelf: 0,
            needsReview: 0,
            total: 0
          };
          row.total += 1;
          if (e.status === "OPEN") {
            row.open += 1;
            row.waitingSelf += 1;
          } else if (e.status === "SELF_SUBMITTED") {
            row.open += 1;
            row.needsReview += 1;
          } else if (e.status === "CLOSED") {
            row.closed += 1;
            if (e.finalScore != null) {
              const end = endAt;
              if (!row.lastClosed || end > row.lastClosed.endAt) {
                row.lastClosed = { periodLabel: e.periodLabel, score: Number(e.finalScore || 0), endAt: end };
              }
            }
          }
          employeeMap.set(key, row);
        }

        const quarterStats = [...quarterMap.values()].sort((a, b) => b.endAt.getTime() - a.endAt.getTime()).slice(0, 6);
        const yearStats = [...yearMap.values()].sort((a, b) => b.endAt.getTime() - a.endAt.getTime()).slice(0, 5);
        const employees = [...employeeMap.values()].sort((a, b) => a.name.localeCompare(b.name));

        return { quarterStats, yearStats, employees };
      })()
    : null;

  const createOptions = isManagerRole(user.role) ? directReports.items : manageable.items;

  const evalProgress = (e: any) => {
    if (!e?.periodStart || !e?.periodEnd) return null;
    const startIso = formatInTimeZone(e.periodStart, APP_TIMEZONE, "yyyy-MM-dd");
    const endIso = formatInTimeZone(e.periodEnd, APP_TIMEZONE, "yyyy-MM-dd");
    const totalDays = Math.max(1, diffDaysIso(startIso, endIso));
    const elapsed = clamp(diffDaysIso(startIso, todayIso), 0, totalDays);
    const pct = Math.round((elapsed / totalDays) * 100);
    const selfDeadlineIso = addDaysIso(endIso, -selfDeadlineDays);
    const left = diffDaysIso(todayIso, selfDeadlineIso);
    return { pct, selfDeadlineIso, selfDaysLeft: left };
  };

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div className="brand">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
                ) : null}
                <div>
                  <h1 className="brand-title">{t.performance.title}</h1>
                  <p className="muted">{t.performance.subtitle}</p>
                </div>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
              </div>
            </div>
          </div>

          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            hrAddon={user.hrAddon}
            adminAddon={user.adminAddon}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        {message && messageType ? <div className={messageType === "success" ? "success" : "error"}>{message}</div> : null}

        <section className="panel stack">
          <h2 className="h2">
            <LabelWithTooltip
              label={t.performance.kpiTitle}
              tooltip={
                lang === "sr"
                  ? "Pregled tekućeg performance ciklusa: koliko evaluacija je otvoreno, zatvoreno i gde još postoji akcija."
                  : "A snapshot of the current performance cycle: how many evaluations are open, closed, and still need action."
              }
            />
          </h2>
          <div className="grid3">
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconBolt size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.performance.kpiOpenMy}</div>
                <div className="kpi-value">{myOpen}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconCheckCircle size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.performance.kpiClosedMy}</div>
                <div className="kpi-value">{myClosed}</div>
              </div>
            </div>
            {isManager ? (
              <div className="item item-compact kpi-card">
                <div className="kpi-icon">
                  <IconUsers size={18} />
                </div>
                <div>
                  <div className="kpi-label">{t.performance.kpiOpenTeam}</div>
                  <div className="kpi-value">{teamOpen}</div>
                </div>
              </div>
            ) : null}
            {isManager ? (
              <div className="item item-compact kpi-card">
                <div className="kpi-icon">
                  <IconCheckCircle size={18} />
                </div>
                <div>
                  <div className="kpi-label">{t.performance.kpiClosedTeam}</div>
                  <div className="kpi-value">{teamClosed}</div>
                </div>
              </div>
            ) : null}
            {isManager ? (
              <div className="item item-compact kpi-card">
                <div className="kpi-icon">
                  <IconClock size={18} />
                </div>
                <div>
                  <div className="kpi-label">{t.performance.kpiNeedsReview}</div>
                  <div className="kpi-value">{teamNeedsReview}</div>
                </div>
              </div>
            ) : null}
            {isManager ? (
              <div className="item item-compact kpi-card">
                <div className="kpi-icon">
                  <IconAlertTriangle size={18} />
                </div>
                <div>
                  <div className="kpi-label">{t.performance.kpiCritical}</div>
                  <div className="kpi-value">{teamCritical}</div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <PerformanceCharts
          lang={lang}
          palette={palette}
          history={myHistory}
          teamStatus={teamStatus}
        />

        {canViewTeam && teamAnalytics ? (
          <section className="panel stack">
            <div className="section-head">
              <div>
                <h2 className="h2">
                  <LabelWithTooltip
                    label={t.performance.analyticsTitle}
                    tooltip={
                      lang === "sr"
                        ? "Timski pregled bez promene scoring logike: ko čeka self-assessment, ko čeka manager review i kakvi su završni rezultati."
                        : "A team view without changing the scoring model: who is waiting on self-assessment, who is waiting on manager review, and how final results look."
                    }
                  />
                </h2>
                <div className="muted small">{t.performance.analyticsHint}</div>
              </div>
            </div>

            <div className="grid2">
              <div className="item stack">
                <div className="item-title">{t.performance.analyticsQuarters}</div>
                <div className="analytics-list">
                  {teamAnalytics.quarterStats.map((x) => {
                    const total = Math.max(1, x.total);
                    const closedPct = Math.round((x.closed / total) * 100);
                    const avg = x.closed ? Math.round((x.sumFinal / x.closed) * 10) / 10 : null;
                    return (
                      <div key={x.label} className="analytics-row">
                        <div className="analytics-meta">
                          <div className="analytics-title">{x.label}</div>
                          <div className="muted small">
                            {t.performance.analyticsOpen}: {x.open} · {t.performance.analyticsClosed}: {x.closed}
                          </div>
                        </div>
                        <div className="analytics-bar">
                          <span style={{ width: `${closedPct}%` }} />
                        </div>
                        <div className="analytics-score">{avg != null ? `${avg}%` : "—"}</div>
                      </div>
                    );
                  })}
                  {teamAnalytics.quarterStats.length === 0 ? <div className="muted">{t.performance.analyticsEmpty}</div> : null}
                </div>
              </div>

              <div className="item stack">
                <div className="item-title">{t.performance.analyticsYears}</div>
                <div className="analytics-list">
                  {teamAnalytics.yearStats.map((x) => {
                    const total = Math.max(1, x.total);
                    const closedPct = Math.round((x.closed / total) * 100);
                    const avg = x.closed ? Math.round((x.sumFinal / x.closed) * 10) / 10 : null;
                    return (
                      <div key={x.label} className="analytics-row">
                        <div className="analytics-meta">
                          <div className="analytics-title">{x.label}</div>
                          <div className="muted small">
                            {t.performance.analyticsOpen}: {x.open} · {t.performance.analyticsClosed}: {x.closed}
                          </div>
                        </div>
                        <div className="analytics-bar">
                          <span style={{ width: `${closedPct}%` }} />
                        </div>
                        <div className="analytics-score">{avg != null ? `${avg}%` : "—"}</div>
                      </div>
                    );
                  })}
                  {teamAnalytics.yearStats.length === 0 ? <div className="muted">{t.performance.analyticsEmpty}</div> : null}
                </div>
              </div>
            </div>

            <div className="perf-table">
              <div className="perf-row perf-head">
                <div>{t.performance.tableEmployee}</div>
                <div>{t.performance.tableOpen}</div>
                <div>{t.performance.tableClosed}</div>
                <div>{t.performance.tableWaitingSelf}</div>
                <div>{t.performance.tableNeedsReview}</div>
                <div>{t.performance.tableSelfFill}</div>
                <div>{t.performance.tableQuarterScores}</div>
              </div>
              {teamAnalytics.employees.map((r) => {
                const totalActive = Math.max(0, r.open + r.closed + r.needsReview);
                const selfFill = totalActive ? Math.round(((r.closed + r.needsReview) / totalActive) * 100) : 0;
                return (
                  <div key={`${r.email}-${r.name}`} className="perf-row">
                    <div className="perf-employee">
                      <div className="perf-name">{r.name}</div>
                      <div className="muted small">
                        {r.email}
                        {r.team ? ` · ${r.team}` : ""}
                      </div>
                    </div>
                    <div>{r.open}</div>
                    <div>{r.closed}</div>
                    <div>{r.waitingSelf}</div>
                    <div>{r.needsReview}</div>
                    <div>{selfFill}%</div>
                    <div>{r.lastClosed ? `${r.lastClosed.periodLabel}: ${Math.round(r.lastClosed.score * 10) / 10}%` : "—"}</div>
                  </div>
                );
              })}
              {teamAnalytics.employees.length === 0 ? <div className="muted">{t.performance.analyticsEmpty}</div> : null}
            </div>
          </section>
        ) : null}

        {canCreate ? (
          <section className="panel stack">
            <h2 className="h2">
              <LabelWithTooltip
                label={t.performance.createTitle}
                tooltip={
                  lang === "sr"
                    ? "Ovde menadžer otvara novu kvartalnu evaluaciju i po želji odmah dodaje početne ciljeve."
                    : "Managers open a new quarterly evaluation here and can optionally add the starting goals immediately."
                }
              />
            </h2>
            <div className="muted small">{t.performance.createHint}</div>
            <form className="stack" action={createEvaluationAction}>
              <label className="field">
                <span className="label">{t.performance.employee}</span>
                <select className="input" name="employeeId" required defaultValue={createOptions[0]?.id ?? ""}>
                  {createOptions
                    .filter((e: any) => e.id !== user.id)
                    .map((e: any) => (
                      <option key={e.id} value={e.id}>
                        {e.name} ({e.email}){e.team?.name ? ` — ${e.team.name}` : ""}
                      </option>
                    ))}
                </select>
              </label>

              <div className="divider">
                <span>{lang === "sr" ? "Opcioni početni ciljevi" : "Optional starting goals"}</span>
              </div>

              <div className="list">
                {Array.from({ length: 3 }).map((_, idx) => {
                  const n = idx + 1;
                  return (
                    <div key={n} className="item stack">
                      <div className="grid2">
                        <label className="field">
                          <span className="label">{t.performance.goalTitle}</span>
                          <input className="input" name={`newGoalTitle${n}`} type="text" />
                        </label>
                        <label className="field">
                          <span className="label">{t.performance.goalWeight}</span>
                          <input className="input" name={`newGoalWeight${n}`} type="number" min={0} max={100} step={1} />
                        </label>
                      </div>
                      <label className="field">
                        <span className="label">{t.performance.goalDescription}</span>
                        <textarea className="input" name={`newGoalDesc${n}`} rows={2} style={{ resize: "vertical" }} />
                      </label>
                    </div>
                  );
                })}
              </div>

              <button className="button" type="submit" disabled={createOptions.length === 0}>
                {t.performance.createBtn}
              </button>
            </form>
            {createOptions.length === 0 ? <div className="muted small">{t.performance.noDirectReports}</div> : null}
          </section>
        ) : null}

        <section className="panel stack">
          <h2 className="h2">
            <LabelWithTooltip
              label={t.performance.myTitle}
              tooltip={
                lang === "sr"
                  ? "Tvoj pregled ciljeva, self-assessment-a i finalnog rezultata kada ciklus bude zatvoren."
                  : "Your view of goals, self-assessment, and the final result once the cycle is closed."
              }
            />
          </h2>
          <div className="muted small">{t.performance.myHint}</div>
          <div className="list">
            {my.items.map((e) => {
              const progress = evalProgress(e);
              return (
                <div key={e.id} className="item item-compact">
                  <div>
                    <div className="item-title">{e.periodLabel}</div>
                    <div className="muted small">
                      {t.performance.status}: {e.status} · {e.locked ? t.performance.locked : t.performance.unlocked}
                      {e.finalScore != null ? ` · ${t.performance.finalScore}: ${Math.round(Number(e.finalScore || 0) * 10) / 10}` : ""}
                    </div>
                    {progress && e.status !== "CLOSED" ? (
                      <div className="progress">
                        <div className="muted small">
                          {t.performance.selfDeadline(progress.selfDaysLeft)} · {t.performance.periodProgress}: {progress.pct}%
                        </div>
                        <div className="progress-track">
                          <span style={{ width: `${progress.pct}%` }} />
                        </div>
                      </div>
                    ) : null}
                  </div>
                  <Link className="button button-secondary" href={`/performance/${e.id}`}>
                    {t.performance.open} <IconArrowRight size={18} />
                  </Link>
                </div>
              );
            })}
            {my.items.length === 0 ? <div className="muted">{t.performance.emptyMy}</div> : null}
          </div>
        </section>

        {canViewTeam ? (
          <section className="panel stack">
            <h2 className="h2">
              <LabelWithTooltip
                label={t.performance.teamTitle}
                tooltip={
                  lang === "sr"
                    ? "Pregled direktnih podređenih i stanja njihovih kvartalnih evaluacija."
                    : "A view of direct reports and the status of their quarterly evaluations."
                }
              />
            </h2>
            <div className="muted small">{t.performance.teamHint}</div>
            <div className="inline">
              <Link className={teamFilter === "ALL" ? "button" : "button button-secondary"} href="/performance?teamFilter=ALL">
                {t.performance.filters.all}
              </Link>
              <Link className={teamFilter === "OPEN" ? "button" : "button button-secondary"} href="/performance?teamFilter=OPEN">
                {t.performance.filters.open}
              </Link>
              <Link
                className={teamFilter === "NEEDS_REVIEW" ? "button" : "button button-secondary"}
                href="/performance?teamFilter=NEEDS_REVIEW"
              >
                {t.performance.filters.needsReview}
              </Link>
              <Link
                className={teamFilter === "CRITICAL" ? "button" : "button button-secondary"}
                href="/performance?teamFilter=CRITICAL"
              >
                {t.performance.filters.critical}
              </Link>
              <Link className={teamFilter === "CLOSED" ? "button" : "button button-secondary"} href="/performance?teamFilter=CLOSED">
                {t.performance.filters.closed}
              </Link>
              <Link
                className={teamFilter === "CANCELLED" ? "button" : "button button-secondary"}
                href="/performance?teamFilter=CANCELLED"
              >
                {t.performance.filters.cancelled}
              </Link>
            </div>
            <div className="list">
              {filteredTeam.map((e: any) => {
                const progress = evalProgress(e);
                return (
                  <div key={e.id} className="item item-compact">
                    <div>
                      <div className="item-title">
                        {e.employee?.name || "—"} · {e.periodLabel}
                      </div>
                      <div className="muted small">
                        {e.employee?.email || ""}{e.employee?.team?.name ? ` · ${e.employee.team.name}` : ""} · {t.performance.status}: {e.status} ·{" "}
                        {e.locked ? t.performance.locked : t.performance.unlocked}
                        {e.finalScore != null ? ` · ${t.performance.finalScore}: ${Math.round(Number(e.finalScore || 0) * 10) / 10}` : ""}
                      </div>
                      {progress && e.status !== "CLOSED" ? (
                        <div className="progress">
                          <div className="muted small">
                            {t.performance.selfDeadline(progress.selfDaysLeft)} · {t.performance.periodProgress}: {progress.pct}%
                          </div>
                          <div className="progress-track">
                            <span style={{ width: `${progress.pct}%` }} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="inline">
                      <div className="pills">
                        {e.critical ? <span className="pill pill-danger">{t.performance.filters.critical}</span> : null}
                        {e.needsReview ? <span className="pill pill-warn">{t.performance.filters.needsReview}</span> : null}
                      </div>
                      <Link className="button button-secondary" href={`/performance/${e.id}`}>
                        {t.performance.open}
                      </Link>
                    </div>
                  </div>
                );
              })}
              {filteredTeam.length === 0 ? <div className="muted">{t.performance.emptyTeam}</div> : null}
            </div>
          </section>
        ) : null}

      </div>
    </main>
  );
}
