import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import { getOnboardingDashboard } from "@/server/onboarding";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconCalendar, IconCheckCircle, IconUsers } from "@/components/icons";
import { getOnboardingStatusMeta } from "@/server/recruiting-presentation";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Onboarding",
      subtitle: "Plan, checklist i dokumenti za nove zaposlene.",
      back: "Dashboard",
      noAccess: "Nemaš pristup onboarding modulu.",
      open: "Otvori onboarding",
      empty: "Nema onboarding stavki za prikaz.",
      overviewTitle: "Onboarding pregled",
      overviewText: "Ovde se vidi gde je start procesa, ko je sledeći na potezu i da li novi zaposleni nešto čeka od HR-a, menadžera ili sebe.",
      total: "Ukupno",
      active: "Aktivni onboarding",
      waitingEmployee: "Čeka zaposlenog",
      completed: "Završeni onboarding",
      listTitle: "Aktivni onboarding procesi",
      listHint: "Svaki red jasno pokazuje status, napredak i kome onboarding trenutno pripada.",
      progress: "Napredak",
      nextOwner: "Sledeći fokus",
      noValue: "—"
    };
  }
  return {
    title: "Onboarding",
    subtitle: "Plans, checklists, and documents for new hires.",
    back: "Dashboard",
    noAccess: "You do not have access to the onboarding module.",
    open: "Open onboarding",
    empty: "No onboarding records to show.",
    overviewTitle: "Onboarding overview",
    overviewText: "See where onboarding starts, who owns the next step, and whether HR, the manager, or the employee is blocking progress.",
    total: "Total",
    active: "Active onboarding",
    waitingEmployee: "Waiting employee",
    completed: "Completed onboarding",
    listTitle: "Active onboarding processes",
    listHint: "Each row shows the status, progress, and who currently owns the onboarding flow.",
    progress: "Progress",
    nextOwner: "Next focus",
    noValue: "—"
  };
}

export default async function OnboardingPage() {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const c = copy(lang);
  const dashboard = await getOnboardingDashboard({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    hrAddon: user.hrAddon,
    adminAddon: user.adminAddon
  });

  if (!dashboard.ok) {
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
          <div className="page-topbar-main stack">
            <div className="header">
              <div className="brand">
                {branding.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="brand-logo" src={branding.logoUrl} alt={branding.title} />
                ) : null}
                <div>
                  <h1 className="brand-title">{c.title}</h1>
                  <p className="muted">{c.subtitle}</p>
                </div>
              </div>
              <Link className="button button-secondary" href="/dashboard">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
            </div>

            <div className="notice notice-info">
              <div className="notice-icon">
                <IconCalendar size={18} />
              </div>
              <div className="stack">
                <div className="notice-title">{c.overviewTitle}</div>
                <div className="muted small">{c.overviewText}</div>
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

        <div className="grid4 profile-metrics">
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconUsers size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.total}</div><div className="kpi-label">{c.total}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCalendar size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.active}</div><div className="kpi-label">{c.active}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconUsers size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.waitingEmployee}</div><div className="kpi-label">{c.waitingEmployee}</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCheckCircle size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.completed}</div><div className="kpi-label">{c.completed}</div></div>
          </div>
        </div>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip label={c.listTitle} tooltip={c.listHint} />
              </h2>
            </div>
          </div>
          <div className="list">
            {dashboard.items.map((item) => {
              const subject = item.employee?.name || item.candidate?.fullName || item.process?.positionTitle || "Onboarding";
              const progress = item.items.length
                ? Math.round((item.items.filter((row) => row.isCompleted).length / item.items.length) * 100)
                : 0;
              const status = getOnboardingStatusMeta(item.status, lang);
              return (
                <div key={item.id} className="item stack entity-card">
                  <div className="item-top">
                    <div className="stack">
                      <div className="item-title">{subject}</div>
                      <div className="muted small">
                        {item.team?.name || c.noValue} · {item.startDate ? new Date(item.startDate).toLocaleDateString(lang === "sr" ? "sr-RS" : "en-GB") : c.noValue}
                      </div>
                    </div>
                    <div className="inline">
                      <span className={`pill pill-status pill-status-${status.tone}`}>{status.label}</span>
                      <Link className="button button-secondary" href={`/onboarding/${item.id}`}>
                        {c.open} <IconArrowRight size={18} />
                      </Link>
                    </div>
                  </div>

                  <div className="detail-list detail-list-compact">
                    <div>
                      <strong>{c.progress}:</strong> {progress}%
                    </div>
                    <div>
                      <strong>{c.nextOwner}:</strong> {status.nextOwnerLabel}
                    </div>
                    <div>
                      <strong>{lang === "sr" ? "Menadžer" : "Manager"}:</strong> {item.manager?.name || c.noValue}
                    </div>
                    <div>
                      <strong>HR:</strong> {item.hrOwner?.name || c.noValue}
                    </div>
                  </div>
                </div>
              );
            })}
            {dashboard.items.length === 0 ? <div className="muted small">{c.empty}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
