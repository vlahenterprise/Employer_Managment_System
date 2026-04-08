import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { prisma } from "@/server/db";
import { requireActiveUser } from "@/server/current-user";
import { getRequestLang } from "@/i18n/server";
import { getI18n } from "@/i18n";
import { approveAbsenceAction, cancelAbsenceAction, submitAbsenceAction } from "./actions";
import { getAbsenceApprovals, getAbsenceCalendar, getAbsenceManagerStats, getAbsenceRemaining, getMyAbsenceRequests } from "@/server/absence";
import { endOfMonth, startOfMonth } from "date-fns";
import { formatInTimeZone } from "@/server/time";
import { APP_TIMEZONE } from "@/server/app-settings";
import { IconArrowLeft, IconCalendar, IconPdf } from "@/components/icons";
import AbsenceCalendarView from "./AbsenceCalendarView";
import AbsenceRequestForm from "./AbsenceRequestForm";
import { isLegacyAdminRole, isManagerRole } from "@/server/rbac";
import { GuidancePanel } from "@/components/GuidancePanel";

function defaultMonthRange() {
  const now = new Date();
  return {
    fromIso: formatInTimeZone(startOfMonth(now), APP_TIMEZONE, "yyyy-MM-dd"),
    toIso: formatInTimeZone(endOfMonth(now), APP_TIMEZONE, "yyyy-MM-dd")
  };
}

function msgFromCode(t: ReturnType<typeof getI18n>, code: string | null, isSuccess: boolean) {
  const c = String(code || "");
  if (!c) return null;
  if (!isSuccess) {
    if (c === "INVALID_DATE") return t.absence.msgInvalidDate;
    if (c === "INVALID_TYPE") return t.absence.msgInvalidType;
    if (c === "NO_BUSINESS_DAYS") return t.absence.msgNoBusinessDays;
    if (c === "NO_ACCESS") return t.common.admin;
    return t.absence.msgGenericError(c);
  }

  if (c === "SUBMITTED") return t.absence.msgSubmitted;
  if (c.startsWith("OVERLAP:")) {
    const n = Number.parseInt(c.split(":")[1] || "0", 10);
    if (Number.isFinite(n) && n > 0) return t.absence.msgSubmittedOverlap(n);
  }
  if (c === "APPROVED") return t.absence.msgApproved;
  if (c === "REJECTED") return t.absence.msgRejected;
  if (c === "CANCELLED") return t.absence.msgCancelled;
  return c;
}

export default async function AbsencePage({
  searchParams
}: {
  searchParams: {
    fromIso?: string;
    toIso?: string;
    teamId?: string;
    status?: string;
    type?: string;
    includeMine?: string;
    success?: string;
    error?: string;
  };
}) {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const t = getI18n(lang);

  function typeLabel(value: string) {
    const v = String(value || "").trim().toUpperCase();
    if (v === "ANNUAL_LEAVE") return t.absence.typeAnnual;
    if (v === "HOME_OFFICE") return t.absence.typeHome;
    if (v === "SLAVA") return t.absence.typeSlava;
    if (v === "SICK") return t.absence.typeSick;
    if (v === "OTHER") return t.absence.typeOther;
    return value;
  }

  function statusLabel(value: string) {
    const v = String(value || "").trim().toUpperCase();
    if (v === "PENDING") return t.absence.statusPending;
    if (v === "APPROVED") return t.absence.statusApproved;
    if (v === "REJECTED") return t.absence.reject;
    if (v === "CANCELLED") return t.absence.cancel;
    return value;
  }

  function statusPillClass(value: string) {
    const v = String(value || "").trim().toUpperCase();
    if (v === "APPROVED") return "pill pill-status pill-status-approved";
    if (v === "PENDING") return "pill pill-status pill-status-pending";
    if (v === "REJECTED") return "pill pill-status pill-status-rejected";
    if (v === "CANCELLED") return "pill pill-status pill-status-muted";
    return "pill";
  }

  const isManager = isManagerRole(user.role);
  const isAdmin = isLegacyAdminRole(user.role);
  const canReviewAbsences = isAdmin || isManager;

  const rangeDefault = defaultMonthRange();
  const fromIso = String(searchParams.fromIso || rangeDefault.fromIso).trim();
  const toIso = String(searchParams.toIso || rangeDefault.toIso).trim();
  const status = String(searchParams.status || "ALL").trim().toUpperCase();
  const type = String(searchParams.type || "ALL").trim().toUpperCase();
  const includeMine = String(searchParams.includeMine || "").trim() === "1";
  const teamId = isAdmin ? (searchParams.teamId && searchParams.teamId !== "ALL" ? String(searchParams.teamId) : null) : null;

  const success = searchParams.success ? decodeURIComponent(searchParams.success) : null;
  const error = searchParams.error ? decodeURIComponent(searchParams.error) : null;

  const [remaining, myReq, approvals, stats, teams, cal] = await Promise.all([
    getAbsenceRemaining({ id: user.id }),
    getMyAbsenceRequests({ id: user.id }),
    canReviewAbsences ? getAbsenceApprovals({ id: user.id, role: user.role }) : Promise.resolve({ ok: true as const, items: [] as any[] }),
    isAdmin || isManager
      ? getAbsenceManagerStats({ id: user.id, role: user.role })
      : Promise.resolve({ ok: true as const, year: new Date().getFullYear(), items: [] as any[] }),
    isAdmin ? prisma.team.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
    getAbsenceCalendar({
      actor: { id: user.id, role: user.role, teamId: user.teamId },
      range: {
        fromIso,
        toIso,
        teamId,
        status: status === "PENDING" || status === "APPROVED" ? (status as any) : "ALL",
        type: type === "ALL" ? "ALL" : (type as any),
        includeMine
      }
    })
  ]);

  const pdfSelfHref = "/api/absence/export-pdf?scope=self";
  const pdfTeamHref = "/api/absence/export-pdf?scope=team";

  const message = msgFromCode(t, success, true) || msgFromCode(t, error, false);
  const messageType = success ? "success" : error ? "error" : null;
  const guide = lang === "sr"
    ? {
        title: "Kako da koristiš odsustva",
        description: canReviewAbsences
          ? "Prvo proveri dostupnost tima i pending zahteve, pa onda rešavaj pojedinačne odluke."
          : "Prvo proveri preostale dane i kalendar tima, pa onda pošalji zahtev za odsustvo.",
        items: canReviewAbsences
          ? [
              "Kalendar pokazuje ko je odsutan i gde može nastati preklapanje.",
              "Pending zahtevi čekaju tvoje odobrenje ili odbijanje.",
              "Team summary služi za brz pregled kapaciteta, ne za menjanje pravila odsustva."
            ]
          : [
              "Preostali dani pokazuju trenutno dostupne limite.",
              "Sistem upozorava ako postoji preklapanje sa kolegama iz tima.",
              "Posle slanja zahtev čeka odobrenje odgovorne osobe."
            ]
      }
    : {
        title: "How to use absence",
        description: canReviewAbsences
          ? "Start with team availability and pending requests, then resolve individual decisions."
          : "Start with your remaining balance and team calendar, then submit the absence request.",
        items: canReviewAbsences
          ? [
              "The calendar shows who is away and where overlaps may happen.",
              "Pending requests are waiting for your approval or rejection.",
              "Team summary is for capacity visibility, not for changing absence rules."
            ]
          : [
              "Remaining balance shows your currently available limits.",
              "The system warns you when there is a team overlap.",
              "After submission, the request waits for the responsible approver."
            ]
      };

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div>
                <h1 className="brand-title">{t.absence.title}</h1>
                <p className="muted">{t.absence.subtitle}</p>
              </div>
              <div className="inline">
                <Link className="button button-secondary" href="/dashboard">
                  <IconArrowLeft size={18} /> {t.common.backToDashboard}
                </Link>
                <a className="button button-secondary" href="#calendar">
                  <IconCalendar size={18} /> {t.absence.calendarTitle}
                </a>
                <a className="button button-secondary" href={pdfSelfHref} target="_blank" rel="noreferrer">
                  <IconPdf size={18} /> {t.absence.exportPdfSelf}
                </a>
                {canReviewAbsences ? (
                  <a className="button" href={pdfTeamHref} target="_blank" rel="noreferrer">
                    <IconPdf size={18} /> {t.absence.exportPdfTeam}
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {message && messageType ? <div className={messageType === "success" ? "success" : "error"}>{message}</div> : null}

        <GuidancePanel title={guide.title} description={guide.description} items={guide.items} />

        <section className="panel stack">
          <h2 className="h2">
            <LabelWithTooltip
              label={t.absence.remainingTitle}
              tooltip={
                lang === "sr"
                  ? "Ovde vidiš trenutno stanje dostupnih dana po tipu odsustva, uključujući carry-over kada postoji."
                  : "This shows the current remaining balance by absence type, including carry-over when available."
              }
            />
          </h2>
          <div className="grid3">
            <div className="item item-compact">
              <div>
                <div className="muted small">{t.absence.remainingAnnual}</div>
                <div className="item-title">{remaining.annualRemaining}</div>
              </div>
            </div>
            <div className="item item-compact">
              <div>
                <div className="muted small">{t.absence.remainingHomeOffice}</div>
                <div className="item-title">{remaining.homeOfficeRemaining}</div>
              </div>
            </div>
            <div className="item item-compact">
              <div>
                <div className="muted small">{t.absence.remainingSlava}</div>
                <div className="item-title">{remaining.slavaRemaining}</div>
              </div>
            </div>
            <div className="item item-compact">
              <div>
                <div className="muted small">{t.absence.carryover}</div>
                <div className="item-title">{remaining.carryover}</div>
                <div className="muted small">
                  {t.absence.carryoverUntil}: {remaining.carryoverUntil}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="panel stack">
          <h2 className="h2">
            <LabelWithTooltip
              label={t.absence.newRequestTitle}
              tooltip={
                lang === "sr"
                  ? "Pošalji novi zahtev za odsustvo. Sistem će te upozoriti ako je neko iz tvog tima već odsutan u istom periodu."
                  : "Submit a new absence request. The system will warn you if someone from your team is already absent in the same period."
              }
            />
          </h2>
          <AbsenceRequestForm lang={lang} timeZone={APP_TIMEZONE} action={submitAbsenceAction} />
        </section>

        <section className="panel stack">
          <h2 className="h2">
            <LabelWithTooltip
              label={t.absence.myRequestsTitle}
              tooltip={
                lang === "sr"
                  ? "Lista tvojih zahteva sa statusima, komentarima i upozorenjem ako postoji team overlap."
                  : "Your request history with statuses, comments, and a warning when there is a team overlap."
              }
            />
          </h2>
          <div className="list">
            {myReq.items.map((r) => (
              <details key={r.absenceId} className="item stack">
                <summary className="item-top" style={{ cursor: "pointer" }}>
                  <div>
                    <div className="item-title">
                      {typeLabel(r.type)} · {r.fromIso} → {r.toIso}
                    </div>
                    <div className="muted small">
                      {t.absence.days}: {r.days} · {t.absence.status}: {statusLabel(r.status)}
                      {r.overlapWarning ? ` · ${t.absence.overlapWarning}` : ""}
                    </div>
                  </div>
                  <div className="pills">
                    {r.overlapWarning ? <span className="pill pill-status pill-status-pending">{t.absence.overlapWarning}</span> : null}
                    <span className={statusPillClass(r.status)}>{statusLabel(r.status)}</span>
                  </div>
                </summary>

                {r.comment ? (
                  <div className="muted small">
                    <b>{t.absence.comment}:</b> {r.comment}
                  </div>
                ) : null}
                {r.approvedAtIso || r.approverEmail ? (
                  <div className="muted small">
                    <b>{t.absence.approvedAt}:</b> {r.approvedAtIso || "—"} · <b>{t.absence.approver}:</b>{" "}
                    {r.approverEmail || "—"}
                  </div>
                ) : null}

                <form className="inline" action={cancelAbsenceAction}>
                  <input type="hidden" name="absenceId" value={r.absenceId} />
                  <input className="input" name="comment" type="text" placeholder={t.absence.cancelOptional} />
                  <button className="button button-danger" type="submit">
                    {t.absence.cancel}
                  </button>
                </form>
              </details>
            ))}
            {myReq.items.length === 0 ? <div className="muted">{t.absence.emptyMy}</div> : null}
          </div>
        </section>

        <section id="calendar" className="panel stack">
          <div className="section-head">
            <div>
              <h2 className="h2">
                <LabelWithTooltip
                  label={t.absence.calendarTitle}
                  tooltip={
                    lang === "sr"
                      ? "Kalendar prikazuje odsustva po timu i periodu. Koristi filtere da vidiš samo odobrena, samo pending ili samo određeni tip odsustva."
                      : "The calendar shows absences by team and period. Use the filters to focus on approved, pending, or a specific absence type."
                  }
                />
              </h2>
              <div className="muted small">
                {lang === "sr"
                  ? "Brzi pregled dostupnosti tima i overlap situacija u izabranom periodu."
                  : "A quick view of team availability and overlap situations in the selected period."}
              </div>
            </div>
            <div className="pills">
              {cal.ok ? <span className="pill pill-status pill-status-progress">{cal.items.length}</span> : null}
              <span className="pill pill-status pill-status-muted">
                {fromIso} → {toIso}
              </span>
            </div>
          </div>
          <form className="grid3" method="get" action="/absence">
            <label className="field">
              <span className="label">{t.absence.from}</span>
              <input className="input" name="fromIso" type="date" defaultValue={fromIso} required />
            </label>
            <label className="field">
              <span className="label">{t.absence.to}</span>
              <input className="input" name="toIso" type="date" defaultValue={toIso} required />
            </label>
            <label className="field">
              <span className="label">{t.absence.status}</span>
              <select className="input" name="status" defaultValue={status}>
                <option value="ALL">{t.absence.statusAll}</option>
                <option value="PENDING">{t.absence.statusPending}</option>
                <option value="APPROVED">{t.absence.statusApproved}</option>
              </select>
            </label>

            <label className="field">
              <span className="label">{t.absence.type}</span>
              <select className="input" name="type" defaultValue={type}>
                <option value="ALL">{t.absence.typeAll}</option>
                <option value="ANNUAL_LEAVE">{t.absence.typeAnnual}</option>
                <option value="HOME_OFFICE">{t.absence.typeHome}</option>
                <option value="SLAVA">{t.absence.typeSlava}</option>
                <option value="SICK">{t.absence.typeSick}</option>
                <option value="OTHER">{t.absence.typeOther}</option>
              </select>
            </label>

            {isAdmin ? (
              <label className="field">
                <span className="label">{t.absence.team}</span>
                <select className="input" name="teamId" defaultValue={teamId ?? "ALL"}>
                  <option value="ALL">(ALL)</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <input type="hidden" name="teamId" value="" />
            )}

            <label className="inline small muted">
              <input type="checkbox" name="includeMine" value="1" defaultChecked={includeMine} />
              {t.absence.includeMine}
            </label>

            <div className="field field-actions">
              <span className="label"> </span>
              <button className="button button-secondary" type="submit">
                {t.common.apply}
              </button>
            </div>
          </form>
          {!cal.ok ? (
            <div className="error">{t.absence.msgInvalidDate}</div>
          ) : (
            <>
              {cal.items.length === 0 ? <div className="muted">{t.absence.emptyCalendar}</div> : null}
              <AbsenceCalendarView
                lang={lang}
                timeZone={APP_TIMEZONE}
                fromIso={fromIso}
                toIso={toIso}
                items={cal.items as any}
              />
            </>
          )}
        </section>

        {canReviewAbsences ? (
          <section className="panel stack">
            <div className="section-head">
              <div>
                <h2 className="h2">
                  <LabelWithTooltip
                    label={t.absence.approvalsTitle}
                    tooltip={
                      lang === "sr"
                        ? "Ovde rešavaš zahteve koji čekaju tvoju odluku. Otvori zahtev, proveri period i ostavi komentar uz odobrenje ili odbijanje."
                        : "This is where you resolve requests waiting for your decision. Open the request, review the period, and leave a comment with the approval or rejection."
                    }
                  />
                </h2>
                <div className="muted small">
                  {lang === "sr"
                    ? "Lista zahteva koji trenutno čekaju odluku odgovornog menadžera."
                    : "A queue of requests currently waiting for the responsible manager decision."}
                </div>
              </div>
              <div className="pills">
                <span className="pill pill-status pill-status-review">{approvals.items.length}</span>
              </div>
            </div>
            <div className="list">
            {approvals.items.map((x) => (
                <details key={x.absenceId} className="item stack">
                  <summary className="item-top" style={{ cursor: "pointer" }}>
                    <div>
                      <div className="item-title">
                        {x.employee.name} · {typeLabel(x.type)} · {x.fromIso} → {x.toIso}
                      </div>
                      <div className="muted small">
                        {x.employee.email} · {x.employee.teamName || "—"} · {t.absence.days}: {x.days}
                      </div>
                    </div>
                    <span className={statusPillClass("PENDING")}>{statusLabel("PENDING")}</span>
                  </summary>

                  <div className="grid2">
                    <form className="stack" action={approveAbsenceAction}>
                      <input type="hidden" name="absenceId" value={x.absenceId} />
                      <input type="hidden" name="status" value="APPROVED" />
                      <label className="field">
                        <span className="label">{t.absence.adminComment}</span>
                        <textarea className="input" name="comment" rows={3} style={{ resize: "vertical" }} />
                      </label>
                      <button className="button" type="submit">
                        {t.absence.approve}
                      </button>
                    </form>

                    <form className="stack" action={approveAbsenceAction}>
                      <input type="hidden" name="absenceId" value={x.absenceId} />
                      <input type="hidden" name="status" value="REJECTED" />
                      <label className="field">
                        <span className="label">{t.absence.adminComment}</span>
                        <textarea className="input" name="comment" rows={3} style={{ resize: "vertical" }} />
                      </label>
                      <button className="button button-danger" type="submit">
                        {t.absence.reject}
                      </button>
                    </form>
                  </div>
                </details>
              ))}
              {approvals.items.length === 0 ? <div className="muted">{t.absence.emptyApprovals}</div> : null}
            </div>
          </section>
        ) : null}

        {isAdmin || isManager ? (
          <section className="panel stack">
            <div className="section-head">
              <div>
                <h2 className="h2">
                  <LabelWithTooltip
                    label={t.absence.managerStatsTitle}
                    tooltip={
                      lang === "sr"
                        ? "Sažetak dostupnih dana i limita po zaposlenom, da bi menadžer ili admin imao jasan pregled kapaciteta tima."
                        : "A per-employee summary of balances and limits so managers or admins can quickly understand team availability."
                    }
                  />
                </h2>
                <div className="muted small">{t.absence.managerStatsHint(stats.year)}</div>
              </div>
              <div className="pills">
                <span className="pill pill-status pill-status-muted">{stats.items.length}</span>
              </div>
            </div>
            <div className="list">
              {stats.items.slice(0, 50).map((x: any) => (
                <div key={x.email} className="item stack">
                  <div className="item-top">
                    <div>
                      <div className="item-title">{x.name}</div>
                      <div className="muted small">
                        {x.email} · {x.team || "—"} · {x.position || "—"}
                      </div>
                    </div>
                    <div className="pills">
                      <span className="pill">
                        {t.absence.remainingAnnual}: {x.annualRemaining}/{x.annualLimit}
                      </span>
                      <span className="pill">
                        {t.absence.remainingHomeOffice}: {x.homeRemaining}/{x.homeLimit}
                      </span>
                      <span className="pill">
                        {t.absence.remainingSlava}: {x.slavaRemaining}/{x.slavaLimit}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {stats.items.length === 0 ? <div className="muted">{t.absence.emptyStats}</div> : null}
            </div>
          </section>
        ) : null}

      </div>
    </main>
  );
}
