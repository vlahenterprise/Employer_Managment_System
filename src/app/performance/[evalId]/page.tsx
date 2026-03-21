import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import UserMenu from "../../dashboard/UserMenu";
import { getRequestLang } from "@/i18n/server";
import { getI18n, type Lang } from "@/i18n";
import { getPerformanceEvaluationDetail, getPerformanceHistoryForEmployee } from "@/server/performance";
import { IconArrowLeft, IconPdf, IconTrash } from "@/components/icons";
import {
  cancelEvalAction,
  closeEvalAction,
  deleteEvalAction,
  lockEvalAction,
  saveGoalsAction,
  saveManagerReviewAction,
  savePersonalReviewAction,
  saveSelfReviewAction,
  submitSelfReviewAction,
  unlockEvalAction
} from "../actions";
import { APP_TIMEZONE, getAppSettings } from "@/server/app-settings";
import { formatInTimeZone } from "@/server/time";

function mapMsg(t: ReturnType<typeof getI18n>, code: string | null, isSuccess: boolean) {
  const c = String(code || "");
  if (!c) return null;
  if (!isSuccess) {
    if (c === "GOALS_LOCKED") return t.performance.msgGoalsLocked;
    if (c === "DEADLINE_PASSED") return t.performance.msgDeadlinePassed;
    if (c === "SELF_SUBMIT_WINDOW") return t.performance.msgSelfSubmitWindow;
    if (c === "BAD_PASSWORD") return t.performance.msgBadPassword;
    if (c === "NOT_LOCKED") return t.performance.msgNotLocked;
    if (c === "PERIOD_NOT_ENDED") return t.performance.msgPeriodNotEnded;
    if (c === "LOCKED") return t.performance.msgDeleteLocked;
    if (c === "CLOSED") return t.performance.msgDeleteClosed;
    return t.performance.msgGenericError(c);
  }
  if (c === "GOALS_SAVED") return t.performance.msgGoalsSaved;
  if (c === "SELF_SAVED") return t.performance.msgSelfSaved;
  if (c === "SELF_SUBMITTED") return t.performance.msgSelfSubmitted;
  if (c === "MANAGER_SAVED") return t.performance.msgManagerSaved;
  if (c === "PERSONAL_SAVED") return t.performance.msgPersonalSaved;
  if (c === "LOCKED") return t.performance.msgLocked;
  if (c === "UNLOCKED") return t.performance.msgUnlocked;
  if (c === "CANCELLED") return t.performance.msgCancelled;
  if (c === "DELETED") return t.performance.msgDeleted;
  if (c.startsWith("CLOSED:")) return t.performance.msgClosed(c.slice("CLOSED:".length));
  return c;
}

function pickLangText(value: string | null | undefined, lang: Lang) {
  const s = String(value || "").trim();
  if (!s) return s;
  const separators = [" || ", " | ", " / "];
  for (const sep of separators) {
    if (!s.includes(sep)) continue;
    const parts = s.split(sep).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) return lang === "sr" ? parts[0] : parts[1];
  }
  return s;
}

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

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function ScoreRing({
  label,
  display,
  pct,
  sub
}: {
  label: string;
  display: string;
  pct: number;
  sub?: string;
}) {
  const safePct = Number.isFinite(pct) ? pct : 0;
  const ringPct = clamp(safePct, 0, 100);
  const over = safePct > 100;
  return (
    <div className="score-card">
      <div className={`score-ring${over ? " score-ring-over" : ""}`} style={{ ["--score" as any]: `${ringPct}` }}>
        <span>{display}</span>
      </div>
      <div className="score-meta">
        <div className="score-label">{label}</div>
        {sub ? <div className="muted small">{sub}</div> : null}
      </div>
    </div>
  );
}

function getPerformanceFocus(params: {
  lang: Lang;
  status: string;
  locked: boolean;
  canEditGoals: boolean;
  canSelfEdit: boolean;
  canManagerReview: boolean;
}) {
  const { lang, status, locked, canEditGoals, canSelfEdit, canManagerReview } = params;
  const sr = lang === "sr";

  if (status === "CLOSED") {
    return {
      tone: "approved",
      label: sr ? "Finalizovano" : "Finalized",
      text: sr
        ? "Evaluacija je zatvorena i finalni score je zaključan za istoriju i KPI pregled."
        : "The evaluation is closed and the final score is locked for history and KPI visibility."
    };
  }

  if (locked) {
    return {
      tone: "muted",
      label: sr ? "Zaključano" : "Locked",
      text: sr
        ? "Evaluacija je privremeno zaključana. Sledeći korak je otključavanje ili finalizacija."
        : "The evaluation is temporarily locked. The next step is either unlocking or finalizing it."
    };
  }

  if (canEditGoals) {
    return {
      tone: "review",
      label: sr ? "Postavi ciljeve" : "Set goals",
      text: sr
        ? "Menadžer prvo treba da definiše 2–5 ciljeva i da ukupna težina ostane 100%."
        : "The manager should first define 2–5 goals and keep the total weight at 100%."
    };
  }

  if (canSelfEdit) {
    return {
      tone: "progress",
      label: sr ? "Čeka self-review" : "Waiting self-review",
      text: sr
        ? "Zaposleni sada popunjava self-assessment po ciljevima pre konačnog manager review-a."
        : "The employee now completes the self-assessment per goal before the final manager review."
    };
  }

  if (canManagerReview || status === "SELF_SUBMITTED") {
    return {
      tone: "review",
      label: sr ? "Čeka manager review" : "Waiting manager review",
      text: sr
        ? "Self-review je završen. Menadžer sada daje finalne goal score-ove i personal evaluation."
        : "The self-review is finished. The manager now gives the final goal scores and personal evaluation."
    };
  }

  return {
    tone: "muted",
    label: sr ? "U toku" : "In progress",
    text: sr
      ? "Evaluacija je otvorena i čeka sledeći korak prema trenutnim dozvolama i statusu."
      : "The evaluation is open and waiting for the next step based on the current permissions and status."
  };
}

export default async function PerformanceEvalPage({
  params,
  searchParams
}: {
  params: { evalId: string };
  searchParams: { success?: string; error?: string };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const t = getI18n(lang);

  const evalId = String(params.evalId || "").trim();
  const detail = await getPerformanceEvaluationDetail({ id: user.id, role: user.role }, evalId);
  if (!detail.ok) {
    return (
      <main className="page">
        <div className="card stack">
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
              <Link className="button button-secondary" href="/performance">
                <IconArrowLeft size={18} /> {t.performance.backToList}
              </Link>
              <Link className="button button-secondary" href="/dashboard">
                <IconArrowLeft size={18} /> {t.common.backToDashboard}
              </Link>
            </div>
          </div>
          <div className="error">{t.performance.msgGenericError(detail.error)}</div>
        </div>
      </main>
    );
  }

  const e = detail.evaluation;
  const canDelete = detail.perms.canManage && !e.locked && e.status !== "CLOSED";
  const goalIds = e.goals.map((g) => g.id).join(",");
  const personalIds = e.personalItems.map((p) => p.id).join(",");

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;
  const message = mapMsg(t, success, true) || mapMsg(t, error, false);
  const messageType = success ? "success" : error ? "error" : null;

  const exportHref = `/api/performance/eval-pdf?evalId=${encodeURIComponent(e.id)}`;
  const settings = await getAppSettings();
  const historyRows = await getPerformanceHistoryForEmployee(e.employeeId);

  const todayIso = formatInTimeZone(new Date(), APP_TIMEZONE, "yyyy-MM-dd");
  const startIso = formatInTimeZone(e.periodStart, APP_TIMEZONE, "yyyy-MM-dd");
  const endIso = formatInTimeZone(e.periodEnd, APP_TIMEZONE, "yyyy-MM-dd");
  const totalDays = Math.max(1, diffDaysIso(startIso, endIso));
  const elapsedDays = clamp(diffDaysIso(startIso, todayIso), 0, totalDays);
  const periodPct = Math.round((elapsedDays / totalDays) * 100);

  const windowStartIso = detail.window.startIso;
  const windowDeadlineIso = detail.window.deadlineIso;
  const windowTotalDays = Math.max(1, diffDaysIso(windowStartIso, windowDeadlineIso));
  const windowElapsed = clamp(diffDaysIso(windowStartIso, todayIso), 0, windowTotalDays);
  const selfWindowPct = Math.round((windowElapsed / windowTotalDays) * 100);
  const selfStartsIn = diffDaysIso(todayIso, windowStartIso);
  const selfDeadlineIn = diffDaysIso(todayIso, windowDeadlineIso);

  const goalsWeightTotal = e.goals.reduce((sum, g) => sum + Math.max(0, Number(g.weight || 0)), 0);
  const employeeGoalsScore = goalsWeightTotal
    ? e.goals.reduce((sum, g) => sum + Math.max(0, Number(g.weight || 0)) * Number(g.employeeScore || 0), 0) / goalsWeightTotal
    : null;
  const managerGoalsScore = goalsWeightTotal
    ? e.goals.reduce((sum, g) => sum + Math.max(0, Number(g.weight || 0)) * Number(g.managerScore || 0), 0) / goalsWeightTotal
    : null;
  const personalAvg =
    e.personalItems.length > 0
      ? e.personalItems.reduce((sum, p) => sum + Number(p.managerRating || 0), 0) / e.personalItems.length
      : null;
  const personalPct = personalAvg != null ? (personalAvg / 10) * 100 : null;
  const wP = Number(settings.PerformancePersonalWeight || 30) / 100;
  const wG = Number(settings.PerformanceGoalsWeight || 70) / 100;
  const finalComputed =
    managerGoalsScore != null && personalPct != null ? personalPct * wP + managerGoalsScore * wG : null;
  const finalScore = e.finalScore != null ? Number(e.finalScore || 0) : finalComputed;

  const selfCompleted = e.goals.filter((g) => String(g.employeeComment || "").trim() || g.employeeScore != null).length;
  const managerGoalsCompleted = e.goals.filter((g) => String(g.managerComment || "").trim() && g.managerScore != null).length;
  const personalCompleted = e.personalItems.filter((p) => String(p.managerComment || "").trim() && p.managerRating != null).length;
  const managerTotal = e.goals.length + e.personalItems.length;
  const managerCompleted = managerGoalsCompleted + personalCompleted;
  const focus = getPerformanceFocus({
    lang,
    status: e.status,
    locked: e.locked,
    canEditGoals: detail.perms.canEditGoals,
    canSelfEdit: detail.perms.canSelfEdit,
    canManagerReview: detail.perms.canManagerReview
  });
  const activeWorkflowStep = e.status === "CLOSED"
    ? 4
    : detail.perms.canManagerReview || e.status === "SELF_SUBMITTED"
      ? 3
      : detail.perms.canSelfEdit || selfCompleted > 0
        ? 2
        : 1;

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
                  <h1 className="brand-title">{t.performance.detailTitle}</h1>
                  <p className="muted">
                    {e.employee.name} · {e.periodLabel} · {t.performance.status}: {e.status} ·{" "}
                    {e.locked ? t.performance.locked : t.performance.unlocked}
                  </p>
                </div>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/performance">
                  <IconArrowLeft size={18} /> {t.performance.backToList}
                </Link>
                <a className="button button-secondary" href={exportHref} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {t.performance.exportPdf}
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

        {message && messageType ? <div className={messageType === "success" ? "success" : "error"}>{message}</div> : null}

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={lang === "sr" ? "Tok evaluacije" : "Evaluation flow"}
                  tooltip={
                    lang === "sr"
                      ? "Ovaj blok ne menja score logiku. Samo pokazuje gde je evaluacija sada, ko je na potezu i šta je sledeći korak."
                      : "This block does not change the scoring logic. It simply shows where the evaluation is now, who owns the next move, and what should happen next."
                  }
                />
              </h2>
              <p className="muted small">{focus.text}</p>
            </div>
            <div className="pills">
              <span className={`pill pill-status pill-status-${focus.tone}`}>{focus.label}</span>
              <span className="pill pill-blue">
                {lang === "sr" ? "Status" : "Status"}: {e.status}
              </span>
            </div>
          </div>

          <div className="workflow-strip">
            {[
              {
                index: 1,
                title: lang === "sr" ? "Ciljevi" : "Goals",
                text: lang === "sr" ? "Menadžer postavlja 2–5 ciljeva sa ukupnom težinom 100%." : "The manager sets 2–5 goals with a total weight of 100%."
              },
              {
                index: 2,
                title: lang === "sr" ? "Self-assessment" : "Self-assessment",
                text: lang === "sr" ? "Zaposleni ocenjuje svaki cilj u opsegu 0–200%." : "The employee rates each goal in the 0–200% range."
              },
              {
                index: 3,
                title: lang === "sr" ? "Manager review" : "Manager review",
                text: lang === "sr" ? "Menadžer daje finalne score-ove po ciljevima i personal evaluation." : "The manager gives the final goal scores and personal evaluation."
              },
              {
                index: 4,
                title: lang === "sr" ? "Final score" : "Final score",
                text: lang === "sr" ? "Finalni rezultat zadržava postojeću 70/30 logiku i može preći 100%." : "The final result keeps the existing 70/30 logic and can exceed 100%."
              }
            ].map((step) => (
              <div key={step.index} className={`workflow-step${activeWorkflowStep === step.index ? " is-active" : ""}`}>
                <div className="workflow-step-index">{step.index}</div>
                <div className="flow-step-copy">
                  <div className="flow-step-title">{step.title}</div>
                  <div className="flow-step-text">{step.text}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={t.performance.detailProgressTitle}
                  tooltip={
                    lang === "sr"
                      ? "Ove progress trake pomažu da se odmah vidi ko još nije završio svoj deo evaluacije i koliko je ostalo do kraja perioda."
                      : "These progress bars make it easy to see who still needs to complete their part of the evaluation and how much time is left in the cycle."
                  }
                />
              </h2>
            </div>
          </div>
          <div className="grid2">
            <div className="item stack">
              <div className="item-title">{t.performance.detailEmployeeProgress}</div>
              <div className="muted small">
                {t.performance.detailSelfProgress(selfCompleted, e.goals.length)}
              </div>
              <div className="progress-track">
                <span style={{ width: `${e.goals.length ? Math.round((selfCompleted / e.goals.length) * 100) : 0}%` }} />
              </div>
            </div>
            <div className="item stack">
              <div className="item-title">{t.performance.detailManagerProgress}</div>
              <div className="muted small">
                {t.performance.detailManagerProgressHint(managerCompleted, managerTotal)}
              </div>
              <div className="progress-track">
                <span style={{ width: `${managerTotal ? Math.round((managerCompleted / managerTotal) * 100) : 0}%` }} />
              </div>
            </div>
            <div className="item stack">
              <div className="item-title">{t.performance.detailPeriodProgress}</div>
              <div className="muted small">
                {t.performance.detailPeriodLeft(Math.max(0, diffDaysIso(todayIso, endIso)))}
              </div>
              <div className="progress-track">
                <span style={{ width: `${periodPct}%` }} />
              </div>
            </div>
            <div className="item stack">
              <div className="item-title">{t.performance.detailSelfWindow}</div>
              <div className="muted small">
                {todayIso < windowStartIso
                  ? t.performance.detailSelfStarts(selfStartsIn)
                  : t.performance.detailSelfDeadline(selfDeadlineIn)}
              </div>
              <div className="progress-track">
                <span style={{ width: `${selfWindowPct}%` }} />
              </div>
            </div>
          </div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={t.performance.detailScoresTitle}
                  tooltip={
                    lang === "sr"
                      ? "Goals deo ostaje 70%, personal evaluation 30%. Manager final score po cilju i dalje može da ide do 200%."
                      : "The goals part stays 70% and personal evaluation stays 30%. The manager final goal score can still go up to 200%."
                  }
                />
              </h2>
            </div>
          </div>
          <div className="score-grid">
            <ScoreRing
              label={t.performance.detailEmployeeGoals}
              display={employeeGoalsScore != null ? `${Math.round(employeeGoalsScore * 10) / 10}%` : "—"}
              pct={employeeGoalsScore != null ? clamp(employeeGoalsScore / 2, 0, 100) : 0}
              sub={t.performance.detailEmployeeGoalsHint}
            />
            <ScoreRing
              label={t.performance.detailManagerGoals}
              display={managerGoalsScore != null ? `${Math.round(managerGoalsScore * 10) / 10}%` : "—"}
              pct={managerGoalsScore != null ? clamp(managerGoalsScore / 2, 0, 100) : 0}
              sub={t.performance.detailManagerGoalsHint}
            />
            <ScoreRing
              label={t.performance.detailPersonal}
              display={personalAvg != null ? `${Math.round(personalAvg * 10) / 10} / 10` : "—"}
              pct={personalPct != null ? clamp(personalPct, 0, 100) : 0}
              sub={personalPct != null ? `${Math.round(personalPct * 10) / 10}%` : ""}
            />
            <ScoreRing
              label={t.performance.detailFinal}
              display={finalScore != null ? `${Math.round(finalScore * 10) / 10}%` : "—"}
              pct={finalScore != null ? clamp(finalScore, 0, 100) : 0}
              sub={t.performance.detailFinalHint(settings.PerformanceGoalsWeight, settings.PerformancePersonalWeight)}
            />
          </div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">{t.performance.detailHistoryTitle}</h2>
            </div>
          </div>
          <div className="list">
            {historyRows.map((r) => (
              <div key={r.id} className="item item-compact">
                <div>
                  <div className="item-title">{r.periodLabel}</div>
                  <div className="muted small">
                    {t.performance.finalScore}: {Math.round(Number(r.finalScore || 0) * 10) / 10}%
                  </div>
                </div>
                <div className="score-badge">
                  {Math.round(Number(r.finalScore || 0) * 10) / 10}%
                </div>
              </div>
            ))}
            {historyRows.length === 0 ? <div className="muted">{t.performance.charts.empty}</div> : null}
          </div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">{t.performance.metaTitle}</h2>
            </div>
          </div>
          <div className="list">
            <div className="item item-compact">
              <div>
                <div className="item-title">{t.performance.employee}</div>
                <div className="muted small">
                  {e.employee.name} · {e.employee.email} · {e.employee.team?.name || "—"} · {e.employee.position || "—"}
                </div>
              </div>
              <span className="pill">{e.status}</span>
            </div>
            <div className="item item-compact">
              <div>
                <div className="item-title">{t.performance.manager}</div>
                <div className="muted small">
                  {e.manager.name} · {e.manager.email}
                </div>
              </div>
              <span className="pill">{e.locked ? t.performance.locked : t.performance.unlocked}</span>
            </div>
            {e.finalScore != null ? (
              <div className="item item-compact">
                <div>
                  <div className="item-title">{t.performance.finalScore}</div>
                  <div className="muted small">
                    {t.performance.personalScore}: {Math.round(Number(e.personalScore || 0) * 10) / 10} · {t.performance.goalsScore}:{" "}
                    {Math.round(Number(e.goalsScore || 0) * 10) / 10}
                  </div>
                </div>
                <span className="pill pill-blue">{Math.round(Number(e.finalScore || 0) * 10) / 10}</span>
              </div>
            ) : null}
          </div>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip
                  label={t.performance.goalsTitle}
                  tooltip={
                    lang === "sr"
                      ? "Ciljevi ostaju srž kvartalne evaluacije. Minimum su 2, maksimum 5, a ukupna težina mora da ostane 100%."
                      : "Goals remain the core of the quarterly evaluation. The minimum is 2, the maximum is 5, and total weight must remain 100%."
                  }
                />
              </h2>
            </div>
          </div>
          {detail.perms.canEditGoals ? (
            <form className="stack" action={saveGoalsAction}>
              <input type="hidden" name="evalId" value={e.id} />
              <div className="muted small">{t.performance.goalsHint}</div>
              <div className="list">
                {Array.from({ length: 5 }).map((_, idx) => {
                  const goal = e.goals[idx];
                  const n = idx + 1;
                  return (
                    <div key={n} className="item stack">
                      <input type="hidden" name={`goalId${n}`} value={goal?.id || ""} />
                      <div className="grid2">
                        <label className="field">
                          <span className="label">{t.performance.goalTitle}</span>
                          <input className="input" name={`goalTitle${n}`} type="text" defaultValue={goal?.title || ""} />
                        </label>
                        <label className="field">
                          <span className="label">{t.performance.goalWeight}</span>
                          <input
                            className="input"
                            name={`goalWeight${n}`}
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            defaultValue={goal?.weight != null ? Number(goal.weight) : 0}
                          />
                        </label>
                      </div>
                      <label className="field">
                        <span className="label">{t.performance.goalDescription}</span>
                        <textarea
                          className="input"
                          name={`goalDesc${n}`}
                          rows={2}
                          style={{ resize: "vertical" }}
                          defaultValue={goal?.description || ""}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
              <button className="button button-secondary" type="submit">
                {t.performance.saveGoals}
              </button>
            </form>
          ) : (
            <div className="list">
              {e.goals.map((g) => (
                <div key={g.id} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{g.title}</div>
                      <div className="muted small">
                        {t.performance.goalWeight}: {Math.round(Number(g.weight || 0) * 10) / 10}%
                      </div>
                    </div>
                  </div>
                  {g.description ? <div className="muted small">{g.description}</div> : null}
                </div>
              ))}
              {e.goals.length === 0 ? <div className="muted">{t.performance.emptyGoals}</div> : null}
            </div>
          )}
        </section>

        {detail.perms.isEmployee ? (
          <section className="panel stack">
            <div className="section-head">
              <div className="section-copy">
                <h2 className="h2">
                  <LabelWithTooltip
                    label={t.performance.selfTitle}
                    tooltip={
                      lang === "sr"
                        ? "Zaposleni ovde unosi svoju procenu po cilju. Ovaj deo je informativan za menadžera i ne menja finalnu logiku ocenjivanja."
                        : "The employee enters their own assessment per goal here. This informs the manager but does not change the final scoring logic."
                    }
                  />
                </h2>
              </div>
            </div>
            <div className="muted small">
              {t.performance.selfWindow(detail.window.startIso, detail.window.deadlineIso, detail.window.endIso)}
            </div>
            {detail.perms.canSelfEdit ? (
              <form className="stack" action={saveSelfReviewAction}>
                <input type="hidden" name="evalId" value={e.id} />
                <input type="hidden" name="goalIds" value={goalIds} />
                <div className="list">
                  {e.goals.map((g) => (
                    <div key={g.id} className="item stack">
                      <div className="item-title">{g.title}</div>
                      <div className="grid2">
                        <label className="field">
                          <span className="label">{t.performance.selfPercent}</span>
                          <input
                            className="input"
                            name={`selfPct:${g.id}`}
                            type="number"
                            min={0}
                            max={200}
                            step={1}
                            defaultValue={g.employeeScore != null ? Number(g.employeeScore) : 0}
                          />
                        </label>
                        <label className="field">
                          <span className="label">{t.performance.selfComment}</span>
                          <textarea
                            className="input"
                            name={`selfCmt:${g.id}`}
                            rows={2}
                            style={{ resize: "vertical" }}
                            defaultValue={g.employeeComment || ""}
                            required
                          />
                        </label>
                      </div>
                    </div>
                  ))}
                  {e.goals.length === 0 ? <div className="muted">{t.performance.emptyGoals}</div> : null}
                </div>
                <button className="button button-secondary" type="submit" disabled={e.goals.length === 0}>
                  {t.performance.saveSelf}
                </button>
              </form>
            ) : (
              <div className="muted">{t.performance.selfReadOnly}</div>
            )}

            {detail.perms.canSelfSubmit ? (
              <form action={submitSelfReviewAction}>
                <input type="hidden" name="evalId" value={e.id} />
                <button className="button" type="submit" disabled={e.goals.length === 0}>
                  {t.performance.submitSelf}
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        {detail.perms.canManagerReview ? (
          <section className="panel stack">
            <div className="section-head">
              <div className="section-copy">
                <h2 className="h2">
                  <LabelWithTooltip
                    label={t.performance.managerReviewTitle}
                    tooltip={
                      lang === "sr"
                        ? "Menadžer daje finalni procenat po cilju i personal evaluation 1–10. Time se završava score logika za ovaj ciklus."
                        : "The manager gives the final percentage per goal and the personal evaluation from 1–10. This completes the scoring logic for the cycle."
                    }
                  />
                </h2>
              </div>
            </div>

            <form className="stack" action={saveManagerReviewAction}>
              <input type="hidden" name="evalId" value={e.id} />
              <input type="hidden" name="goalIds" value={goalIds} />
              <div className="list">
                {e.goals.map((g) => (
                  <div key={g.id} className="item stack">
                    <div className="item-title">{g.title}</div>
                    <div className="grid2">
                      <label className="field">
                        <span className="label">{t.performance.managerPercent}</span>
                        <input
                          className="input"
                          name={`mgrPct:${g.id}`}
                          type="number"
                          min={0}
                          max={200}
                          step={1}
                          defaultValue={g.managerScore != null ? Number(g.managerScore) : 0}
                        />
                      </label>
                      <label className="field">
                        <span className="label">{t.performance.managerComment}</span>
                        <textarea
                          className="input"
                          name={`mgrCmt:${g.id}`}
                          rows={2}
                          style={{ resize: "vertical" }}
                          defaultValue={g.managerComment || ""}
                          required
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {e.goals.length === 0 ? <div className="muted">{t.performance.emptyGoals}</div> : null}
              </div>
              <button className="button button-secondary" type="submit" disabled={e.goals.length === 0}>
                {t.performance.saveManager}
              </button>
            </form>

            <div className="divider">
              <span>{t.performance.personalTitle}</span>
            </div>

            <form className="stack" action={savePersonalReviewAction}>
              <input type="hidden" name="evalId" value={e.id} />
              <input type="hidden" name="personalIds" value={personalIds} />
              <div className="list">
                {e.personalItems.map((p) => (
                  <div key={p.id} className="item stack">
                    <div className="item-title">
                      #{p.qNo} · {pickLangText(p.area, lang)}
                    </div>
                    <div className="muted small">{pickLangText(p.description, lang)}</div>
                    <div className="muted small">
                      <b>{t.performance.scale}:</b> {pickLangText(p.scale, lang)}
                    </div>
                    <div className="grid2">
                      <label className="field">
                        <span className="label">{t.performance.rating}</span>
                        <input
                          className="input"
                          name={`persRating:${p.id}`}
                          type="number"
                          min={0}
                          max={10}
                          step={1}
                          defaultValue={p.managerRating != null ? Number(p.managerRating) : 0}
                        />
                      </label>
                      <label className="field">
                        <span className="label">{t.performance.managerComment}</span>
                        <textarea
                          className="input"
                          name={`persCmt:${p.id}`}
                          rows={2}
                          style={{ resize: "vertical" }}
                          defaultValue={p.managerComment || ""}
                          required
                        />
                      </label>
                    </div>
                  </div>
                ))}
                {e.personalItems.length === 0 ? <div className="muted">{t.performance.emptyPersonal}</div> : null}
              </div>
              <button className="button button-secondary" type="submit" disabled={e.personalItems.length === 0}>
                {t.performance.savePersonal}
              </button>
            </form>
          </section>
        ) : null}

        {detail.perms.canManage ? (
          <section className="panel stack">
            <div className="section-head">
              <div className="section-copy">
                <h2 className="h2">
                  <LabelWithTooltip
                    label={t.performance.adminActionsTitle}
                    tooltip={
                      lang === "sr"
                        ? "Ove akcije koriste se samo kada treba zaključati, otključati, finalizovati ili administrativno zatvoriti evaluaciju."
                        : "Use these actions only when you need to lock, unlock, finalize, or administratively close the evaluation."
                    }
                  />
                </h2>
              </div>
            </div>
            <div className="grid2">
              <form className="stack" action={lockEvalAction}>
                <input type="hidden" name="evalId" value={e.id} />
                <label className="field">
                  <span className="label">{t.performance.password}</span>
                  <input className="input" name="password" type="password" required />
                </label>
                <button className="button" type="submit">
                  {t.performance.lock}
                </button>
              </form>

              <form className="stack" action={unlockEvalAction}>
                <input type="hidden" name="evalId" value={e.id} />
                <label className="field">
                  <span className="label">{t.performance.password}</span>
                  <input className="input" name="password" type="password" required />
                </label>
                <button className="button button-secondary" type="submit">
                  {t.performance.unlock}
                </button>
              </form>
            </div>

            <form className="stack" action={closeEvalAction}>
              <input type="hidden" name="evalId" value={e.id} />
              <label className="field">
                <span className="label">{t.performance.finalComment}</span>
                <textarea
                  className="input"
                  name="finalComment"
                  rows={3}
                  style={{ resize: "vertical" }}
                  defaultValue={e.managerFinalComment || ""}
                />
              </label>
              <button className="button" type="submit">
                {t.performance.close}
              </button>
              <div className="muted small">{t.performance.closeHint}</div>
            </form>

            <form className="stack" action={cancelEvalAction}>
              <input type="hidden" name="evalId" value={e.id} />
              <label className="field">
                <span className="label">{t.performance.cancelReason}</span>
                <input className="input" name="reason" type="text" />
              </label>
              <button className="button button-danger" type="submit">
                {t.performance.cancel}
              </button>
            </form>

            {canDelete ? (
              <form className="stack" action={deleteEvalAction}>
                <input type="hidden" name="evalId" value={e.id} />
                <button className="button button-danger" type="submit">
                  <IconTrash size={16} /> {t.performance.deleteEval}
                </button>
                <div className="muted small">{t.performance.deleteHint}</div>
              </form>
            ) : null}
          </section>
        ) : null}

      </div>
    </main>
  );
}
