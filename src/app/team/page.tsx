import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getTeamWorkspace } from "@/server/team";
import { getRequestLang } from "@/i18n/server";
import { isHrModuleEnabled } from "@/server/features";
import { IconArrowLeft, IconArrowRight, IconCalendar, IconTasks, IconUsers } from "@/components/icons";
import { GuidancePanel } from "@/components/GuidancePanel";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Team",
      subtitle: "Pregled ljudi, izveštaja, taskova i aktivnih procesa u timu.",
      back: "Dashboard",
      noAccess: "Tim pregled je dostupan samo menadžerima.",
      missingReports: "Nedostaju izveštaji",
      overdueTasks: "Zakasneli taskovi",
      absentToday: "Odsutni danas",
      activeOnboarding: "Aktivan onboarding",
      employees: "Zaposleni",
      report: "Današnji izveštaj",
      profile: "Profil",
      reportSubmitted: "Predat",
      reportMissing: "Nedostaje",
      noValue: "—",
      guideTitle: "Kako da koristiš Team pregled",
      guideDescription: "Ovo je brz menadžerski pregled tima — za odluke, ne za duboku administraciju.",
      guideItems: [
        "Nedostajući izveštaji pokazuju gde treba podsetnik ili provera.",
        "Zakasneli taskovi pokazuju gde posao stoji ili treba podrška.",
        "Odsutni danas pomaže da odmah vidiš dostupnost tima."
      ],
      emptyTeam: "Nema zaposlenih u tvom opsegu."
    };
  }

  return {
    title: "Team",
    subtitle: "A simple overview of people, reports, tasks, and active processes in your scope.",
    back: "Dashboard",
    noAccess: "Team workspace is available to managers only.",
    missingReports: "Missing reports",
    overdueTasks: "Overdue tasks",
    absentToday: "Absent today",
    activeOnboarding: "Active onboarding",
    employees: "Employees",
    report: "Today report",
    profile: "Profile",
    reportSubmitted: "Submitted",
    reportMissing: "Missing",
    noValue: "—",
    guideTitle: "How to use Team",
    guideDescription: "This is a fast manager view of the team — for decisions, not deep administration.",
    guideItems: [
      "Missing reports show where a reminder or check-in may be needed.",
      "Overdue tasks show where work is stuck or support is needed.",
      "Absent today helps you understand team availability immediately."
    ],
    emptyTeam: "No employees in your scope."
  };
}

export default async function TeamPage() {
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);
  const hrEnabled = isHrModuleEnabled();
  const workspace = await getTeamWorkspace({ id: user.id, role: user.role });

  if (!workspace.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.noAccess}</div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div className="brand">
                <div>
                  <h1 className="brand-title">{c.title}</h1>
                  <p className="muted">{c.subtitle}</p>
                </div>
              </div>
              <Link className="button button-secondary" href="/dashboard">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
            </div>
          </div>
        </div>

        <GuidancePanel title={c.guideTitle} description={c.guideDescription} items={c.guideItems} />

        <div className={`${hrEnabled ? "grid4" : "grid3"} profile-metrics`}>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconUsers size={18} /></div>
            <div><div className="kpi-value">{workspace.metrics.employees}</div><div className="kpi-label">{c.employees}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCalendar size={18} /></div>
            <div><div className="kpi-value">{workspace.metrics.missingReports}</div><div className="kpi-label">{c.missingReports}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconTasks size={18} /></div>
            <div><div className="kpi-value">{workspace.metrics.overdueTasks}</div><div className="kpi-label">{c.overdueTasks}</div></div>
          </div>
          {hrEnabled ? (
            <div className="item item-compact kpi-card">
              <div className="kpi-icon"><IconUsers size={18} /></div>
              <div><div className="kpi-value">{workspace.metrics.activeOnboarding}</div><div className="kpi-label">{c.activeOnboarding}</div></div>
            </div>
          ) : null}
        </div>

        <section className="panel stack">
          <div className="list">
            {workspace.rows.map((member) => (
              <div key={member.id} className="item stack">
                <div className="item-top">
                  <div>
                    <div className="item-title">{member.name}</div>
                    <div className="muted small">
                      {member.email} · {member.team?.name || c.noValue} · {member.position || c.noValue}
                    </div>
                  </div>
                  <Link className="button button-secondary" href={`/profile?userId=${member.id}`}>
                    {c.profile} <IconArrowRight size={18} />
                  </Link>
                </div>
                <div className={`${hrEnabled ? "grid4" : "grid3"} team-summary-grid`}>
                  <div className="item item-compact">
                    <div className="muted small">{c.report}</div>
                    <div className="item-title">{member.reportSubmittedToday ? c.reportSubmitted : c.reportMissing}</div>
                  </div>
                  <div className="item item-compact">
                    <div className="muted small">{c.overdueTasks}</div>
                    <div className="item-title">{member.overdueTasks}</div>
                  </div>
                  <div className="item item-compact">
                    <div className="muted small">{c.absentToday}</div>
                    <div className="item-title">{member.activeAbsence ? member.activeAbsence.type : c.noValue}</div>
                  </div>
                  {hrEnabled ? (
                    <div className="item item-compact">
                      <div className="muted small">{c.activeOnboarding}</div>
                      <div className="item-title">{member.activeOnboarding?.status || c.noValue}</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {workspace.rows.length === 0 ? <div className="muted">{c.emptyTeam}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
