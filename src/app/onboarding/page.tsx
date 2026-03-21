import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getBrandingSettings } from "@/server/settings";
import { getOnboardingDashboard } from "@/server/onboarding";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconCalendar, IconCheckCircle, IconUsers } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Onboarding",
      subtitle: "Plan, checklist i dokumenti za nove zaposlene.",
      back: "Dashboard",
      noAccess: "Nemaš pristup onboarding modulu.",
      open: "Otvori",
      empty: "Nema onboarding stavki za prikaz."
    };
  }
  return {
    title: "Onboarding",
    subtitle: "Plans, checklists, and documents for new hires.",
    back: "Dashboard",
    noAccess: "You do not have access to the onboarding module.",
    open: "Open",
    empty: "No onboarding records to show."
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
          <div className="page-topbar-main">
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
            <div><div className="kpi-value">{dashboard.metrics.total}</div><div className="kpi-label">Total</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCalendar size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.active}</div><div className="kpi-label">Active</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconUsers size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.waitingEmployee}</div><div className="kpi-label">Waiting employee</div></div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon"><IconCheckCircle size={18} /></div>
            <div><div className="kpi-value">{dashboard.metrics.completed}</div><div className="kpi-label">Completed</div></div>
          </div>
        </div>

        <section className="panel stack">
          <div className="list">
            {dashboard.items.map((item) => {
              const subject = item.employee?.name || item.candidate?.fullName || item.process?.positionTitle || "Onboarding";
              const progress = item.items.length ? Math.round((item.items.filter((row) => row.isCompleted).length / item.items.length) * 100) : 0;
              return (
                <div key={item.id} className="item item-compact">
                  <div>
                    <div className="item-title">{subject}</div>
                    <div className="muted small">
                      {item.team?.name || "—"} · {item.status} · {progress}% complete
                    </div>
                  </div>
                  <div className="inline">
                    <span className="pill pill-status pill-status-review">{item.status}</span>
                    <Link className="button button-secondary" href={`/onboarding/${item.id}`}>
                      {c.open} <IconArrowRight size={18} />
                    </Link>
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
