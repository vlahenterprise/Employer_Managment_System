import Link from "next/link";
import { redirect } from "next/navigation";
import { LabelWithTooltip } from "@/components/Tooltip";
import { requireActiveUser } from "@/server/current-user";
import { getTalentPool } from "@/server/candidates";
import { getRequestLang } from "@/i18n/server";
import { IconArrowLeft, IconArrowRight, IconSparkles, IconUsers } from "@/components/icons";
import { getCandidateStageMeta } from "@/server/recruiting-presentation";
import { isHrModuleEnabled } from "@/server/features";

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
      listMeta: (start: number, end: number, total: number) => `${start}–${end} od ${total} kandidata`,
      search: "Pretraga",
      searchHint: "Ime, email, telefon, tag, pozicija ili razlog zatvaranja.",
      apply: "Primeni filtere",
      reset: "Resetuj",
      open: "Otvori detalj",
      empty: "Još nema kandidata u talent pool-u.",
      lastRole: "Poslednja pozicija",
      tag: "Tag",
      seniority: "Senioritet",
      language: "Jezik",
      location: "Lokacija",
      skills: "Veštine",
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
    listMeta: (start: number, end: number, total: number) => `${start}–${end} of ${total} candidates`,
    search: "Search",
    searchHint: "Name, email, phone, tag, position, or closing reason.",
    apply: "Apply filters",
    reset: "Reset",
    open: "Open detail",
    empty: "No candidates in the talent pool yet.",
    lastRole: "Latest role",
    tag: "Tag",
    seniority: "Seniority",
    language: "Language",
    location: "Location",
    skills: "Skills",
    reason: "Closing reason",
    stage: "Latest status",
    noValue: "—"
  };
}

function jsonList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

export default async function TalentPoolPage({
  searchParams
}: {
  searchParams: { tag?: string; query?: string; page?: string };
}) {
  if (!isHrModuleEnabled()) {
    redirect("/dashboard");
  }
  const user = await requireActiveUser();
  const lang = getRequestLang();
  const c = copy(lang);
  const pool = await getTalentPool(
    { id: user.id, role: user.role, hrAddon: user.hrAddon },
    {
      tag: searchParams.tag,
      query: searchParams.query,
      pagination: { page: searchParams.page, defaultPageSize: 24 }
    }
  );

  function pageHref(page: number) {
    const params = new URLSearchParams();
    if (searchParams.tag) params.set("tag", searchParams.tag);
    if (searchParams.query) params.set("query", searchParams.query);
    if (page > 1) params.set("page", String(page));
    return `/talent-pool${params.toString() ? `?${params.toString()}` : ""}`;
  }

  if (!pool.ok) {
    return (
      <main className="page">
        <div className="card stack">
          <div className="error">{c.noAccess}</div>
        </div>
      </main>
    );
  }

  const reusableCount = pool.metrics.reusable;
  const taggedCount = pool.metrics.tagged;

  return (
    <main className="page">
      <div className="card stack">
        <div className="page-topbar">
          <div className="page-topbar-main stack">
            <div className="header">
              <div className="brand">
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

        </div>

        <div className="grid3 profile-metrics">
          <div className="item item-compact kpi-card">
            <div className="kpi-icon">
              <IconUsers size={18} />
            </div>
            <div>
              <div className="kpi-value">{pool.metrics.total}</div>
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
              <p className="muted small">
                {pool.meta.total > 0 ? c.listMeta(pool.meta.start, pool.meta.end, pool.meta.total) : c.listHint}
              </p>
            </div>
          </div>

          <form className="grid3" method="get" action="/talent-pool">
            <label className="field">
              <span className="label">
                <LabelWithTooltip label={c.search} tooltip={c.searchHint} />
              </span>
              <input className="input" name="query" type="text" defaultValue={searchParams.query || ""} />
            </label>
            <label className="field">
              <span className="label">{c.tag}</span>
              <input className="input" name="tag" type="text" defaultValue={searchParams.tag || ""} />
            </label>
            <div className="field field-actions">
              <span className="label"> </span>
              <div className="inline">
                <button className="button" type="submit">
                  {c.apply}
                </button>
                {(searchParams.tag || searchParams.query) ? (
                  <Link className="button button-secondary" href="/talent-pool">
                    {c.reset}
                  </Link>
                ) : null}
              </div>
            </div>
          </form>

          <div className="list">
            {pool.items.map((candidate) => {
              const latest = candidate.applications[0] || null;
              const stage = getCandidateStageMeta(latest?.status, lang);
              const skills = jsonList(candidate.skillMarkers);
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
                      <strong>{c.seniority}:</strong> {candidate.seniority || c.noValue}
                    </div>
                    <div>
                      <strong>{c.language}:</strong> {candidate.language || c.noValue}
                    </div>
                    <div>
                      <strong>{c.location}:</strong> {candidate.location || c.noValue}
                    </div>
                    <div>
                      <strong>{c.skills}:</strong> {skills.length ? skills.join(" · ") : c.noValue}
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
          {pool.meta.pageCount > 1 ? (
            <div className="inline" style={{ justifyContent: "space-between" }}>
              <div className="muted small">
                {pool.meta.page} / {pool.meta.pageCount}
              </div>
              <div className="inline">
                {pool.meta.hasPrev ? (
                  <Link className="button button-secondary" href={pageHref(pool.meta.page - 1)} aria-label="Previous page">
                    <IconArrowLeft size={18} />
                  </Link>
                ) : null}
                {pool.meta.hasNext ? (
                  <Link className="button button-secondary" href={pageHref(pool.meta.page + 1)} aria-label="Next page">
                    <span style={{ display: "inline-flex", transform: "rotate(180deg)" }}>
                      <IconArrowLeft size={18} />
                    </span>
                  </Link>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
