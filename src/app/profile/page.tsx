import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getEmployeeProfile } from "@/server/profile";
import { getRequestLang } from "@/i18n/server";
import { isHrModuleEnabled } from "@/server/features";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconCalendar, IconCheckCircle, IconTasks, IconUsers } from "@/components/icons";
import { GuidancePanel } from "@/components/GuidancePanel";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Profil zaposlenog",
      subtitle: "Centralno mesto za info, operativni pregled i važne linkove.",
      back: "Dashboard",
      basic: "Osnovne informacije",
      access: "Pristup",
      operational: "Operativni pregled",
      onboarding: "Onboarding",
      absence: "Odsustva",
      performance: "Performance",
      links: "Drive linkovi",
      notFound: "Profil nije dostupan.",
      jobDescription: "Opis posla",
      workInstructions: "Radne instrukcije",
      manager: "Menadžer",
      team: "Tim",
      position: "Pozicija",
      employmentDate: "Datum zaposlenja",
      status: "Status",
      openTasks: "Otvoreni zadaci",
      overdueTasks: "Zakasneli zadaci",
      latestReport: "Poslednji izveštaj",
      activeAbsence: "Aktivno odsustvo",
      directReports: "Direktni članovi tima",
      currentCycle: "Aktuelni ciklus",
      activeOnboarding: "Aktivan onboarding",
      noValue: "—",
      guideTitle: "Kako da koristiš profil",
      guideDescription: "Profil je centralno mesto za osnovne informacije, operativni kontekst i Drive dokumenta vezana za poziciju.",
      guideItems: [
        "Osnovne informacije pokazuju tim, poziciju i reporting liniju.",
        "Operativni pregled pomaže da brzo vidiš taskove, odsustvo i performance ciklus.",
        "Drive linkovi vode ka opisu posla i radnim instrukcijama bez čuvanja fajlova u bazi."
      ]
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
    noValue: "—",
    guideTitle: "How to use the profile",
    guideDescription: "The profile is the central place for core information, operational context, and Drive documents tied to the position.",
    guideItems: [
      "Basic info shows team, position, and reporting line.",
      "Operational summary helps you quickly see tasks, absence, and performance cycle.",
      "Drive links open job descriptions and work instructions without storing files in the database."
    ]
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
  const lang = getRequestLang();
  const c = copy(lang);
  const hrEnabled = isHrModuleEnabled();
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
  const orgDocs = profile.orgResources;
  const locale = lang === "sr" ? "sr-RS" : "en-GB";
  const jobDescriptionUrl = target.jobDescriptionUrl || orgDocs.jobDescriptionUrl;
  const workInstructionsUrl = target.workInstructionsUrl || orgDocs.workInstructionsUrl;

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main">
            <div className="header">
              <div>
                <h1 className="brand-title">{target.name}</h1>
                <p className="muted">{c.subtitle}</p>
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

        <GuidancePanel title={c.guideTitle} description={c.guideDescription} items={c.guideItems} />

        <div className="grid2 profile-grid">
          <section className="panel stack">
            <h2 className="h2">
              <LabelWithTooltip
                label={c.basic}
                tooltip={
                  lang === "sr"
                    ? "Osnovne informacije o zaposlenom, timu, ulozi i reporting liniji."
                    : "Core employee information, including team, position, and reporting line."
                }
              />
            </h2>
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
            <h2 className="h2">
              <LabelWithTooltip
                label={c.access}
                tooltip={
                  lang === "sr"
                    ? "Prikazuje baznu rolu i dodatne pristupe koje korisnik ima u sistemu."
                    : "Shows the base role and any additional access layers assigned to this user."
                }
              />
            </h2>
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

        <div className={`${hrEnabled ? "grid3" : "grid2"} profile-summary-grid`}>
          <section className="panel stack">
            <h2 className="h2">
              <LabelWithTooltip
                label={c.operational}
                tooltip={
                  lang === "sr"
                    ? "Sažetak dnevnog rada: poslednji report, aktivno odsustvo i trenutni performance ciklus."
                    : "A compact operational summary: latest report, active absence, and the current performance cycle."
                }
              />
            </h2>
            <div className="detail-list">
              <div><strong>{c.latestReport}:</strong> {summary.latestReport ? `${summary.latestReport.dateIso} · ${summary.latestReport.totalMinutes} min` : c.noValue}</div>
              <div><strong>{c.activeAbsence}:</strong> {summary.activeAbsence ? `${summary.activeAbsence.type} · ${formatDate(summary.activeAbsence.dateTo, locale)}` : c.noValue}</div>
              <div><strong>{c.currentCycle}:</strong> {summary.currentEvaluation ? `${summary.currentEvaluation.periodLabel} · ${summary.currentEvaluation.status}` : c.noValue}</div>
            </div>
          </section>

          {hrEnabled ? (
            <section className="panel stack">
              <h2 className="h2">
                <LabelWithTooltip
                  label={c.onboarding}
                  tooltip={
                    lang === "sr"
                      ? "Aktivni onboarding pokazuje status, HR vlasnika i direktan link ka checklisti."
                      : "Active onboarding shows the current status, HR owner, and a direct link to the checklist."
                  }
                />
              </h2>
              {summary.activeOnboarding ? (
                <div className="detail-list">
                  <div><strong>{c.activeOnboarding}:</strong> {summary.activeOnboarding.status}</div>
                  <div>
                    <strong>HR:</strong>{" "}
                    {
                      (
                        summary.activeOnboarding as typeof summary.activeOnboarding & {
                          hrOwner?: { name?: string | null } | null;
                        }
                      ).hrOwner?.name || c.noValue
                    }
                  </div>
                  <Link className="button button-secondary" href={`/onboarding/${summary.activeOnboarding.id}`}>
                    Open onboarding <IconArrowRight size={18} />
                  </Link>
                </div>
              ) : (
                <div className="muted small">{c.noValue}</div>
              )}
            </section>
          ) : null}

          <section className="panel stack">
            <h2 className="h2">
              <LabelWithTooltip
                label={c.links}
                tooltip={
                  lang === "sr"
                    ? "Važni Drive linkovi za poziciju. Primarno se održavaju u Admin → Org struktura, a profil ovde prikazuje najrelevantnije reference."
                    : "Important Drive links for the role. They are primarily maintained in Admin → Org structure, while the profile shows the most relevant references here."
                }
              />
            </h2>
            <div className="list">
              {jobDescriptionUrl ? (
                <a className="button button-secondary" href={jobDescriptionUrl} target="_blank" rel="noreferrer">
                  {c.jobDescription}
                </a>
              ) : null}
              {workInstructionsUrl ? (
                <a className="button button-secondary" href={workInstructionsUrl} target="_blank" rel="noreferrer">
                  {c.workInstructions}
                </a>
              ) : null}
              <Link className="button button-secondary" href="/organization">
                ORG System <IconArrowRight size={18} />
              </Link>
              {!jobDescriptionUrl && !workInstructionsUrl ? <div className="muted small">{c.noValue}</div> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
