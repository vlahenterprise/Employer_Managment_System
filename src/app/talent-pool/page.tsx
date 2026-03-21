import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getTalentPool } from "@/server/candidates";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconSparkles, IconUsers } from "@/components/icons";
import { getCandidateStageMeta } from "@/server/recruiting-presentation";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Talent pool",
      subtitle: "Sačuvani kandidati koje možemo brzo vratiti u aktivan hiring proces.",
      back: "HR System",
      noAccess: "Talent pool je dostupan samo HR korisnicima.",
      introTitle: "Zadržani kvalitetni kandidati",
      introText: "Ovde čuvamo kandidate koje vredi ponovo aktivirati bez novog unosa svih podataka.",
      listTitle: "Kandidati za ponovno aktiviranje",
      listHint: "Pregledaj poslednju poziciju, razlog zatvaranja i CV link kako bi HR brzo odlučio da li kandidata vraća u novi proces.",
      open: "Otvori detalj",
      empty: "Još nema kandidata u talent pool-u.",
      lastRole: "Poslednja pozicija",
      tag: "Tag",
      reason: "Razlog zatvaranja",
      stage: "Poslednji status",
      noValue: "—"
    };
  }
  return {
    title: "Talent Pool",
    subtitle: "Saved candidates we can quickly move back into an active hiring process.",
    back: "HR System",
    noAccess: "Talent pool is available to HR users only.",
    introTitle: "Retained strong candidates",
    introText: "This is where we keep candidates worth reusing later without re-entering all the data.",
    listTitle: "Candidates ready to reuse",
    listHint: "Review the latest role, closing reason, and CV link so HR can quickly decide whether to reopen the candidate.",
    open: "Open detail",
    empty: "No candidates in the talent pool yet.",
    lastRole: "Latest role",
    tag: "Tag",
    reason: "Closing reason",
    stage: "Latest status",
    noValue: "—"
  };
}

export default async function TalentPoolPage({
  searchParams
}: {
  searchParams: { tag?: string };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const c = copy(lang);
  const pool = await getTalentPool({ id: user.id, role: user.role, hrAddon: user.hrAddon }, searchParams.tag);

  if (!pool.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.noAccess}</div>
        </div>
      </main>
    );
  }

  const reusableCount = pool.items.filter((candidate) => candidate.cvDriveUrl).length;
  const taggedCount = pool.items.filter((candidate) => candidate.talentPoolTag).length;

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
              <Link className="button button-secondary" href="/hr">
                <IconArrowLeft size={18} /> {c.back}
              </Link>
            </div>

            <div className="notice notice-info">
              <div className="notice-icon">
                <IconSparkles size={18} />
              </div>
              <div className="stack">
                <div className="notice-title">{c.introTitle}</div>
                <div className="muted small">{c.introText}</div>
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

        <div className="grid3 profile-metrics">
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconUsers size={18} />
            </div>
            <div>
              <div className="kpi-value">{pool.items.length}</div>
              <div className="kpi-label">{c.listTitle}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconSparkles size={18} />
            </div>
            <div>
              <div className="kpi-value">{taggedCount}</div>
              <div className="kpi-label">{lang === "sr" ? "Tagovani kandidati" : "Tagged candidates"}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconArrowRight size={18} />
            </div>
            <div>
              <div className="kpi-value">{reusableCount}</div>
              <div className="kpi-label">{lang === "sr" ? "Spremni za reuse" : "Ready to reuse"}</div>
            </div>
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
            {pool.items.map((candidate) => {
              const latest = candidate.applications[0] || null;
              const stage = getCandidateStageMeta(latest?.status, lang);
              return (
                <div key={candidate.id} className="item stack entity-card">
                  <div className="item-top">
                    <div className="stack">
                      <div className="item-title">{candidate.fullName}</div>
                      <div className="muted small">{candidate.email || candidate.phone || c.noValue}</div>
                    </div>
                    <div className="inline">
                      <span className={`pill pill-status pill-status-${stage.tone}`}>{stage.label}</span>
                      <Link className="button button-secondary" href={`/candidates/${candidate.id}`}>
                        {c.open} <IconArrowRight size={18} />
                      </Link>
                    </div>
                  </div>

                  <div className="detail-list detail-list-compact">
                    <div>
                      <strong>{c.lastRole}:</strong> {latest?.process.positionTitle || c.noValue}
                    </div>
                    <div>
                      <strong>{c.tag}:</strong> {candidate.talentPoolTag || c.noValue}
                    </div>
                    <div>
                      <strong>{c.reason}:</strong> {latest?.closedReason || (lang === "sr" ? "Sačuvan za buduće procese." : "Kept for future processes.")}
                    </div>
                    <div>
                      <strong>{c.stage}:</strong> {stage.label}
                    </div>
                  </div>
                </div>
              );
            })}
            {pool.items.length === 0 ? <div className="muted small">{c.empty}</div> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
