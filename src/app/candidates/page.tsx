import Link from "next/link";
import { requireActiveUser } from "@/server/current-user";
import { getCandidatesWorkspace } from "@/server/candidates";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconUsers } from "@/components/icons";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Candidates",
      subtitle: "Jednostavan pregled kandidata, faza, CV linkova i sledećih akcija.",
      back: "HR System",
      noAccess: "Kandidati su dostupni samo HR korisnicima.",
      filters: "Filteri",
      search: "Pretraga",
      stage: "Faza",
      open: "Otvori",
      empty: "Nema kandidata za izabrane filtere."
    };
  }
  return {
    title: "Candidates",
    subtitle: "A simple candidate view with stages, CV links, and next actions.",
    back: "HR System",
    noAccess: "Candidates are available to HR users only.",
    filters: "Filters",
    search: "Search",
    stage: "Stage",
    open: "Open",
    empty: "No candidates for the current filters."
  };
}

export default async function CandidatesPage({
  searchParams
}: {
  searchParams: { query?: string; stage?: string };
}) {
  const user = await requireActiveUser();
  const branding = await getBrandingSettings();
  const lang = getRequestLang();
  const c = copy(lang);
  const data = await getCandidatesWorkspace(
    { id: user.id, role: user.role, hrAddon: user.hrAddon },
    { query: searchParams.query, stage: searchParams.stage }
  );

  if (!data.ok) {
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
              <Link className="button button-secondary" href="/hr">
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

        <section className="panel stack">
          <h2 className="h2">{c.filters}</h2>
          <form className="grid3" method="get" action="/candidates">
            <label className="field">
              <span className="label">{c.search}</span>
              <input className="input" name="query" type="text" defaultValue={searchParams.query || ""} />
            </label>
            <label className="field">
              <span className="label">{c.stage}</span>
              <input className="input" name="stage" type="text" defaultValue={searchParams.stage || ""} />
            </label>
            <div className="field field-actions">
              <span className="label"> </span>
              <button className="button" type="submit">Apply</button>
            </div>
          </form>
        </section>

        <section className="panel stack">
          <div className="list">
            {data.items.map((candidate) => {
              const latest = candidate.applications[0] || null;
              return (
                <div key={candidate.id} className="item item-compact">
                  <div>
                    <div className="item-title">{candidate.fullName}</div>
                    <div className="muted small">
                      {candidate.email || "—"} · {latest?.process.positionTitle || "—"} · {latest?.status || "—"}
                    </div>
                    <div className="muted small">
                      {candidate.talentPoolTag || "—"} · {candidate.source || "—"} · {latest?.nextAction || "—"}
                    </div>
                  </div>
                  <div className="inline">
                    <span className="pill pill-status pill-status-review">{latest?.status || "NO_STAGE"}</span>
                    <Link className="button button-secondary" href={`/candidates/${candidate.id}`}>
                      {c.open} <IconArrowRight size={18} />
                    </Link>
                  </div>
                </div>
              );
            })}
            {data.items.length === 0 ? (
              <div className="muted small">
                <IconUsers size={18} /> {c.empty}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
