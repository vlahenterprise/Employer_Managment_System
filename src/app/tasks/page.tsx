import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import UserMenu from "../dashboard/UserMenu";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { getTaskDashboard, getTaskPickers, normalizeTaskFilters } from "@/server/tasks";
import { createTaskAction, submitForApprovalAction, approveTaskFormAction, returnTaskFormAction, cancelTaskFormAction } from "./actions";
import TaskCharts from "./task-charts";
import { startOfMonth, subDays } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { APP_TIMEZONE } from "@/server/app-settings";
import { IconAlertTriangle, IconArrowLeft, IconBolt, IconCheckCircle, IconClock, IconPdf, IconSparkles, IconTasks } from "@/components/icons";

function resolveQuickRange(quickRaw: string | undefined, currentFrom: string, currentTo: string) {
  const quick = Number.parseInt(String(quickRaw || ""), 10);
  if (![7, 30, 90].includes(quick)) return { fromIso: currentFrom, toIso: currentTo, quick: "" };
  const toIso = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const fromIso = formatInTimeZone(subDays(new Date(), quick), APP_TIMEZONE, "yyyy-MM-dd");
  return { fromIso, toIso, quick: String(quick) };
}

export default async function TasksPage({
  searchParams
}: {
  searchParams: {
    fromIso?: string;
    toIso?: string;
    teamId?: string;
    employeeId?: string;
    quick?: string;
    success?: string;
    error?: string;
  };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const isAdmin = user.role === "ADMIN";
  const canManage = user.role === "ADMIN" || user.role === "HR" || user.role === "MANAGER";

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  const now = new Date();
  const defaultFrom = formatInTimeZone(startOfMonth(now), APP_TIMEZONE, "yyyy-MM-dd");
  const defaultTo = formatInTimeZone(now, APP_TIMEZONE, "yyyy-MM-dd");
  const baseFrom = searchParams.fromIso || (searchParams.quick ? "" : defaultFrom);
  const baseTo = searchParams.toIso || (searchParams.quick ? "" : defaultTo);
  const quickResolved = resolveQuickRange(searchParams.quick, baseFrom, baseTo);

  const filters = normalizeTaskFilters({
    fromIso: quickResolved.fromIso,
    toIso: quickResolved.toIso,
    teamId: searchParams.teamId || null,
    employeeId: searchParams.employeeId || null
  });

  const [pickers, dash] = await Promise.all([
    canManage ? getTaskPickers({ id: user.id, role: user.role }) : Promise.resolve(null),
    getTaskDashboard({ id: user.id, email: user.email, role: user.role }, filters)
  ]);

  const employeesForFilter = (() => {
    if (!pickers) return [];
    const teamId = filters.teamId;
    const list: Array<{ id: string; name: string; email: string }> = [];
    const add = (e: { id: string; name: string; email: string }) => list.push(e);
    if (teamId && pickers.employeesByTeam[teamId]) {
      pickers.employeesByTeam[teamId].forEach(add);
    } else {
      Object.values(pickers.employeesByTeam).forEach((arr) => arr.forEach(add));
    }
    const seen = new Set<string>();
    return list.filter((e) => {
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
  })();

  const priorityLabel = (p: string) => {
    if (p === "CRIT") return "P1 · CRIT";
    if (p === "HIGH") return "P2 · HIGH";
    if (p === "MED") return "P3 · MED";
    return "P4 · LOW";
  };

  const statusLabel = (status: string) => {
    const key = String(status || "").trim().toUpperCase();
    if (key === "OPEN") return t.tasks.statusLabels.open;
    if (key === "IN_PROGRESS") return t.tasks.statusLabels.inProgress;
    if (key === "FOR_APPROVAL") return t.tasks.statusLabels.forApproval;
    if (key === "APPROVED") return t.tasks.statusLabels.approved;
    if (key === "RETURNED") return t.tasks.statusLabels.returned;
    return status;
  };

  const statusPillClass = (status: string) => {
    const key = String(status || "").trim().toUpperCase();
    if (key === "APPROVED") return "pill pill-status pill-status-approved";
    if (key === "FOR_APPROVAL") return "pill pill-status pill-status-review";
    if (key === "IN_PROGRESS") return "pill pill-status pill-status-progress";
    if (key === "RETURNED") return "pill pill-status pill-status-rejected";
    if (key === "OPEN") return "pill pill-status pill-status-muted";
    return "pill";
  };

  const processFlow = [
    { key: "OPEN", label: t.tasks.statsOpen, value: dash.totals.open, icon: <IconTasks size={18} />, tone: "muted" },
    { key: "IN_PROGRESS", label: t.tasks.statsInProgress, value: dash.totals.inProgress, icon: <IconClock size={18} />, tone: "progress" },
    { key: "FOR_APPROVAL", label: t.tasks.statsForApproval, value: dash.totals.forApproval, icon: <IconSparkles size={18} />, tone: "review" },
    { key: "APPROVED", label: t.tasks.statsApproved, value: dash.totals.approved, icon: <IconCheckCircle size={18} />, tone: "approved" },
    { key: "RETURNED", label: t.tasks.statsReturned, value: dash.totals.returned, icon: <IconAlertTriangle size={18} />, tone: "rejected" }
  ];

  const exportParams = new URLSearchParams();
  if (dash.filters.fromIso) exportParams.set("fromIso", dash.filters.fromIso);
  if (dash.filters.toIso) exportParams.set("toIso", dash.filters.toIso);
  if (dash.filters.teamId) exportParams.set("teamId", dash.filters.teamId);
  if (dash.filters.employeeId) exportParams.set("employeeId", dash.filters.employeeId);
  const exportHref = `/api/tasks/dashboard-pdf?${exportParams.toString()}`;

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
                  <h1 className="brand-title">{t.tasks.title}</h1>
                  <p className="muted">{t.tasks.subtitle}</p>
                </div>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
                <a className="button" href={exportHref} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {t.tasks.exportPdf}
                </a>
              </div>
            </div>
          </div>

          <UserMenu
            name={user.name}
            email={user.email}
            role={user.role}
            position={user.position}
            team={user.team?.name ?? null}
            lang={lang}
          />
        </div>

        {success ? <div className="success">{success}</div> : null}
        {error ? <div className="error">{error}</div> : null}

        <section className="panel stack">
          <h2 className="h2">{t.tasks.filters}</h2>
          <form className="grid3" method="get" action="/tasks">
            <label className="field">
              <span className="label">{t.tasks.from}</span>
              <input className="input" name="fromIso" type="date" defaultValue={dash.filters.fromIso} />
            </label>
            <label className="field">
              <span className="label">{t.tasks.to}</span>
              <input className="input" name="toIso" type="date" defaultValue={dash.filters.toIso} />
            </label>
            <label className="field">
              <span className="label">{t.tasks.quick}</span>
              <select className="input" name="quick" defaultValue={quickResolved.quick || ""}>
                <option value="">{t.tasks.quickNone}</option>
                <option value="7">{t.tasks.quick7}</option>
                <option value="30">{t.tasks.quick30}</option>
                <option value="90">{t.tasks.quick90}</option>
              </select>
            </label>

            {canManage ? (
              <label className="field">
                <span className="label">{t.tasks.team}</span>
                <select className="input" name="teamId" defaultValue={dash.filters.teamId ?? "ALL"}>
                  <option value="ALL">(ALL)</option>
                  {pickers?.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="teamId" value="" />
            )}

            {canManage ? (
              <label className="field">
                <span className="label">{t.tasks.employee}</span>
                <select className="input" name="employeeId" defaultValue={dash.filters.employeeId ?? "ALL"}>
                  <option value="ALL">(ALL)</option>
                  {employeesForFilter.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} ({e.email})
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="employeeId" value="" />
            )}

            <div className="field field-actions">
              <span className="label"> </span>
              <button className="button" type="submit">
                {t.common.apply}
              </button>
            </div>
          </form>
          <div className="muted small">
            {t.tasks.tzNote(APP_TIMEZONE)}
          </div>
          {!canManage ? <div className="muted small">{t.tasks.nonAdminNote}</div> : null}
        </section>

        <section className="panel stack">
          <h2 className="h2">{t.tasks.kpi}</h2>
          <div className="grid3">
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconTasks size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.tasks.kpiTotal}</div>
                <div className="kpi-value">{dash.totals.totalTasks}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconAlertTriangle size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.tasks.kpiOverdue}</div>
                <div className="kpi-value">{dash.totals.overdue}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconBolt size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.tasks.kpiCriticalOverdue}</div>
                <div className="kpi-value">{dash.totals.criticalOverdue}</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconTasks size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.tasks.kpiReturnRate}</div>
                <div className="kpi-value">{dash.totals.returnRate}%</div>
              </div>
            </div>
            <div className="item item-compact kpi-card">
              <div className="kpi-icon">
                <IconCheckCircle size={18} />
              </div>
              <div>
                <div className="kpi-label">{t.tasks.kpiApprovedOnTime}</div>
                <div className="kpi-value">{dash.totals.approvedOnTime}</div>
              </div>
            </div>
          </div>
        </section>

        <TaskCharts
          lang={lang}
          status={dash.chartStatus}
          approved={dash.chartApproved}
          tri={dash.chartTri}
        />

        <section className="panel stack">
          <div className="section-head">
            <div>
              <h2 className="h2">{t.tasks.processTitle}</h2>
              <div className="muted small">{t.tasks.processHint}</div>
            </div>
            <span className="pill">{dash.totals.totalTasks}</span>
          </div>
          <div className="process-grid">
            {processFlow.map((step) => (
              <div key={step.key} className={`process-card process-card-${step.tone}`}>
                <div className="process-card-icon">{step.icon}</div>
                <div className="process-card-body">
                  <div className="process-card-label">{step.label}</div>
                  <div className="process-card-value">{step.value}</div>
                </div>
                <span className={statusPillClass(step.key)}>{statusLabel(step.key)}</span>
              </div>
            ))}
          </div>
        </section>

        {canManage ? (
          <section className="panel stack">
            <h2 className="h2">{t.tasks.managerStatsTitle}</h2>
            <div className="muted small">{t.tasks.managerStatsHint}</div>
            <div className="list">
              {dash.byEmployee.map((row) => (
                <div key={row.id} className="item item-compact">
                  <div>
                    <div className="item-title">{row.name}</div>
                    <div className="muted small">{row.email}</div>
                    <div className="bars">
                      <div className="bar-row">
                        <div className="bar-label">{t.tasks.statsOpen}</div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${row.total ? Math.round((row.open / row.total) * 100) : 0}%` }} />
                        </div>
                        <div className="bar-value">{row.open}</div>
                      </div>
                      <div className="bar-row">
                        <div className="bar-label">{t.tasks.statsForApproval}</div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${row.total ? Math.round((row.forApproval / row.total) * 100) : 0}%` }} />
                        </div>
                        <div className="bar-value">{row.forApproval}</div>
                      </div>
                      <div className="bar-row">
                        <div className="bar-label">{t.tasks.statsApproved}</div>
                        <div className="bar-track">
                          <div className="bar-fill" style={{ width: `${row.total ? Math.round((row.approved / row.total) * 100) : 0}%` }} />
                        </div>
                        <div className="bar-value">{row.approved}</div>
                      </div>
                    </div>
                  </div>
                  <div className="pills">
                    {row.criticalOverdue ? <span className="pill pill-red">{t.tasks.criticalOverdue}: {row.criticalOverdue}</span> : null}
                    {row.overdue ? <span className="pill pill-orange">{t.tasks.overdue}: {row.overdue}</span> : null}
                    <span className="pill">{t.tasks.statsTotal}: {row.total}</span>
                  </div>
                </div>
              ))}
              {dash.byEmployee.length === 0 ? <div className="muted">{t.tasks.managerStatsEmpty}</div> : null}
            </div>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="panel stack">
            <h2 className="h2">{t.tasks.createTitle}</h2>
            <form className="stack" action={createTaskAction}>
              <div className="grid2">
                <label className="field">
                  <span className="label">{t.tasks.titleLabel}</span>
                  <input className="input" name="title" type="text" required />
                </label>

                <label className="field">
                  <span className="label">{t.tasks.priority}</span>
                  <select className="input" name="priority" defaultValue="MED">
                    <option value="LOW">LOW</option>
                    <option value="MED">MED</option>
                    <option value="HIGH">HIGH</option>
                    <option value="CRIT">CRIT</option>
                  </select>
                </label>

                <label className="field">
                  <span className="label">{t.tasks.due}</span>
                  <input className="input" name="dueIso" type="date" required />
                </label>

                <label className="field">
                  <span className="label">{t.tasks.team}</span>
                  <select className="input" name="teamId" defaultValue="">
                    <option value="">{t.tasks.teamAuto}</option>
                    {pickers?.teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field">
                <span className="label">{t.tasks.employee}</span>
                <select className="input" name="assigneeId" required defaultValue="">
                  <option value="" disabled>
                    {t.tasks.selectEmployee}
                  </option>
                  {pickers?.teams.map((team) => (
                    <optgroup key={team.id} label={team.name}>
                      {(pickers.employeesByTeam[team.id] || []).map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name} ({e.email})
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="field">
                <span className="label">{t.tasks.description}</span>
                <textarea className="input textarea" name="description" rows={5} required />
              </label>

              <button className="button" type="submit">
                {t.tasks.createBtn}
              </button>
            </form>
          </section>
        ) : null}

        {isAdmin ? (
          <section className="panel stack">
            <h2 className="h2">{t.tasks.approvals}</h2>
            <div className="muted small">{t.tasks.approvalsHint}</div>
            <div className="list">
              {dash.approvals.filter((x) => x.canApprove).map((task) => (
                <details key={task.taskId} className="item stack">
                  <summary className="item-top" style={{ cursor: "pointer" }}>
                    <div>
                      <div className="item-title">{task.title}</div>
                      <div className="muted small">
                        {task.assignee.name} · {task.assignee.email} · {task.team?.name || "—"} · {t.tasks.due}: {task.dueIso || "—"}
                      </div>
                    </div>
                    <div className="pills">
                      <span className={statusPillClass(task.status)}>{statusLabel(task.status)}</span>
                      <span className={`pill pill-priority priority-${task.priority.toLowerCase()}`}>{priorityLabel(task.priority)}</span>
                    </div>
                  </summary>

                  {task.empComment ? (
                    <div className="muted small">
                      <b>{t.tasks.employeeComment}:</b> {task.empComment}
                    </div>
                  ) : null}

                  <div className="grid2">
                    <form className="stack" action={approveTaskFormAction}>
                      <input type="hidden" name="taskId" value={task.taskId} />
                      <label className="field">
                        <span className="label">{t.tasks.adminComment}</span>
                        <textarea className="input" name="comment" rows={3} />
                      </label>
                      <button className="button" type="submit">
                        {t.tasks.approve}
                      </button>
                    </form>

                    <form className="stack" action={returnTaskFormAction}>
                      <input type="hidden" name="taskId" value={task.taskId} />
                      <label className="field">
                        <span className="label">{t.tasks.adminComment}</span>
                        <textarea className="input" name="comment" rows={3} />
                      </label>
                      <button className="button button-secondary" type="submit">
                        {t.tasks.return}
                      </button>
                    </form>
                  </div>
                </details>
              ))}
              {dash.approvals.filter((x) => x.canApprove).length === 0 ? (
                <div className="muted">{t.tasks.emptyApprovals}</div>
              ) : null}
            </div>
          </section>
        ) : null}

        <section className="panel stack">
          <h2 className="h2">{t.tasks.listTitle}</h2>
          <div className="list">
            {dash.tasks.slice(0, 200).map((task) => (
              <details key={task.taskId} className={`item stack ${task.criticalOverdue ? "item-critical" : task.overdue ? "item-overdue" : ""}`}>
                <summary className="item-top" style={{ cursor: "pointer" }}>
                  <div>
                    <div className="item-title">{task.title}</div>
                    <div className="muted small">
                      {t.tasks.employee}: {task.assignee.name} · {task.team?.name || "—"} · {t.tasks.delegated}: {task.delegatedIso} · {t.tasks.due}:{" "}
                      {task.dueIso || "—"} · {t.tasks.returned}: {task.returnedCount}
                    </div>
                  </div>
                  <div className="pills">
                    {task.criticalOverdue ? <span className="pill pill-red">{t.tasks.criticalOverdue}</span> : null}
                    {task.overdue && !task.criticalOverdue ? <span className="pill pill-orange">{t.tasks.overdue}</span> : null}
                    <span className={statusPillClass(task.status)}>{statusLabel(task.status)}</span>
                    <span className={`pill pill-priority priority-${task.priority.toLowerCase()}`}>{priorityLabel(task.priority)}</span>
                  </div>
                </summary>

                {task.description ? <div className="muted small">{task.description}</div> : null}

                <div className="grid2">
                  <div className="stack">
                    {task.empComment ? (
                      <div className="muted small">
                        <b>{t.tasks.employeeComment}:</b> {task.empComment}
                      </div>
                    ) : null}
                    {task.adminComment ? (
                      <div className="muted small">
                        <b>{t.tasks.adminComment}:</b> {task.adminComment}
                      </div>
                    ) : null}
                  </div>

                  <div className="stack">
                    {task.status !== "APPROVED" && task.status !== "FOR_APPROVAL" && !isAdmin ? (
                      <form className="stack" action={submitForApprovalAction}>
                        <input type="hidden" name="taskId" value={task.taskId} />
                        <label className="field">
                          <span className="label">{t.tasks.submitComment}</span>
                          <textarea className="input" name="comment" rows={3} required />
                        </label>
                        <button className="button" type="submit">
                          {t.tasks.submit}
                        </button>
                      </form>
                    ) : null}

                    {isAdmin && task.canApprove ? (
                      <div className="stack">
                        <form className="stack" action={approveTaskFormAction}>
                          <input type="hidden" name="taskId" value={task.taskId} />
                          <label className="field">
                            <span className="label">{t.tasks.adminComment}</span>
                            <textarea className="input" name="comment" rows={2} />
                          </label>
                          <button className="button" type="submit">
                            {t.tasks.approve}
                          </button>
                        </form>

                        <form className="stack" action={returnTaskFormAction}>
                          <input type="hidden" name="taskId" value={task.taskId} />
                          <label className="field">
                            <span className="label">{t.tasks.adminComment}</span>
                            <textarea className="input" name="comment" rows={2} />
                          </label>
                          <button className="button button-secondary" type="submit">
                            {t.tasks.return}
                          </button>
                        </form>

                        <form className="stack" action={cancelTaskFormAction}>
                          <input type="hidden" name="taskId" value={task.taskId} />
                          <label className="field">
                            <span className="label">{t.tasks.adminComment}</span>
                            <input className="input" name="comment" type="text" placeholder={t.tasks.cancelOptional} />
                          </label>
                          <button className="button button-danger" type="submit">
                            {t.tasks.cancel}
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                </div>
              </details>
            ))}
            {dash.tasks.length === 0 ? <div className="muted">{t.tasks.empty}</div> : null}
          </div>
        </section>

      </div>
    </main>
  );
}
