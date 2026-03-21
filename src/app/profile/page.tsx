import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import { getEmployeeProfile } from "@/server/profile";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconCalendar, IconCheckCircle, IconTasks, IconUsers } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Employee Profile",
      subtitle: "Centralno mesto za info, operativni pregled i važne linkove.",
      back: "Dashboard",
      basic: "Basic Info",
      access: "Access",
      operational: "Operational Summary",
      onboarding: "Onboarding",
      absence: "Absence",
      performance: "Performance",
      links: "Drive Links",
      notFound: "Profil nije dostupan.",
      jobDescription: "Job description",
      workInstructions: "Work instructions",
      manager: "Manager",
      team: "Team",
      position: "Position",
      employmentDate: "Employment date",
      status: "Status",
      openTasks: "Open tasks",
      overdueTasks: "Overdue tasks",
      latestReport: "Latest report",
      activeAbsence: "Active absence",
      directReports: "Direct reports",
      currentCycle: "Current cycle",
      activeOnboarding: "Active onboarding",
      noValue: "—"
    };
  }

  return {
    title: "Employee Profile",
    subtitle: "A central place for employee info, operational visibility, and important links.",
    back: "Dashboard",
    basic: "Basic Info",
    access: "Access",
    operational: "Operational Summary",
    onboarding: "Onboarding",
    absence: "Absence",
    performance: "Performance",
    links: "Drive Links",
    notFound: "Profile is not available.",
    jobDescription: "Job description",
    workInstructions: "Work instructions",
    manager: "Manager",
    team: "Team",
    position: "Position",
    employmentDate: "Employment date",
    status: "Status",
    openTasks: "Open tasks",
    overdueTasks: "Overdue tasks",
    latestReport: "Latest report",
    activeAbsence: "Active absence",
    directReports: "Direct reports",
    currentCycle: "Current cycle",
    activeOnboarding: "Active onboarding",
    noValue: "—"
  };
}

function formatDate(value: Date | null | undefined, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(value);
}

export default async function ProfilePage({
  searchParams
}: {
  searchParams: { userId?: string };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const c = copy(lang);
  const profile = await getEmployeeProfile(
    {
      id: user.id,
      role: user.role,
      hrAddon: user.hrAddon,
      adminAddon: user.adminAddon
    },
    searchParams.userId
  );

  if (!profile.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.notFound}</div>
        </div>
      </main>
    );
  }

  const target = profile.user;
  const summary = profile.summary;
  const locale = lang === "sr" ? "sr-RS" : "en-GB";

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
                  <h1 className="brand-title">{target.name}</h1>
                  <p className="muted">{c.subtitle}</p>
                </div>
              </div>
              <Link className="button button-secondary" href={profile.isSelf ? "/dashboard" : "/team"}>
                <IconArrowLeft size={18} /> {c.back}
              </Link>
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

        <div className="grid2 profile-grid">
          <section className="panel stack">
            <h2 className="h2">{c.basic}</h2>
            <div className="detail-list">
              <div><strong>{c.team}:</strong> {target.team?.name || c.noValue}</div>
              <div><strong>{c.position}:</strong> {target.position || c.noValue}</div>
              <div><strong>{c.manager}:</strong> {target.manager?.name || c.noValue}</div>
              <div><strong>{c.employmentDate}:</strong> {formatDate(target.employmentDate, locale)}</div>
              <div><strong>{c.status}:</strong> {target.status}</div>
              <div><strong>Email:</strong> {target.email}</div>
            </div>
          </section>

          <section className="panel stack">
            <h2 className="h2">{c.access}</h2>
            <div className="pills">
              {profile.access.map((entry) => (
                <span key={entry} className="pill pill-status pill-status-review">{entry}</span>
              ))}
            </div>
          </section>
        </div>

        <div className="grid4 profile-metrics">
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconTasks size={18} /></div>
            <div><div className="kpi-value">{summary.openTasks}</div><div className="kpi-label">{c.openTasks}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCalendar size={18} /></div>
            <div><div className="kpi-value">{summary.overdueTasks}</div><div className="kpi-label">{c.overdueTasks}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconUsers size={18} /></div>
            <div><div className="kpi-value">{summary.directReports}</div><div className="kpi-label">{c.directReports}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCheckCircle size={18} /></div>
            <div><div className="kpi-value">{summary.currentEvaluation?.finalScore?.toFixed?.(1) ?? c.noValue}</div><div className="kpi-label">{c.currentCycle}</div></div>
          </div>
        </div>

        <div className="grid3 profile-summary-grid">
          <section className="panel stack">
            <h2 className="h2">{c.operational}</h2>
            <div className="detail-list">
              <div><strong>{c.latestReport}:</strong> {summary.latestReport ? `${summary.latestReport.dateIso} · ${summary.latestReport.totalMinutes} min` : c.noValue}</div>
              <div><strong>{c.activeAbsence}:</strong> {summary.activeAbsence ? `${summary.activeAbsence.type} · ${formatDate(summary.activeAbsence.dateTo, locale)}` : c.noValue}</div>
              <div><strong>{c.currentCycle}:</strong> {summary.currentEvaluation ? `${summary.currentEvaluation.periodLabel} · ${summary.currentEvaluation.status}` : c.noValue}</div>
            </div>
          </section>

          <section className="panel stack">
            <h2 className="h2">{c.onboarding}</h2>
            {summary.activeOnboarding ? (
              <div className="detail-list">
                <div><strong>{c.activeOnboarding}:</strong> {summary.activeOnboarding.status}</div>
                <div><strong>HR:</strong> {summary.activeOnboarding.hrOwner?.name || c.noValue}</div>
                <Link className="button button-secondary" href={`/onboarding/${summary.activeOnboarding.id}`}>
                  Open onboarding <IconArrowRight size={18} />
                </Link>
              </div>
            ) : (
              <div className="muted small">{c.noValue}</div>
            )}
          </section>

          <section className="panel stack">
            <h2 className="h2">{c.links}</h2>
            <div className="list">
              {target.jobDescriptionUrl ? (
                <a className="button button-secondary" href={target.jobDescriptionUrl} target="_blank" rel="noreferrer">
                  {c.jobDescription}
                </a>
              ) : null}
              {target.workInstructionsUrl ? (
                <a className="button button-secondary" href={target.workInstructionsUrl} target="_blank" rel="noreferrer">
                  {c.workInstructions}
                </a>
              ) : null}
              {!target.jobDescriptionUrl && !target.workInstructionsUrl ? <div className="muted small">{c.noValue}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
