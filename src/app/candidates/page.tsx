import Link from "next/link";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getCandidatesWorkspace } from "@/server/candidates";
import { getBrandingSettings } from "@/server/settings";
import { getRequestLang } from "@/i18n/server";
import UserMenu from "../dashboard/UserMenu";
import { IconArrowLeft, IconArrowRight, IconCheckCircle, IconSparkles, IconUsers } from "@/components/icons";
import { getCandidateStageMeta, getCandidateStageOptions } from "@/server/recruiting-presentation";

function copy(lang: "sr" | "en") {
  if (lang === "sr") {
    return {
      title: "Kandidati",
      subtitle: "Pregled kandidata, faza, CV linkova i sledećih akcija na jednom mestu.",
      back: "HR System",
      noAccess: "Kandidati su dostupni samo HR korisnicima.",
      filters: "Filteri kandidata",
      filtersHint: "Pretraži po kandidatu ili suzi listu na jednu fazu kako bi brže video šta čeka akciju.",
      search: "Pretraga",
      searchHint: "Ime, email, telefon, pozicija ili tim.",
      stage: "Faza",
      stageHint: "Prikazuje trenutnu fazu poslednje aktivne prijave kandidata.",
      apply: "Primeni filtere",
      reset: "Resetuj",
      listTitle: "Aktivni kandidati",
      listHint: "Svaka kartica pokazuje gde je kandidat sada, ko je sledeći na potezu i koja je naredna akcija.",
      open: "Otvori detalj",
      empty: "Nema kandidata za izabrane filtere.",
      total: "Ukupno kandidata",
      screening: "HR screening",
      managerReview: "Čeka menadžera",
      finalApproval: "Čeka finalnu odluku",
      approved: "Odobreni za hire",
      owner: "Vlasnik procesa",
      nextAction: "Sledeći korak",
      updated: "Poslednja izmena",
      team: "Tim",
      position: "Pozicija",
      source: "Izvor",
      status: "Status",
      noValue: "—"
    };
  }

  return {
    title: "Candidates",
    subtitle: "A clear view of candidates, stages, CV links, and next actions in one place.",
    back: "HR System",
    noAccess: "Candidates are available to HR users only.",
    filters: "Candidate filters",
    filtersHint: "Search by candidate or narrow the list to one stage so it is easier to see what needs action.",
    search: "Search",
    searchHint: "Name, email, phone, position, or team.",
    stage: "Stage",
    stageHint: "Shows the current stage of the latest active application.",
    apply: "Apply filters",
    reset: "Reset",
    listTitle: "Active candidates",
    listHint: "Each card shows the current stage, who owns the next move, and the recommended next action.",
    open: "Open detail",
    empty: "No candidates for the current filters.",
    total: "Total candidates",
    screening: "HR screening",
    managerReview: "Waiting manager",
    finalApproval: "Waiting final decision",
    approved: "Approved for hire",
    owner: "Owner",
    nextAction: "Next action",
    updated: "Last update",
    team: "Team",
    position: "Position",
    source: "Source",
    status: "Status",
    noValue: "—"
  };
}

function formatDate(value: Date | null | undefined, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(value);
}

function getToneClass(tone: ReturnType<typeof getCandidateStageMeta>["tone"]) {
  return `pill pill-status pill-status-${tone}`;
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
  const locale = lang === "sr" ? "sr-RS" : "en-GB";
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

  const stageOptions = getCandidateStageOptions(lang);
  const metrics = {
    total: data.items.length,
    screening: data.items.filter((candidate) => {
      const status = String(candidate.applications[0]?.status || "").toUpperCase();
      return status === "NEW_APPLICANT" || status === "HR_SCREENING";
    }).length,
    managerReview: data.items.filter((candidate) => {
      const status = String(candidate.applications[0]?.status || "").toUpperCase();
      return status === "SENT_TO_MANAGER" || status === "WAITING_MANAGER_REVIEW";
    }).length,
    finalApproval: data.items.filter((candidate) => String(candidate.applications[0]?.status || "").toUpperCase() === "WAITING_FINAL_APPROVAL").length,
    approved: data.items.filter((candidate) => String(candidate.applications[0]?.status || "").toUpperCase() === "APPROVED_FOR_EMPLOYMENT").length
  };

  const hasFilters = Boolean(String(searchParams.query || "").trim() || String(searchParams.stage || "").trim());

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
                <IconUsers size={18} />
              </div>
              <div className="stack">
                <div className="notice-title">{c.listTitle}</div>
                <div className="muted small">{c.listHint}</div>
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
            <div className="kpi-icon">
              <IconUsers size={18} />
            </div>
            <div>
              <div className="kpi-value">{metrics.total}</div>
              <div className="kpi-label">{c.total}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconSparkles size={18} />
            </div>
            <div>
              <div className="kpi-value">{metrics.screening}</div>
              <div className="kpi-label">{c.screening}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconArrowRight size={18} />
            </div>
            <div>
              <div className="kpi-value">{metrics.managerReview}</div>
              <div className="kpi-label">{c.managerReview}</div>
            </div>
          </div>
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconCheckCircle size={18} />
            </div>
            <div>
              <div className="kpi-value">{metrics.approved}</div>
              <div className="kpi-label">{c.approved}</div>
            </div>
          </div>
        </div>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">
                <LabelWithTooltip label={c.filters} tooltip={c.filtersHint} />
              </h2>
            </div>
            {hasFilters ? (
              <Link className="button button-secondary" href="/candidates">
                {c.reset}
              </Link>
            ) : null}
          </div>

          <form className="grid3" method="get" action="/candidates">
            <label className="field">
              <span className="label">
                <LabelWithTooltip label={c.search} tooltip={c.searchHint} />
              </span>
              <input className="input" name="query" type="text" defaultValue={searchParams.query || ""} />
            </label>
            <label className="field">
              <span className="label">
                <LabelWithTooltip label={c.stage} tooltip={c.stageHint} />
              </span>
              <select className="input" name="stage" defaultValue={String(searchParams.stage || "").toUpperCase() || "ALL"}>
                {stageOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="field field-actions">
              <span className="label"> </span>
              <button className="button" type="submit">
                {c.apply}
              </button>
            </div>
          </form>
        </section>

        <section className="panel stack">
          <div className="section-head">
            <div className="section-copy">
              <h2 className="h2">{c.listTitle}</h2>
              <p className="muted small">{c.listHint}</p>
            </div>
            <div className="pills">
              <span className="pill pill-blue">
                {c.finalApproval}: {metrics.finalApproval}
              </span>
            </div>
          </div>

          <div className="list">
            {data.items.map((candidate) => {
              const latest = candidate.applications[0] || null;
              const stage = getCandidateStageMeta(latest?.status, lang);
              return (
                <div key={candidate.id} className="item stack entity-card">
                  <div className="item-top">
                    <div className="stack">
                      <div className="item-title">{candidate.fullName}</div>
                      <div className="muted small">
                        {candidate.email || candidate.phone || c.noValue}
                      </div>
                    </div>
                    <div className="inline">
                      <span className={getToneClass(stage.tone)}>{stage.label}</span>
                      <Link className="button button-secondary" href={`/candidates/${candidate.id}`}>
                        {c.open} <IconArrowRight size={18} />
                      </Link>
                    </div>
                  </div>

                  <div className="detail-list detail-list-compact">
                    <div>
                      <strong>{c.position}:</strong> {latest?.process.positionTitle || c.noValue}
                    </div>
                    <div>
                      <strong>{c.team}:</strong> {latest?.process.team?.name || c.noValue}
                    </div>
                    <div>
                      <strong>{c.owner}:</strong> {latest?.process.manager?.name || c.noValue}
                    </div>
                    <div>
                      <strong>{c.source}:</strong> {candidate.source || c.noValue}
                    </div>
                    <div>
                      <strong>{c.nextAction}:</strong> {latest?.nextAction || c.noValue}
                    </div>
                    <div>
                      <strong>{c.updated}:</strong> {formatDate(latest?.updatedAt, locale)}
                    </div>
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
