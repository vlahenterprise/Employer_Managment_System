import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { requireActiveUser } from "@/server/current-user";
import { getReportsDashboard, getReportsGrid } from "@/server/reports";
import { deleteDailyReportRedirectAction } from "../actions";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import ReportsCharts from "./ReportsCharts";
import { IconArrowLeft, IconCalendar, IconPdf, IconReport, IconSparkles, IconTasks } from "@/components/icons";
import { APP_TIMEZONE } from "@/server/app-settings";
import { startOfMonth } from "date-fns";
import { formatInTimeZone } from "@/server/time";
import { getScopedEmployeeIds, isManagerRole } from "@/server/rbac";
import { loadOrgUsers } from "@/server/org";
import UserMenu from "../../dashboard/UserMenu";
import { LabelWithTooltip } from "@/components/Tooltip";

function fmtMin(minutes: number) {
  const min = Math.max(0, Math.floor(Number(minutes || 0)));
  const h = Math.floor(min / 60);
  const mm = min % 60;
  return `${h}h ${String(mm).padStart(2, "0")}m`;
}

export default async function ReportsManagerPage({
  searchParams
}: {
  searchParams: {
    fromIso?: string;
    toIso?: string;
    teamName?: string;
    position?: string;
    employeeEmail?: string;
    page?: string;
    success?: string;
    error?: string;
  };
}) {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const canViewAll = isManagerRole(user.role);
  if (!canViewAll) redirect("/reports");

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  const orgUsers = canViewAll ? await loadOrgUsers() : [];
  const scopedEmployeeIds = canViewAll ? [...getScopedEmployeeIds({ id: user.id, role: user.role }, orgUsers)] : [];

  const [teams, positions, employees] = canViewAll
    ? await Promise.all([
        prisma.team.findMany({
          where: { users: { some: { id: { in: scopedEmployeeIds } } } },
          orderBy: { name: "asc" },
          select: { name: true }
        }),
        prisma.user.findMany({
          where: {
            id: { in: scopedEmployeeIds },
            position: { not: null }
          },
          distinct: ["position"],
          orderBy: { position: "asc" },
          select: { position: true }
        }),
        prisma.user.findMany({
          where: { id: { in: scopedEmployeeIds } },
          orderBy: { name: "asc" },
          select: { name: true, email: true, team: { select: { name: true } } }
        })
      ])
    : [[], [], []];

  const now = new Date();
  const defaultFrom = formatInTimeZone(startOfMonth(now), APP_TIMEZONE, "yyyy-MM-dd");
  const defaultTo = formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd");

  const filters = {
    fromIso: searchParams.fromIso || defaultFrom,
    toIso: searchParams.toIso || defaultTo,
    teamName: searchParams.teamName || null,
    position: searchParams.position || null,
    employeeEmail: searchParams.employeeEmail || null
  };

  const actor = { id: user.id, email: user.email, role: user.role, hrAddon: user.hrAddon };
  const [dash, grid] = await Promise.all([
    getReportsDashboard({ actor, filters }),
    getReportsGrid({
      actor,
      filters,
      pagination: { page: searchParams.page }
    })
  ]);

  const exportParams = new URLSearchParams();
  exportParams.set("fromIso", filters.fromIso || "");
  exportParams.set("toIso", filters.toIso || "");
  if (filters.teamName) exportParams.set("teamName", filters.teamName);
  if (filters.position) exportParams.set("position", filters.position);
  if (filters.employeeEmail) exportParams.set("employeeEmail", filters.employeeEmail);
  const exportHref = `/api/reports/dashboard-pdf?${exportParams.toString()}`;
  const help = lang === "sr"
    ? {
        filters: "Suzi pregled po periodu, timu, poziciji i zaposlenom da lakše vidiš gde odlazi vreme.",
        kpi: "Ovo je brz rezime ukupnog rada u izabranom opsegu — bez potrebe da odmah ulaziš u detalje.",
        topMost: "Najveći ulagači vremena otkrivaju gde je fokus tima u ovom periodu.",
        topLeast: "Najmanje vreme pokazuje aktivnosti koje se retko rade ili ostaju po strani.",
        allTypes: "Šira raspodela vremena preko svih tipova aktivnosti za celokupan pregled.",
        grid: "Detaljni prikaz po zaposlenom i danu kada želiš da uđeš na konkretan zapis."
      }
    : {
        filters: "Narrow the view by period, team, position, and employee so you can see where time really goes.",
        kpi: "This is the fast summary of work in the selected range before you go into details.",
        topMost: "Highest time allocation reveals where the team is focusing most in this period.",
        topLeast: "Lowest time shows activities that are rare or keep slipping into the background.",
        allTypes: "Wider time distribution across all activity types for a complete overview.",
        grid: "Detailed view by employee and day when you need the exact record."
      };

  function pageHref(page: number) {
    const params = new URLSearchParams();
    params.set("fromIso", filters.fromIso || "");
    params.set("toIso", filters.toIso || "");
    if (filters.teamName) params.set("teamName", filters.teamName);
    if (filters.position) params.set("position", filters.position);
    if (filters.employeeEmail) params.set("employeeEmail", filters.employeeEmail);
    if (page > 1) params.set("page", String(page));
    return `/reports/manager?${params.toString()}`;
  }

  const topMostMax = Math.max(1, ...dash.topMost.map((x) => Number(x.minutes || 0)));
  const topLeastMax = Math.max(1, ...dash.topLeast.map((x) => Number(x.minutes || 0)));
  const allMax = Math.max(1, ...dash.chart.slice(0, 25).map((x) => Number(x.minutes || 0)));

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div>
                <h1 className="brand-title">{t.reports.managerTitle}</h1>
                <p className="muted">{t.reports.managerSubtitle}</p>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
                <Link className="button button-secondary" href="/reports">
                  <IconReport size={18} /> {t.reports.entryTitle}
                </Link>
                <a className="button" href={exportHref} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {t.reports.exportPdf}
                </a>
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

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="panel stack">
          <div className="section-head">
            <h2 className="h2">
              <LabelWithTooltip label={t.reports.filters} tooltip={help.filters} />
            </h2>
          </div>
          <form className="grid3" method="get" action="/reports/manager">
            <label className="field">
              <span className="label">{t.reports.from}</span>
              <input className="input" name="fromIso" type="date" defaultValue={filters.fromIso} required />
            </label>
            <label className="field">
              <span className="label">{t.reports.to}</span>
              <input className="input" name="toIso" type="date" defaultValue={filters.toIso} required />
            </label>

            {canViewAll ? (
              <label className="field">
                <span className="label">{t.reports.team}</span>
                <select className="input" name="teamName" defaultValue={filters.teamName ?? "ALL"}>
                  <option value="ALL">(ALL)</option>
                  {teams.map((t) => (
                    <option key={t.name} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="teamName" value="" />
            )}

            {canViewAll ? (
              <label className="field">
                <span className="label">{t.reports.position}</span>
                <select className="input" name="position" defaultValue={filters.position ?? "ALL"}>
                  <option value="ALL">(ALL)</option>
                  {positions.map((p) => (
                    <option key={p.position ?? ""} value={p.position ?? ""}>
                      {p.position}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="position" value="" />
            )}

            {canViewAll ? (
              <label className="field">
                <span className="label">{t.reports.employee}</span>
                <select className="input" name="employeeEmail" defaultValue={filters.employeeEmail ?? "ALL"}>
                  <option value="ALL">(ALL)</option>
                  {employees.map((e) => (
                    <option key={e.email} value={e.email}>
                      {e.name} ({e.email}){e.team?.name ? ` — ${e.team.name}` : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="employeeEmail" value="" />
            )}

            <div className="field field-actions">
              <span className="label"> </span>
              <button className="button" type="submit">
                {t.common.apply}
              </button>
            </div>
          </form>
          <div className="muted small">Scope is limited to your reporting line.</div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <h2 className="h2">
              <LabelWithTooltip label={t.reports.kpi} tooltip={help.kpi} />
            </h2>
          </div>
          <div className="grid3">
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconReport size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.reports.kpiTotalHours}</div>
                <div className="kpi-value">{dash.totals.totalHours}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconReport size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.reports.kpiTotalMinutes}</div>
                <div className="kpi-value">{dash.totals.totalMinutes}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconCalendar size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.reports.kpiDays}</div>
                <div className="kpi-value">{dash.totals.daysCount}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconTasks size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.reports.kpiActivities}</div>
                <div className="kpi-value">{dash.totals.activitiesCount}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconSparkles size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.reports.kpiDistinctTypes}</div>
                <div className="kpi-value">{dash.totals.distinctTypes}</div>
              </div>
            </div>
          </div>
        </section>

        <ReportsCharts
          topMost={dash.topMost}
          topLeast={dash.topLeast}
          chart={dash.chart}
          titles={{ topMost: t.reports.topMost, topLeast: t.reports.topLeast, all: t.reports.allTypesTop12 }}
          emptyText={t.reports.empty}
        />

        <section className="grid2">
          <div className="panel stack">
            <div className="section-head">
              <h2 className="h2">
                <LabelWithTooltip label={t.reports.topMost} tooltip={help.topMost} />
              </h2>
            </div>
            <div className="rank-list">
              {dash.topMost.map((x, i) => {
                const pct = Math.round((Number(x.minutes || 0) / topMostMax) * 100);
                return (
                  <div key={x.type} className="rank-row">
                    <div className="rank-badge">{i + 1}</div>
                    <div className="rank-body">
                      <div className="rank-title">{x.type}</div>
                      <div className="rank-bar">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="rank-value">{fmtMin(x.minutes)}</div>
                  </div>
                );
              })}
              {dash.topMost.length === 0 ? <div className="muted">{t.reports.empty}</div> : null}
            </div>
          </div>

          <div className="panel stack">
            <div className="section-head">
              <h2 className="h2">
                <LabelWithTooltip label={t.reports.topLeast} tooltip={help.topLeast} />
              </h2>
            </div>
            <div className="rank-list">
              {dash.topLeast.map((x, i) => {
                const pct = Math.round((Number(x.minutes || 0) / topLeastMax) * 100);
                return (
                  <div key={x.type} className="rank-row">
                    <div className="rank-badge">{i + 1}</div>
                    <div className="rank-body">
                      <div className="rank-title">{x.type}</div>
                      <div className="rank-bar">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="rank-value">{fmtMin(x.minutes)}</div>
                  </div>
                );
              })}
              {dash.topLeast.length === 0 ? <div className="muted">{t.reports.empty}</div> : null}
            </div>
          </div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <h2 className="h2">
              <LabelWithTooltip label={t.reports.allTypes} tooltip={help.allTypes} />
            </h2>
          </div>
          <div className="rank-list">
            {dash.chart.slice(0, 25).map((x, i) => {
              const pct = Math.round((Number(x.minutes || 0) / allMax) * 100);
              return (
                <div key={x.type} className="rank-row">
                  <div className="rank-badge">{i + 1}</div>
                  <div className="rank-body">
                    <div className="rank-title">{x.type}</div>
                    <div className="rank-bar">
                      <span style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <div className="rank-value">{fmtMin(x.minutes)}</div>
                </div>
              );
            })}
            {dash.chart.length === 0 ? <div className="muted">{t.reports.empty}</div> : null}
          </div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <h2 className="h2">
              <LabelWithTooltip label={t.reports.gridTitle} tooltip={help.grid} />
            </h2>
          </div>
          <div className="inline" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div className="muted small">{t.reports.gridDesc}</div>
            <div className="muted small">
              {grid.meta.start}-{grid.meta.end} / {grid.meta.total}
            </div>
          </div>
          <div className="list">
            {grid.rows.map((r) => (
              <div key={r.reportId} className="item item-compact">
                <div>
                  <div className="item-title">
                    {r.dateIso} · {r.name}
                  </div>
                  <div className="muted small">
                    {r.email} · {r.team || "—"} · {r.position || "—"} · {r.totalMinutes} min · {r.activities} activities
                  </div>
                </div>

                {canViewAll ? (
                  <form action={deleteDailyReportRedirectAction}>
                    <input type="hidden" name="dateIso" value={r.dateIso} />
                    <input type="hidden" name="targetEmail" value={r.email} />
                    <button className="button button-danger" type="submit">
                      {t.common.delete}
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
            {grid.rows.length === 0 ? <div className="muted">{t.reports.empty}</div> : null}
          </div>
          {grid.meta.pageCount > 1 ? (
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <div className="muted small">
                {grid.meta.page} / {grid.meta.pageCount}
              </div>
              <div className="inline">
                {grid.meta.hasPrev ? (
                  <Link className="button button-secondary" href={pageHref(grid.meta.page - 1)} aria-label="Previous page">
                    <IconArrowLeft size={18} />
                  </Link>
                ) : null}
                {grid.meta.hasNext ? (
                  <Link className="button button-secondary" href={pageHref(grid.meta.page + 1)} aria-label="Next page">
                    <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
                      <IconArrowLeft size={18} />
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
